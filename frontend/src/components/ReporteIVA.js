import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, TextField, Button, Divider, Table, TableHead, TableRow, TableCell, TableBody, TableContainer } from '@mui/material';
import { Assessment, DateRange } from '@mui/icons-material';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';

const ReporteIVA = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await apiClient.get('/reportes/iva-neto', { params });
      setData(res.data);
    } catch (error) {
      toast.error("Error al generar el reporte tributario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Assessment sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h5" fontWeight="bold">Reporte Tributario (IVA Neto)</Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth label="Desde" type="date"
              value={startDate} onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth label="Hasta" type="date"
              value={endDate} onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button 
              variant="contained" 
              fullWidth 
              startIcon={<DateRange />} 
              onClick={fetchReport}
              disabled={loading}
            >
              {loading ? "Generando..." : "Filtrar Periodo"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {data && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
              <Typography variant="subtitle1">IVA Generado (Ventas)</Typography>
              <Typography variant="h4">{formatCurrency(data.iva_generado_ventas)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.light', color: 'white' }}>
              <Typography variant="subtitle1">IVA Descontable (Compras)</Typography>
              <Typography variant="h4">{formatCurrency(data.iva_descontable_compras)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: data.iva_neto_resultado >= 0 ? 'error.light' : 'info.light', color: 'white' }}>
              <Typography variant="subtitle1">IVA Neto a {data.iva_neto_resultado >= 0 ? 'Pagar' : 'Favor'}</Typography>
              <Typography variant="h4">{formatCurrency(Math.abs(data.iva_neto_resultado))}</Typography>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Concepto</TableCell>
                    <TableCell align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Ventas Totales (Bruto - Recaudado)</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>{formatCurrency(data.ventas_brutas)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Base Gravable Ventas (Valor Real Mercancía)</TableCell>
                    <TableCell align="right">{formatCurrency(data.base_gravable_ventas)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total IVA Generado (A pagar al fisco)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.iva_generado_ventas)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total IVA Descontable (A favor por compras)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.iva_descontable_compras)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ReporteIVA;
