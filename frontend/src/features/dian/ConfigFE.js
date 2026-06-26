import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Switch, FormControlLabel,
  Divider, Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, InputAdornment, IconButton, CircularProgress, Alert,
  useTheme, useMediaQuery, Stack, Pagination, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, Card, alpha,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Save, Receipt, CheckCircle, ErrorOutline,
  HourglassEmpty, Refresh, MenuBook, Settings, Gavel, Upgrade, Close, Shield,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api';
import WompiButton from '../../components/common/WompiButton';
import ResolucionesDian from './ResolucionesDian';

const PURPLE = '#8B5CF6';
const fmtCOP = (val) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val ?? 0);

// ─── PlanCardFE — tarjeta de plan dentro del modal ─────────────────────────────
function PlanCardFE({ plan, onSuccess }) {
  const theme = useTheme();
  const ACCENT = '#6366F1';
  const features = plan.caracteristicas?.split(',').map(f => f.trim()).filter(Boolean) || [];
  return (
    <Card elevation={0} sx={{
      borderRadius: 3, p: 2.5, height: '100%', display: 'flex', flexDirection: 'column',
      border: `1.5px solid ${plan.incluye_fe !== false ? alpha('#059669', 0.4) : alpha(theme.palette.divider, 1)}`,
      transition: 'all 0.2s',
      '&:hover': { borderColor: alpha(ACCENT, 0.5), boxShadow: `0 4px 20px ${alpha(ACCENT, 0.1)}` },
    }}>
      <Typography fontSize={12} fontWeight={800} color={ACCENT} textTransform="uppercase" mb={1} letterSpacing={0.8}>
        {plan.nombre}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 1.5 }}>
        <Typography fontWeight={900} fontSize={26}>{fmtCOP(plan.precio)}</Typography>
        <Typography fontSize={13} color="text.secondary">/ {plan.dias_duracion} días</Typography>
      </Box>
      <Box sx={{ flex: 1, mb: 2 }}>
        {features.map((feat, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6 }}>
            <CheckCircle sx={{ fontSize: 13, color: '#059669', flexShrink: 0 }} />
            <Typography fontSize={12.5} color="text.secondary">{feat}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mb: 1.5 }}>
        {plan.incluye_fe !== false ? (
          <Chip
            icon={<CheckCircle sx={{ fontSize: '13px !important', color: '#059669 !important' }} />}
            label="FE incluida" size="small"
            sx={{ bgcolor: alpha('#059669', 0.1), color: '#059669', fontWeight: 700, fontSize: 11, border: `1px solid ${alpha('#059669', 0.3)}`, '& .MuiChip-icon': { ml: '4px' } }}
          />
        ) : (
          <Chip label="Sin FE" size="small"
            sx={{ bgcolor: alpha('#6b7280', 0.1), color: '#6b7280', fontWeight: 700, fontSize: 11, border: `1px solid ${alpha('#6b7280', 0.3)}` }}
          />
        )}
      </Box>
      <WompiButton planName={plan.codigo_interno} onSuccess={onSuccess} />
    </Card>
  );
}

