// ═══════════════════════════════════════════════════════════════════════════
// ParqueaderoMetodosPago.jsx
// Configuración de métodos de pago (links + QR) + plantillas de WhatsApp.
// Se importa desde ParqueaderoConfig.jsx como sección extra.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, Typography, Stack, Grid, Card, CardContent, CardActions,
  TextField, Button, Chip, IconButton, Tooltip, CircularProgress, Alert,
  Tabs, Tab, MenuItem, InputAdornment, Avatar, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import {
  WhatsApp, Save, QrCode2, Link as LinkIcon, Delete, Upload,
  RestartAlt, EditNote, AttachMoney, EventRepeat, Today, AllInclusive
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';

const ACCENT = '#0891B2';
const WA_GREEN = '#25D366';

// ─── Modalidades disponibles ────────────────────────────────────────────────
const MODALIDADES = [
  { key: 'mensual',   label: 'Mensual',  icon: <EventRepeat />,    color: '#10B981' },
  { key: 'quincenal', label: 'Quincenal', icon: <EventRepeat />,    color: '#3B82F6' },
  { key: 'diaria',    label: 'Diaria',    icon: <Today />,          color: '#F59E0B' },
  { key: 'libre',     label: 'Pago libre', icon: <AllInclusive />,  color: '#8B5CF6' },
];

// ─── Tipos de plantillas ────────────────────────────────────────────────────
const TIPOS_PLANTILLA = [
  {
    key:   'pago',
    label: 'Cobro / Pago',
    desc:  'Para enviar a clientes con saldo pendiente o vencido',
    color: '#10B981',
  },
  {
    key:   'recordatorio',
    label: 'Recordatorio',
    desc:  'Aviso días antes del vencimiento',
    color: '#F59E0B',
  },
  {
    key:   'manual',
    label: 'Manual',
    desc:  'Mensaje genérico para cualquier ocasión',
    color: '#8B5CF6',
  },
  // ✨ NUEVAS PLANTILLAS AGREGADAS AQUÍ ✨
  {
    key:   'comprobante_entrada',
    label: 'Comprobante de Entrada',
    desc:  'Se envía cuando un cliente ocasional (por horas/minutos) ingresa su vehículo',
    color: '#3B82F6', // Azul
  },
  {
    key:   'recibo_salida',
    label: 'Recibo de Salida',
    desc:  'Se envía cuando el cliente ocasional paga y retira su vehículo',
    color: '#EC4899', // Rosa
  },
];

// ─── Variables disponibles en plantillas ────────────────────────────────────
const VARIABLES = [
  { v: '{nombre}',            d: 'Primer nombre del cliente' },
  { v: '{placa}',             d: 'Placa del vehículo' },
  { v: '{parqueadero}',       d: 'Nombre del parqueadero' },
  { v: '{tipo_plan}',         d: 'mensual / quincenal / diaria / ocasional' },
  { v: '{fecha_vence}',       d: 'Fecha de vencimiento legible' },
  { v: '{dias_restantes}',    d: 'Días que faltan para vencer' },
  { v: '{dias_vencido}',      d: 'Días que lleva vencida' },
  { v: '{monto}',             d: 'Valor a pagar formateado' },
  { v: '{saldo}',             d: 'Saldo pendiente' },
  { v: '{saldo_linea}',       d: 'Línea con saldo (solo si > 0)' },
  { v: '{link_pago}',         d: 'Link de pago de la modalidad' },
  { v: '{instrucciones}',     d: 'Instrucciones del método' },
  { v: '{direccion}',         d: 'Dirección del parqueadero' },
  // ✨ NUEVAS VARIABLES AGREGADAS AQUÍ ✨
  { v: '{hora_entrada}',      d: 'Hora a la que ingresó el vehículo' },
  { v: '{tarifa_minuto}',     d: 'Valor de la tarifa por minuto' },
  { v: '{tarifa_hora}',       d: 'Valor de la tarifa por hora' },
  { v: '{cobro_minimo_linea}',d: 'Aviso del cobro mínimo (si aplica)' },
  { v: '{minutos}',           d: 'Total de minutos de estadía' },
  { v: '{metodo_pago}',       d: 'Método usado para pagar la salida' },
];


export default function ParqueaderoMetodosPago() {
  const [tab, setTab] = useState(0);

  return (
    <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ p: 2.5, bgcolor: `${WA_GREEN}10`, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: WA_GREEN, width: 40, height: 40 }}>
            <WhatsApp />
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>
              Cobro por WhatsApp
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              Configura los métodos de pago y los mensajes que se enviarán a los clientes
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Tabs
        value={tab} onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}
      >
        <Tab label="💳 Métodos de pago"  sx={{ fontWeight: 700 }} />
        <Tab label="📝 Plantillas WhatsApp" sx={{ fontWeight: 700 }} />
      </Tabs>

      <Box sx={{ p: 2 }}>
        {tab === 0 && <PanelMetodosPago />}
        {tab === 1 && <PanelPlantillas />}
      </Box>
    </Paper>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// PANEL 1: MÉTODOS DE PAGO
