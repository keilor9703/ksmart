import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Chip, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, LinearProgress,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, AttachMoney, AccountBalance, FileDownload,
  CalendarToday, Assessment, Info,
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import { FilterPanel, KpiCard, LoadingState, GREEN, BLUE, RED } from './ReportShared';

const ACCENT = '#F43F5E';
const YELLOW = '#F59E0B';
const PURPLE = '#8B5CF6';

const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`; };
const today = () => fmt(new Date());

const PRESETS = [
  { key: 'mes',      label: 'Este mes'      },
  { key: 'trim',     label: 'Trimestre'     },
  { key: 'semestre', label: 'Semestre'      },
  { key: 'año',      label: 'Este año'      },
];

// eslint-disable-next-line no-unused-vars
const PnLRow = ({ label, value, color = 'text.primary', bold = false, indent = 0, borderTop = false, negative = false }) => (
  <TableRow sx={borderTop ? { borderTop: '2px solid', borderColor: 'divider' } : {}}>
    <TableCell sx={{ fontWeight: bold ? 800 : 400, fontSize: bold ? 13 : 12, pl: 2 + indent * 2, color: 'text.primary' }}>
      {label}
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: bold ? 800 : 600, fontSize: bold ? 14 : 12, color: negative ? RED : color, whiteSpace: 'nowrap' }}>
      {negative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value)}
    </TableCell>
    <TableCell align="right" sx={{ width: 80, color: 'text.disabled', fontSize: 11 }}>
      {/* placeholder for % column */}
    </TableCell>
  </TableRow>
);

const ReporteEstadoResultados = ({ accentColor = ACCENT }) => {
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate]     = useState(today());
  const [activePreset, setActivePreset] = useState('mes');
  const [loading, setLoading]     = useState(false);
  const [ventasSummary, setVentasSummary] = useState(null);
  const [rentabilidad, setRentabilidad]   = useState([]);
  const [ivaData, setIvaData]             = useState(null);

  const applyPreset = (key) => {
    const now = new Date();
    let s, e;
    if (key === 'mes') {
      s = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
      e = fmt(now);
    } else if (key === 'trim') {
      const d = new Date(now); d.setMonth(now.getMonth() - 2); d.setDate(1);
      s = fmt(d); e = fmt(now);
    } else if (key === 'semestre') {
      const d = new Date(now); d.setMonth(now.getMonth() - 5); d.setDate(1);
      s = fmt(d); e = fmt(now);
    } else {
      s = `${now.getFullYear()}-01-01`; e = fmt(now);
    }
    setStartDate(s); setEndDate(e); setActivePreset(key);
  };

  const fetchAll = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      const [vs, rent, iva] = await Promise.all([
        apiClient.get('/reportes/ventas_summary', { params }),
        apiClient.get('/reportes/rentabilidad_productos', { params }),
        apiClient.get('/reportes/iva-neto', { params }),
      ]);
      setVentasSummary(vs.data);
      setRentabilidad(rent.data);
      setIvaData(iva.data);
    } catch { toast.error('Error al cargar el estado de resultados.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  // Computed P&L values
  const ingresosVentas   = rentabilidad.reduce((s, i) => s + i.total_revenue, 0);
  const cmv              = rentabilidad.reduce((s, i) => s + i.total_cost, 0);
  const utilidadBruta    = ingresosVentas - cmv;
  const margenBruto      = ingresosVentas > 0 ? (utilidadBruta / ingresosVentas * 100) : 0;
  const ivaAplicar       = ivaData?.iva_neto_resultado ?? 0;
  const productosTop     = [...rentabilidad].sort((a, b) => b.net_profit - a.net_profit).slice(0, 5);
  const productosNeg     = [...rentabilidad].filter(i => i.net_profit < 0);

  const handleExportCSV = () => {
    const rows = [
      ['Estado de Resultados', `${startDate} al ${endDate}`],
      [''],
      ['INGRESOS', ''],
      ['Ingresos por ventas', ingresosVentas],
      [''],
      ['COSTOS', ''],
      ['CMV (Costo mercancía vendida)', cmv],
      [''],
      ['UTILIDAD BRUTA', utilidadBruta],
      ['Margen bruto %', margenBruto.toFixed(2)],
      [''],
      ['TRIBUTARIO', ''],
      ['IVA generado', ivaData?.iva_generado_ventas ?? 0],
      ['IVA descontable', ivaData?.iva_descontable_compras ?? 0],
      ['IVA neto (a pagar / a favor)', ivaAplicar],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `estado-resultados-${startDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Preset chips */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {PRESETS.map(p => (
            <Chip
              key={p.key}
              label={p.label}
              size="small"
              icon={<CalendarToday sx={{ fontSize: '14px !important' }} />}
              onClick={() => { applyPreset(p.key); setTimeout(fetchAll, 0); }}
              sx={{
                borderRadius: 1.5, fontWeight: 600, cursor: 'pointer',
                bgcolor: activePreset === p.key ? accentColor : 'transparent',
                color: activePreset === p.key ? '#fff' : 'text.secondary',
                border: '1px solid', borderColor: activePreset === p.key ? accentColor : 'divider',
              }}
            />
          ))}
        </Stack>
      </Box>

      <FilterPanel
        startDate={startDate} onStartChange={v => { setStartDate(v); setActivePreset(null); }}
        endDate={endDate}     onEndChange={v => { setEndDate(v); setActivePreset(null); }}
        onFilter={fetchAll}   onClear={() => { applyPreset('mes'); setTimeout(fetchAll, 0); }}
        loading={loading}     accentColor={accentColor}
      />

      {loading && <LoadingState />}

      {!loading && ventasSummary && (
        <>
          {/* KPI row */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
            <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 140 }}>
              <KpiCard label="Ingresos ventas" value={formatCurrency(ingresosVentas)} icon={<AttachMoney />} color={GREEN} sub="Período seleccionado" />
            </Box>
            <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 140 }}>
              <KpiCard label="CMV" value={formatCurrency(cmv)} icon={<TrendingDown />} color={RED} sub={`${ingresosVentas > 0 ? (cmv/ingresosVentas*100).toFixed(1) : 0}% de ingresos`} />
            </Box>
            <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 140 }}>
              <KpiCard
                label="Utilidad bruta"
                value={formatCurrency(utilidadBruta)}
                icon={<TrendingUp />}
                color={utilidadBruta >= 0 ? GREEN : RED}
                sub={`Margen: ${margenBruto.toFixed(1)}%`}
              />
            </Box>
            <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 140 }}>
              <KpiCard label="IVA neto" value={formatCurrency(Math.abs(ivaAplicar))} icon={<AccountBalance />} color={ivaAplicar >= 0 ? RED : GREEN} sub={ivaAplicar >= 0 ? 'A pagar DIAN' : 'A favor'} />
            </Box>
            <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 140 }}>
              <KpiCard label="Ventas en cartera" value={formatCurrency(ventasSummary?.total_pendiente ?? 0)} icon={<Assessment />} color={YELLOW} sub="Sin cobrar" />
            </Box>
            <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 140 }}>
              <KpiCard label="Productos con pérdida" value={productosNeg.length} icon={<TrendingDown />} color={productosNeg.length > 0 ? RED : GREEN} sub="Margen negativo" />
            </Box>
          </Box>

          {/* Margen bruto progress */}
          <Paper sx={{ p: 2, borderRadius: 2.5, mb: 2.5, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 12 }}>Margen bruto</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: margenBruto >= 30 ? GREEN : margenBruto >= 15 ? YELLOW : RED }}>
                {margenBruto.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(Math.max(margenBruto, 0), 100)}
              sx={{
                height: 8, borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  bgcolor: margenBruto >= 30 ? GREEN : margenBruto >= 15 ? YELLOW : RED,
                  borderRadius: 4,
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>Objetivo mín.: 15%</Typography>
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>Objetivo óptimo: 30%+</Typography>
            </Box>
          </Paper>

          {/* Estado de Resultados P&L table */}
          <Paper sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', boxShadow: 'none', mb: 2.5, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, bgcolor: 'action.hover' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Estado de Resultados — {startDate} al {endDate}</Typography>
              <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={handleExportCSV} sx={{ borderRadius: 2, fontWeight: 600 }}>
                CSV
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Concepto</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Valor</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 80 }}>% Ingr.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* INGRESOS */}
                  <TableRow sx={{ bgcolor: `${GREEN}08` }}>
                    <TableCell colSpan={3} sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: GREEN, py: 0.8 }}>
                      Ingresos
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell sx={{ pl: 4, fontSize: 12 }}>Ventas brutas</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: GREEN }}>{formatCurrency(ingresosVentas)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, color: 'text.disabled' }}>100%</TableCell>
                  </TableRow>

                  {/* COSTOS */}
                  <TableRow sx={{ bgcolor: `${RED}08` }}>
                    <TableCell colSpan={3} sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: RED, py: 0.8 }}>
                      Costo de Ventas
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell sx={{ pl: 4, fontSize: 12 }}>(-) CMV — Costo mercancía vendida</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: RED }}>{formatCurrency(cmv)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, color: 'text.disabled' }}>
                      {ingresosVentas > 0 ? (cmv / ingresosVentas * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>

                  {/* UTILIDAD BRUTA */}
                  <TableRow sx={{ bgcolor: utilidadBruta >= 0 ? `${GREEN}12` : `${RED}12`, borderTop: '2px solid', borderColor: 'divider' }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: 13, pl: 2 }}>= Utilidad Bruta</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: 14, color: utilidadBruta >= 0 ? GREEN : RED }}>
                      {formatCurrency(utilidadBruta)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: margenBruto >= 30 ? GREEN : margenBruto >= 10 ? YELLOW : RED }}>
                      {margenBruto.toFixed(1)}%
                    </TableCell>
                  </TableRow>

                  {/* TRIBUTARIO */}
                  <TableRow sx={{ bgcolor: `${PURPLE}08` }}>
                    <TableCell colSpan={3} sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: PURPLE, py: 0.8 }}>
                      Tributario (IVA)
                    </TableCell>
                  </TableRow>
                  <TableRow hover>
                    <TableCell sx={{ pl: 4, fontSize: 12 }}>Base gravable ventas</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12 }}>{formatCurrency(ivaData?.base_gravable_ventas ?? 0)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow hover>
                    <TableCell sx={{ pl: 4, fontSize: 12 }}>IVA generado (ventas)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: RED }}>{formatCurrency(ivaData?.iva_generado_ventas ?? 0)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow hover>
                    <TableCell sx={{ pl: 4, fontSize: 12 }}>(-) IVA descontable (compras)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: GREEN }}>{formatCurrency(ivaData?.iva_descontable_compras ?? 0)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow sx={{ bgcolor: ivaAplicar >= 0 ? `${RED}10` : `${GREEN}10` }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: 12, pl: 2 }}>
                      IVA Neto — {ivaAplicar >= 0 ? 'A pagar DIAN' : 'A favor'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: ivaAplicar >= 0 ? RED : GREEN }}>
                      {formatCurrency(Math.abs(ivaAplicar))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Top 5 productos rentables */}
          {productosTop.length > 0 && (
            <Paper sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', boxShadow: 'none', mb: 2.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>Top 5 productos más rentables</Typography>
              {productosTop.map((item, i) => {
                const pct = ingresosVentas > 0 ? (item.total_revenue / ingresosVentas * 100) : 0;
                const color = item.net_profit >= 0 ? GREEN : RED;
                return (
                  <Box key={item.product_id} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: i < 3 ? `${accentColor}20` : 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: i < 3 ? accentColor : 'text.secondary' }}>
                          {i + 1}
                        </Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{item.product_name}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{formatCurrency(item.net_profit)}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{item.profit_margin.toFixed(1)}% margen</Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(pct, 100)}
                      sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 } }}
                    />
                    <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.3 }}>{pct.toFixed(1)}% de los ingresos</Typography>
                  </Box>
                );
              })}
            </Paper>
          )}

          {/* Nota contador */}
          <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: `${BLUE}08`, border: `1px solid ${BLUE}25`, boxShadow: 'none' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Info sx={{ color: BLUE, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 12, color: BLUE, mb: 0.5 }}>Nota para el contador</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.6 }}>
                  Este reporte es un estimado basado en las transacciones registradas. No incluye: amortizaciones, depreciaciones, gastos de nómina ni provisiones. Para la declaración de renta (Formulario 110) consulta también los gastos operativos registrados en el módulo de Caja/Gastos. El IVA mostrado es el neto contable — verifica con el Formulario 300 de DIAN.
                </Typography>
              </Box>
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default ReporteEstadoResultados;
