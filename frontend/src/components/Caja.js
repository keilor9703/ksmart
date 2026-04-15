import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Divider, Tabs, Tab,
  TextField, Chip, Table, TableBody, TableCell, Stack, Autocomplete, Tooltip,
  TableContainer, TableHead, TableRow, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Alert, useTheme, useMediaQuery
} from '@mui/material';
import {
  PointOfSale, CheckCircle, Close, Add,
  TrendingUp, AttachMoney, CreditCard, AccountBalance,
  Refresh, ReceiptLong, MoneyOff
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import CurrencyField from './CurrencyField';
import QuickCreateModal from './QuickCreateModal';

const ACCENT = '#FF6020';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';
const YELLOW = '#F59E0B';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub }) => (
  <Paper sx={{ 
    p: 2, borderRadius: 3, 
    display: 'flex', alignItems: 'center', gap: 1.5, 
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
  }}>
    <Box sx={{ 
      width: 42, height: 42, borderRadius: 2, flexShrink: 0, 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      bgcolor: `${color}18`, color 
    }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{sub}</Typography>}
    </Box>
  </Paper>
);

// ─── Método Row ────────────────────────────────────────────────────────────────
const MetodoRow = ({ icon, label, value, color }) => (
  <Box sx={{ 
    display: 'flex', alignItems: 'center', gap: 1.5, 
    py: 1.2, borderBottom: '1px solid', borderColor: 'divider' 
  }}>
    <Box sx={{ 
      width: 30, height: 30, borderRadius: 1.5, 
      bgcolor: `${color}15`, 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      color, flexShrink: 0 
    }}>
      {icon}
    </Box>
    <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color }}>{formatCurrency(value)}</Typography>
  </Box>
);

// ─── Gasto Card Mobile ─────────────────────────────────────────────────────────
const GastoCard = ({ gasto }) => (
  <Paper sx={{ p: 2, mb: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.3 }}>
          {gasto.tercero?.nombre}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
          {gasto.concepto}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={gasto.metodo_pago} 
            size="small" 
            sx={{ 
              fontSize: 10, 
              height: 20, 
              bgcolor: 'action.hover', 
              fontWeight: 600 
            }} 
          />
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {new Date(gasto.fecha).toLocaleDateString()}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 16, color: RED, ml: 1 }}>
        {formatCurrency(gasto.monto)}
      </Typography>
    </Box>
  </Paper>
);

