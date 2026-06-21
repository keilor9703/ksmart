import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Chip, Divider, Alert,
  useTheme, useMediaQuery, LinearProgress, Collapse,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  CheckCircle, OpenInNew, ExpandMore,
  Settings, Phone, Email, ArrowForward, ArrowBack, CheckCircleOutline,
  LightbulbOutlined, WarningAmber, InfoOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const PURPLE   = '#8B5CF6';
const PURPLE_L = '#7C3AED';
const GREEN    = '#10B981';
const AMBER    = '#F59E0B';

// ── Chip de link externo ──────────────────────────────────────────────────────
const LinkChip = ({ label, href }) => (
  <Chip
    label={label}
    icon={<OpenInNew sx={{ fontSize: '14px !important' }} />}
    size="small"
    component="a"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    clickable
    sx={{ fontWeight: 600, fontSize: 11 }}
  />
);

// ── Ítem de checklist ─────────────────────────────────────────────────────────
const Check = ({ children, tip }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
    <CheckCircleOutline sx={{ color: GREEN, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
    <Box>
      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>{children}</Typography>
      {tip && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
          💡 {tip}
        </Typography>
      )}
    </Box>
  </Box>
);

// ── Tip box ───────────────────────────────────────────────────────────────────
const Tip = ({ children, color = PURPLE }) => (
  <Box sx={{
    display: 'flex', gap: 1, alignItems: 'flex-start',
    p: 1.5, borderRadius: 2, bgcolor: `${color}10`,
    border: `1px solid ${color}30`, mt: 1.5,
  }}>
    <LightbulbOutlined sx={{ color, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
    <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6 }}>
      {children}
    </Typography>
  </Box>
);

// ════════════════════════════════════════════════════════════════════════════════
// PASOS
// ════════════════════════════════════════════════════════════════════════════════
const PASOS = [
  {
    label: 'Habilitarte como Facturador Electrónico en la DIAN',
    emoji: '🏛️',
    resumen: 'Registro en el portal MUISCA — gratis y solo se hace una vez.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          Lo primero que necesitas es decirle a la DIAN que vas a facturar electrónicamente.
          Esto se hace una sola vez en el portal <strong>MUISCA</strong> y es completamente gratuito.
        </Typography>

        <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2, borderRadius: 2 }}>
          ¿Ya facturas electrónicamente con Siigo, Alegra u otro software?
          Entonces ya estás registrado — <strong>puedes saltar este paso</strong>.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>¿Cómo hacerlo?</Typography>
        <Check tip="Necesitas el usuario y contraseña de tu empresa en la DIAN, no el tuyo personal.">
          Ingresa a <strong>muisca.dian.gov.co</strong> con las credenciales de tu empresa.
        </Check>
        <Check>
          Busca la opción <em>"Habilitación como facturador electrónico"</em> y sigue el proceso.
        </Check>
        <Check tip="Guárdalo, lo vas a necesitar luego.">
          La DIAN te asignará un número de habilitación. Anótalo.
        </Check>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          <LinkChip label="Ir a MUISCA" href="https://muisca.dian.gov.co" />
        </Box>

        <Tip>
          Si no recuerdas tus credenciales de MUISCA, puedes recuperarlas desde el mismo portal
          o llamar a la línea de atención de la DIAN: 601 546-1000.
        </Tip>
      </Box>
    ),
  },
  {
    label: 'Solicitar las Resoluciones de Numeración a la DIAN',
    emoji: '🔢',
    resumen: 'Necesitas DOS resoluciones: una para FE y otra para DEE/POS.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          La DIAN autoriza rangos de números para tus documentos electrónicos.
          Sin una resolución activa, el sistema no puede numerar ni emitir nada.
        </Typography>

        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Necesitas dos resoluciones distintas</strong> — una para Facturas Electrónicas (FE)
          y otra para Documentos Equivalentes Electrónicos (DEE / Tiquete POS). Son trámites separados.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>📄 Resolución FE (Factura Electrónica)</Typography>
        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
          Se usa cuando un cliente solicita factura con sus datos fiscales.
        </Typography>
        <Check>
          En MUISCA solicita <em>"Autorización de numeración para facturación electrónica"</em>.
        </Check>
        <Check tip="Ejemplo: prefijo FEV, rango 1 al 10.000.">
          Define un prefijo (ej: FEV, FE, FAC) y el rango de números (ej: 1 al 10.000).
        </Check>
        <Check>
          Anota: número de resolución, prefijo, rango inicial, rango final y fecha de vencimiento.
        </Check>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>🧾 Resolución DEE/POS (Documento Equivalente Electrónico)</Typography>
        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
          Se usa en TODAS las ventas donde el cliente NO solicita factura (consumidor final).
          La normativa DIAN también exige reportarlas electrónicamente.
        </Typography>
        <Check>
          En MUISCA solicita <em>"Habilitación sistema POS / Documento Equivalente Electrónico"</em>.
        </Check>
        <Check tip="Ejemplo: prefijo POS, rango 1 al 50.000.">
          Define un prefijo distinto (ej: POS, DEE, T) y el rango que usarás.
        </Check>
        <Check>
          Anota los mismos datos: número de resolución, prefijo, rango y vigencia.
        </Check>

        <Tip color={AMBER}>
          Ambas resoluciones se registran luego en Ksmart360 (paso 6). El sistema las usa
          automáticamente según el tipo de venta: FE si el cliente la solicita, DEE/POS para el resto.
        </Tip>
      </Box>
    ),
  },
  {
    label: 'Adquirir el Certificado Digital',
    emoji: '🔐',
    resumen: 'La firma electrónica de tu empresa. Solo para producción.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          El certificado digital es la "firma" con la que tu empresa sella cada documento electrónico.
          Es obligatorio para facturas reales — para pruebas en sandbox <strong>no lo necesitas</strong>.
        </Typography>

        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2, borderRadius: 2 }}>
          <strong>¿Solo quieres hacer pruebas?</strong> Puedes saltar este paso por ahora.
          El sandbox de Matías API incluye un certificado de prueba automático.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>¿Dónde conseguirlo?</Typography>

        {/* Opción 1: Matías */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5, borderColor: PURPLE + '60' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip label="Recomendado" size="small" sx={{ bgcolor: PURPLE, color: '#fff', fontWeight: 700 }} />
            <Typography variant="subtitle2" fontWeight={700}>Matías API</Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', lineHeight: 1.6 }}>
            El mismo proveedor tecnológico que usa Ksmart360 puede gestionar tu certificado directamente.
            Simplifica todo el proceso porque ellos ya conocen la configuración necesaria.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <LinkChip label="matias-api.com" href="https://matias-api.com" />
            <LinkChip label="Documentación" href="https://docs.matias-api.com" />
          </Box>
        </Paper>

        {/* Opción 2: Certicámara */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Certicámara</Typography>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            La entidad certificadora más común en Colombia. Autorizada por la DIAN.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <LinkChip label="certicamara.com" href="https://certicamara.com" />
          </Box>
        </Paper>

        {/* Opción 3: GSE */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>GSE</Typography>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            Otra entidad autorizada por la DIAN con buena presencia en el mercado colombiano.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <LinkChip label="gse.com.co" href="https://gse.com.co" />
          </Box>
        </Paper>

        <Tip>
          El costo es aproximadamente <strong>$104.000 COP / año por NIT</strong>.
          Si tienes varias sucursales con el mismo NIT, comparten el mismo certificado.
          Si son NIT distintos, cada uno necesita el suyo.
        </Tip>
      </Box>
    ),
  },
  {
    label: 'Entregar el certificado a Tech Stack Colombia',
    emoji: '📤',
    resumen: 'Nosotros lo configuramos en el sistema por ti.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          Una vez que tengas el certificado, nos lo envías a nosotros y lo configuramos en tu cuenta.
          Tech Stack Colombia opera como <strong>Casa de Software</strong> ante Matías API —
          somos los responsables técnicos de la integración con la DIAN.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>¿Qué necesitamos de tu parte?</Typography>
        <Check>El archivo del certificado digital (formato .pfx o .p12).</Check>
        <Check>La contraseña del certificado.</Check>
        <Check>
          Los datos de tus resoluciones DIAN (número, prefijo, rango desde/hasta, fechas de vigencia)
          — tanto la de FE como la de DEE/POS si ya la tienes.
        </Check>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>¿Cómo nos contactas?</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Chip icon={<Email />} label="soporte@techstackcolombia.com" size="small" variant="outlined" sx={{ justifyContent: 'flex-start', width: 'fit-content' }} />
          <Chip icon={<Phone />} label="WhatsApp Tech Stack Colombia" size="small" variant="outlined" sx={{ justifyContent: 'flex-start', width: 'fit-content' }} />
        </Box>

        <Alert severity="warning" icon={<WarningAmber />} sx={{ mt: 2, borderRadius: 2 }}>
          Envía el certificado por un canal seguro (correo o WhatsApp).
          Nunca lo compartas por redes sociales o mensajes abiertos.
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Recibir y guardar tu Token de Matías API',
    emoji: '🔑',
    resumen: 'Tu llave de acceso al sistema de facturación.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          Después de configurar tu certificado, te entregamos un <strong>token JWT</strong> de Matías API.
          Piénsalo como la llave que conecta Ksmart360 con la DIAN — sin él, nada funciona.
        </Typography>

        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Trátalo como una contraseña.</strong> Quien tenga este token puede emitir
          facturas a nombre de tu empresa. No lo compartas ni lo publiques en ningún lado.
        </Alert>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Hay dos tipos de token:</Typography>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5, borderColor: AMBER + '60' }}>
          <Chip label="SANDBOX" size="small" sx={{ bgcolor: AMBER, color: '#fff', fontWeight: 700, mb: 1 }} />
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            Para hacer pruebas sin emitir facturas reales. Perfecto para verificar que la
            configuración está bien antes de activar producción.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: GREEN + '60' }}>
          <Chip label="PRODUCCIÓN" size="small" sx={{ bgcolor: GREEN, color: '#fff', fontWeight: 700, mb: 1 }} />
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            Para facturas reales ante la DIAN. Solo lo recibes una vez que el certificado
            y las resoluciones están correctamente configurados.
          </Typography>
        </Paper>

        <Tip>
          Guarda el token en un lugar seguro (gestor de contraseñas, etc.).
          Si lo pierdes, debemos regenerarlo — lo que implica actualizar la configuración en Ksmart360.
        </Tip>
      </Box>
    ),
  },
  {
    label: 'Configurar el token en Ksmart360',
    emoji: '⚙️',
    resumen: 'Pegar el token en la configuración FE del sistema.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          Con el token en mano, ya puedes conectar Ksmart360 con Matías API.
          Este paso lo haces tú mismo directamente en la plataforma.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Pasos en Ksmart360:</Typography>
        <Check>
          Ve a <strong>Facturación Electrónica</strong> desde el menú lateral o tu avatar.
        </Check>
        <Check tip='Activa "Modo Sandbox" si estás usando el token de pruebas.'>
          En la pestaña <em>Configuración</em>, pega el token en el campo correspondiente.
        </Check>
        <Check>
          Haz clic en <strong>"Guardar cambios"</strong>.
        </Check>
        <Check>
          El sistema confirma la conexión mostrando los datos de tu empresa registrados en Matías.
        </Check>

        <Tip color={GREEN}>
          El token se guarda cifrado en la base de datos de tu empresa y nunca es visible
          para otros usuarios ni para otras empresas del sistema.
        </Tip>
      </Box>
    ),
  },
  {
    label: 'Registrar las Resoluciones DIAN en Ksmart360',
    emoji: '📋',
    resumen: 'Para que el sistema numere correctamente tus documentos.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          Ksmart360 necesita saber qué números puede usar — por eso debes registrar
          tus resoluciones DIAN aquí también. Son las mismas que tramitaste en el paso 2.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>📄 Resolución FE (Factura Electrónica)</Typography>
        <Check>
          Ve a <strong>Facturación Electrónica → Resoluciones DIAN</strong>.
        </Check>
        <Check>
          Haz clic en <em>"Nueva Resolución"</em>, selecciona tipo <strong>FE</strong> e ingresa los datos exactos.
        </Check>
        <Check>Actívala como resolución activa.</Check>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>🧾 Resolución DEE/POS (opcional pero recomendada)</Typography>
        <Check>
          Repite el proceso creando otra resolución, esta vez con tipo <strong>POS</strong>.
        </Check>
        <Check>
          El sistema usará automáticamente la resolución correcta según el tipo de venta.
        </Check>

        <Alert severity="warning" icon={<WarningAmber />} sx={{ mt: 2, borderRadius: 2 }}>
          El prefijo y rango deben coincidir <strong>exactamente</strong> con los registrados en la DIAN
          y en Matías API. Una discrepancia genera error en la emisión.
        </Alert>
      </Box>
    ),
  },
  {
    label: '¡Activar y hacer una prueba!',
    emoji: '🚀',
    resumen: 'El último paso — activar el switch y registrar tu primera venta.',
    contenido: (
      <Box>
        <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
          ¡Ya casi terminamos! Solo falta activar la facturación electrónica y verificar
          que todo funciona con una venta de prueba.
        </Typography>

        <Check>
          En <strong>Facturación Electrónica → Configuración</strong>, activa el switch
          <em>"Facturación Electrónica activa"</em>.
        </Check>
        <Check tip='Si estás en sandbox, el estado debe aparecer como "exitoso" aunque la factura no va a la DIAN real.'>
          Registra una venta normal en el módulo de Ventas.
        </Check>
        <Check>
          Ve a la pestaña <em>"Historial de emisiones"</em> y verifica que el estado sea
          <strong> ✓ exitoso</strong> y que tenga un CUFE asignado.
        </Check>
        <Check>
          Si el estado es <strong>✗ fallido</strong>, el mensaje de error te dice exactamente qué corregir.
          Los errores más comunes son: token vencido, prefijo incorrecto o resolución no encontrada.
        </Check>

        <Alert severity="success" icon={<CheckCircle />} sx={{ mt: 2, borderRadius: 2 }}>
          <strong>¡Listo!</strong> Tu empresa está emitiendo documentos electrónicos válidos ante la DIAN.
          Cada venta genera automáticamente su documento con CUFE/CUDE y PDF descargable.
        </Alert>
      </Box>
    ),
  },
];

