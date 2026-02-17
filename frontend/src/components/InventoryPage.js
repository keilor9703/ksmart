import React, { useEffect, useState } from 'react';
import {
  Paper, Box, Typography, Grid, TextField, Button, MenuItem, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, Alert, Stack,
  Card, CardContent, CardActions, useMediaQuery, TablePagination, Accordion,AccordionSummary,AccordionDetails
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { fetchMovements, createMovement, fetchLowStockAlerts } from '../api';
import apiClient from '../api';
import Autocomplete from '@mui/material/Autocomplete';

import ExpandMore from "@mui/icons-material/ExpandMore";
import BulkUpload from './BulkUpload'; 

const formatDate = (dateString) => {
  if (!dateString) {
    return '—';
  }
  // Append 'Z' to assume UTC if no timezone is specified
  const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
  return date.toLocaleString();
};


/* ---------------------- Banner de stock bajo (tema-aware) ---------------------- */
const LowStockBanner = () => {
  const [items, setItems] = useState([]);
  const theme = useTheme();

  const load = async () => {
    try {
      const { data } = await fetchLowStockAlerts();
      setItems(data || []);
    } catch {
      setItems([]);
    }
  };
  useEffect(() => { load(); }, []);

  if (!items.length) return null;

  return (
    <Alert
      severity="warning"
      icon={false}
      variant="standard"
      sx={{
        mb: 2,
        borderRadius: 2,
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.warning.main, 0.12)
            : alpha(theme.palette.warning.light, 0.25),
        color: theme.palette.text.primary,
        '& .MuiAlert-message': { width: '100%' },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography fontWeight={600}>Productos con stock bajo</Typography>
        {items.map((i) => (
          <Chip
            key={i.producto_id}
            label={`${i.nombre} (${i.stock_actual}/${i.stock_minimo})`}
            color="warning"
            size="small"
          />
        ))}
      </Stack>
    </Alert>
  );
};

/* ----------------------------- Formulario movimiento ----------------------------- */
const MovementForm = ({ onCreated }) => {
  const [productos, setProductos] = useState([]);
  const [productoSel, setProductoSel] = useState(null);
  const [productoInput, setProductoInput] = useState('');

  const [form, setForm] = useState({
    tipo: 'ajuste',
    cantidad: '',
    motivo: '',
    referencia: '',
    observacion: '',
  });
  const [saving, setSaving] = useState(false);

  // Carga productos para buscar por nombre o ID
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/productos/');
        setProductos(res.data || []);
      } catch {
        setProductos([]);
      }
    })();
  }, []);

  const handleChange = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!productoSel || !form.tipo || !form.cantidad || Number(form.cantidad) <= 0) {
      toast.warning('Debes completar: Producto, Tipo y Cantidad (mayor a 0).');
      return;
    }
    setSaving(true);
    try {
      await createMovement({
        producto_id: productoSel.id,
        tipo: form.tipo,
        cantidad: Number(form.cantidad),
        motivo: form.motivo || '',
        referencia: form.referencia || '',
        observacion: form.observacion || '',
      });
      toast.success('Movimiento registrado');
      setProductoSel(null);
      setProductoInput('');
      setForm({ tipo: 'ajuste', cantidad: '', motivo: '', referencia: '', observacion: '' });
      onCreated && onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo registrar el movimiento.');
    } finally {
      setSaving(false);
    }
  };


return (
  <Accordion
    // defaultExpanded
    sx={{
      mb: 2,
      borderRadius: 2,
      boxShadow: 2,
      overflow: "hidden",
      "&:before": { display: "none" }
    }}
  >
    <AccordionSummary
      expandIcon={<ExpandMore />}
      sx={{ minHeight: 48, "& .MuiAccordionSummary-content": { margin: 0 } }}
    >
      <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
        Crear Movimiento
      </Typography>
    </AccordionSummary>

    <AccordionDetails>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {/* Producto (ancho) */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            options={productos}
            value={productoSel}
            onChange={(_, v) => setProductoSel(v)}
            inputValue={productoInput}
            onInputChange={(_, v) => setProductoInput(v)}
            getOptionLabel={(opt) =>
              opt ? `${opt.nombre} (ID: ${opt.id})` : ""
            }
            filterOptions={(opts, state) => {
              const q = (state.inputValue || "").toLowerCase().trim();
              if (!q) return opts;
              return opts.filter(
                (o) =>
                  o.nombre.toLowerCase().includes(q) ||
                  String(o.id).includes(q)
              );
            }}
            fullWidth
            sx={{ minWidth: { xs: "100%", md: 360 } }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Producto (busca por nombre o ID)"
                fullWidth
              />
            )}
          />
        </Grid>

        {/* Tipo */}
        <Grid item xs={12} md={2}>
          <TextField
            select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => handleChange("tipo", e.target.value)}
            fullWidth
          >
            <MenuItem value="entrada">Entrada</MenuItem>
            <MenuItem value="salida">Salida</MenuItem>
            <MenuItem value="ajuste">Ajuste</MenuItem>
          </TextField>
        </Grid>

        {/* Cantidad */}
        <Grid item xs={12} md={2}>
          <TextField
            label="Cantidad"
            type="number"
            value={form.cantidad}
            onChange={(e) => handleChange("cantidad", e.target.value)}
            inputProps={{ min: 0, step: "any" }}
            fullWidth
          />
        </Grid>

        {/* Motivo */}
        <Grid item xs={12} md={2}>
          <TextField
            label="Motivo"
            value={form.motivo}
            onChange={(e) => handleChange("motivo", e.target.value)}
            fullWidth
          />
        </Grid>

        {/* Segunda fila */}
        <Grid item xs={12} md={4}>
          <TextField
            label="Referencia"
            value={form.referencia}
            onChange={(e) => handleChange("referencia", e.target.value)}
            fullWidth
          />
        </Grid>

        <Grid item xs={12} md={8}>
          <TextField
            label="Observación"
            value={form.observacion}
            onChange={(e) => handleChange("observacion", e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Grid>
      </Grid>

      <Box sx={{ textAlign: "right", mt: 2 }}>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </Box>
    </AccordionDetails>
  </Accordion>
);

};

