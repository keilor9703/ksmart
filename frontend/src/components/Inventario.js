import React, { useState, useEffect, useMemo } from "react";
import { 
  Box, Paper, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, TextField, TablePagination, useTheme, useMediaQuery,
  Card, CardContent, Divider
} from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import apiClient from "../api";
import { formatCurrency } from "../utils/formatters";
import InventoryPage from "./InventoryPage"; // Reutilizamos la lógica de movimientos

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const getGroupInfo = (id) => {
  const groups = {
    1: { label: 'MP - Materia Prima', color: 'primary' },
    2: { label: 'PT - Producto Terminado', color: 'success' },
    3: { label: 'AF - Activo Fijo', color: 'warning' },
    4: { label: 'INS - Insumo', color: 'default' }
  };
  return groups[id] || { label: 'N/A', color: 'default' };
};

const StockCard = ({ producto }) => {
  const stockActual = producto.stock_actual ?? 0;
  const stockMinimo = producto.stock_minimo ?? 0;
  const low = stockActual < stockMinimo;
  const group = getGroupInfo(producto.grupo_item);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">{producto.nombre}</Typography>
          <Chip label={group.label.split(' ')[0]} color={group.color} size="small" variant="outlined" />
        </Box>
        <Typography color="textSecondary" variant="body2">ID: {producto.id} | Medida: {producto.unidad_medida}</Typography>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip 
            label={`Stock: ${stockActual}`} 
            color={low ? "error" : "success"} 
            variant={low ? "filled" : "outlined"}
            size="small"
          />
          <Typography variant="body2">Costo: {formatCurrency(producto.costo)}</Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" align="right">
          Valorización: <b>{formatCurrency(stockActual * producto.costo)}</b>
        </Typography>
      </CardContent>
    </Card>
  );
};

export default function Inventario() {
  const [tab, setTab] = useState(0);
  const [productos, setProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      const res = await apiClient.get('/productos/');
      setProductos(res.data || []);
    } catch (err) {
      console.error("Error cargando inventario:", err);
    }
  };

  const GRUPOS = [
    { id: 1, label: "Materia Prima (MP)" },
    { id: 2, label: "Producto Terminado (PT)" },
    { id: 3, label: "Activo Fijo (AF)" },
    { id: 4, label: "Insumos (INS)" }
  ];

  const filteredData = useMemo(() => {
    if (tab > 3) return []; // Para la pestaña de movimientos
    const grupoId = GRUPOS[tab].id;
    return productos
      .filter(p => 
        p.grupo_item === grupoId && 
        !p.es_servicio &&
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos, tab, searchTerm]);

  const paginatedData = useMemo(() => {
    return filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Inventory2OutlinedIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" fontWeight="bold">Gestión de Inventarios Vialmar</Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => { setTab(v); setPage(0); }}
          variant="scrollable"
          scrollButtons="auto"
          indicatorColor="primary"
          textColor="primary"
        >
          {GRUPOS.map(g => <Tab key={g.id} label={g.label} />)}
          <Tab label="Movimientos y Ajustes" sx={{ fontWeight: 'bold', color: 'secondary.main' }} />
        </Tabs>
      </Paper>

      {tab <= 3 ? (
        <>
          <TextField
            fullWidth
            variant="outlined"
            label={`Buscar en ${GRUPOS[tab].label}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TabPanel value={tab} index={tab}>
            {isMobile ? (
              <Box>
                {paginatedData.map(p => <StockCard key={p.id} producto={p} />)}
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead sx={{ backgroundColor: theme.palette.action.hover }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Grupo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>U.M.</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Stock Actual</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Costo Unit.</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Valor Total</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedData.map((p) => {
                      const stock = p.stock_actual ?? 0;
                      const low = stock < (p.stock_minimo ?? 0);
                      const group = getGroupInfo(p.grupo_item);
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>{p.id}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{p.nombre}</TableCell>
                          <TableCell>
                            <Chip label={group.label.split(' ')[0]} color={group.color} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{p.unidad_medida}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: low ? 'error.main' : 'inherit' }}>{stock}</TableCell>
                          <TableCell>{formatCurrency(p.costo)}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{formatCurrency(stock * p.costo)}</TableCell>
                          <TableCell>
                            <Chip 
                              label={low ? "Stock Bajo" : "Normal"} 
                              color={low ? "error" : "success"} 
                              size="small" 
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {paginatedData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center">No hay productos en este grupo</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Filas por página:"
            />
          </TabPanel>
        </>
      ) : (
        <InventoryPage />
      )}
    </Box>
  );
}