// ─── Corte Card Mobile ─────────────────────────────────────────────────────────
const CorteCard = ({ corte }) => {
  const dif = corte.diferencia;
  const difColor = dif === 0 ? 'text.primary' : dif > 0 ? BLUE : RED;
  
  return (
    <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
            {new Date(corte.fecha).toLocaleDateString('es-CO', { 
              day: '2-digit', month: 'short', year: 'numeric' 
            })}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            Corte #{corte.id}
          </Typography>
        </Box>
        <Chip 
          label={corte.estado} 
          size="small" 
          sx={{ 
            bgcolor: corte.estado === 'cerrado' ? `${GREEN}15` : `${YELLOW}15`, 
            color: corte.estado === 'cerrado' ? GREEN : YELLOW, 
            fontWeight: 600, 
            fontSize: 10, 
            borderRadius: 1.5 
          }} 
        />
      </Box>
      
      <Divider sx={{ my: 1.5 }} />
      
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {[
          { label: 'Ingresos', val: corte.total_ventas_dia, color: ACCENT },
          { label: 'Gastos', val: corte.total_gastos || 0, color: RED },
          { label: 'Efectivo Sist.', val: corte.total_efectivo_ventas, color: GREEN },
          { label: 'Efectivo Físico', val: corte.efectivo_fisico, color: BLUE },
        ].map(({ label, val, color }) => (
          <Grid item xs={6} key={label}>
            <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', mb: 0.2 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color }}>
                {formatCurrency(val)}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      
      {dif !== 0 && (
        <Box sx={{ 
          mt: 1.5, pt: 1.5, 
          borderTop: '1px dashed', 
          borderColor: 'divider', 
          textAlign: 'center' 
        }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.3 }}>
            {dif > 0 ? 'Sobrante' : 'Faltante'}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: difColor }}>
            {dif === 0 ? '—' : dif > 0 ? `+${formatCurrency(dif)}` : formatCurrency(dif)}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function Caja() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [tab, setTab] = useState(0);

  // Estados Cierre Caja
  const [preview, setPreview] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [efectivoFisico, setEfectivoFisico] = useState(0);
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estados Gastos
  const [gastos, setGastos] = useState([]);
  const [terceros, setTerceros] = useState([]);
  const [loadingGastos, setLoadingGastos] = useState(false);

  // Formulario Gasto
  const [gastoTercero, setGastoTercero] = useState(null);
  const [terceroInput, setTerceroInput] = useState('');
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoConcepto, setGastoConcepto] = useState('');
  const [gastoMetodo, setGastoMetodo] = useState('Efectivo');

  // QuickCreate
  const [quickCreate, setQuickCreate] = useState({ 
    open: false, type: 'tercero', initialName: '' 
  });

  useEffect(() => { 
    fetchPreview(); 
    fetchHistorial(); 
    fetchGastos(); 
    fetchTerceros(); 
  }, []);

  // ── API Calls ──────────────────────────────────────────────────────────────
  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await apiClient.get('/caja/corte/preview');
      setPreview(data);
    } catch { 
      toast.error('Error al cargar el resumen del día'); 
    } finally { 
      setLoadingPreview(false); 
    }
  };

  const fetchHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const { data } = await apiClient.get('/caja/cortes');
      setHistorial(data);
    } catch { 
      /* silencioso */ 
    } finally { 
      setLoadingHistorial(false); 
    }
  };

  const fetchGastos = async () => {
    setLoadingGastos(true);
    try {
      const { data } = await apiClient.get('/caja/gastos');
      setGastos(data);
    } catch { 
      toast.error('Error al cargar historial de gastos'); 
    } finally { 
      setLoadingGastos(false); 
    }
  };

  const fetchTerceros = async () => {
    try {
      const { data } = await apiClient.get('/clientes/');
      setTerceros(data);
    } catch { 
      /* silencioso */ 
    }
  };

  const handleCerrarCaja = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/caja/corte', { 
        efectivo_fisico: efectivoFisico, 
        observaciones 
      });
      toast.success('¡Caja cerrada exitosamente!');
      setOpenDialog(false); 
      setEfectivoFisico(0); 
      setObservaciones('');
      fetchPreview(); 
      fetchHistorial();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cerrar la caja');
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    if (!gastoTercero || !gastoMonto || !gastoConcepto) {
      toast.warning('Completa todos los campos obligatorios del gasto.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/caja/gastos', {
        tercero_id: gastoTercero.id,
        monto: parseFloat(gastoMonto),
        concepto: gastoConcepto,
        metodo_pago: gastoMetodo
      });
      toast.success('Gasto registrado correctamente');
      setGastoTercero(null); 
      setTerceroInput(''); 
      setGastoMonto(''); 
      setGastoConcepto('');
      fetchGastos(); 
      fetchPreview();
    } catch (err) {
      toast.error('Error al registrar el gasto');
    } finally { 
      setSubmitting(false); 
    }
  };

  // ── QuickCreate Handlers ───────────────────────────────────────────────────
  const openQuickCreate = (initialName = '') => 
    setQuickCreate({ open: true, type: 'tercero', initialName });
  
  const closeQuickCreate = () => 
    setQuickCreate({ ...quickCreate, open: false });
  
  const handleQuickCreated = (nuevoTercero) => {
    setTerceros(prev => [...prev, nuevoTercero]);
    setGastoTercero(nuevoTercero);
    setTerceroInput(nuevoTercero.nombre);
    closeQuickCreate();
  };

  const diferencia = efectivoFisico - (preview?.efectivo || 0);

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Header ── */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        mb: 3, 
        flexWrap: 'wrap', 
        gap: 2 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ 
            width: 40, height: 40, borderRadius: 2, 
            bgcolor: `${ACCENT}18`, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: ACCENT 
          }}>
            <PointOfSale />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              Control de Caja
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              Arqueo, cortes y gastos menores
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Tabs ── */}
      <Paper sx={{ 
        borderRadius: 3, 
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
        overflow: 'hidden', 
        mb: 3 
      }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)} 
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons="auto"
          sx={{ 
            px: 2, 
            borderBottom: '1px solid', 
            borderColor: 'divider', 
            '& .MuiTab-root': { 
              fontWeight: 600, 
              fontSize: 13, 
              textTransform: 'none', 
              minHeight: 52 
            }, 
            '& .MuiTabs-indicator': { 
              backgroundColor: ACCENT, 
              height: 3, 
              borderRadius: 3 
            }, 
            '& .Mui-selected': { color: `${ACCENT} !important` } 
          }}
        >
          <Tab label="Corte y Resumen" />
          <Tab label="Registrar Gasto (Egreso)" />
        </Tabs>
      </Paper>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 0: RESUMEN Y CORTE ──────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <TabPanel value={tab} index={0} sx={{ pt: 0 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          mb: 2, 
          gap: 1, 
          flexWrap: 'wrap' 
        }}>
          <Button 
            variant="outlined" 
            startIcon={<Refresh />} 
            onClick={fetchPreview} 
            size="small" 
            sx={{ 
              borderRadius: 2, 
              fontWeight: 600, 
              borderColor: 'divider', 
              color: 'text.secondary' 
            }}
          >
            Actualizar
          </Button>
          <Button 
            variant="contained" 
            startIcon={<PointOfSale />} 
            onClick={() => setOpenDialog(true)} 
            size="small" 
            sx={{ 
              background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, 
              boxShadow: `0 4px 14px rgba(255,96,32,0.3)`, 
              borderRadius: 2, 
              fontWeight: 600 
            }}
          >
            Cerrar Caja
          </Button>
        </Box>

        {loadingPreview ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: ACCENT }} />
          </Box>
        ) : preview && (
          <>
            {/* KPIs */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}>
                <KpiCard 
                  label="Ingresos del día" 
                  value={formatCurrency(preview.total_dia)} 
                  icon={<TrendingUp />} 
                  color={ACCENT} 
                  sub={preview.fecha} 
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard 
                  label="Efectivo (Caja)" 
                  value={formatCurrency(preview.efectivo)} 
                  icon={<AttachMoney />} 
                  color={GREEN} 
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard 
                  label="Transferencias" 
                  value={formatCurrency(preview.transferencia)} 
                  icon={<AccountBalance />} 
                  color={BLUE} 
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <KpiCard 
                  label="Gastos (Salidas)" 
                  value={formatCurrency(preview.total_gastos)} 
                  icon={<MoneyOff />} 
                  color={RED} 
                />
              </Grid>
            </Grid>

            {/* Desglose Métodos */}
            <Paper sx={{ 
              p: 2.5, borderRadius: 3, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', 
              mb: 2 
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>
                Dinero disponible por método — hoy
              </Typography>
              <MetodoRow 
                icon={<AttachMoney sx={{ fontSize: 16 }} />}  
                label="Efectivo"       
                value={preview.efectivo}     
                color={GREEN}  
              />
              <MetodoRow 
                icon={<AccountBalance sx={{ fontSize: 16 }} />} 
                label="Transferencia" 
                value={preview.transferencia} 
                color={BLUE}   
              />
              <MetodoRow 
                icon={<CreditCard sx={{ fontSize: 16 }} />}   
                label="Tarjeta"        
                value={preview.tarjeta}      
                color={YELLOW} 
              />
              
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                pt: 1.5, pb: 1 
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: RED }}>
                  (-) Total Egresos/Gastos
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: RED }}>
                  {formatCurrency(preview.total_gastos)}
                </Typography>
              </Box>

              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                pt: 1.5, 
                borderTop: '2px solid', 
                borderColor: 'divider' 
              }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  Saldo Neto (Ingresos - Gastos)
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: ACCENT }}>
                  {formatCurrency(preview.total_dia - preview.total_gastos)}
                </Typography>
              </Box>

              {(preview.ventas_contado > 0 || preview.abonos_cartera > 0) && (
                <Box sx={{ 
                  mt: 2, pt: 1.5, 
                  borderTop: '1px dashed', 
                  borderColor: 'divider' 
                }}>
                  <Typography sx={{ 
                    fontSize: 11, fontWeight: 600, 
                    color: 'text.secondary', 
                    textTransform: 'uppercase', 
                    letterSpacing: 0.6, mb: 1 
                  }}>
                    Por origen de ingreso
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ 
                      flex: 1, p: 1.2, borderRadius: 2, 
                      bgcolor: `${GREEN}08`, 
                      border: `1px solid ${GREEN}20`, 
                      textAlign: 'center',
                      minWidth: isMobile ? '100%' : 'auto'
                    }}>
                      <Typography sx={{ 
                        fontSize: 10, 
                        color: 'text.secondary', 
                        mb: 0.3 
                      }}>
                        Ventas contado ({preview.num_ventas || 0})
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>
                        {formatCurrency(preview.ventas_contado || 0)}
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      flex: 1, p: 1.2, borderRadius: 2, 
                      bgcolor: `${BLUE}08`, 
                      border: `1px solid ${BLUE}20`, 
                      textAlign: 'center',
                      minWidth: isMobile ? '100%' : 'auto'
                    }}>
                      <Typography sx={{ 
                        fontSize: 10, 
                        color: 'text.secondary', 
                        mb: 0.3 
                      }}>
                        Abonos cartera ({preview.num_abonos || 0})
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: BLUE }}>
                        {formatCurrency(preview.abonos_cartera || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </Paper>
          </>
        )}

        {/* Historial de Cortes */}
        <Paper sx={{ 
          p: 2.5, borderRadius: 3, 
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>
            Historial de cortes
          </Typography>
          
          {loadingHistorial ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          ) : historial.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <PointOfSale sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
              <Typography fontSize={13}>No hay cortes registrados</Typography>
            </Box>
          ) : isMobile ? (
            /* VISTA MOBILE - CARDS */
            <Box>
              {historial.map(c => (
                <CorteCard key={c.id} corte={c} />
              ))}
            </Box>
          ) : (
            /* VISTA DESKTOP - TABLA */
            <TableContainer sx={{ 
              borderRadius: 2, 
              border: '1px solid', 
              borderColor: 'divider', 
              overflowX: 'auto' 
            }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Fecha', 'Ingresos Día', 'Gastos', 'Efectivo Sist.', 'Efectivo Físico', 'Diferencia', 'Estado'].map(h => (
                      <TableCell key={h} sx={{ fontSize: 11 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historial.map(c => {
                    const dif = c.diferencia;
                    const difColor = dif === 0 ? 'text.primary' : dif > 0 ? BLUE : RED;
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {new Date(c.fecha).toLocaleDateString('es-CO', { 
                            day: '2-digit', month: 'short', year: 'numeric' 
                          })}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {formatCurrency(c.total_ventas_dia)}
                        </TableCell>
                        <TableCell sx={{ color: RED, fontWeight: 600 }}>
                          {formatCurrency(c.total_gastos || 0)}
                        </TableCell>
                        <TableCell sx={{ color: GREEN, fontWeight: 600 }}>
                          {formatCurrency(c.total_efectivo_ventas)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(c.efectivo_fisico)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: difColor }}>
                          {dif === 0 ? '—' : dif > 0 ? `+${formatCurrency(dif)}` : formatCurrency(dif)}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={c.estado} 
                            size="small" 
                            sx={{ 
                              bgcolor: c.estado === 'cerrado' ? `${GREEN}15` : `${YELLOW}15`, 
                              color: c.estado === 'cerrado' ? GREEN : YELLOW, 
                              fontWeight: 600, 
                              fontSize: 10, 
                              borderRadius: 1.5 
                            }} 
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </TabPanel>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: REGISTRO DE GASTOS ───────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <TabPanel value={tab} index={1} sx={{ pt: 0 }}>
        <Grid container spacing={3}>
          {/* Formulario Registro */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ 
              p: 3, borderRadius: 3, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 2 }}>
                Registrar nuevo gasto
              </Typography>
              <Box component="form" onSubmit={handleRegistrarGasto}>
                <Stack spacing={2}>
                  
                  {/* Beneficiario con QuickCreate */}
                  <Autocomplete
                    options={terceros}
                    getOptionLabel={(o) => o?.nombre || ''}
                    value={gastoTercero}
                    onChange={(_, v) => setGastoTercero(v)}
                    inputValue={terceroInput}
                    onInputChange={(_, v) => setTerceroInput(v)}
                    filterOptions={(opts, state) => {
                      const q = (state.inputValue || '').toLowerCase().trim();
                      if (!q) return opts;
                      return opts.filter(o => 
                        o.nombre.toLowerCase().includes(q) || 
                        (o.cedula || '').toLowerCase().includes(q)
                      );
                    }}
                    noOptionsText={
                      <Box sx={{ py: 0.5 }}>
                        <Typography sx={{ 
                          fontSize: 13, 
                          color: 'text.secondary', 
                          mb: 1 
                        }}>
                          No se encontró ningún beneficiario
                        </Typography>
                        <Button 
                          size="small" 
                          variant="contained" 
                          fullWidth 
                          startIcon={<Add />} 
                          onClick={() => openQuickCreate(terceroInput)}
                          sx={{ 
                            borderRadius: 2, 
                            fontWeight: 600, 
                            fontSize: 12, 
                            bgcolor: '#3B82F6', 
                            '&:hover': { bgcolor: '#2563EB' } 
                          }}
                        >
                          Crear "{terceroInput || 'nuevo beneficiario'}"
                        </Button>
                      </Box>
                    }
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Beneficiario (A quién se le paga) *" 
                        required 
                        fullWidth 
                        size="small"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {params.InputProps.endAdornment}
                              <Tooltip title="Crear nuevo proveedor/beneficiario">
                                <IconButton 
                                  size="small" 
                                  onClick={() => openQuickCreate(terceroInput)} 
                                  sx={{ color: '#3B82F6', p: 0.5 }}
                                >
                                  <Add fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ),
                        }}
                      />
                    )}
                  />

                  <TextField 
                    label="Concepto / Razón del gasto *" 
                    required 
                    fullWidth 
                    size="small" 
                    value={gastoConcepto} 
                    onChange={e => setGastoConcepto(e.target.value)} 
                    placeholder="Ej: Compra de insumos de aseo" 
                  />
                  
                  <CurrencyField 
                    label="Monto del gasto *" 
                    value={gastoMonto} 
                    onChange={setGastoMonto} 
                    required 
                  />
                  
                  <Box>
                    <Typography sx={{ 
                      fontSize: 11, fontWeight: 600, 
                      color: 'text.secondary', 
                      textTransform: 'uppercase', 
                      letterSpacing: 0.6, mb: 1 
                    }}>
                      Método de Pago (Salida)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {['Efectivo', 'Transferencia', 'Tarjeta'].map(opt => (
                        <Chip 
                          key={opt} 
                          label={opt} 
                          onClick={() => setGastoMetodo(opt)}
                          sx={{ 
                            fontWeight: 600, 
                            fontSize: 12, 
                            borderRadius: 1.5,
                            bgcolor: gastoMetodo === opt ? `${ACCENT}20` : 'background.paper',
                            color: gastoMetodo === opt ? ACCENT : 'text.secondary',
                            border: '1.5px solid', 
                            borderColor: gastoMetodo === opt ? ACCENT : 'divider',
                            '&:hover': { borderColor: ACCENT },
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                  
                  <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={submitting}
                    sx={{ 
                      mt: 1, 
                      background: `linear-gradient(135deg, ${RED}, #f87171)`, 
                      boxShadow: `0 4px 14px rgba(239,68,68,0.3)`, 
                      borderRadius: 2, 
                      fontWeight: 600 
                    }}
                  >
                    {submitting ? 'Guardando...' : 'Registrar Salida'}
                  </Button>
                </Stack>
              </Box>
            </Paper>
          </Grid>

          {/* Historial de Gastos */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ 
              p: 3, borderRadius: 3, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 2 }}>
                Historial de Gastos
              </Typography>
              
              {loadingGastos ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} sx={{ color: RED }} />
                </Box>
              ) : gastos.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <ReceiptLong sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                  <Typography fontSize={13}>No hay gastos registrados</Typography>
                </Box>
              ) : isMobile ? (
                /* VISTA MOBILE - CARDS */
                <Box>
                  {gastos.map(g => (
                    <GastoCard key={g.id} gasto={g} />
                  ))}
                </Box>
              ) : (
                /* VISTA DESKTOP - TABLA */
                <TableContainer sx={{ 
                  borderRadius: 2, 
                  border: '1px solid', 
                  borderColor: 'divider', 
                  maxHeight: 400 
                }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: 11 }}>Fecha</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>Beneficiario</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>Concepto</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>Método</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>Monto</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {gastos.map(g => (
                        <TableRow key={g.id} hover>
                          <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                            {new Date(g.fecha).toLocaleDateString()}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>
                            {g.tercero?.nombre}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {g.concepto}
                          </TableCell>
                          <TableCell sx={{ fontSize: 11 }}>
                            {g.metodo_pago}
                          </TableCell>
                          <TableCell sx={{ color: RED, fontWeight: 700 }}>
                            {formatCurrency(g.monto)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── DIALOG: CERRAR CAJA ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog 
        open={openDialog} 
        onClose={() => !submitting && setOpenDialog(false)} 
        maxWidth="xs" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ 
          sx: { 
            borderRadius: isMobile ? 0 : 3, 
            overflow: 'hidden', 
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)' 
          } 
        }}
      >
        <Box sx={{ height: 4, bgcolor: ACCENT }} />
        <DialogTitle sx={{ pb: 1, pt: 2.5, pr: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              width: 38, height: 38, borderRadius: 2, 
              bgcolor: `${ACCENT}15`, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: ACCENT 
            }}>
              <PointOfSale />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                Cerrar Caja
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {preview?.fecha}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            size="small" 
            onClick={() => setOpenDialog(false)} 
            disabled={submitting} 
            sx={{ 
              position: 'absolute', 
              right: 12, top: 16, 
              color: 'text.secondary' 
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Paper sx={{ 
            p: 1.5, mb: 2, borderRadius: 2, 
            bgcolor: 'action.hover', 
            boxShadow: 'none', 
            border: 'none' 
          }}>
            <Typography sx={{ 
              fontSize: 11, fontWeight: 600, 
              color: 'text.secondary', 
              textTransform: 'uppercase', 
              letterSpacing: 0.6, mb: 1 
            }}>
              Resumen del sistema
            </Typography>
            {[
              { label: 'Efectivo (Ingresos - Gastos)', val: preview?.efectivo, color: GREEN },
              { label: 'Transferencias', val: preview?.transferencia, color: BLUE },
              { label: 'Tarjeta / Otros', val: (preview?.tarjeta || 0) + (preview?.otros || 0), color: YELLOW },
            ].map(({ label, val, color }) => (
              <Box 
                key={label} 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  py: 0.4 
                }}
              >
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color }}>
                  {formatCurrency(val || 0)}
                </Typography>
              </Box>
            ))}
            <Divider sx={{ my: 0.8 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                Total en Caja Esperado
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>
                {formatCurrency(preview?.efectivo || 0)}
              </Typography>
            </Box>
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <CurrencyField 
              label="Efectivo físico contado" 
              value={efectivoFisico} 
              onChange={setEfectivoFisico} 
              helperText="Cuenta el dinero en caja y digita el total" 
            />
            {efectivoFisico > 0 && (
              <Alert 
                severity={diferencia === 0 ? 'success' : diferencia > 0 ? 'info' : 'error'} 
                sx={{ borderRadius: 2, fontSize: 13 }}
              >
                {diferencia === 0 
                  ? '✓ Cuadre exacto' 
                  : diferencia > 0 
                    ? `Sobrante: ${formatCurrency(Math.abs(diferencia))}` 
                    : `Faltante: ${formatCurrency(Math.abs(diferencia))}`
                }
              </Alert>
            )}
            <TextField 
              fullWidth 
              size="small" 
              multiline 
              rows={2} 
              label="Observaciones (opcional)" 
              value={observaciones} 
              onChange={e => setObservaciones(e.target.value)} 
              placeholder="Ej: Faltante por vuelto en efectivo..." 
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button 
            onClick={() => setOpenDialog(false)} 
            disabled={submitting} 
            variant="outlined" 
            size="small" 
            fullWidth={isMobile}
            sx={{ 
              borderRadius: 2, 
              fontWeight: 600, 
              borderColor: 'divider', 
              color: 'text.secondary', 
              flex: isMobile ? 1 : 'auto'
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleCerrarCaja} 
            disabled={submitting} 
            variant="contained" 
            size="small" 
            fullWidth={isMobile}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 16 }} />} 
            sx={{ 
              borderRadius: 2, 
              fontWeight: 600, 
              flex: isMobile ? 1 : 'auto', 
              background: `linear-gradient(135deg, ${ACCENT}, #ff9a62)`, 
              boxShadow: `0 4px 14px rgba(255,96,32,0.3)`, 
              color: '#fff' 
            }}
          >
            {submitting ? 'Cerrando…' : 'Confirmar cierre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── QuickCreate Modal ── */}
      <QuickCreateModal 
        open={quickCreate.open} 
        onClose={closeQuickCreate} 
        type={quickCreate.type} 
        initialName={quickCreate.initialName} 
        onCreated={handleQuickCreated} 
      />
    </Box>
  );
}