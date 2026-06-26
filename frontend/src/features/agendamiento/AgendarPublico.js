import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Chip, CircularProgress, Stack, Avatar,
  TextField, Stepper, Step, StepLabel, Grid, Divider, Tooltip, Fade, Alert,
} from '@mui/material';
import {
  EventNote, Schedule, AccessTime, CheckCircle, ArrowBack, ArrowForward,
  Person, Engineering, EventAvailable, Spa, AttachMoney, WhatsApp,
} from '@mui/icons-material';
import {
  fetchAgendamientoPublico, fetchDisponibilidadPublica, crearCitaPublica,
} from '../../api';
import apiClient from '../../api';

const TEAL = '#0D9488';
const imgSrc = (slug, id, idx = 0) =>
  `${apiClient.defaults.baseURL}/catalogo/${slug}/productos/${id}/imagen?index=${idx}`;
const TEAL_DARK = '#0F766E';

const pad = n => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtFecha = (iso) => new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

const PASOS = ['Servicio', 'Fecha y hora', 'Tus datos', 'Listo'];

export default function AgendarPublico() {
  const { slug } = useParams();
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [step, setStep]       = useState(0);

  // Selección
  const [servicio, setServicio] = useState(null);
  const [fecha, setFecha]       = useState(toYMD(new Date()));
  const [franjas, setFranjas]   = useState([]);
  const [loadingFranjas, setLoadingFranjas] = useState(false);
  const [slot, setSlot]         = useState(null);

  const [nombre, setNombre]     = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail]       = useState('');
  const [notas, setNotas]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [citaOk, setCitaOk]     = useState(null);

  useEffect(() => {
    if (!slug) { setLoading(false); setError('Página no encontrada.'); return; }
    (async () => {
      try {
        const { data } = await fetchAgendamientoPublico(slug);
        setInfo(data);
      } catch (e) {
        setError(e?.response?.status === 404
          ? 'Esta página de agendamiento no existe.'
          : 'No se pudo cargar la página. Intenta más tarde.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const cargarFranjas = useCallback(async () => {
    if (!servicio || !fecha) return;
    setLoadingFranjas(true);
    setSlot(null);
    try {
      const { data } = await fetchDisponibilidadPublica(slug, servicio.id, fecha);
      setFranjas(data.franjas || []);
    } catch {
      setFranjas([]);
    } finally {
      setLoadingFranjas(false);
    }
  }, [slug, servicio, fecha]);

  useEffect(() => { if (step === 1) cargarFranjas(); }, [step, cargarFranjas]);

  const handleConfirmar = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const { data } = await crearCitaPublica(slug, {
        producto_id: servicio.id,
        user_id: slot.user_id,
        fecha_inicio: slot.inicio,
        cliente_nombre: nombre.trim(),
        cliente_telefono: telefono.trim() || null,
        cliente_email: email.trim() || null,
        notas: notas.trim() || null,
      });
      setCitaOk(data);
      setStep(3);
    } catch (e) {
      // 409 = franja tomada mientras tanto
      alert(e?.response?.data?.detail || 'No se pudo agendar. Intenta con otro horario.');
      setStep(1);
      cargarFranjas();
    } finally {
      setSaving(false);
    }
  };

  // ── Estados de carga / error ──
  if (loading) {
    return <Centered><CircularProgress sx={{ color: TEAL }} /></Centered>;
  }
  if (error) {
    return (
      <Centered>
        <EventNote sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>{error}</Typography>
      </Centered>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F0FDFA', py: { xs: 2, sm: 5 }, px: 1.5 }}>
      <Box sx={{ maxWidth: 560, mx: 'auto' }}>
        {/* Encabezado de la empresa */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          {info.logo_base64 ? (
            <Avatar src={info.logo_base64} sx={{ width: 64, height: 64, mx: 'auto', mb: 1, boxShadow: 2 }} />
          ) : (
            <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 1, bgcolor: TEAL }}>
              <Spa sx={{ fontSize: 32 }} />
            </Avatar>
          )}
          <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{info.empresa_nombre}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Reserva tu cita en línea</Typography>
        </Box>

        <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: '#CCFBF1', overflow: 'hidden' }}>
          {/* Stepper */}
          <Box sx={{ bgcolor: '#fff', px: 2, pt: 2.5 }}>
            <Stepper activeStep={step} alternativeLabel>
              {PASOS.map(p => (
                <Step key={p}>
                  <StepLabel sx={{ '& .Mui-active': { color: `${TEAL} !important` }, '& .Mui-completed': { color: `${TEAL} !important` } }}>
                    <Typography sx={{ fontSize: 11.5 }}>{p}</Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* PASO 0 — Servicio */}
            {step === 0 && (
              <Fade in>
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 1.5 }}>¿Qué servicio deseas?</Typography>
                  {info.servicios.length === 0 ? (
                    <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                      No hay servicios disponibles para agendar en este momento.
                    </Typography>
                  ) : (
                    <Stack spacing={1.2}>
                      {info.servicios.map(s => {
                        const sel = servicio?.id === s.id;
                        return (
                          <Paper key={s.id} onClick={() => setServicio(s)} elevation={0} sx={{
                            borderRadius: 3, cursor: 'pointer', transition: 'all .15s',
                            border: '2px solid', borderColor: sel ? TEAL : 'divider',
                            bgcolor: sel ? `${TEAL}0A` : '#fff',
                            '&:hover': { borderColor: TEAL },
                            overflow: 'hidden',
                          }}>
                            {/* Imagen del servicio */}
                            {s.image_count > 0 && (
                              <Box sx={{
                                width: '100%', height: 140, overflow: 'hidden',
                                position: 'relative', bgcolor: '#F8FAFC',
                              }}>
                                <img
                                  src={imgSrc(slug, s.id, 0)}
                                  alt={s.nombre}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                                {sel && (
                                  <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                    <CheckCircle sx={{ color: '#fff', fontSize: 28, filter: `drop-shadow(0 0 4px ${TEAL})` }} />
                                  </Box>
                                )}
                              </Box>
                            )}
                            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              {s.image_count === 0 && (
                                <Avatar sx={{ bgcolor: sel ? TEAL : `${TEAL}1A`, color: sel ? '#fff' : TEAL_DARK }}>
                                  <EventAvailable />
                                </Avatar>
                              )}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700 }} noWrap>{s.nombre}</Typography>
                                {s.descripcion && (
                                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }} noWrap>{s.descripcion}</Typography>
                                )}
                                <Stack direction="row" spacing={1} sx={{ mt: 0.3 }}>
                                  <Chip size="small" icon={<Schedule sx={{ fontSize: 14 }} />}
                                    label={`${s.duracion_minutos || 30} min`}
                                    sx={{ bgcolor: '#F1F5F9', height: 22, fontSize: 11.5 }} />
                                  {s.precio != null && (
                                    <Chip size="small" label={`$${Number(s.precio).toLocaleString('es-CO')}`}
                                      sx={{ bgcolor: '#ECFDF5', color: '#047857', height: 22, fontSize: 11.5, fontWeight: 700 }} />
                                  )}
                                </Stack>
                              </Box>
                              {s.image_count === 0 && sel && <CheckCircle sx={{ color: TEAL }} />}
                            </Box>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </Fade>
            )}

            {/* PASO 1 — Fecha y hora */}
            {step === 1 && (
              <Fade in>
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Elige fecha y hora</Typography>
                  <TextField type="date" fullWidth size="small" label="Fecha"
                    value={fecha} onChange={e => setFecha(e.target.value)}
                    inputProps={{ min: toYMD(new Date()) }}
                    InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <AccessTime sx={{ fontSize: 17, color: TEAL }} /> Horarios disponibles
                  </Typography>
                  {loadingFranjas ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: TEAL }} /></Box>
                  ) : franjas.length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed' }}>
                      <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
                        No hay horarios libres este día. Prueba con otra fecha.
                      </Typography>
                    </Paper>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 220, overflowY: 'auto', p: 0.5 }}>
                      {franjas.map((f, i) => {
                        const sel = slot && slot.inicio === f.inicio && slot.user_id === f.user_id;
                        return (
                          <Tooltip key={i} title={`Atiende: ${f.trabajador_nombre}`} arrow>
                            <Chip label={fmtHora(f.inicio)} onClick={() => setSlot(f)}
                              sx={{
                                fontWeight: 700, cursor: 'pointer', px: 0.5, fontSize: 13.5,
                                bgcolor: sel ? TEAL : '#fff', color: sel ? '#fff' : TEAL_DARK,
                                border: `1.5px solid ${sel ? TEAL : `${TEAL}44`}`,
                                '&:hover': { bgcolor: sel ? TEAL_DARK : `${TEAL}14` },
                              }} />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Fade>
            )}

            {/* PASO 2 — Datos */}
            {step === 2 && (
              <Fade in>
                <Box>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Tus datos de contacto</Typography>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 2 }}>
                    Te contactaremos para confirmar tu cita.
                  </Typography>
                  <Stack spacing={1.8}>
                    <TextField fullWidth size="small" label="Nombre completo *"
                      value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
                    <TextField fullWidth size="small" label="Teléfono / WhatsApp"
                      value={telefono} onChange={e => setTelefono(e.target.value)} />
                    <TextField fullWidth size="small" label="Email"
                      value={email} onChange={e => setEmail(e.target.value)} />
                    <TextField fullWidth size="small" label="Notas (opcional)" multiline rows={2}
                      value={notas} onChange={e => setNotas(e.target.value)} />
                  </Stack>
                  {/* Resumen */}
                  <Paper variant="outlined" sx={{ mt: 2, p: 1.8, borderRadius: 2, bgcolor: '#F0FDFA', borderColor: '#99F6E4' }}>
                    <ResumenRow icon={<EventAvailable sx={{ fontSize: 17, color: TEAL }} />} text={servicio?.nombre} />
                    <ResumenRow icon={<Schedule sx={{ fontSize: 17, color: TEAL }} />}
                      text={slot ? `${fmtFecha(slot.inicio)} · ${fmtHora(slot.inicio)}` : ''} />
                    <ResumenRow icon={<Engineering sx={{ fontSize: 17, color: TEAL }} />} text={slot?.trabajador_nombre} />
                    {servicio?.precio != null && (
                      <ResumenRow icon={<AttachMoney sx={{ fontSize: 17, color: TEAL }} />}
                        text={`Total: $${Number(servicio.precio).toLocaleString('es-CO')}`} bold />
                    )}
                  </Paper>
                  {info.requiere_anticipo && servicio?.precio != null && (
                    <Alert severity="info" icon={<WhatsApp />} sx={{ mt: 1.5, borderRadius: 2, fontSize: 13 }}>
                      Este servicio requiere un anticipo del <strong>{info.porcentaje_anticipo}%</strong>{' '}
                      (${Math.ceil(servicio.precio * info.porcentaje_anticipo / 100).toLocaleString('es-CO')} COP).
                      Al confirmar te contactaremos para coordinar el pago.
                    </Alert>
                  )}
                </Box>
              </Fade>
            )}

            {/* PASO 3 — Confirmación */}
            {step === 3 && citaOk && (
              <Fade in>
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Avatar sx={{ width: 72, height: 72, mx: 'auto', mb: 2, bgcolor: '#DCFCE7' }}>
                    <CheckCircle sx={{ fontSize: 44, color: '#16A34A' }} />
                  </Avatar>
                  <Typography sx={{ fontWeight: 800, fontSize: 20 }}>¡Cita agendada!</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 2.5 }}>
                    Recibimos tu solicitud. Te contactaremos para confirmarla.
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'left', bgcolor: '#F0FDFA', borderColor: '#99F6E4' }}>
                    <ResumenRow icon={<EventAvailable sx={{ fontSize: 18, color: TEAL }} />} text={citaOk.producto_nombre} bold />
                    <ResumenRow icon={<Schedule sx={{ fontSize: 18, color: TEAL }} />}
                      text={`${fmtFecha(citaOk.fecha_inicio)} · ${fmtHora(citaOk.fecha_inicio)}`} />
                    <ResumenRow icon={<Engineering sx={{ fontSize: 18, color: TEAL }} />} text={citaOk.trabajador_nombre} />
                    {servicio?.precio != null && (
                      <ResumenRow icon={<AttachMoney sx={{ fontSize: 18, color: TEAL }} />}
                        text={`Total: $${Number(servicio.precio).toLocaleString('es-CO')}`} bold />
                    )}
                  </Paper>

                  {/* Instrucciones de pago */}
                  {info.requiere_anticipo && servicio?.precio != null ? (
                    <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3, borderColor: '#FDE68A', bgcolor: '#FFFBEB', textAlign: 'left' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>💳 Anticipo requerido</Typography>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
                        Para confirmar tu cita, envía el anticipo del <strong>{info.porcentaje_anticipo}%</strong>{' '}
                        (<strong>${Math.ceil(servicio.precio * info.porcentaje_anticipo / 100).toLocaleString('es-CO')} COP</strong>).
                        El saldo restante lo pagas al llegar.
                      </Typography>
                      {info.whatsapp && (
                        <Button fullWidth variant="contained" size="small" startIcon={<WhatsApp />}
                          href={`https://wa.me/${info.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hola! Acabo de agendar una cita de *${citaOk.producto_nombre}* para el ${fmtFecha(citaOk.fecha_inicio)} · ${fmtHora(citaOk.fecha_inicio)}. ¿Cómo envío el anticipo?`
                          )}`}
                          target="_blank"
                          sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe5d' }, color: '#fff', borderRadius: 2 }}>
                          Coordinar pago por WhatsApp
                        </Button>
                      )}
                    </Paper>
                  ) : (
                    <Alert severity="success" sx={{ mt: 2, borderRadius: 2, fontSize: 13 }}>
                      El pago se realiza directamente en el local el día de tu cita. 💰
                    </Alert>
                  )}

                  <Button sx={{ mt: 3, color: TEAL_DARK }} onClick={() => {
                    setStep(0); setServicio(null); setSlot(null); setCitaOk(null);
                    setNombre(''); setTelefono(''); setEmail(''); setNotas('');
                  }}>
                    Agendar otra cita
                  </Button>
                </Box>
              </Fade>
            )}
          </Box>

          {/* Navegación */}
          {step < 3 && (
            <>
              <Divider />
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', bgcolor: '#fff' }}>
                <Button disabled={step === 0} onClick={() => setStep(s => s - 1)}
                  startIcon={<ArrowBack />} color="inherit">Atrás</Button>
                {step < 2 ? (
                  <Button variant="contained" disableElevation endIcon={<ArrowForward />}
                    onClick={() => setStep(s => s + 1)}
                    disabled={(step === 0 && !servicio) || (step === 1 && !slot)}
                    sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
                    Continuar
                  </Button>
                ) : (
                  <Button variant="contained" disableElevation
                    onClick={handleConfirmar} disabled={!nombre.trim() || saving}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                    sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}>
                    Confirmar cita
                  </Button>
                )}
              </Box>
            </>
          )}
        </Paper>

        <Typography sx={{ textAlign: 'center', fontSize: 11.5, color: 'text.disabled', mt: 3 }}>
          Agendamiento en línea · Ksmart360
        </Typography>
      </Box>
    </Box>
  );
}

const Centered = ({ children }) => (
  <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', bgcolor: '#F0FDFA', p: 3, textAlign: 'center' }}>
    {children}
  </Box>
);

const ResumenRow = ({ icon, text, bold }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4 }}>
    {icon}
    <Typography sx={{ fontSize: 13.5, fontWeight: bold ? 700 : 500, textTransform: text && text.includes(':') ? 'none' : 'capitalize' }}>
      {text}
    </Typography>
  </Box>
);
