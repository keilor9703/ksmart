// ═══════════════════════════════════════════════════════════════════════════
// WhatsAppBot.js
// Pantalla donde cada empresa conecta SU número de WhatsApp para recibir
// pedidos automáticamente. El cliente solo escanea un QR — nunca ve la
// infraestructura que hay detrás.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Button, CircularProgress, Chip, Stack, Alert,
  Divider, TextField, useTheme, useMediaQuery, Switch, FormControlLabel,
} from '@mui/material';
import {
  WhatsApp, QrCode2, CheckCircle, LinkOff, Refresh, AutoAwesome, Schedule, Save,
  SupportAgent, LocalShipping,
} from '@mui/icons-material';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import HelpGuideTopBar from '../../components/onboarding/HelpGuideTopBar';

const GREEN = '#25D366';

// "ayer a las 3:20 p. m." comunica mucho más que una fecha ISO: el negocio
// necesita dimensionar cuánto tiempo lleva sin responderle a sus clientes.
function formatearDesde(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return 'hace un rato';
  const horas = (Date.now() - d.getTime()) / 3600000;
  const hora = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  if (horas < 1) return 'hace menos de una hora';
  if (horas < 24) return `hoy a las ${hora}`;
  if (horas < 48) return `ayer a las ${hora}`;
  return `el ${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`;
}

