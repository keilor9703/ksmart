import React from 'react';
import { Box, Typography, Container, Paper, Divider, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const LegalLayout = ({ title, children }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#F4F6F9', 
      py: { xs: 4, md: 8 },
      px: 2
    }}>
      <Container maxWidth="md">
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate(-1)}
          sx={{ mb: 3, color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
        >
          Volver
        </Button>
        <Paper elevation={0} sx={{ 
          p: { xs: 3, md: 6 }, 
          borderRadius: 4, 
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          <Typography variant="h4" fontWeight={800} gutterBottom sx={{ color: '#1a1a1a' }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 4 }}>
            Última actualización: Mayo 19, 2026
          </Typography>
          <Divider sx={{ mb: 4 }} />
          <Box sx={{ 
            '& p': { mb: 2, lineHeight: 1.7, color: '#4a4a4a' },
            '& h6': { mt: 3, mb: 1, fontWeight: 700, color: '#2d3748' },
            '& ul': { mb: 2, pl: 3 },
            '& li': { mb: 1, color: '#4a4a4a' }
          }}>
            {children}
          </Box>
        </Paper>
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            © 2026 KSMP Systems - Todos los derechos reservados.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export const Terminos = () => (
  <LegalLayout title="Términos y Condiciones de Uso">
    <Typography variant="h6">1. Aceptación de los Términos</Typography>
    <Typography variant="body1">
      Al acceder y utilizar la plataforma Ksmart360, usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá utilizar nuestros servicios.
    </Typography>

    <Typography variant="h6">2. Descripción del Servicio</Typography>
    <Typography variant="body1">
      Ksmart360 es una plataforma SaaS (Software as a Service) que proporciona herramientas de gestión empresarial (ERP), incluyendo ventas, inventarios, producción y gestión de cartera. El servicio se presta bajo la modalidad de suscripción.
    </Typography>

    <Typography variant="h6">3. Responsabilidades del Usuario</Typography>
    <Typography variant="body1">
      El usuario es responsable de mantener la confidencialidad de su cuenta y contraseña. Asimismo, es responsable de toda la información ingresada en el sistema y de asegurar que su uso cumpla con las leyes locales vigentes.
    </Typography>

    <Typography variant="h6">4. Propiedad Intelectual</Typography>
    <Typography variant="body1">
      Todo el contenido, código, diseño y logotipos de Ksmart360 son propiedad exclusiva de KSMP Systems. Queda prohibida la reproducción total o parcial sin autorización previa.
    </Typography>

    <Typography variant="h6">5. Limitación de Responsabilidad</Typography>
    <Typography variant="body1">
      KSMP Systems no se hace responsable por pérdidas de datos debidas a mal uso por parte del usuario, ni por interrupciones del servicio fuera de nuestro control razonable.
    </Typography>
  </LegalLayout>
);

export const Privacidad = () => (
  <LegalLayout title="Política de Privacidad">
    <Typography variant="h6">1. Recolección de Información</Typography>
    <Typography variant="body1">
      Recopilamos información necesaria para la prestación del servicio, incluyendo datos de registro (nombre, correo, NIT), información transaccional y datos de uso de la plataforma.
    </Typography>

    <Typography variant="h6">2. Uso de la Información</Typography>
    <Typography variant="body1">
      La información recolectada se utiliza para:
    </Typography>
    <ul>
      <li>Proveer y mantener el servicio.</li>
      <li>Gestionar suscripciones y pagos.</li>
      <li>Enviar actualizaciones técnicas y anuncios de seguridad.</li>
      <li>Mejorar la experiencia del usuario mediante analítica.</li>
    </ul>

    <Typography variant="h6">3. Protección de Datos</Typography>
    <Typography variant="body1">
      Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos contra acceso no autorizado, alteración o destrucción. Utilizamos encriptación SSL/TLS para todas las comunicaciones.
    </Typography>

    <Typography variant="h6">4. Cookies</Typography>
    <Typography variant="body1">
      Utilizamos cookies y tecnologías similares para mantener la sesión del usuario y recordar preferencias de personalización.
    </Typography>
  </LegalLayout>
);

export const HabeasData = () => (
  <LegalLayout title="Política de Tratamiento de Datos (Habeas Data)">
    <Typography variant="body1">
      De conformidad con la Ley 1581 de 2012 de Colombia, KSMP Systems, como responsable del tratamiento de datos personales, informa su política de tratamiento.
    </Typography>

    <Typography variant="h6">1. Derechos del Titular</Typography>
    <Typography variant="body1">
      Como titular de datos personales, usted tiene derecho a conocer, actualizar, rectificar y suprimir la información suministrada, así como a revocar la autorización otorgada.
    </Typography>

    <Typography variant="h6">2. Finalidad del Tratamiento</Typography>
    <Typography variant="body1">
      Los datos suministrados serán tratados con el fin de ejecutar el contrato de prestación de servicios SaaS, realizar gestiones contables, administrativas y comerciales relacionadas con el vínculo contractual.
    </Typography>

    <Typography variant="h6">3. Canales de Atención</Typography>
    <Typography variant="body1">
      Para ejercer sus derechos, puede contactarnos a través del correo electrónico: <strong>soporte@appjeylor.com</strong> o mediante el módulo de soporte dentro de la plataforma.
    </Typography>

    <Typography variant="h6">4. Vigencia</Typography>
    <Typography variant="body1">
      La presente política rige a partir de su publicación y los datos se conservarán mientras persista la relación contractual o según lo exija la ley.
    </Typography>
  </LegalLayout>
);