// ─── PlanesDialog — modal con planes disponibles ───────────────────────────────
function PlanesDialog({ open, onClose, planes }) {
  const conFE = planes.filter(p => p.incluye_fe !== false);
  const lista = conFE.length > 0 ? conFE : planes;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Planes con Facturación Electrónica</Typography>
          <Typography variant="body2" color="text.secondary">Elige un plan que incluya FE para emitir facturas ante la DIAN</Typography>
        </Box>
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <DialogContent>
        {lista.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No hay planes disponibles en este momento.
          </Typography>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(lista.length, 3)}, 1fr)` },
            gap: 2, mt: 1,
          }}>
            {lista.map(plan => (
              <PlanCardFE key={plan.id} plan={plan} onSuccess={() => { onClose(); window.location.reload(); }} />
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2.5, mb: 1, color: 'text.disabled' }}>
          <Shield sx={{ fontSize: 14 }} />
          <Typography fontSize={11.5}>Pagos seguros procesados por <strong>Wompi (Bancolombia)</strong></Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ChipEstado({ estado }) {
  if (estado === 'exitoso')   return <Chip label="Exitoso"   size="small" icon={<CheckCircle />}   color="success" />;
  if (estado === 'fallido')   return <Chip label="Fallido"   size="small" icon={<ErrorOutline />}  color="error" />;
  if (estado === 'pendiente') return <Chip label="Pendiente" size="small" icon={<HourglassEmpty />} color="warning" />;
  return <Chip label={estado || '—'} size="small" />;
}

export default function ConfigFE() {
  const theme    = useTheme();
  const isDark   = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [tabValue, setTabValue]   = useState(0);
  const [config, setConfig]       = useState({ facturacion_electronica_activa: false, matias_api_key: '', matias_sandbox_api_key: '', matias_test_mode: true });
  const [intentos, setIntentos]       = useState([]);
  const [intentosTotal, setIntentosTotal] = useState(0);
  const [intentosPages, setIntentosPages] = useState(1);
  const [intentosPage, setIntentosPage]   = useState(1);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [showKey, setShowKey]         = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [loadingIntentos, setLoadingIntentos] = useState(false);
  const [planIncluyeFE, setPlanIncluyeFE] = useState(true);
  const [planes, setPlanes] = useState([]);
  const [planesOpen, setPlanesOpen] = useState(false);
  const [feUsage, setFeUsage] = useState(null);

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

  const fetchSuscripcion = async () => {
    try {
      const r = await apiClient.get('/suscripcion/mi-suscripcion');
      setPlanes(r.data?.planes_disponibles || []);
      const historial = r.data?.historial_pagos || [];
      if (historial.length > 0 && historial[0].plan) {
        setPlanIncluyeFE(historial[0].plan.incluye_fe !== false);
        return;
      }
      // Sin historial de pagos (trial) → permitir FE
      setPlanIncluyeFE(true);
    } catch { /* silencioso — en caso de error, no bloquear */ }
  };

  const fetchIntentos = async (page = 1) => {
    setLoadingIntentos(true);
    try {
      const r = await apiClient.get('/fe/intentos', { params: { page, page_size: 10 } });
      setIntentos(r.data.items);
      setIntentosTotal(r.data.total);
      setIntentosPages(r.data.pages);
      setIntentosPage(page);
    } catch { /* silencioso */ }
    finally { setLoadingIntentos(false); }
  };

  const fetchFeUsage = async () => {
    try {
      const r = await apiClient.get('/fe/uso-documentos-mes');
      setFeUsage(r.data);
    } catch { /* silencioso */ }
  };

  useEffect(() => { fetchConfig(); fetchIntentos(1); fetchSuscripcion(); fetchFeUsage(); }, []);

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

  if (!planIncluyeFE) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Receipt sx={{ color: PURPLE, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Facturación Electrónica</Typography>
            <Typography variant="body2" color="text.secondary">Configuración Matias API — DIAN Colombia</Typography>
          </Box>
        </Box>
        <Paper sx={{
          p: 4, textAlign: 'center',
          border: `2px dashed #F59E0B`,
          borderRadius: 3,
          bgcolor: 'rgba(245,158,11,0.04)',
        }}>
          <Receipt sx={{ fontSize: 56, color: '#F59E0B', mb: 2 }} />
          <Typography variant="h6" fontWeight={700} mb={1}>
            Tu plan actual no incluye Facturación Electrónica
          </Typography>
          <Typography color="text.secondary" mb={3} maxWidth={480} mx="auto">
            Para emitir facturas electrónicas válidas ante la DIAN, necesitas un plan que incluya esta funcionalidad.
            Actualiza tu suscripción para acceder a la configuración completa de FE.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Upgrade />}
            onClick={() => setPlanesOpen(true)}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' }, fontWeight: 700, borderRadius: 2.5, px: 4 }}
          >
            Actualizar plan
          </Button>
        </Paper>
        <PlanesDialog open={planesOpen} onClose={() => setPlanesOpen(false)} planes={planes} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Receipt sx={{ color: PURPLE, fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Facturación Electrónica</Typography>
            <Typography variant="body2" color="text.secondary">Configuración Matias API — DIAN Colombia</Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={<MenuBook />}
          size="small"
          onClick={() => navigate('/admin/facturacion-electronica/guia')}
          sx={{ borderColor: PURPLE, color: PURPLE, '&:hover': { borderColor: '#7C3AED', bgcolor: '#F5F3FF' } }}
        >
          Ver guía de activación
        </Button>
      </Box>

      {/* ── Widget uso de documentos electrónicos ── */}
      {feUsage?.activo && feUsage?.limite != null && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Receipt sx={{ fontSize: 18, color: PURPLE }} />
              <Typography fontWeight={700} fontSize={14}>Documentos electrónicos — mes actual</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography fontSize={22} fontWeight={900}
                color={feUsage.porcentaje >= 100 ? 'error.main' : feUsage.porcentaje >= 80 ? '#F59E0B' : '#10B981'}>
                {feUsage.usados}
              </Typography>
              <Typography fontSize={14} color="text.secondary">/ {feUsage.limite} docs</Typography>
              <Chip
                label={`${feUsage.porcentaje}%`}
                size="small"
                sx={{
                  fontWeight: 800, fontSize: 11, height: 22,
                  bgcolor: feUsage.porcentaje >= 100
                    ? alpha('#EF4444', 0.12)
                    : feUsage.porcentaje >= 80
                      ? alpha('#F59E0B', 0.12)
                      : alpha('#10B981', 0.12),
                  color: feUsage.porcentaje >= 100 ? '#EF4444' : feUsage.porcentaje >= 80 ? '#F59E0B' : '#10B981',
                }}
              />
            </Box>
          </Box>

          {/* Barra de progreso */}
          <Box sx={{ position: 'relative', height: 10, borderRadius: 5, bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <Box sx={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.min(feUsage.porcentaje, 100)}%`,
              borderRadius: 5,
              bgcolor: feUsage.porcentaje >= 100 ? '#EF4444' : feUsage.porcentaje >= 80 ? '#F59E0B' : '#10B981',
              transition: 'width 0.4s ease',
            }} />
          </Box>

          {/* Mensaje de estado */}
          <Box sx={{ mt: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography fontSize={12} color="text.secondary">
              {feUsage.porcentaje >= 100
                ? '🚫 Límite alcanzado. Las nuevas ventas no generarán documento electrónico hasta el próximo mes o al cambiar de plan.'
                : feUsage.porcentaje >= 80
                  ? `⚠ Quedan ${feUsage.limite - feUsage.usados} documentos disponibles este mes.`
                  : `Quedan ${feUsage.limite - feUsage.usados} documentos disponibles este mes.`}
            </Typography>
            {feUsage.porcentaje >= 80 && (
              <Button size="small" variant="outlined" onClick={() => navigate('/mi-suscripcion')}
                sx={{ fontSize: 11, fontWeight: 700, borderRadius: 2, py: 0.3, px: 1.2,
                  borderColor: feUsage.porcentaje >= 100 ? '#EF4444' : '#F59E0B',
                  color: feUsage.porcentaje >= 100 ? '#EF4444' : '#F59E0B',
                }}>
                Actualizar plan
              </Button>
            )}
          </Box>
        </Paper>
      )}

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Configuración" icon={<Settings fontSize="small" />} iconPosition="start" />
        <Tab label="Resoluciones DIAN" icon={<Gavel fontSize="small" />} iconPosition="start" />
        <Tab label="Historial de emisiones" icon={<Receipt fontSize="small" />} iconPosition="start" />
      </Tabs>

      {tabValue === 1 && <ResolucionesDian embedded />}

      {tabValue === 2 && (
      <Paper sx={{ p: { xs: 1.5, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Últimos intentos de emisión</Typography>
            {intentosTotal > 0 && (
              <Typography variant="caption" color="text.secondary">{intentosTotal} registro{intentosTotal !== 1 ? 's' : ''} en total</Typography>
            )}
          </Box>
          <IconButton onClick={() => fetchIntentos(intentosPage)} size="small" disabled={loadingIntentos}>
            {loadingIntentos ? <CircularProgress size={18} /> : <Refresh />}
          </IconButton>
        </Box>

        {intentos.length === 0 ? (
          <Typography color="text.secondary" variant="body2">Aún no hay intentos registrados.</Typography>
        ) : isMobile ? (
          // ── Vista de tarjetas en móvil ──────────────────────────────────
          <Box>
            <Stack spacing={1.5}>
              {intentos.map(i => (
                <Paper key={i.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography fontWeight={700}>Venta #{i.venta_id}</Typography>
                    <ChipEstado estado={i.estado} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {i.timestamp ? new Date(i.timestamp).toLocaleString('es-CO') : '—'}
                  </Typography>
                  {i.cufe && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: 'break-all', mt: 0.5 }}>
                      <strong>CUFE:</strong> {i.cufe}
                    </Typography>
                  )}
                  {i.mensaje && (
                    <Typography variant="body2" sx={{ mt: 0.5, fontSize: 13, wordBreak: 'break-word' }}>
                      {i.mensaje}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
            {intentosPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={intentosPages}
                  page={intentosPage}
                  onChange={(_, p) => fetchIntentos(p)}
                  size="small"
                  color="primary"
                  disabled={loadingIntentos}
                />
              </Box>
            )}
          </Box>
        ) : (
          <Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
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
                      <TableCell sx={{ maxWidth: 320, fontSize: 12, wordBreak: 'break-word' }}>
                        {i.mensaje || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {intentosPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={intentosPages}
                  page={intentosPage}
                  onChange={(_, p) => fetchIntentos(p)}
                  size="small"
                  color="primary"
                  disabled={loadingIntentos}
                />
              </Box>
            )}
          </Box>
        )}
      </Paper>
      )}

      {tabValue === 0 && (
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
      )}
    </Box>
  );
}
