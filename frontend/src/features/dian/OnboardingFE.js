import React, { useState } from 'react';
import {
  Box, Typography, Paper, Stepper, Step, StepLabel, StepContent,
  Button, Chip, Divider, Alert, List, ListItem, ListItemIcon,
  ListItemText, Accordion, AccordionSummary, AccordionDetails,
  useTheme, useMediaQuery,
} from '@mui/material';
import {
  Receipt, CheckCircle, OpenInNew, ExpandMore, InfoOutlined,
  AssignmentTurnedIn, Security, VpnKey, Settings, PlayArrow,
  Phone, Email,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const PURPLE = '#8B5CF6';

const PASOS = [
  {
    label: 'Habilitarte como Facturador Electrónico ante la DIAN',
    icon: <AssignmentTurnedIn />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          Antes de emitir facturas electrónicas, tu empresa debe estar inscrita en el portal MUISCA de la DIAN como facturador electrónico voluntario u obligado.
        </Typography>
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Si ya facturas electrónicamente con otro software (p.ej. Siigo, Alegra), este paso ya está hecho — puedes pasar al siguiente.
        </Alert>
        <Typography variant="subtitle2" mb={1}>¿Cómo hacerlo?</Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Ingresa a muisca.dian.gov.co con tu usuario y contraseña de la empresa." />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Ve a "Habilitación facturación electrónica" y sigue el proceso de inscripción.' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="La DIAN te asignará un número de habilitación. Guárdalo." />
          </ListItem>
        </List>
        <Chip
          label="muisca.dian.gov.co"
          icon={<OpenInNew />}
          size="small"
          component="a"
          href="https://muisca.dian.gov.co"
          target="_blank"
          rel="noopener noreferrer"
          clickable
          sx={{ mt: 1 }}
        />
      </Box>
    ),
  },
  {
    label: 'Solicitar una Resolución de Numeración a la DIAN',
    icon: <Receipt />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          La DIAN asigna rangos de numeración (resoluciones) que autorizan los números de factura que puedes usar. Sin resolución activa, no puedes emitir facturas válidas.
        </Typography>
        <Typography variant="subtitle2" mb={1}>Pasos:</Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='En MUISCA, solicita "Autorización de numeración para facturación electrónica".' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Define el prefijo (ej: FEV, FE, FAC) y el rango de números (ej: 1 al 10.000)." />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="La resolución incluye fecha de vigencia — normalmente 2 años." />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Anota: número de resolución, prefijo, rango inicial y final, y fecha de vencimiento." />
          </ListItem>
        </List>
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          Esta resolución también se debe registrar en Ksmart360 (paso 6) para que el sistema numere correctamente tus facturas.
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Adquirir el Certificado Digital',
    icon: <Security />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          El certificado digital es la "firma electrónica" de tu empresa. Es obligatorio para producción y lo emiten entidades certificadoras autorizadas por la DIAN.
        </Typography>
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Para el ambiente de <strong>pruebas (sandbox)</strong> no necesitas comprar certificado — Matias API asigna uno de prueba automáticamente. El certificado solo es necesario para facturación real.
        </Alert>
        <Typography variant="subtitle2" mb={1}>Proveedores autorizados (Colombia):</Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText primary="Certicámara — certicamara.com" secondary="Entidad más común, con soporte para facturación electrónica" />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="primary" /></ListItemIcon>
            <ListItemText primary="GSE — gse.com.co" secondary="También autorizado por la DIAN" />
          </ListItem>
        </List>
        <Typography variant="subtitle2" mt={1.5} mb={0.5}>Costo aproximado:</Typography>
        <Typography variant="body2" color="text.secondary">
          ~$104.000 COP / NIT / año (varía según proveedor y vigencia). <strong>Este costo es por empresa (NIT)</strong> — cada empresa que quiera facturar electrónicamente debe adquirir su propio certificado.
        </Typography>
        <Alert severity="success" sx={{ mt: 1.5 }}>
          Una vez adquirido, el certificado (.pfx o .p12) se entrega a Tech Stack Colombia para cargarlo en el sistema.
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Entregar el certificado a Tech Stack Colombia',
    icon: <Phone />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          Tech Stack Colombia opera como <strong>Casa de Software</strong> ante Matias API (proveedor tecnológico). Nosotros configuramos tu certificado en el sistema para que puedas emitir facturas.
        </Typography>
        <Typography variant="subtitle2" mb={1}>Qué debes enviar:</Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Archivo del certificado digital (.pfx o .p12)" />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Contraseña del certificado" />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Datos de la resolución DIAN (número, prefijo, rango, fechas)" />
          </ListItem>
        </List>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="subtitle2" mb={1}>Canales de contacto:</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Chip icon={<Email />} label="soporte@techstackcolombia.com" size="small" variant="outlined" />
          <Chip icon={<Phone />} label="WhatsApp Tech Stack Colombia" size="small" variant="outlined" />
        </Box>
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          Envía el certificado por un canal seguro (WhatsApp cifrado o correo). Nunca lo compartas por redes sociales abiertas.
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Recibir y guardar tu Token de Matias API',
    icon: <VpnKey />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          Una vez configurado tu certificado, Tech Stack Colombia te entregará un <strong>token JWT</strong> de Matias API. Este token es la llave que conecta Ksmart360 con el sistema de facturación electrónica de la DIAN.
        </Typography>
        <Alert severity="error" sx={{ mb: 1.5 }}>
          <strong>Guarda este token con cuidado.</strong> Es confidencial — quien lo tenga puede emitir facturas a nombre de tu empresa. No lo compartas públicamente.
        </Alert>
        <Typography variant="subtitle2" mb={1}>Tipos de token:</Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><Chip label="SANDBOX" size="small" color="warning" /></ListItemIcon>
            <ListItemText
              primary="Token de pruebas"
              secondary="Para probar sin emitir facturas reales. Obtenido en sandbox-auth.matias-api.com"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Chip label="PROD" size="small" color="success" /></ListItemIcon>
            <ListItemText
              primary="Token de producción"
              secondary="Para facturas reales ante la DIAN. Solo después de tener certificado y resolución activos."
            />
          </ListItem>
        </List>
      </Box>
    ),
  },
  {
    label: 'Configurar el token en Ksmart360',
    icon: <Settings />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          Con tu token en mano, ve a la pantalla de configuración de Facturación Electrónica en Ksmart360 y guarda tu token.
        </Typography>
        <Typography variant="subtitle2" mb={1}>Pasos en Ksmart360:</Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Haz clic en tu avatar (esquina superior derecha) → "Facturación Electrónica".' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Si estás en pruebas: activa "Modo Sandbox" y pega el token de sandbox.' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Si estás en producción: desactiva "Modo Sandbox" y pega el token de producción.' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Haz clic en "Guardar cambios".' />
          </ListItem>
        </List>
        <Alert severity="info" sx={{ mt: 1 }}>
          El token se guarda cifrado en la base de datos de tu empresa. No se comparte con otras empresas.
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Registrar la Resolución DIAN en Ksmart360',
    icon: <Receipt />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          Ksmart360 necesita conocer tu resolución DIAN para numerar correctamente tus facturas electrónicas.
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Ve a Configuración → Resoluciones de Facturación.' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Crea una resolución con el número, prefijo, rango y fechas de tu resolución DIAN." />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Actívala como "Resolución activa".' />
          </ListItem>
        </List>
        <Alert severity="warning" sx={{ mt: 1 }}>
          El prefijo y rango deben coincidir exactamente con lo registrado en Matias API y en la DIAN. Una discrepancia genera error de resolución no encontrada.
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Activar Facturación Electrónica y hacer una prueba',
    icon: <PlayArrow />,
    contenido: (
      <Box>
        <Typography variant="body2" mb={1.5}>
          Con todo configurado, activa la FE y realiza una venta de prueba para verificar que todo funciona correctamente.
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='En Facturación Electrónica, activa el switch "Facturación Electrónica activa".' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Registra una venta normal en el POS." />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Revisa el historial en "Últimos intentos de emisión" — verás el estado "Exitoso" y el CUFE asignado por la DIAN.' />
          </ListItem>
          <ListItem>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary='Si el estado es "Fallido", el mensaje de error te indicará qué corregir.' />
          </ListItem>
        </List>
        <Alert severity="success" sx={{ mt: 1.5 }}>
          ¡Listo! Tu empresa está emitiendo facturas electrónicas válidas ante la DIAN. Cada venta genera automáticamente una factura con CUFE y PDF descargable.
        </Alert>
      </Box>
    ),
  },
];

