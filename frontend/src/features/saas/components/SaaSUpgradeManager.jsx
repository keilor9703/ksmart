import React, { useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogContent,
  IconButton, CircularProgress, useTheme, Chip, Divider,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { Close, WorkspacePremium, ReceiptLong, ExpandMore, GppGood } from '@mui/icons-material';
import apiClient from '../../../api';
import { formatCurrency } from '../../../utils/formatters';
import WompiButton from '../../../components/common/WompiButton';

const GREEN    = '#10B981';
const ACCENT   = '#F43F5E';
const BLUE     = '#2563EB';
const ORANGE   = '#F59E0B';

const PERIODOS = [
  { label: 'Mensual',    dias: 30,  descuento: null  },
  { label: 'Trimestral', dias: 90,  descuento: '-10%' },
  { label: 'Anual',      dias: 365, descuento: '-20%' },
];

// ── Plan definitions (order matters: basic→enterprise) ──────────────────────
const PLAN_ORDER = ['basico', 'emprendedor', 'comercio', 'empresarial'];

const PLAN_META = {
  basico: {
    color: '#6B7280',
    label: 'Básico',
    tagline: 'Todo el sistema de gestión. Sin facturación electrónica.',
    fe: false,
  },
  emprendedor: {
    color: BLUE,
    label: 'Emprendedor',
    tagline: 'Para negocios que empiezan a facturar electrónicamente.',
    fe: true,
    featured: false,
  },
  comercio: {
    color: ACCENT,
    label: 'Comercio',
    tagline: 'Para comercios con flujo medio de ventas electrónicas.',
    fe: true,
    featured: true,
  },
  empresarial: {
    color: '#7C3AED',
    label: 'Empresarial',
    tagline: 'Para negocios con alto volumen de documentos electrónicos.',
    fe: true,
    featured: false,
  },
};

const BASE_FEATURES = [
  'Todos los módulos según tu tipo de negocio',
  'Punto de venta clásico y touch',
  'Inventario, compras y proveedores',
  'Clientes, cartera y cuentas por cobrar',
  'Caja diaria con arqueo',
  'Cotizaciones y órdenes de trabajo',
  'Reportes y dashboard en tiempo real',
  'Contabilidad automática en partida doble',
  'Programa de puntos y fidelización',
  'Catálogo virtual con pedidos por WhatsApp',
  'Autenticación biométrica',
  'Usuarios ilimitados',
];

const FE_FEATURES = [
  'Factura Electrónica DIAN (UBL 2.1)',
  'Documento Equivalente POS / Tiquete electrónico',
  'CUFE / CUDE y QR automático',
  'Emisión automática en cada venta',
  'Gestión de resoluciones DIAN',
  'Alertas de resolución próxima a vencer',
  'Soporte prioritario',
];

const DIAN_REQUIREMENTS = [
  {
    icon: '📄',
    title: 'Resolución DIAN de Factura Electrónica (FE)',
    desc: 'Tu empresa debe tramitar ante la DIAN la habilitación para emitir Facturas Electrónicas. Ksmart360 te guía en el proceso.',
  },
  {
    icon: '🧾',
    title: 'Resolución DIAN para Tiquete POS (DEE)',
    desc: 'Resolución separada para el Documento Equivalente Electrónico. Obligatoria desde Resolución DIAN 000165/2023 para cada punto de venta.',
  },
  {
    icon: '🔐',
    title: 'Firma Digital vigente',
    desc: 'Certificado de firma electrónica emitido por una entidad autorizada (Certicámara, GSE). Costo externo aprox. $104,000 COP/año. Ksmart360 lo gestiona por ti.',
  },
  {
    icon: '🏢',
    title: 'Datos DIAN completos en Ksmart360',
    desc: 'NIT con dígito de verificación, municipio, régimen tributario, responsabilidades fiscales y correo de facturación registrados en tu perfil.',
  },
];

const FeatureItem = ({ text, included = true, small }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8, mb: 0.6 }}>
    <Box sx={{
      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, mt: 0.15,
      bgcolor: included ? `${GREEN}20` : 'rgba(0,0,0,0.05)',
      color: included ? GREEN : '#9CA3AF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Typography sx={{ fontSize: 9, fontWeight: 900 }}>{included ? '✓' : '✕'}</Typography>
    </Box>
    <Typography sx={{ fontSize: small ? 11.5 : 12, color: included ? 'text.primary' : 'text.disabled', lineHeight: 1.35 }}>
      {text}
    </Typography>
  </Box>
);

// Helpers
const getPlanKey = (codigo = '') => {
  const lower = codigo.toLowerCase();
  return PLAN_ORDER.find(k => lower.startsWith(k)) || null;
};

const groupPlanes = (planes) => {
  const groups = {};
  PLAN_ORDER.forEach(k => { groups[k] = {}; });
  planes.forEach(p => {
    const key = getPlanKey(p.codigo_interno);
    if (key) groups[key][p.dias_duracion] = p;
  });
  return groups;
};

const PlanCard = ({ planKey, plan, periodo, theme }) => {
  const meta   = PLAN_META[planKey];
  const color  = meta.color;
  const diasLabel = periodo.dias === 30 ? '/mes' : periodo.dias === 90 ? '/mes (trim.)' : '/mes (anual)';
  const precioMes = Math.round(plan.precio / (periodo.dias / 30));
  const maxDocs   = plan.max_documentos_mes;

  return (
    <Box sx={{
      flex: '1 1 210px',
      border: '2px solid',
      borderColor: meta.featured ? color : 'divider',
      borderRadius: 3,
      p: 2.5,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      bgcolor: meta.featured
        ? theme.palette.mode === 'dark' ? `${color}12` : '#FFF5F6'
        : 'background.paper',
      boxShadow: meta.featured ? `0 8px 24px ${color}20` : '0 2px 8px rgba(0,0,0,0.06)',
      minWidth: 180,
    }}>
      {meta.featured && (
        <Box sx={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          bgcolor: color, color: 'white', px: 1.5, py: 0.3,
          borderRadius: '0 0 8px 8px', fontSize: 9, fontWeight: 900, letterSpacing: 0.5, whiteSpace: 'nowrap',
        }}>
          ✦ MÁS ELEGIDO
        </Box>
      )}

      {/* Header */}
      <Box sx={{ mb: 1.5, mt: meta.featured ? 1.5 : 0 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 17, mb: 0.3, color }}>
          {meta.label}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1, lineHeight: 1.3 }}>
          {meta.tagline}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4 }}>
          <Typography sx={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>
            {formatCurrency(precioMes)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{diasLabel}</Typography>
        </Box>
        {periodo.dias > 30 && (
          <Typography sx={{ fontSize: 10.5, color: GREEN, fontWeight: 600, mt: 0.3 }}>
            Total: {formatCurrency(plan.precio)} · Ahorras {periodo.descuento}
          </Typography>
        )}

        {/* Doc limit badge */}
        {meta.fe && (
          <Box sx={{ mt: 1 }}>
            <Chip
              icon={<ReceiptLong sx={{ fontSize: 13 }} />}
              label={maxDocs ? `Hasta ${maxDocs} docs electrónicos/mes` : 'Docs electrónicos ilimitados'}
              size="small"
              sx={{
                fontSize: 10.5, fontWeight: 700,
                bgcolor: `${color}15`, color,
                border: `1px solid ${color}40`,
                height: 22,
                '& .MuiChip-icon': { color },
              }}
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Features */}
      <Box sx={{ flex: 1, mb: 2 }}>
        {meta.fe ? (
          <>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', mb: 0.8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Todo el sistema +
            </Typography>
            {FE_FEATURES.map((f, i) => <FeatureItem key={i} text={f} small />)}
          </>
        ) : (
          <>
            {BASE_FEATURES.slice(0, 6).map((f, i) => <FeatureItem key={i} text={f} small />)}
            <FeatureItem text="Facturación electrónica DIAN" included={false} small />
          </>
        )}
      </Box>

      {/* FE Requirements note */}
      {meta.fe && (
        <Box sx={{
          mb: 1.5, p: 1, borderRadius: 1.5, fontSize: 10,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
          border: '1px solid rgba(245,158,11,0.3)',
          color: ORANGE,
        }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.3, color: ORANGE }}>
            ⚠ Requisitos adicionales DIAN
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.4 }}>
            Resoluciones FE y POS ante la DIAN + firma digital vigente. Ksmart360 te acompaña en la configuración.
          </Typography>
        </Box>
      )}

      <WompiButton
        planName={plan.codigo_interno}
        onSuccess={() => window.location.reload()}
        sx={meta.featured ? { bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } } : {}}
      />
    </Box>
  );
};