// ═══════════════════════════════════════════════════════════════════════════

function PanelMetodosPago() {
  const [metodos, setMetodos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/parqueadero/metodos-pago');
      setMetodos(data);
    } catch (err) {
      toast.error('No se pudieron cargar los métodos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const findByModalidad = (mod) => metodos.find(m => m.modalidad === mod);

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
        Configura un método (link y/o QR) para cada modalidad. El sistema escogerá automáticamente
        el correcto según el tipo de plan del cliente al enviar el mensaje.
      </Alert>

      <Grid container spacing={2}>
        {MODALIDADES.map(mod => (
          <Grid item xs={12} md={6} key={mod.key}>
            <MetodoCard
              modalidad={mod}
              data={findByModalidad(mod.key)}
              onChange={cargar}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}


function MetodoCard({ modalidad, data, onChange }) {
  const [editing, setEditing]   = useState(false);
  const [nombre, setNombre]     = useState(data?.nombre_metodo || '');
  const [link, setLink]         = useState(data?.link_pago || '');
  const [instr, setInstr]       = useState(data?.instrucciones || '');
  const [qrUri, setQrUri]       = useState(data?.qr_data_uri || null);
  const [qrBase64, setQrBase64] = useState(null);
  const [qrMime, setQrMime]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef(null);

  const startEdit = () => {
    setEditing(true);
    setNombre(data?.nombre_metodo || '');
    setLink(data?.link_pago || '');
    setInstr(data?.instrucciones || '');
    setQrUri(data?.qr_data_uri || null);
    setQrBase64(null);
    setQrMime(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setQrBase64(null);
    setQrMime(null);
  };

  const handleQrFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.warning('La imagen no puede pesar más de 1 MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.warning('El archivo debe ser una imagen.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result;
      const b64 = dataUri.split(',')[1];
      setQrUri(dataUri);
      setQrBase64(b64);
      setQrMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleQuitarQR = () => {
    setQrUri(null);
    setQrBase64(null);
    setQrMime(null);
  };

  const handleGuardar = async () => {
    if (!link && !qrBase64 && !data?.qr_base64) {
      toast.warning('Debes proporcionar al menos un link o un QR.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        modalidad:     modalidad.key,
        nombre_metodo: nombre.trim() || null,
        link_pago:     link.trim() || null,
        instrucciones: instr.trim() || null,
        is_active:     true,
      };
      if (qrBase64) {
        payload.qr_base64    = qrBase64;
        payload.qr_mime_type = qrMime;
      } else if (qrUri === null && data?.qr_base64) {
        payload.qr_base64    = null;
        payload.qr_mime_type = null;
      }
      await apiClient.put('/parqueadero/metodos-pago', payload);
      toast.success(`${modalidad.label}: método guardado.`);
      setEditing(false);
      onChange?.();
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        toast.error('Solo el administrador puede modificar.');
      } else {
        toast.error(err.response?.data?.detail || 'Error al guardar.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async () => {
    if (!window.confirm(`¿Eliminar el método de pago ${modalidad.label}?`)) return;
    try {
      await apiClient.delete(`/parqueadero/metodos-pago/${modalidad.key}`);
      toast.success('Método eliminado.');
      onChange?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar.');
    }
  };

  const tieneAlgo = data?.tiene_link || data?.tiene_qr;

  return (
    <Card sx={{
      borderRadius: 2, height: '100%',
      borderTop: `3px solid ${modalidad.color}`,
    }}>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ bgcolor: `${modalidad.color}20`, color: modalidad.color, width: 32, height: 32 }}>
              {modalidad.icon}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                {modalidad.label}
              </Typography>
              {data?.nombre_metodo && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {data.nombre_metodo}
                </Typography>
              )}
            </Box>
          </Stack>
          <Chip
            size="small"
            label={tieneAlgo ? '✓ Configurado' : 'Sin configurar'}
            sx={{
              fontSize: 10, fontWeight: 700, height: 20,
              bgcolor: tieneAlgo ? '#10B98120' : 'action.hover',
              color:   tieneAlgo ? '#065F46' : 'text.secondary',
            }}
          />
        </Stack>

        {!editing ? (
          <Box sx={{ mt: 2 }}>
            {data?.link_pago && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <LinkIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {data.link_pago.length > 50 ? data.link_pago.slice(0, 50) + '...' : data.link_pago}
                </Typography>
              </Stack>
            )}
            {data?.qr_data_uri && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <QrCode2 sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 11 }}>QR cargado</Typography>
                <Box sx={{ ml: 'auto' }}>
                  <img src={data.qr_data_uri} alt="QR" style={{ width: 40, height: 40, borderRadius: 4 }} />
                </Box>
              </Stack>
            )}
            {!tieneAlgo && (
              <Typography sx={{ fontSize: 11, color: 'text.disabled', fontStyle: 'italic' }}>
                No hay link ni QR configurados aún.
              </Typography>
            )}
          </Box>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              size="small" label="Nombre del método"
              placeholder="Nequi, Bold, Daviplata..."
              value={nombre} onChange={(e) => setNombre(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney fontSize="small" /></InputAdornment> }}
            />
            <TextField
              size="small" label="Link de pago"
              placeholder="https://..."
              value={link} onChange={(e) => setLink(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><LinkIcon fontSize="small" /></InputAdornment> }}
              helperText="Pega aquí el link generado por tu banco/Nequi/Bold"
            />
            <TextField
              size="small" multiline rows={2}
              label="Instrucciones (opcional)"
              placeholder="Ej: 'Verifica el pago al número 300...'"
              value={instr} onChange={(e) => setInstr(e.target.value)}
            />

            <Box sx={{
              p: 1.5, border: '1px dashed', borderColor: 'divider',
              borderRadius: 2, textAlign: 'center',
            }}>
              <input
                ref={fileRef} type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={handleQrFile}
              />
              {qrUri ? (
                <Stack alignItems="center" spacing={1}>
                  <img src={qrUri} alt="QR preview"
                    style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8 }} />
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined"
                      onClick={() => fileRef.current?.click()}>
                      Cambiar
                    </Button>
                    <Button size="small" variant="outlined" color="error"
                      startIcon={<Delete />} onClick={handleQuitarQR}>
                      Quitar
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Button
                  variant="outlined" startIcon={<Upload />}
                  onClick={() => fileRef.current?.click()}
                  sx={{ py: 1 }}
                >
                  Subir imagen del QR
                </Button>
              )}
              <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.5 }}>
                Imagen PNG o JPG, máx. 1 MB
              </Typography>
            </Box>
          </Stack>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, justifyContent: 'flex-end' }}>
        {!editing ? (
          <>
            {tieneAlgo && (
              <Tooltip title="Eliminar método">
                <IconButton size="small" onClick={handleEliminar} sx={{ color: 'error.main' }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Button size="small" startIcon={<EditNote />} onClick={startEdit}
              sx={{ color: ACCENT, fontWeight: 700 }}>
              {tieneAlgo ? 'Editar' : 'Configurar'}
            </Button>
          </>
        ) : (
          <>
            <Button size="small" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
            <Button size="small" variant="contained" onClick={handleGuardar} disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' }, fontWeight: 700 }}>
              Guardar
            </Button>
          </>
        )}
      </CardActions>
    </Card>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// PANEL 2: PLANTILLAS DE WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════

function PanelPlantillas() {
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [variablesOpen, setVariablesOpen] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/parqueadero/plantillas-whatsapp');
      setPlantillas(data);
    } catch (err) {
      toast.error('No se pudieron cargar las plantillas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const findByTipo = (tipo) => plantillas.find(p => p.tipo === tipo);

  if (loading) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
        Personaliza los mensajes que se enviarán a tus clientes.
        Puedes usar <strong>variables</strong> entre llaves para que el sistema las reemplace automáticamente.
        <Button size="small" onClick={() => setVariablesOpen(true)} sx={{ ml: 1, fontSize: 11, py: 0 }}>
          Ver variables disponibles
        </Button>
      </Alert>

      <Stack spacing={2}>
        {TIPOS_PLANTILLA.map(tipo => (
          <PlantillaCard
            key={tipo.key}
            tipo={tipo}
            data={findByTipo(tipo.key)}
            onChange={cargar}
          />
        ))}
      </Stack>

      {/* Diálogo de variables */}
      <Dialog open={variablesOpen} onClose={() => setVariablesOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Variables disponibles</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
            Copia estas variables y pégalas en tus mensajes. El sistema las reemplazará por los datos reales.
          </Typography>
          <Stack spacing={1}>
            {VARIABLES.map(({ v, d }) => (
              <Stack key={v} direction="row" spacing={1} alignItems="center"
                sx={{ p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                <Chip
                  size="small" label={v}
                  onClick={() => {
                    navigator.clipboard.writeText(v);
                    toast.info(`Copiado: ${v}`);
                  }}
                  sx={{
                    fontFamily: 'monospace', fontWeight: 700,
                    bgcolor: ACCENT + '15', color: ACCENT, cursor: 'pointer',
                    '&:hover': { bgcolor: ACCENT + '30' },
                  }}
                />
                <Typography sx={{ fontSize: 12 }}>{d}</Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariablesOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


function PlantillaCard({ tipo, data, onChange }) {
  const [editing, setEditing] = useState(false);
  const [mensaje, setMensaje] = useState(data?.mensaje || '');
  const [saving, setSaving]   = useState(false);

  // Asegurarnos de que el estado local se actualice si la data del backend cambia
  useEffect(() => {
    setMensaje(data?.mensaje || '');
  }, [data]);

  const startEdit = () => {
    setMensaje(data?.mensaje || '');
    setEditing(true);
  };

  const handleGuardar = async () => {
    if (mensaje.trim().length < 10) {
      toast.warning('El mensaje es demasiado corto.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/parqueadero/plantillas-whatsapp/${tipo.key}`, { mensaje });
      toast.success('Plantilla actualizada.');
      setEditing(false);
      onChange?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurar = async () => {
    if (!window.confirm('¿Restaurar el mensaje al texto por defecto?')) return;
    try {
      await apiClient.post(`/parqueadero/plantillas-whatsapp/${tipo.key}/restaurar`);
      toast.success('Plantilla restaurada al default.');
      onChange?.();
      setEditing(false);
    } catch (err) {
      toast.error('Error al restaurar.');
    }
  };

  return (
    <Card sx={{ borderRadius: 2, borderLeft: `4px solid ${tipo.color}` }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{tipo.label}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{tipo.desc}</Typography>
          </Box>
          {!editing ? (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Restaurar default">
                <IconButton size="small" onClick={handleRestaurar}>
                  <RestartAlt fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button size="small" startIcon={<EditNote />} onClick={startEdit}
                sx={{ color: ACCENT, fontWeight: 700 }}>
                Editar
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="small" variant="contained" onClick={handleGuardar} disabled={saving}
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#0e7490' }, fontWeight: 700 }}>
                Guardar
              </Button>
            </Stack>
          )}
        </Stack>

        {!editing ? (
          <Box sx={{
            p: 1.5, bgcolor: 'background.default', borderRadius: 1,
            fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap',
            color: 'text.secondary', maxHeight: 200, overflow: 'auto',
          }}>
            {data?.mensaje || '(sin contenido)'}
          </Box>
        ) : (
          <TextField
            fullWidth multiline minRows={6} maxRows={20}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'monospace', fontSize: 13,
              },
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}