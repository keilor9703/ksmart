import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Grid, Button, Switch,
  FormControlLabel, CircularProgress, Divider, Chip, Alert, MenuItem, InputAdornment,
} from '@mui/material';
import {
  Save, Storefront, ReceiptLong, VpnKey, Verified, Science, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../../api';

const ACCENT = '#0891B2';

const SectionTitle = ({ icon, title, subtitle }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
    <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${ACCENT}15`, color: ACCENT }}>
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{subtitle}</Typography>}
    </Box>
  </Box>
);

export default function PlataformaConfigForm() {
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [showProd, setShowProd]       = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  // Las API keys se manejan aparte: vacío = no tocar; valor = sobrescribir
  const [prodKey, setProdKey]       = useState('');
  const [sandboxKey, setSandboxKey] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    apiClient.get('/superadmin/plataforma-config')
      .then(r => setCfg(r.data))
      .catch(() => toast.error('No se pudo cargar la configuración de la plataforma.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (campo, valor) => setCfg(prev => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    setSaving(true);
    try {
      const payload = { ...cfg };
      // No reenviar campos de solo-lectura/derivados
      delete payload.matias_api_key_set;
      delete payload.matias_api_key_preview;
      delete payload.matias_sandbox_api_key_set;
      delete payload.matias_sandbox_api_key_preview;
      // API keys: solo enviar si el usuario escribió una nueva
      if (prodKey.trim())    payload.matias_api_key = prodKey.trim();
      if (sandboxKey.trim()) payload.matias_sandbox_api_key = sandboxKey.trim();

      const r = await apiClient.put('/superadmin/plataforma-config', payload);
      setCfg(r.data);
      setProdKey(''); setSandboxKey('');
      toast.success('Configuración de la plataforma guardada.');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !cfg) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  }

  const feActiva = !!cfg.facturacion_electronica_activa;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>Datos del dueño del sistema (facturador)</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          Esta es la empresa que percibe los ingresos por suscripciones y que emite la factura
          electrónica a cada cliente que paga. Es independiente de las empresas clientes del sistema.
          Si vendes la plataforma, solo actualizas estos datos.
        </Typography>
      </Box>

      {/* ── Datos fiscales ── */}
      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <SectionTitle icon={<Storefront fontSize="small" />} title="Identificación fiscal" subtitle="Razón social y NIT del facturador" />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField label="Razón social" fullWidth size="small" value={cfg.nombre_empresa || ''} onChange={e => set('nombre_empresa', e.target.value)} placeholder="Ej: Teck Stack Colombia S.A.S." />
          </Grid>
          <Grid item xs={8} md={4}>
            <TextField label="NIT" fullWidth size="small" value={cfg.nit || ''} onChange={e => set('nit', e.target.value)} />
          </Grid>
          <Grid item xs={4} md={2}>
            <TextField label="DV" fullWidth size="small" value={cfg.dv || ''} onChange={e => set('dv', e.target.value)} inputProps={{ maxLength: 1 }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select label="Tipo de organización" fullWidth size="small" value={cfg.tipo_organizacion_id || 1} onChange={e => set('tipo_organizacion_id', Number(e.target.value))}>
              <MenuItem value={1}>Persona jurídica</MenuItem>
              <MenuItem value={2}>Persona natural</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select label="Régimen" fullWidth size="small" value={cfg.tipo_regimen_id || 48} onChange={e => set('tipo_regimen_id', Number(e.target.value))}>
              <MenuItem value={48}>Responsable de IVA</MenuItem>
              <MenuItem value={49}>No responsable de IVA</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Responsabilidad fiscal (códigos)" fullWidth size="small" value={cfg.responsabilidad_fiscal_codes || ''} onChange={e => set('responsabilidad_fiscal_codes', e.target.value)} placeholder="O-13, O-15" />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Correo de facturación" fullWidth size="small" value={cfg.correo_facturacion || ''} onChange={e => set('correo_facturacion', e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField label="Cód. departamento" fullWidth size="small" value={cfg.departamento_code || ''} onChange={e => set('departamento_code', e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField label="Cód. ciudad" fullWidth size="small" value={cfg.ciudad_code || ''} onChange={e => set('ciudad_code', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Teléfono" fullWidth size="small" value={cfg.telefono || ''} onChange={e => set('telefono', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Dirección" fullWidth size="small" value={cfg.direccion || ''} onChange={e => set('direccion', e.target.value)} />
          </Grid>
        </Grid>
      </Paper>

      {/* ── Integración Matías ── */}
      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <SectionTitle icon={<VpnKey fontSize="small" />} title="Integración Matías (DIAN)" subtitle="Credenciales con las que facturas las suscripciones" />

        <FormControlLabel
          control={<Switch checked={feActiva} onChange={e => set('facturacion_electronica_activa', e.target.checked)} sx={{ '& .Mui-checked': { color: ACCENT } }} />}
          label={<Typography sx={{ fontWeight: 700, fontSize: 13 }}>Facturar electrónicamente las suscripciones</Typography>}
          sx={{ mb: 1 }}
        />

        {feActiva && (
          <>
            <FormControlLabel
              control={<Switch checked={!!cfg.matias_test_mode} onChange={e => set('matias_test_mode', e.target.checked)} color="warning" />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  {cfg.matias_test_mode ? <Science fontSize="small" color="warning" /> : <Verified fontSize="small" color="success" />}
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    {cfg.matias_test_mode ? 'Modo pruebas (sandbox)' : 'Modo producción (facturas reales DIAN)'}
                  </Typography>
                </Box>
              }
              sx={{ mb: 2, display: 'block' }}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Token producción Matías" fullWidth size="small"
                  type={showProd ? 'text' : 'password'}
                  value={prodKey}
                  onChange={e => setProdKey(e.target.value)}
                  placeholder={cfg.matias_api_key_set ? cfg.matias_api_key_preview : 'Pega el token de producción'}
                  helperText={cfg.matias_api_key_set ? 'Ya hay un token guardado. Deja vacío para conservarlo.' : 'Sin configurar'}
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" onClick={() => setShowProd(s => !s)} sx={{ minWidth: 0 }}>
                        {showProd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </Button>
                    </InputAdornment>
                  ) }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Token sandbox Matías" fullWidth size="small"
                  type={showSandbox ? 'text' : 'password'}
                  value={sandboxKey}
                  onChange={e => setSandboxKey(e.target.value)}
                  placeholder={cfg.matias_sandbox_api_key_set ? cfg.matias_sandbox_api_key_preview : 'Pega el token de sandbox'}
                  helperText={cfg.matias_sandbox_api_key_set ? 'Ya hay un token guardado. Deja vacío para conservarlo.' : 'Sin configurar'}
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" onClick={() => setShowSandbox(s => !s)} sx={{ minWidth: 0 }}>
                        {showSandbox ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </Button>
                    </InputAdornment>
                  ) }}
                />
              </Grid>
            </Grid>
          </>
        )}
      </Paper>

      {/* ── Resolución DIAN ── */}
      {feActiva && (
        <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <SectionTitle icon={<ReceiptLong fontSize="small" />} title="Resolución DIAN de la plataforma" subtitle="Numeración para las facturas de suscripción" />
          {!cfg.resolucion_numero && (
            <Alert severity="warning" sx={{ mb: 2, fontSize: 12.5 }}>
              Sin resolución configurada no se emitirán facturas electrónicas de suscripción.
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <TextField label="Prefijo" fullWidth size="small" value={cfg.resolucion_prefijo || ''} onChange={e => set('resolucion_prefijo', e.target.value)} placeholder="Ej: SETP" />
            </Grid>
            <Grid item xs={6} md={5}>
              <TextField label="N° resolución DIAN" fullWidth size="small" value={cfg.resolucion_numero || ''} onChange={e => set('resolucion_numero', e.target.value)} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField label="Clave técnica" fullWidth size="small" value={cfg.resolucion_clave_tecnica || ''} onChange={e => set('resolucion_clave_tecnica', e.target.value)} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="N° inicial" type="number" fullWidth size="small" value={cfg.resolucion_numero_inicial ?? ''} onChange={e => set('resolucion_numero_inicial', Number(e.target.value))} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="N° final" type="number" fullWidth size="small" value={cfg.resolucion_numero_final ?? ''} onChange={e => set('resolucion_numero_final', Number(e.target.value))} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Último asignado" type="number" fullWidth size="small" value={cfg.resolucion_numero_actual ?? ''} onChange={e => set('resolucion_numero_actual', Number(e.target.value))} helperText="Auto-incrementa" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Vigencia desde" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={cfg.resolucion_vigencia_desde ? String(cfg.resolucion_vigencia_desde).slice(0, 10) : ''} onChange={e => set('resolucion_vigencia_desde', e.target.value)} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Vigencia hasta" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={cfg.resolucion_vigencia_hasta ? String(cfg.resolucion_vigencia_hasta).slice(0, 10) : ''} onChange={e => set('resolucion_vigencia_hasta', e.target.value)} />
            </Grid>
          </Grid>
        </Paper>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button onClick={cargar} disabled={saving} sx={{ fontWeight: 700, borderRadius: 2 }}>Descartar</Button>
        <Button
          variant="contained" onClick={guardar} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e5551c' }, fontWeight: 800, borderRadius: 2, px: 3 }}
        >
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </Box>
    </Box>
  );
}