/* --------- Tarjeta para móviles (renderiza un movimiento en formato card) --------- */
const MovementCard = ({ row }) => {
  const chipColor =
    row.tipo === 'entrada' ? 'success' : row.tipo === 'salida' ? 'error' : 'warning';

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600}>
          {row.producto?.nombre ?? `#${row.producto_id}`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Chip size="small" label={row.tipo} color={chipColor} />
          <Typography variant="body2">Cant.: <b>{row.cantidad}</b></Typography>
          <Typography variant="body2">Ref.: {row.referencia || '—'}</Typography>
        </Box>
        <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
          Motivo: {row.motivo || '—'}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }} color="text.secondary">
          {formatDate(row.created_at)}
        </Typography>
      </CardContent>
      <CardActions />
    </Card>
  );
};

/* --------------------------------- Lista / Tabla con paginación --------------------------------- */
const MovementsTable = () => {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const load = async () => {
    const { data } = await fetchMovements({ limit: 500 }); // traemos varios y paginamos en cliente
    setRows(data || []);
  };

  useEffect(() => { load(); }, []);

  // Paginar en cliente
  // const start = page * rowsPerPage;
  // const end = start + rowsPerPage;
  // const paginated = rows.slice(start, end);

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // ⬆️ asegúrate de tener estos estados arriba del return
const [searchTerm, setSearchTerm] = useState("");

// Filtrar movimientos según búsqueda (producto, tipo, motivo, referencia)
  const filteredRows = rows.filter((r) => {
    const query = searchTerm.toLowerCase();
    return (
      r.id.toString().includes(query) ||
      r.producto?.nombre?.toLowerCase().includes(query) ||
      (r.tipo && r.tipo.toLowerCase().includes(query)) ||
      (r.motivo && r.motivo.toLowerCase().includes(query)) ||
      (r.referencia && r.referencia.toLowerCase().includes(query))
    );
  });

// Aplica paginación sobre los filtrados
const paginated = filteredRows.slice(
  page * rowsPerPage,
  page * rowsPerPage + rowsPerPage
);

return (
  <Paper sx={{ p: 2 }}>
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        mb: 2
      }}
    >
      <Typography variant="h6">Movimientos recientes</Typography>
    </Box>

    {/* 🔎 Campo de búsqueda */}
    <TextField
      label="Buscar Movimiento"
      variant="outlined"
      fullWidth
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      sx={{ mb: 2 }}
    />

    {isMobile ? (
      <Box sx={{ mt: 1 }}>
        {paginated.map((r) => (
          <MovementCard key={r.id} row={r} />
        ))}
      </Box>
    ) : (
      <Table size="small" sx={{ mt: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Producto</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Cantidad</TableCell>
            <TableCell>Motivo</TableCell>
            <TableCell>Referencia</TableCell>
            <TableCell>Fecha</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginated.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.id}</TableCell>
              <TableCell>{r.producto?.nombre ?? `#${r.producto_id}`}</TableCell>
              <TableCell>
                <Chip
                  label={r.tipo}
                  color={
                    r.tipo === "entrada"
                      ? "success"
                      : r.tipo === "salida"
                      ? "error"
                      : "warning"
                  }
                  size="small"
                />
              </TableCell>
              <TableCell>{r.cantidad}</TableCell>
              <TableCell>{r.motivo || "-"}</TableCell>
              <TableCell>{r.referencia || "-"}</TableCell>
              <TableCell>
                {formatDate(r.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}

    {/* 📌 Paginador con count de los filtrados */}
    <TablePagination
      rowsPerPageOptions={[5, 10, 25, 50]}
      component="div"
      count={filteredRows.length}
      rowsPerPage={rowsPerPage}
      page={page}
      onPageChange={handleChangePage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      labelRowsPerPage="Filas por página:"
      labelDisplayedRows={({ from, to, count }) =>
        `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
      }
    />
  </Paper>
);
};

/* ------------------------------ Página wrapper ------------------------------ */


export default function InventoryPage() {
  const [refresh, setRefresh] = useState(0);

  const handleRefresh = () => setRefresh((x) => x + 1);

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <LowStockBanner />

      {/* Acordeón para crear movimiento manual */}
      <MovementForm onCreated={handleRefresh} />

      {/* ⬇️ Nuevo acordeón para carga masiva */}
      <Accordion
        sx={{
          mb: 2,
          borderRadius: 2,
          boxShadow: 2,
          overflow: "hidden",
          "&:before": { display: "none" }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore />}
          sx={{ minHeight: 48, "& .MuiAccordionSummary-content": { margin: 0 } }}
        >
          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
            Carga Masiva de Movimientos
          </Typography>
        </AccordionSummary>

        <AccordionDetails>
          <BulkUpload uploadType="movimientos" onUploadSuccess={handleRefresh} />
        </AccordionDetails>
      </Accordion>

      {/* Tabla de movimientos recientes */}
      <MovementsTable key={refresh} />
    </Box>
  );
}