// ── Sección normativa DIAN ───────────────────────────────────────────────────
const NormativaFE = ({ theme }) => (
  <Box sx={{ mt: 3 }}>
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GppGood sx={{ color: GREEN, fontSize: 18 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
            ¿Por qué necesito la Factura Electrónica? Marco normativo DIAN
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2, lineHeight: 1.6 }}>
          En Colombia, la <strong>facturación electrónica es obligatoria</strong> para todos los contribuyentes
          según la <strong>Ley 1943 de 2018</strong> y el <strong>Decreto 2242 de 2015</strong>.
          Adicionalmente, la <strong>Resolución DIAN 000165 de noviembre 2023</strong> exige que{' '}
          <strong>cada venta genere su propio documento electrónico</strong> en el momento de la transacción —
          sin excepción — incluyendo el{' '}
          <strong>Documento Equivalente Electrónico (DEE) / Tiquete POS electrónico</strong> para ventas
          a consumidor final.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
          {[
            { icon: '📋', title: 'Ley 1943/2018', desc: 'Establece la obligatoriedad de la factura electrónica para todos los contribuyentes del impuesto sobre la renta.' },
            { icon: '⚖️', title: 'Decreto 2242/2015', desc: 'Regula la expedición y entrega de facturas electrónicas en formato UBL 2.1 exigido por la DIAN.' },
            { icon: '🧾', title: 'Res. 000165/2023', desc: 'Obliga a emitir Documento Equivalente Electrónico (Tiquete POS) por cada venta a consumidor final, en tiempo real.' },
            { icon: '💰', title: 'Regla 5 UVT', desc: 'Ventas ≥ $261,030 COP (5 UVT 2026) exigen Factura Electrónica aunque el cliente no la solicite.' },
          ].map((item, i) => (
            <Box key={i} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#F9FAFB', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 18, mb: 0.5 }}>{item.icon}</Typography>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, mb: 0.3 }}>{item.title}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4 }}>{item.desc}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: theme.palette.mode === 'dark' ? `${GREEN}15` : '#F0FDF4', border: `1px solid ${GREEN}40` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
            <GppGood sx={{ color: GREEN, fontSize: 16 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: GREEN }}>Ksmart360 lo hace automáticamente</Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.5 }}>
            Con un plan que incluye FE, Ksmart360 emite el documento electrónico correcto en cada venta —
            Factura Electrónica o Tiquete POS — sin que tengas que hacer nada. Cumplimiento DIAN garantizado
            y sin riesgo de sanciones.
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 11.5, fontWeight: 700, mt: 2, mb: 1 }}>
          ¿Qué necesitas tener configurado?
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {DIAN_REQUIREMENTS.map((req, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, p: 1.2, borderRadius: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#FAFAFA', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 20, lineHeight: 1 }}>{req.icon}</Typography>
              <Box>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, mb: 0.2 }}>{req.title}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.4 }}>{req.desc}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  </Box>
);

