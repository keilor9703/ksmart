import React from 'react';
import { Box, Typography, Container, Paper, Divider, Button, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GavelIcon from '@mui/icons-material/Gavel';
import LockIcon from '@mui/icons-material/Lock';
import FingerprintIcon from '@mui/icons-material/Fingerprint';

const ACCENT = '#FF6020';

// ─── Layout compartido ────────────────────────────────────────────────────────
const LegalLayout = ({ title, icon: Icon, accentColor, children }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      py: { xs: 4, md: 8 },
      px: 2,
    }}>
      <Container maxWidth="md">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 3, color: 'text.secondary', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: 'action.hover' } }}
        >
          Volver
        </Button>

        <Paper elevation={0} sx={{
          p: { xs: 3, md: 6 },
          borderRadius: 4,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 2.5, flexShrink: 0,
              bgcolor: `${accentColor || ACCENT}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: accentColor || ACCENT,
            }}>
              {Icon && <Icon />}
            </Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', lineHeight: 1.2 }}>
              {title}
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 4, ml: 0.5 }}>
            Última actualización: Mayo 19, 2026 · Ksmart360 — KSMP Systems
          </Typography>

          <Divider sx={{ mb: 4 }} />

          {/* Content */}
          <Box sx={{
            '& .section-title': {
              mt: 3.5, mb: 1.2,
              fontWeight: 700, fontSize: 15,
              color: accentColor || ACCENT,
              display: 'flex', alignItems: 'center', gap: 0.8,
            },
            '& .section-title::before': {
              content: '""',
              display: 'inline-block',
              width: 4, height: 16, borderRadius: 2,
              bgcolor: accentColor || ACCENT,
              flexShrink: 0,
            },
            '& p': { mb: 1.8, lineHeight: 1.75, color: 'text.primary', fontSize: 14 },
            '& ul, & ol': { mb: 2, pl: 3 },
            '& li': { mb: 0.8, color: 'text.primary', fontSize: 14, lineHeight: 1.7 },
            '& strong': { color: 'text.primary', fontWeight: 700 },
            '& .highlight-box': {
              mt: 2, mb: 2, p: 2.5, borderRadius: 2.5,
              bgcolor: isDark ? `${accentColor || ACCENT}12` : `${accentColor || ACCENT}08`,
              border: '1px solid',
              borderColor: isDark ? `${accentColor || ACCENT}30` : `${accentColor || ACCENT}25`,
            },
          }}>
            {children}
          </Box>
        </Paper>

        {/* Footer */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            © 2026 KSMP Systems — Todos los derechos reservados.{' '}
            <Box component="span" sx={{ color: accentColor || ACCENT }}>Ksmart360®</Box>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

// ─── Sección helper ───────────────────────────────────────────────────────────
const S = ({ n, title, children }) => (
  <>
    <Typography className="section-title">{n}. {title}</Typography>
    {children}
  </>
);

// ════════════════════════════════════════════════════════════════════════════════
// TÉRMINOS Y CONDICIONES
// ════════════════════════════════════════════════════════════════════════════════
export const Terminos = () => (
  <LegalLayout title="Términos y Condiciones de Uso" icon={GavelIcon} accentColor={ACCENT}>

    <Box className="highlight-box">
      <Typography variant="body2" sx={{ mb: 0 }}>
        <strong>Importante:</strong> Al acceder, registrarse o utilizar la plataforma Ksmart360, usted declara haber leído,
        comprendido y aceptado en su totalidad los presentes Términos y Condiciones. Si actúa en nombre de una empresa,
        garantiza que cuenta con autorización suficiente para vincular a dicha organización.
      </Typography>
    </Box>

    <S n="1" title="Aceptación de los Términos">
      <p>
        Los presentes Términos y Condiciones de Uso (en adelante, "los Términos") regulan el acceso y uso de la plataforma
        Ksmart360, propiedad de <strong>KSMP Systems</strong> (en adelante, "la Empresa"), con domicilio en Colombia.
        El uso de la plataforma implica la aceptación plena e incondicional de estos Términos. Si no acepta alguna
        disposición, debe abstenerse de utilizar el servicio.
      </p>
      <p>
        La Empresa se reserva el derecho de modificar estos Términos en cualquier momento. Los cambios serán notificados
        con al menos 15 días de anticipación mediante correo electrónico o aviso dentro de la plataforma. El uso
        continuado del servicio tras la publicación de los cambios constituirá aceptación de los mismos.
      </p>
    </S>

    <S n="2" title="Descripción del Servicio">
      <p>
        Ksmart360 es una plataforma de software empresarial en modalidad SaaS (Software as a Service), diseñada para
        pequeñas y medianas empresas colombianas. Incluye, entre otros, los siguientes módulos:
      </p>
      <ul>
        <li><strong>Punto de Venta (POS):</strong> registro de ventas, cotizaciones, gestión de clientes y cobros.</li>
        <li><strong>Inventario:</strong> control de productos, lotes, movimientos y reportes.</li>
        <li><strong>Producción:</strong> órdenes de trabajo, recetas y trazabilidad.</li>
        <li><strong>Compras:</strong> registro de proveedores y gestión de compras.</li>
        <li><strong>Finanzas:</strong> caja diaria, cartera y reportes contables básicos.</li>
        <li><strong>Facturación DIAN:</strong> gestión de resoluciones y numeración de facturas.</li>
        <li><strong>Módulos especializados:</strong> lavadero, parqueadero, préstamos, entre otros.</li>
      </ul>
      <p>
        El servicio se presta de forma continua, salvo ventanas de mantenimiento programado, y está sujeto a los niveles
        de disponibilidad pactados en el plan de suscripción contratado.
      </p>
    </S>

    <S n="3" title="Registro y Cuenta de Usuario">
      <p>
        Para acceder a Ksmart360, el usuario debe crear una cuenta proporcionando información verídica, completa y
        actualizada. Cada empresa dispone de una cuenta principal (administrador) con la facultad de crear usuarios
        adicionales con roles específicos.
      </p>
      <ul>
        <li>El usuario es el único responsable de la confidencialidad de sus credenciales de acceso.</li>
        <li>Queda prohibida la transferencia o cesión de cuentas a terceros sin autorización expresa de la Empresa.</li>
        <li>El usuario debe notificar de inmediato cualquier uso no autorizado de su cuenta a <strong>soporte@appjeylor.com</strong>.</li>
        <li>La Empresa no será responsable de pérdidas derivadas del acceso no autorizado por negligencia del usuario.</li>
      </ul>
    </S>

    <S n="4" title="Planes, Suscripción y Pagos">
      <p>
        El acceso a Ksmart360 está condicionado a la contratación de un plan de suscripción vigente. Los planes se
        facturan de forma mensual o anual, según la modalidad elegida al momento del registro.
      </p>
      <ul>
        <li><strong>Pago:</strong> los pagos se realizan de forma anticipada. El incumplimiento en el pago conlleva la
        suspensión temporal del servicio hasta regularizar el estado de la cuenta.</li>
        <li><strong>Renovación automática:</strong> los planes se renuevan automáticamente al vencer el período contratado,
        salvo que el usuario cancele con al menos 5 días de antelación.</li>
        <li><strong>Cambio de plan:</strong> el usuario puede actualizar o degradar su plan en cualquier momento; los
        cambios aplican al inicio del siguiente ciclo de facturación.</li>
        <li><strong>Reembolsos:</strong> no se realizan reembolsos por períodos ya facturados, salvo falla grave imputable
        exclusivamente a la Empresa.</li>
        <li><strong>Precios:</strong> la Empresa se reserva el derecho de ajustar los precios con un preaviso mínimo de
        30 días.</li>
      </ul>
    </S>

    <S n="5" title="Obligaciones del Usuario">
      <p>El usuario se compromete a:</p>
      <ul>
        <li>Utilizar la plataforma exclusivamente para fines legítimos y conforme a la legislación colombiana vigente.</li>
        <li>Ingresar información veraz y mantenerla actualizada.</li>
        <li>Respetar los derechos de propiedad intelectual de la Empresa y de terceros.</li>
        <li>Garantizar que el personal interno autorizado que accede al sistema conoce y cumple estos Términos.</li>
        <li>Mantener actualizado el software de sus dispositivos y navegadores para garantizar compatibilidad.</li>
        <li>Reportar de forma oportuna cualquier fallo técnico o vulnerabilidad detectada.</li>
      </ul>
    </S>

    <S n="6" title="Usos Prohibidos">
      <p>Queda expresamente prohibido:</p>
      <ul>
        <li>Intentar acceder sin autorización a sistemas, servidores o cuentas de otros usuarios.</li>
        <li>Realizar ingeniería inversa, descompilar o desensamblar cualquier parte del software.</li>
        <li>Usar la plataforma para actividades ilegales, fraudulentas o que violen derechos de terceros.</li>
        <li>Introducir virus, malware o cualquier código malicioso.</li>
        <li>Realizar cargas masivas de datos con fines de prueba de rendimiento sin autorización previa.</li>
        <li>Revender, sublicenciar o ceder el acceso al servicio a terceros no autorizados.</li>
        <li>Usar medios automatizados (bots, scrapers) para extraer datos de la plataforma.</li>
      </ul>
      <p>
        El incumplimiento de cualquiera de estas prohibiciones podrá dar lugar a la suspensión inmediata del servicio
        sin derecho a reembolso, y/o al ejercicio de las acciones legales correspondientes.
      </p>
    </S>

    <S n="7" title="Propiedad Intelectual">
      <p>
        Todo el contenido de Ksmart360, incluyendo pero sin limitarse a: código fuente, diseño visual, interfaces,
        logotipos, marcas, base de datos, documentación y algoritmos, son propiedad exclusiva de KSMP Systems o de sus
        licenciantes, y están protegidos por las leyes colombianas e internacionales de propiedad intelectual.
      </p>
      <p>
        La suscripción al servicio no transfiere ningún derecho de propiedad intelectual al usuario. Se concede
        únicamente una licencia de uso limitada, no exclusiva, intransferible y revocable, para el período de
        suscripción vigente y conforme a los presentes Términos.
      </p>
    </S>

    <S n="8" title="Disponibilidad del Servicio (SLA)">
      <p>
        La Empresa se compromete a ofrecer una disponibilidad mínima del <strong>99 % mensual</strong> del servicio,
        excluyendo ventanas de mantenimiento programado previamente comunicadas. En caso de incumplimiento imputable
        a la Empresa, el usuario podrá solicitar un crédito proporcional en el siguiente ciclo de facturación.
      </p>
      <p>
        No se consideran interrupciones del servicio: mantenimientos programados, fuerza mayor, fallos en
        infraestructura de terceros (proveedor de hosting, telecomunicaciones) o uso indebido por parte del usuario.
      </p>
    </S>

    <S n="9" title="Datos e Información del Usuario">
      <p>
        Los datos ingresados por el usuario en la plataforma son de su exclusiva propiedad. La Empresa no accederá
        a dichos datos salvo para: (a) prestar el servicio contratado, (b) dar soporte técnico con consentimiento
        previo del usuario, o (c) cuando así lo exija la ley colombiana.
      </p>
      <p>
        El usuario es responsable de realizar copias de seguridad adicionales de su información crítica. La Empresa
        mantiene respaldos periódicos como parte de la infraestructura del servicio, pero no garantiza la recuperación
        total de datos en caso de pérdida derivada de uso incorrecto por parte del usuario.
      </p>
    </S>

    <S n="10" title="Limitación de Responsabilidad">
      <p>
        En la máxima medida permitida por la ley, la Empresa no será responsable por:
      </p>
      <ul>
        <li>Pérdida de datos o lucro cesante derivados de uso incorrecto por parte del usuario.</li>
        <li>Daños indirectos, incidentales, especiales o consecuentes.</li>
        <li>Interrupción del servicio por causas de fuerza mayor o caso fortuito.</li>
        <li>Decisiones empresariales tomadas con base en la información gestionada en la plataforma.</li>
      </ul>
      <p>
        La responsabilidad máxima acumulada de la Empresa frente al usuario, por cualquier concepto, estará limitada
        al monto pagado por el usuario durante los 3 meses anteriores al evento que originó el reclamo.
      </p>
    </S>

    <S n="11" title="Terminación del Contrato">
      <p>
        Cualquiera de las partes puede dar por terminado el uso del servicio en cualquier momento:
      </p>
      <ul>
        <li><strong>Por el usuario:</strong> cancelando la suscripción desde el panel de administración, con efecto al
        cierre del período facturado.</li>
        <li><strong>Por la Empresa:</strong> en caso de incumplimiento de los presentes Términos, con previo aviso de
        48 horas, o de forma inmediata en caso de usos fraudulentos o ilegales.</li>
      </ul>
      <p>
        Tras la terminación, el usuario tendrá 30 días para exportar sus datos. Vencido este plazo, la información
        podrá ser eliminada definitivamente de los servidores.
      </p>
    </S>

    <S n="12" title="Ley Aplicable y Jurisdicción">
      <p>
        Los presentes Términos se rigen por las leyes de la República de Colombia. Para la resolución de controversias,
        las partes se someten a la jurisdicción de los jueces y tribunales competentes de Colombia, renunciando
        expresamente a cualquier otro fuero que pudiera corresponderles.
      </p>
      <p>
        Ante cualquier conflicto, las partes procurarán, en primera instancia, una solución amigable a través del
        canal de soporte: <strong>soporte@appjeylor.com</strong>.
      </p>
    </S>

  </LegalLayout>
);

// ════════════════════════════════════════════════════════════════════════════════
// POLÍTICA DE PRIVACIDAD
// ════════════════════════════════════════════════════════════════════════════════
export const Privacidad = () => (
  <LegalLayout title="Política de Privacidad" icon={LockIcon} accentColor="#3B82F6">

    <Box className="highlight-box" sx={{ borderColor: '#3B82F625 !important', bgcolor: '#3B82F608 !important' }}>
      <Typography variant="body2" sx={{ mb: 0 }}>
        En <strong>KSMP Systems</strong>, respetamos su privacidad y nos comprometemos a proteger sus datos personales.
        Esta Política describe cómo recopilamos, usamos y protegemos la información cuando utiliza Ksmart360.
        Es complementaria a nuestra Política de Tratamiento de Datos (Habeas Data).
      </Typography>
    </Box>

    <S n="1" title="Responsable del Tratamiento">
      <p>
        <strong>KSMP Systems</strong> es el responsable del tratamiento de los datos personales recopilados a través
        de la plataforma Ksmart360. Para cualquier consulta relacionada con privacidad, puede contactarnos en:
        <strong> soporte@appjeylor.com</strong>.
      </p>
    </S>

    <S n="2" title="Datos que Recopilamos">
      <p>Recopilamos las siguientes categorías de datos:</p>
      <ul>
        <li>
          <strong>Datos de registro y perfil:</strong> nombre completo, correo electrónico, número de teléfono,
          NIT o cédula de la empresa, nombre comercial y cargo del usuario administrador.
        </li>
        <li>
          <strong>Datos de uso:</strong> módulos accedidos, transacciones registradas, logs de actividad,
          dirección IP, tipo de dispositivo y navegador, idioma del sistema.
        </li>
        <li>
          <strong>Datos de terceros ingresados por el usuario:</strong> información de clientes, proveedores y
          empleados que el usuario registra en el sistema. El usuario es responsable de contar con la autorización
          de esos terceros.
        </li>
        <li>
          <strong>Datos de pago:</strong> método de pago e historial de transacciones (no almacenamos números
          completos de tarjetas de crédito; este proceso es gestionado por pasarelas de pago certificadas PCI-DSS).
        </li>
        <li>
          <strong>Cookies y tecnologías similares:</strong> datos de sesión, preferencias de interfaz y estadísticas
          de uso anónimas.
        </li>
      </ul>
    </S>

    <S n="3" title="Finalidades del Tratamiento">
      <p>Utilizamos sus datos para:</p>
      <ul>
        <li>Crear, gestionar y mantener su cuenta de acceso a la plataforma.</li>
        <li>Prestar el servicio SaaS contratado y sus actualizaciones.</li>
        <li>Gestionar suscripciones, facturación y cobros.</li>
        <li>Brindar soporte técnico y resolver incidencias.</li>
        <li>Enviar notificaciones del servicio: actualizaciones, alertas de seguridad y cambios en los términos.</li>
        <li>Mejorar la plataforma mediante análisis de uso agregado y anonimizado.</li>
        <li>Cumplir obligaciones legales y regulatorias aplicables en Colombia.</li>
        <li>Prevenir el fraude y garantizar la seguridad del sistema.</li>
      </ul>
      <p>
        <strong>No vendemos sus datos personales a terceros</strong> bajo ninguna circunstancia.
      </p>
    </S>

    <S n="4" title="Base Legal del Tratamiento">
      <p>El tratamiento de sus datos se sustenta en:</p>
      <ul>
        <li><strong>Ejecución del contrato:</strong> necesario para prestar el servicio contratado.</li>
        <li><strong>Consentimiento:</strong> para comunicaciones comerciales y analítica de uso.</li>
        <li><strong>Obligación legal:</strong> cuando así lo exige la normatividad colombiana.</li>
        <li><strong>Interés legítimo:</strong> para seguridad, prevención de fraude y mejora del servicio.</li>
      </ul>
    </S>

    <S n="5" title="Compartir Datos con Terceros">
      <p>Sus datos pueden ser compartidos únicamente con:</p>
      <ul>
        <li>
          <strong>Proveedores de infraestructura tecnológica</strong> (servidores en la nube, correo electrónico
          transaccional) bajo estrictos acuerdos de confidencialidad y encargados de tratamiento.
        </li>
        <li>
          <strong>Procesadores de pago</strong> certificados PCI-DSS para gestionar transacciones.
        </li>
        <li>
          <strong>Autoridades competentes</strong> cuando exista obligación legal, requerimiento judicial o
          administrativo debidamente fundado.
        </li>
      </ul>
      <p>
        Exigimos a todos los terceros que adopten medidas de seguridad equivalentes a las nuestras para proteger
        su información personal.
      </p>
    </S>

    <S n="6" title="Transferencia Internacional de Datos">
      <p>
        Los datos pueden ser almacenados y procesados en servidores ubicados fuera de Colombia (por ejemplo, en
        Estados Unidos o la Unión Europea), siempre que el país receptor cuente con un nivel de protección adecuado
        o se hayan establecido garantías contractuales suficientes, conforme a la normativa colombiana de protección
        de datos.
      </p>
    </S>

    <S n="7" title="Seguridad de los Datos">
      <p>
        Implementamos medidas técnicas y organizativas de seguridad que incluyen:
      </p>
      <ul>
        <li>Cifrado SSL/TLS en todas las comunicaciones entre el cliente y el servidor.</li>
        <li>Almacenamiento de contraseñas con hash seguro (bcrypt / Argon2).</li>
        <li>Control de acceso basado en roles (RBAC) con autenticación por token JWT.</li>
        <li>Copias de seguridad automáticas periódicas con retención configurable.</li>
        <li>Monitoreo de actividad sospechosa y accesos no autorizados.</li>
        <li>Actualizaciones de seguridad periódicas en toda la pila tecnológica.</li>
      </ul>
      <p>
        Pese a las medidas implementadas, ningún sistema es 100 % invulnerable. Le recomendamos usar contraseñas
        robustas y únicas, y activar la verificación de acceso cuando esté disponible.
      </p>
    </S>

    <S n="8" title="Cookies y Tecnologías de Seguimiento">
      <p>Ksmart360 utiliza las siguientes categorías de cookies:</p>
      <ul>
        <li><strong>Estrictamente necesarias:</strong> permiten la autenticación y el funcionamiento del servicio.
        No pueden desactivarse.</li>
        <li><strong>Preferencias:</strong> recuerdan ajustes del usuario como el tema de color (claro/oscuro)
        y el idioma.</li>
        <li><strong>Analíticas:</strong> recopilan datos de uso de forma anonimizada para mejorar la plataforma.
        Pueden desactivarse desde la configuración del navegador.</li>
      </ul>
      <p>
        No utilizamos cookies de publicidad ni compartimos datos de comportamiento con redes publicitarias.
      </p>
    </S>

    <S n="9" title="Retención de los Datos">
      <p>
        Conservamos sus datos durante el tiempo que la suscripción esté vigente y por un período adicional de
        <strong> 12 meses</strong> tras la cancelación, para permitir la recuperación de información y el cumplimiento
        de obligaciones legales. Vencido dicho período, los datos son eliminados de forma segura o anonimizados.
      </p>
    </S>

    <S n="10" title="Sus Derechos">
      <p>Tiene derecho a:</p>
      <ul>
        <li><strong>Acceso:</strong> conocer qué datos personales tenemos sobre usted.</li>
        <li><strong>Rectificación:</strong> corregir información inexacta o incompleta.</li>
        <li><strong>Supresión:</strong> solicitar la eliminación de sus datos (sujeto a obligaciones legales).</li>
        <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado y de uso común.</li>
        <li><strong>Revocación del consentimiento:</strong> retirar el consentimiento en cualquier momento.</li>
        <li><strong>Oposición:</strong> objetar el tratamiento basado en interés legítimo.</li>
      </ul>
      <p>
        Para ejercer cualquiera de estos derechos, contáctenos en <strong>soporte@appjeylor.com</strong> con el
        asunto "Derechos ARCO". Responderemos en un plazo máximo de <strong>10 días hábiles</strong>.
      </p>
    </S>

    <S n="11" title="Cambios a Esta Política">
      <p>
        Podemos actualizar esta Política periódicamente. Cuando los cambios sean materiales, lo notificaremos por
        correo electrónico con al menos 15 días de antelación. Le recomendamos revisar esta página regularmente.
      </p>
    </S>

  </LegalLayout>
);

// ════════════════════════════════════════════════════════════════════════════════
// HABEAS DATA — POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES
// ════════════════════════════════════════════════════════════════════════════════
export const HabeasData = () => (
  <LegalLayout title="Política de Tratamiento de Datos Personales" icon={FingerprintIcon} accentColor="#10B981">

    <Box className="highlight-box" sx={{ borderColor: '#10B98125 !important', bgcolor: '#10B98108 !important' }}>
      <Typography variant="body2" sx={{ mb: 0 }}>
        De conformidad con la <strong>Ley Estatutaria 1581 de 2012</strong>, el Decreto 1377 de 2013 y demás normas
        concordantes, <strong>KSMP Systems</strong> adopta la presente Política de Tratamiento de Datos Personales,
        en calidad de responsable del tratamiento de la información personal que recopila a través de la plataforma
        Ksmart360.
      </Typography>
    </Box>

    <S n="1" title="Marco Legal">
      <p>
        La presente política se rige por la normativa colombiana de protección de datos personales, en especial:
      </p>
      <ul>
        <li><strong>Ley 1581 de 2012:</strong> Ley de Protección de Datos Personales.</li>
        <li><strong>Decreto 1377 de 2013:</strong> reglamenta parcialmente la Ley 1581.</li>
        <li><strong>Decreto 1074 de 2015:</strong> Decreto Único Reglamentario del Sector Comercio.</li>
        <li><strong>Circular Externa 002 de 2015</strong> de la Superintendencia de Industria y Comercio (SIC).</li>
      </ul>
    </S>

    <S n="2" title="Responsable del Tratamiento">
      <p>
        <strong>KSMP Systems</strong><br />
        Correo electrónico: <strong>soporte@appjeylor.com</strong><br />
        Plataforma: <strong>Ksmart360</strong><br />
        País: <strong>Colombia</strong>
      </p>
      <p>
        Para consultas, reclamos o ejercicio de derechos, el titular puede comunicarse directamente a través
        del correo indicado o mediante el módulo de soporte interno de la plataforma.
      </p>
    </S>

    <S n="3" title="Datos Personales Objeto de Tratamiento">
      <p>KSMP Systems trata las siguientes categorías de datos personales:</p>
      <ul>
        <li><strong>Datos de identificación:</strong> nombre completo, tipo y número de documento (CC, NIT, CE),
        número de teléfono y correo electrónico.</li>
        <li><strong>Datos profesionales y comerciales:</strong> nombre de la empresa, cargo, sector económico,
        información de la suscripción contratada.</li>
        <li><strong>Datos de uso de la plataforma:</strong> registros de acceso, operaciones realizadas dentro
        del sistema, dirección IP y datos del dispositivo.</li>
        <li><strong>Datos de terceros gestionados por el usuario:</strong> información de clientes, proveedores,
        empleados u otras personas ingresadas por el usuario en los módulos de la plataforma. El usuario declara
        contar con la autorización de dichos titulares.</li>
      </ul>
      <p>
        <strong>Datos sensibles:</strong> Ksmart360 no recopila datos sensibles (origen racial o étnico, orientación
        sexual, creencias religiosas, datos biométricos, de salud, etc.) de forma directa. Si el usuario ingresa
        este tipo de información en la plataforma, es su responsabilidad contar con la autorización expresa del
        titular y cumplir con las disposiciones especiales de la Ley 1581.
      </p>
    </S>

    <S n="4" title="Finalidades del Tratamiento">
      <p>
        Los datos personales recopilados por KSMP Systems serán utilizados exclusivamente para las siguientes
        finalidades:
      </p>
      <ul>
        <li>Creación, gestión y soporte de la cuenta de acceso a la plataforma Ksmart360.</li>
        <li>Ejecución del contrato de prestación de servicios SaaS y sus renovaciones.</li>
        <li>Gestión de facturación, cobros y reportes contables relacionados con el servicio.</li>
        <li>Envío de comunicaciones técnicas del servicio: actualizaciones, alertas de seguridad, notificaciones
        de cambios en los Términos.</li>
        <li>Análisis interno del uso de la plataforma para mejora continua del servicio (datos anonimizados).</li>
        <li>Cumplimiento de obligaciones legales, tributarias y regulatorias ante autoridades colombianas.</li>
        <li>Gestión de peticiones, quejas y reclamos (PQR) presentadas por el titular.</li>
        <li>Prevención de fraudes, detección de accesos no autorizados y seguridad del sistema.</li>
      </ul>
    </S>

    <S n="5" title="Derechos de los Titulares">
      <p>
        Conforme al artículo 8 de la Ley 1581 de 2012, el titular de los datos personales tiene los siguientes
        derechos:
      </p>
      <ul>
        <li><strong>Conocer:</strong> acceder gratuitamente a sus datos personales que han sido objeto de tratamiento.</li>
        <li><strong>Actualizar y rectificar:</strong> corregir datos parciales, inexactos o incompletos.</li>
        <li><strong>Suprimir:</strong> solicitar la eliminación de sus datos cuando no exista obligación legal o
        contractual de conservarlos.</li>
        <li><strong>Revocar la autorización:</strong> retirar el consentimiento otorgado, siempre que no exista
        un deber legal o contractual que lo impida.</li>
        <li><strong>Acceder de forma gratuita:</strong> consultar sus datos personales al menos una vez al mes
        y cada vez que existan cambios sustanciales que lo justifiquen.</li>
        <li><strong>Presentar quejas:</strong> ante la Superintendencia de Industria y Comercio (SIC) por
        infracciones a la normativa de protección de datos.</li>
        <li><strong>Ser informado:</strong> sobre el uso que se dará a sus datos personales.</li>
      </ul>
    </S>

    <S n="6" title="Procedimiento para Ejercer los Derechos">
      <p>
        Para ejercer cualquiera de los derechos mencionados, el titular o su representante debidamente acreditado
        deberá:
      </p>
      <ol>
        <li>Enviar una solicitud escrita al correo <strong>soporte@appjeylor.com</strong> con el asunto:
        <em>"Ejercicio de Derechos — Habeas Data"</em>.</li>
        <li>Incluir: nombre completo, número de documento de identidad, descripción precisa del derecho
        a ejercer, datos de contacto y, si aplica, documentos que sustenten la solicitud.</li>
        <li>
          Los plazos de respuesta son:
          <ul>
            <li><strong>Consultas:</strong> máximo 10 días hábiles, prorrogables por 5 días hábiles adicionales
            con aviso previo.</li>
            <li><strong>Reclamos:</strong> máximo 15 días hábiles, prorrogables por 8 días hábiles adicionales
            con aviso previo.</li>
          </ul>
        </li>
      </ol>
    </S>

    <S n="7" title="Autorización del Titular">
      <p>
        De conformidad con el artículo 9 de la Ley 1581 de 2012, el tratamiento de datos personales requiere
        la autorización previa, expresa e informada del titular. Dicha autorización es otorgada por el usuario
        al momento de aceptar los presentes Términos y Condiciones durante el proceso de registro en Ksmart360,
        el cual incluye un mecanismo de casilla de verificación explícita.
      </p>
      <p>
        La autorización puede ser revocada en cualquier momento mediante solicitud al correo habilitado, sin
        efectos retroactivos y sin perjuicio de las finalidades necesarias para el cumplimiento del contrato
        de servicios vigente.
      </p>
    </S>

    <S n="8" title="Transmisión y Transferencia de Datos">
      <p>
        KSMP Systems puede compartir los datos personales con encargados del tratamiento (empresas que prestan
        servicios de infraestructura tecnológica, procesamiento de pagos, comunicaciones) mediante contratos
        que imponen obligaciones equivalentes de protección.
      </p>
      <p>
        No se realizan transferencias de datos personales a terceros países que no cuenten con un nivel de
        protección adecuado, salvo que se implementen salvaguardias contractuales suficientes conforme a la
        normativa colombiana y se obtenga la autorización de la SIC cuando corresponda.
      </p>
    </S>

    <S n="9" title="Medidas de Seguridad de la Información">
      <p>
        KSMP Systems implementa medidas técnicas, humanas y administrativas para garantizar la seguridad,
        confidencialidad e integridad de los datos personales tratados, incluyendo:
      </p>
      <ul>
        <li>Protocolos de cifrado SSL/TLS para la transmisión de datos.</li>
        <li>Control de acceso mediante autenticación segura (JWT) y roles diferenciados.</li>
        <li>Auditorías internas periódicas de seguridad de la información.</li>
        <li>Políticas internas de manejo de datos para el personal con acceso a la plataforma.</li>
        <li>Procedimiento documentado de respuesta ante incidentes de seguridad.</li>
        <li>Backups periódicos con cifrado en reposo.</li>
      </ul>
      <p>
        En caso de incidente de seguridad que afecte datos personales, la Empresa notificará a los titulares
        afectados y a la SIC en los plazos establecidos por la normativa vigente.
      </p>
    </S>

    <S n="10" title="Vigencia de la Política y Conservación de los Datos">
      <p>
        La presente Política de Tratamiento de Datos rige a partir de su publicación (Mayo 19, 2026) y permanecerá
        vigente mientras KSMP Systems desarrolle actividades de tratamiento de datos personales.
      </p>
      <p>
        Los datos personales serán conservados durante el período en que persista la relación contractual con el
        usuario y por un término adicional de <strong>12 meses</strong> tras su finalización, para atender
        obligaciones legales, resolver disputas y hacer valer los acuerdos contractuales. Vencido dicho término,
        los datos serán eliminados de forma segura o anonimizados definitivamente.
      </p>
      <p>
        Cualquier cambio sustancial en la presente política será notificado a los titulares con un mínimo de
        <strong> 15 días hábiles</strong> de antelación mediante correo electrónico o aviso destacado dentro
        de la plataforma.
      </p>
    </S>

    <S n="11" title="Autoridad de Control">
      <p>
        La autoridad de protección de datos competente en Colombia es la{' '}
        <strong>Superintendencia de Industria y Comercio (SIC)</strong>, ante quien el titular puede presentar
        consultas y reclamaciones en caso de considerar vulnerados sus derechos:
      </p>
      <ul>
        <li>Sitio web: <strong>www.sic.gov.co</strong></li>
        <li>Línea de atención: 01 8000 910165</li>
        <li>Correo: contactenos@sic.gov.co</li>
      </ul>
    </S>

  </LegalLayout>
);
