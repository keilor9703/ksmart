import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Table, TableBody, TableCell,
  TableHead, TableRow, Avatar, Tabs, Tab,
} from '@mui/material';
import { DirectionsCar, TwoWheeler } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const TallerVehiculos = () => {
  const [origen, setOrigen] = useState('todos');
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/taller/vehiculos', { params: origen !== 'todos' ? { origen } : {} })
      .then((r) => setVehiculos(r.data || []))
      .catch(() => toast.error('No se pudieron cargar los vehículos'))
      .finally(() => setLoading(false));
  }, [origen]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Vehículos del Taller</Typography>

      <Tabs value={origen} onChange={(_, v) => setOrigen(v)} sx={{ mb: 2 }}>
        <Tab value="todos" label="Todos" />
        <Tab value="cliente" label="De clientes" />
        <Tab value="compra_reventa" label="Para reventa" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Placa</TableCell>
              <TableCell>Vehículo</TableCell>
              <TableCell>Origen</TableCell>
              <TableCell>Dueño</TableCell>
              <TableCell>Ingreso</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vehiculos.map((v) => (
              <TableRow key={v.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: alpha('#EA580C', 0.12), color: '#EA580C' }}>
                      {v.tipo === 'moto' ? <TwoWheeler sx={{ fontSize: 15 }} /> : <DirectionsCar sx={{ fontSize: 15 }} />}
                    </Avatar>
                    <Typography fontWeight={700} fontSize={13}>{v.placa}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontSize: 12.5 }}>{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={v.origen === 'compra_reventa' ? 'Reventa' : 'Cliente'}
                    sx={{
                      fontSize: 10.5, fontWeight: 700,
                      bgcolor: v.origen === 'compra_reventa' ? alpha('#7C3AED', 0.12) : alpha('#2563EB', 0.12),
                      color: v.origen === 'compra_reventa' ? '#7C3AED' : '#2563EB',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: 12.5 }}>{v.cliente_nombre || '—'}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{v.created_at ? new Date(v.created_at).toLocaleDateString('es-CO') : '—'}</TableCell>
              </TableRow>
            ))}
            {!vehiculos.length && (
              <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.disabled', py: 4 }}>Sin vehículos registrados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default TallerVehiculos;