// ── Main component ───────────────────────────────────────────────────────────
const SaaSUpgradeManager = ({ user }) => {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [planes, setPlanes]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [periodo, setPeriodo]         = useState(PERIODOS[0]);
  const theme = useTheme();

  const calcDaysLeft = (dateStr) => {
    if (!dateStr) return 0;
    const end = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return Math.ceil((end - new Date()) / 86400000);
  };

  const diasRestantes = calcDaysLeft(user?.empresa?.trial_ends_at);
  const isTrial = user?.empresa?.plan_type === 'trial' && user?.empresa_id !== 1;

  const handleOpen = async () => {
    setUpgradeOpen(true);
    if (planes.length === 0) {
      setLoading(true);
      try {
        const { data } = await apiClient.get('/planes-activos');
        setPlanes(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isTrial || diasRestantes <= 0) return null;

  const groups   = groupPlanes(planes);
  const planKeys = PLAN_ORDER.filter(k => groups[k][periodo.dias] || groups[k][30]);

  return (
    <>
      {/* TRIAL BANNER */}
      <Box sx={{
        mb: 3, p: 1.5, borderRadius: 2,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.15)' : '#EFF6FF',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.3)' : '#BFDBFE',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2,
      }}>
        <Typography sx={{ fontSize: 12, color: theme.palette.mode === 'dark' ? '#93C5FD' : '#1E3A8A', fontWeight: 600 }}>
          ⏱ Estás en tu periodo de prueba. Te quedan {diasRestantes} días gratis.
        </Typography>
        <Button size="small" variant="contained" onClick={handleOpen}
          sx={{ bgcolor: BLUE, fontSize: 11, fontWeight: 700, boxShadow: 'none' }}>
          Activar mi cuenta
        </Button>
      </Box>

      {/* MODAL */}
      <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { borderRadius: 3, bgcolor: 'background.default' } }}>

        {/* Header */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(244,63,94,0.1)', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WorkspacePremium fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 17, lineHeight: 1.2 }}>Elige tu Plan</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>14 días de prueba gratis al registrarse</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setUpgradeOpen(false)} size="small"><Close /></IconButton>
        </Box>

        <DialogContent sx={{ p: { xs: 2, md: 3 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: ACCENT }} />
            </Box>
          ) : (
            <>
              {/* Periodo toggle */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Box sx={{ display: 'inline-flex', gap: 0.5, p: 0.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#F3F4F6', borderRadius: 2 }}>
                  {PERIODOS.map(p => (
                    <Box key={p.dias} onClick={() => setPeriodo(p)} sx={{
                      px: 2, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 0.8,
                      bgcolor: periodo.dias === p.dias ? (theme.palette.mode === 'dark' ? '#1F1F1F' : 'white') : 'transparent',
                      boxShadow: periodo.dias === p.dias ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                      transition: 'all 0.15s',
                    }}>
                      <Typography sx={{ fontSize: 13, fontWeight: periodo.dias === p.dias ? 700 : 500, color: periodo.dias === p.dias ? 'text.primary' : 'text.secondary' }}>
                        {p.label}
                      </Typography>
                      {p.descuento && (
                        <Box sx={{ bgcolor: GREEN, color: 'white', px: 0.8, py: 0.1, borderRadius: 1, fontSize: 10, fontWeight: 800 }}>
                          {p.descuento}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Plan cards */}
              {planKeys.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'stretch' }}>
                  {planKeys.map(k => {
                    const plan = groups[k][periodo.dias] || groups[k][30];
                    return <PlanCard key={k} planKey={k} plan={plan} periodo={periodo} theme={theme} />;
                  })}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    No hay planes disponibles. Selecciona el periodo Mensual.
                  </Typography>
                </Box>
              )}

              {/* Normativa DIAN accordion */}
              <NormativaFE theme={theme} />

              {/* Footer */}
              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 2 }}>
                Pagos procesados por <strong>Wompi (Bancolombia)</strong> — Tarjeta, Nequi, PSE y QR
              </Typography>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SaaSUpgradeManager;