export default function OnboardingFE() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 860, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Receipt sx={{ color: PURPLE, fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Guía de Activación</Typography>
          <Typography variant="body2" color="text.secondary">
            Facturación Electrónica DIAN — Paso a paso para tu empresa
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3 }}>
        Esta guía aplica para el <strong>ambiente de producción</strong> (facturas reales ante la DIAN).
        Para hacer pruebas en sandbox puedes saltarte los pasos del certificado (3 y 4) — el sandbox usa un certificado de prueba automático.
      </Alert>

      {/* Resumen rápido */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'action.hover', borderLeft: `4px solid ${PURPLE}` }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>Resumen del proceso</Typography>
        <Typography variant="body2" color="text.secondary">
          Para activar Facturación Electrónica necesitas: habilitarte en la DIAN, obtener una resolución de numeración, comprar un certificado digital (~$104.000 COP/año), entregarlo a Tech Stack Colombia para configurarlo, y luego ingresar el token en Ksmart360.
          <strong> El tiempo total es de 2 a 5 días hábiles</strong> (dependiendo de Certicámara y la DIAN).
        </Typography>
      </Paper>

      {/* Stepper */}
      {isMobile ? (
        // Vista acordeón en móvil
        <Box>
          {PASOS.map((paso, index) => (
            <Accordion
              key={index}
              expanded={activeStep === index}
              onChange={() => setActiveStep(activeStep === index ? -1 : index)}
              sx={{ mb: 1, border: activeStep === index ? `1px solid ${PURPLE}` : undefined }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={index + 1} size="small" sx={{ bgcolor: PURPLE, color: '#fff', minWidth: 28 }} />
                  <Typography variant="body2" fontWeight={600}>{paso.label}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {paso.contenido}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ) : (
        // Stepper vertical en desktop
        <Stepper activeStep={activeStep} orientation="vertical">
          {PASOS.map((paso, index) => (
            <Step key={index} expanded>
              <StepLabel
                StepIconProps={{ style: { color: PURPLE } }}
                onClick={() => setActiveStep(index)}
                sx={{ cursor: 'pointer' }}
              >
                <Typography fontWeight={600}>{paso.label}</Typography>
              </StepLabel>
              <StepContent>
                <Paper variant="outlined" sx={{ p: 2.5, mb: 1 }}>
                  {paso.contenido}
                </Paper>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {index < PASOS.length - 1 && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setActiveStep(index + 1)}
                      sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7C3AED' } }}
                    >
                      Siguiente paso
                    </Button>
                  )}
                  {index > 0 && (
                    <Button size="small" onClick={() => setActiveStep(index - 1)}>
                      Atrás
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      )}

      <Divider sx={{ my: 3 }} />

      {/* FAQ */}
      <Typography variant="subtitle1" fontWeight={700} mb={2}>Preguntas frecuentes</Typography>
      {[
        {
          q: '¿Cuánto tiempo toma activar la FE?',
          a: 'El proceso completo toma entre 2 y 5 días hábiles. El paso más lento suele ser la emisión del certificado digital por parte de Certicámara.',
        },
        {
          q: '¿Qué pasa si una factura falla?',
          a: 'Ksmart360 guarda el intento con el mensaje de error. Puedes ver los errores en "Últimos intentos de emisión" y reenviar la factura desde el detalle de la venta.',
        },
        {
          q: '¿Las notas de crédito también son electrónicas?',
          a: 'Sí, las devoluciones generan notas de crédito electrónicas automáticamente cuando la FE está activa. Este módulo está en desarrollo.',
        },
        {
          q: '¿El certificado se comparte entre sucursales?',
          a: 'No. El certificado es por NIT de empresa. Si tienes varias sucursales bajo el mismo NIT, usan el mismo certificado. Si son NIT distintos, cada uno necesita su propio certificado.',
        },
        {
          q: '¿Puedo probar sin pagar el certificado?',
          a: 'Sí. El ambiente sandbox de Matias API usa un certificado de prueba automático. Puedes hacer todas las pruebas que necesites en sandbox antes de pasar a producción.',
        },
      ].map((item, i) => (
        <Accordion key={i} sx={{ mb: 0.5 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="body2" fontWeight={600}>{item.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">{item.a}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          startIcon={<Settings />}
          onClick={() => navigate('/admin/facturacion-electronica')}
          sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7C3AED' } }}
        >
          Ir a Configuración FE
        </Button>
      </Box>
    </Box>
  );
}