export default function WhatsAppBot() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [estado, setEstado]     = useState(null);   // { disponible, conectado, estado }
  const [cargando, setCargando] = useState(true);
  const [qr, setQr]             = useState(null);
  const [conectando, setConectando] = useState(false);
  const [horario, setHorario]   = useState('');
  const [avisos, setAvisos]     = useState('');
  const [saludo, setSaludo]     = useState('');
  const [avisarEstado, setAvisarEstado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const pollRef = useRef(null);

  const consultarEstado = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const { data } = await apiClient.get('/whatsapp-bot/estado');
      setEstado(data);
      // Si ya se conectó, dejamos de mostrar el QR y de consultar
      if (data.conectado) {
        setQr(null);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
      return data;
    } catch (e) {
      setEstado({ disponible: false, conectado: false, estado: 'error' });
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    consultarEstado();
    apiClient.get('/whatsapp-bot/config')
      .then(({ data }) => {
        setHorario(data.horario_atencion || '');
        setAvisos(data.whatsapp_notificaciones || '');
        setAvisarEstado(!!data.notificar_estado_pedido);
        setSaludo(data.mensaje_bienvenida_bot || '');
      })
      .catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [consultarEstado]);

  const guardarConfig = async () => {
    setGuardando(true);
    try {
      await apiClient.patch('/whatsapp-bot/config', {
        horario_atencion: horario,
        whatsapp_notificaciones: avisos,
        notificar_estado_pedido: avisarEstado,
        mensaje_bienvenida_bot: saludo,
      });
      toast.success('Guardado. El bot ya usará estos datos.');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo guardar la configuración.');
    } finally {
      setGuardando(false);
    }
  };

  const conectar = async () => {
    setConectando(true);
    setQr(null);
    try {
      const { data } = await apiClient.post('/whatsapp-bot/conectar');
      // El número puede conectarse y aun así no recibir pedidos si el webhook
      // de la automatización no quedó configurado: se avisa en vez de dejar
      // que el cliente crea que todo quedó listo.
      if (data.automatizacion_lista === false) {
        toast.warning('El número se vinculará, pero la automatización no está lista. Contacta a soporte.');
      }
      if (!data.qr_base64) {
        toast.info('No se recibió el código QR. Intenta de nuevo.');
      } else {
        setQr(data.qr_base64);
        // Mientras el QR está en pantalla, revisamos si ya escaneó
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          const d = await consultarEstado(true);
          if (d?.conectado) toast.success('¡WhatsApp conectado correctamente!');
        }, 4000);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo iniciar la conexión.');
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    if (!window.confirm('¿Desvincular tu WhatsApp? Dejarás de recibir pedidos automáticos.')) return;
    try {
      await apiClient.delete('/whatsapp-bot/desconectar');
      toast.success('WhatsApp desvinculado.');
      setQr(null);
      consultarEstado();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo desvincular.');
    }
  };

  if (cargando) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  // El servidor no tiene el servicio configurado todavía
  if (estado && !estado.disponible) {
    return (
      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 900, mx: 'auto' }}>
        <Alert severity="info">
          El bot de WhatsApp aún no está habilitado en tu cuenta. Contacta a soporte
          para activarlo.
        </Alert>
      </Box>
    );
  }

  const conectado = !!estado?.conectado;

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 900, mx: 'auto' }}>

      {/* Encabezado */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 2,
          background: `linear-gradient(135deg, ${GREEN} 0%, #128C7E 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WhatsApp sx={{ color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Pedidos por WhatsApp</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Tus clientes escriben y el pedido entra solo al sistema
          </Typography>
        </Box>
        <HelpGuideTopBar
          moduleName="Pedidos por WhatsApp"
          moduleColor={GREEN}
          steps={[
            { title: 'Conecta tu WhatsApp', description: 'Escanea el código QR con el WhatsApp del negocio. Es el mismo procedimiento de WhatsApp Web.' },
            { title: 'Publica tus productos', description: 'Solo se pueden pedir los productos marcados como "Mostrar en catálogo" en el módulo de Productos.' },
            { title: 'Recibe los pedidos', description: 'Cuando un cliente escriba pidiendo algo, el pedido aparece automáticamente en Pedidos Virtuales.' },
            { title: 'Gestiona y despacha', description: 'Desde Pedidos Virtuales confirmas, preparas y despachas. El cliente recibe la confirmación por WhatsApp.' },
          ]}
        />
      </Stack>

      {/* Estado de la conexión */}
      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 12, height: 12, borderRadius: '50%',
              bgcolor: conectado ? GREEN : '#EF4444',
              boxShadow: `0 0 8px ${conectado ? GREEN : '#EF4444'}`,
            }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                {conectado ? 'WhatsApp conectado' : 'WhatsApp sin conectar'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {conectado
                  ? 'Tu número está recibiendo pedidos automáticamente'
                  : 'Escanea el código QR para empezar a recibir pedidos'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<Refresh />} onClick={() => consultarEstado()}
              sx={{ color: 'text.secondary' }}>
              Actualizar
            </Button>
            {conectado ? (
              <Button variant="outlined" color="error" startIcon={<LinkOff />} onClick={desconectar}
                sx={{ borderRadius: 2, fontWeight: 700 }}>
                Desvincular
              </Button>
            ) : (
              <Button variant="contained" startIcon={conectando ? <CircularProgress size={16} color="inherit" /> : <QrCode2 />}
                onClick={conectar} disabled={conectando}
                sx={{ borderRadius: 2, fontWeight: 700, bgcolor: GREEN, '&:hover': { bgcolor: '#1da851' } }}>
                {conectando ? 'Generando…' : 'Conectar WhatsApp'}
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Caída detectada por el monitor: se dice desde cuándo y qué implica,
            porque un punto rojo no comunica urgencia. */}
        {!conectado && estado?.desconectado_desde && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
            <b>Desconectado desde {formatearDesde(estado.desconectado_desde)}.</b>{' '}
            Los clientes que te escriban no están recibiendo respuesta. Vuelve a
            escanear el código QR para reactivarlo.
          </Alert>
        )}
      </Paper>

      {/* QR */}
      {qr && !conectado && (
        <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>
            Escanea este código
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            En tu celular: <strong>WhatsApp → Dispositivos vinculados → Vincular dispositivo</strong>
          </Typography>

          <Box sx={{
            display: 'inline-block', p: 2, bgcolor: '#fff', borderRadius: 2,
            border: '1px solid', borderColor: 'divider',
          }}>
            <img src={qr} alt="Código QR de WhatsApp"
              style={{ width: isMobile ? 220 : 280, height: isMobile ? 220 : 280, display: 'block' }} />
          </Box>

          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
            El código expira en menos de un minuto. Si no alcanzas a escanearlo,
            pulsa <strong>Conectar WhatsApp</strong> de nuevo para generar otro.
          </Alert>
        </Paper>
      )}

      {/* Saludo de bienvenida */}
      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <SupportAgent sx={{ color: GREEN, fontSize: 20 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Saludo de bienvenida</Typography>
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 2 }}>
          Así saluda el bot al primer mensaje de cada cliente nuevo. Si lo dejas
          vacío, usa el saludo genérico por defecto.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            fullWidth size="small" multiline minRows={2}
            placeholder="Ej: ¡Hola! Bienvenido a Vialmar Cacao 🍫 ¿En qué te puedo ayudar hoy?"
            value={saludo}
            onChange={(e) => setSaludo(e.target.value)}
            inputProps={{ maxLength: 300 }}
            helperText={`${saludo.length}/300`}
          />
        </Stack>
      </Paper>

      {/* Horario de atención */}
      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Schedule sx={{ color: GREEN, fontSize: 20 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Horario de atención</Typography>
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 2 }}>
          Cuando un cliente pregunte "¿a qué hora abren?", el bot responderá
          exactamente esto. Si lo dejas vacío, dirá que no tiene el dato en vez
          de inventarlo.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            fullWidth size="small"
            placeholder="Ej: Lunes a sábado de 8:00 a.m. a 6:00 p.m."
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            inputProps={{ maxLength: 200 }}
          />
        </Stack>

        <Divider sx={{ my: 2.5 }} />

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <SupportAgent sx={{ color: GREEN, fontSize: 20 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
            WhatsApp para avisos
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 2 }}>
          Cuando un cliente pida hablar con una persona, te avisamos a este
          número. Usa uno <b>distinto</b> al que conectaste arriba: si es el
          mismo, el aviso llega al chat "Mensajes contigo mismo" y pasa
          desapercibido.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            fullWidth size="small"
            placeholder="Ej: 3001234567"
            value={avisos}
            onChange={(e) => setAvisos(e.target.value)}
            inputProps={{ maxLength: 20, inputMode: 'tel' }}
          />
        </Stack>

        <Divider sx={{ my: 2.5 }} />

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <LocalShipping sx={{ color: GREEN, fontSize: 20 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
            Avisar al cliente el estado de su pedido
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1 }}>
          Le escribimos al cliente cuando su pedido pasa a <b>Enviado</b> y
          cuando queda <b>Entregado</b>. Solo esos dos: son los momentos en que
          necesita estar pendiente, y escribirle de más desgasta la reputación
          de tu número ante WhatsApp.
        </Typography>
        <FormControlLabel
          sx={{ mb: 1 }}
          control={
            <Switch
              checked={avisarEstado}
              onChange={(e) => setAvisarEstado(e.target.checked)}
              sx={{ '& .Mui-checked': { color: GREEN } }}
            />
          }
          label={
            <Typography sx={{ fontSize: 13.5 }}>
              {avisarEstado ? 'Activado' : 'Desactivado'}
            </Typography>
          }
        />

        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="outlined" onClick={guardarConfig} disabled={guardando}
            startIcon={guardando ? <CircularProgress size={16} /> : <Save />}
            sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
          >
            Guardar
          </Button>
        </Stack>
      </Paper>

      {/* Cómo funciona */}
      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <AutoAwesome sx={{ color: GREEN, fontSize: 20 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Cómo funciona</Typography>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1.5}>
          {[
            ['1', 'Tu cliente escribe por WhatsApp', '"Hola, quiero 2 chocolatinas para la calle 45"'],
            ['2', 'El sistema entiende el pedido', 'Identifica los productos de tu catálogo y la dirección'],
            ['3', 'El pedido entra a Ksmart360', 'Aparece en Pedidos Virtuales, listo para preparar'],
            ['4', 'El cliente recibe confirmación', 'Con el número de pedido y el total, automáticamente'],
          ].map(([n, titulo, desc]) => (
            <Stack key={n} direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                bgcolor: `${GREEN}20`, color: GREEN, fontWeight: 800, fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{n}</Box>
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{titulo}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{desc}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>

        <Alert severity="info" sx={{ mt: 2.5 }}>
          Solo se pueden pedir productos marcados como <strong>"Mostrar en catálogo"</strong>.
          Revísalo en el módulo de Productos.
        </Alert>
      </Paper>
    </Box>
  );
}