// ════════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════════
export default function OnboardingFE() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef([]);
  const isDark = theme.palette.mode === 'dark';

  // Scroll al paso activo cuando cambia
  useEffect(() => {
    const el = stepRefs.current[activeStep];
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [activeStep]);

  const goNext = () => setActiveStep(s => Math.min(s + 1, PASOS.length - 1));
  const goPrev = () => setActiveStep(s => Math.max(s - 1, 0));

  const pct = Math.round(((activeStep + 1) / PASOS.length) * 100);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 780, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5, flexShrink: 0,
            bgcolor: `${PURPLE}18`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 22,
          }}>
            🧾
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
              Guía de Activación FE
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Facturación Electrónica DIAN — te llevamos paso a paso
            </Typography>
          </Box>
        </Box>

        {/* Barra de progreso */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Paso {activeStep + 1} de {PASOS.length}
            </Typography>
            <Typography variant="caption" fontWeight={700} sx={{ color: PURPLE }}>
              {pct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#EDE9FE',
              '& .MuiLinearProgress-bar': { bgcolor: PURPLE, borderRadius: 3 },
            }}
          />
        </Box>
      </Box>

      {/* ── Aviso general ── */}
      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3, borderRadius: 2 }}>
        Esta guía es para <strong>producción</strong> (facturas reales ante la DIAN).
        Para pruebas en sandbox puedes omitir el certificado (paso 3) y la entrega (paso 4) —
        Matías API lo maneja automáticamente.
      </Alert>

      {/* ── Resumen del tiempo ── */}
      <Paper sx={{
        p: 2, mb: 3, borderRadius: 2.5,
        borderLeft: `4px solid ${PURPLE}`,
        bgcolor: isDark ? `${PURPLE}10` : '#FAF5FF',
      }}>
        <Typography variant="subtitle2" fontWeight={700} mb={0.5}>⏱️ ¿Cuánto tarda?</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          El proceso completo toma entre <strong>2 y 5 días hábiles</strong>.
          El paso más lento suele ser el certificado digital (Certicámara lo emite en 1-2 días).
          La parte en Ksmart360 la completas en menos de 15 minutos.
        </Typography>
      </Paper>

      {/* ── Pasos ── */}
      <Box>
        {PASOS.map((paso, index) => {
          const isActive   = activeStep === index;
          const isComplete = index < activeStep;

          return (
            <Box
              key={index}
              ref={el => { stepRefs.current[index] = el; }}
              sx={{ mb: 1.5 }}
            >
              {/* Cabecera del paso */}
              <Paper
                onClick={() => setActiveStep(index)}
                elevation={isActive ? 3 : 0}
                sx={{
                  p: 2, borderRadius: 2.5, cursor: 'pointer',
                  border: `2px solid`,
                  borderColor: isActive ? PURPLE : isComplete ? `${GREEN}50` : 'divider',
                  bgcolor: isActive
                    ? isDark ? `${PURPLE}15` : '#FAF5FF'
                    : isComplete
                    ? isDark ? `${GREEN}08` : '#F0FDF4'
                    : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: isActive ? PURPLE : `${PURPLE}60` },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {/* Número / check */}
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isComplete ? GREEN : isActive ? PURPLE : 'action.hover',
                    color: isComplete || isActive ? '#fff' : 'text.secondary',
                    fontWeight: 800, fontSize: 13,
                  }}>
                    {isComplete ? <CheckCircle sx={{ fontSize: 18 }} /> : index + 1}
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 16, lineHeight: 1 }}>{paso.emoji}</Typography>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ color: isActive ? PURPLE : isComplete ? GREEN : 'text.primary' }}
                      >
                        {paso.label}
                      </Typography>
                    </Box>
                    {!isActive && (
                      <Typography variant="caption" color="text.secondary">
                        {paso.resumen}
                      </Typography>
                    )}
                  </Box>

                  <ExpandMore sx={{
                    color: 'text.secondary',
                    transition: 'transform 0.2s',
                    transform: isActive ? 'rotate(180deg)' : 'none',
                    flexShrink: 0,
                  }} />
                </Box>
              </Paper>

              {/* Contenido expandido */}
              <Collapse in={isActive} unmountOnExit>
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, sm: 2.5 }, mt: 0.5, borderRadius: 2.5,
                    borderColor: `${PURPLE}30`,
                  }}
                >
                  {paso.contenido}

                  {/* Botones de navegación */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    {index > 0 && (
                      <Button
                        size="small"
                        startIcon={<ArrowBack />}
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                        sx={{ color: 'text.secondary' }}
                      >
                        Anterior
                      </Button>
                    )}
                    <Box sx={{ flex: 1 }} />
                    {index < PASOS.length - 1 ? (
                      <Button
                        size="small"
                        variant="contained"
                        endIcon={<ArrowForward />}
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                        sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: PURPLE_L }, borderRadius: 2 }}
                      >
                        Siguiente paso
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Settings />}
                        onClick={() => navigate('/admin/facturacion-electronica')}
                        sx={{ bgcolor: GREEN, '&:hover': { bgcolor: '#059669' }, borderRadius: 2 }}
                      >
                        Ir a Configuración FE
                      </Button>
                    )}
                  </Box>
                </Paper>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* ── FAQ ── */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
        🤔 Preguntas frecuentes
      </Typography>
      {[
        {
          q: '¿Cuánto tiempo toma activar la FE?',
          a: 'Entre 2 y 5 días hábiles. El cuello de botella suele ser el certificado digital — Certicámara puede tardar 1 a 2 días en emitirlo. La configuración en Ksmart360 se hace en minutos.',
        },
        {
          q: '¿Necesito la resolución DEE/POS si solo quiero FE?',
          a: 'Técnicamente puedes empezar solo con la resolución FE, pero la normativa DIAN exige que TODAS las ventas (incluyendo las de consumidor final sin factura) se reporten electrónicamente como DEE. Sin la resolución POS, esas ventas no se reportan.',
        },
        {
          q: '¿Qué pasa si una emisión falla?',
          a: 'La venta queda guardada normalmente en Ksmart360. En el historial de emisiones verás el error exacto. Puedes reintentar la emisión desde el detalle de la venta sin perder nada.',
        },
        {
          q: '¿Puedo probar sin comprar el certificado?',
          a: 'Sí. El sandbox de Matías API usa un certificado de prueba automático. Puedes probar la configuración completa antes de comprar el certificado de producción.',
        },
        {
          q: '¿El certificado se comparte entre sucursales?',
          a: 'El certificado es por NIT. Si tus sucursales tienen el mismo NIT, comparten el mismo certificado. Si tienen NIT distintos, cada una necesita el suyo.',
        },
        {
          q: '¿Las devoluciones también son electrónicas?',
          a: 'Sí, las devoluciones generan notas de crédito electrónicas. Este módulo está en desarrollo activo en Ksmart360.',
        },
      ].map((item, i) => (
        <Accordion key={i} sx={{ mb: 0.5, borderRadius: '8px !important', '&:before': { display: 'none' } }} variant="outlined">
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="body2" fontWeight={600}>{item.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {item.a}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<Settings />}
          onClick={() => navigate('/admin/facturacion-electronica')}
          sx={{ borderColor: PURPLE, color: PURPLE, '&:hover': { bgcolor: `${PURPLE}10` } }}
        >
          Ir a Configuración FE
        </Button>
      </Box>
    </Box>
  );
}
