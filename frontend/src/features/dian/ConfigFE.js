import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Switch, FormControlLabel,
  Divider, Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, InputAdornment, IconButton, CircularProgress, Alert,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Save, Receipt, CheckCircle, ErrorOutline,
  HourglassEmpty, Refresh,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';

const PURPLE = '#8B5CF6';

function ChipEstado({ estado }) {
  if (estado === 'exitoso')   return <Chip label="Exitoso"   size="small" icon={<CheckCircle />}   color="success" />;
  if (estado === 'fallido')   return <Chip label="Fallido"   size="small" icon={<ErrorOutline />}  color="error" />;
  if (estado === 'pendiente') return <Chip label="Pendiente" size="small" icon={<HourglassEmpty />} color="warning" />;
  return <Chip label={estado || '—'} size="small" />;
}

export default function ConfigFE() {
  const [config, setConfig]       = useState({ facturacion_electronica_activa: false, matias_api_key: '', matias_sandbox_api_key: '', matias_test_mode: true });
  const [intentos, setIntentos]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showKey, setShowKey]     = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [loadingIntentos, setLoadingIntentos] = useState(false);

  const fetchConfig = async () => {
    try {
      const r = await apiClient.get('/empresa/config-fe');
      setConfig({
        ...r.data,
        matias_api_key:         r.data.matias_api_key         || '',
        matias_sandbox_api_key: r.data.matias_sandbox_api_key || '',
      });
    } catch { toast.error('Error cargando configuración FE'); }
    finally { setLoading(false); }
  };

  const fetchIntentos = async () => {
    setLoadingIntentos(true);
    try {
      const r = await apiClient.get('/fe/intentos');
      setIntentos(r.data);
    } catch { /* silencioso */ }
    finally { setLoadingIntentos(false); }
  };

  useEffect(() => { fetchConfig(); fetchIntentos(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/empresa/config-fe', config);
      toast.success('Configuración FE guardada');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error guardando configuración');
    } finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Receipt sx={{ color: PURPLE, fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Facturación Electrónica</Typography>
          <Typography variant="body2" color="text.secondary">Configuración Matias API — DIAN Colombia</Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>Configuración de conexión</Typography>

        <FormControlLabel
          control={
            <Switch
              checked={config.facturacion_electronica_activa}
              onChange={e => setConfig(c => ({ ...c, facturacion_electronica_activa: e.target.checked }))}
              color="success"
            />
          }
          label={
            <Box>
              <Typography fontWeight={600}>Facturación Electrónica activa</Typography>
              <Typography variant="caption" color="text.secondary">
                Al activar, las ventas emitirán FE automáticamente al guardar
              </Typography>
            </Box>
          }
          sx={{ mb: 2, alignItems: 'flex-start' }}
        />

        <Divider sx={{ my: 2 }} />

        <FormControlLabel
          control={
            <Switch
              checked={config.matias_test_mode}
              onChange={e => setConfig(c => ({ ...c, matias_test_mode: e.target.checked }))}
              color="warning"
            />
          }
          label={
            <Box>
              <Typography fontWeight={600}>Modo Sandbox (pruebas)</Typography>
              <Typography variant="caption" color="text.secondary">
                Desactivar solo cuando tengas el certificado digital DIAN en producción
              </Typography>
            </Box>
          }
          sx={{ mb: 2, alignItems: 'flex-start' }}
        />

        {config.matias_test_mode ? (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Modo sandbox activo — las facturas no son válidas ante la DIAN. Usa el token de <strong>sandbox-auth.matias-api.com</strong>
            </Alert>
            <TextField
              fullWidth
              label="Token Sandbox (sandbox-auth.matias-api.com)"
              value={config.matias_sandbox_api_key}
              onChange={e => setConfig(c => ({ ...c, matias_sandbox_api_key: e.target.value }))}
              type={showSandboxKey ? 'text' : 'password'}
              multiline={showSandboxKey}
              rows={showSandboxKey ? 4 : 1}
              sx={{ mb: 2 }}
              helperText="Genera este token en el panel sandbox de Matias (es diferente al de producción)"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowSandboxKey(s => !s)} edge="end">
                      {showSandboxKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Modo producción — las facturas se reportan a la DIAN. Requiere certificado digital válido.
            </Alert>
            <TextField
              fullWidth
              label="Token Producción (auth-v2.matias-api.com)"
              value={config.matias_api_key}
              onChange={e => setConfig(c => ({ ...c, matias_api_key: e.target.value }))}
              type={showKey ? 'text' : 'password'}
              multiline={showKey}
              rows={showKey ? 4 : 1}
              sx={{ mb: 2 }}
              helperText="Token JWT obtenido en el panel de producción de Matias API"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowKey(s => !s)} edge="end">
                      {showKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        )}

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving}
          sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7C3AED' } }}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Últimos intentos de emisión</Typography>
          <IconButton onClick={fetchIntentos} size="small" disabled={loadingIntentos}>
            {loadingIntentos ? <CircularProgress size={18} /> : <Refresh />}
          </IconButton>
        </Box>

        {intentos.length === 0 ? (
          <Typography color="text.secondary" variant="body2">Aún no hay intentos registrados.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Venta</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>CUFE</TableCell>
                  <TableCell>Mensaje</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {intentos.map(i => (
                  <TableRow key={i.id}>
                    <TableCell>#{i.venta_id}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {i.timestamp ? new Date(i.timestamp).toLocaleString('es-CO') : '—'}
                    </TableCell>
                    <TableCell><ChipEstado estado={i.estado} /></TableCell>
                    <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={i.cufe}>{i.cufe ? `${i.cufe.slice(0, 16)}…` : '—'}</span>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={i.mensaje}>{i.mensaje || '—'}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
