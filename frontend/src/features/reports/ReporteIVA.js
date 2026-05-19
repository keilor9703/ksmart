import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Stack, Button, Divider,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, AttachMoney, FileDownload, CalendarToday,
  AccountBalance, InfoOutlined,
} from '@mui/icons-material';
import apiClient from '../../api';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-toastify';
import { FilterPanel, KpiCard, LoadingState, GREEN, BLUE, RED } from './ReportShared';

// ─── Constantes ───────────────────────────────────────────────────────────────
const ACCENT = '#F43F5E';
const AMBER  = '#F59E0B';
const PURPLE = '#8B5CF6';
const SKY    = '#0EA5E9';

const currentYear = new Date().getFullYear();

const BIMESTRES = [
  { key: 'bim1', label: 'Bim. 1', start: `${currentYear}-01-01`, end: `${currentYear}-02-28` },
  { key: 'bim2', label: 'Bim. 2', start: `${currentYear}-03-01`, end: `${currentYear}-04-30` },
  { key: 'bim3', label: 'Bim. 3', start: `${currentYear}-05-01`, end: `${currentYear}-06-30` },
  { key: 'bim4', label: 'Bim. 4', start: `${currentYear}-07-01`, end: `${currentYear}-08-31` },
  { key: 'bim5', label: 'Bim. 5', start: `${currentYear}-09-01`, end: `${currentYear}-10-31` },
  { key: 'bim6', label: 'Bim. 6', start: `${currentYear}-11-01`, end: `${currentYear}-12-31` },
  { key: 'año',  label: `Año ${currentYear}`, start: `${currentYear}-01-01`, end: `${currentYear}-12-31` },
];

const getCurrentBimestre = () => {
  const month = new Date().getMonth() + 1; // 1-12
  if (month <= 2)  return 'bim1';
  if (month <= 4)  return 'bim2';
  if (month <= 6)  return 'bim3';
  if (month <= 8)  return 'bim4';
  if (month <= 10) return 'bim5';
  return 'bim6';
};

// ─── SubSection header ────────────────────────────────────────────────────────
const SectionHeader = ({ children, color }) => (
  <TableRow>
    <TableCell
      colSpan={2}
      sx={{
        bgcolor: `${color}12`,
        fontWeight: 800,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        color,
        py: 0.75,
        borderBottom: `2px solid ${color}30`,
      }}
    >
      {children}
    </TableCell>
  </TableRow>
);

// ─── Fila de tabla contable ───────────────────────────────────────────────────
const AccountRow = ({ label, value, color = 'text.primary', bold = false, indent = false, large = false }) => (
  <TableRow hover>
    <TableCell
      sx={{
        fontWeight: bold ? 700 : 400,
        fontSize: large ? 13 : 12,
        pl: indent ? 3.5 : 2,
        color: bold ? color : 'text.primary',
      }}
    >
      {label}
    </TableCell>
    <TableCell
      align="right"
      sx={{
        fontWeight: bold ? 800 : 600,
        fontSize: large ? 14 : 12,
        color,
        pr: 2,
      }}
    >
      {formatCurrency(value)}
    </TableCell>
  </TableRow>
);

// ─── Componente principal ─────────────────────────────────────────────────────
const ReporteIVA = ({ accentColor = ACCENT }) => {
  const initialBim  = getCurrentBimestre();
  const initialPreset = BIMESTRES.find(b => b.key === initialBim);

  const [startDate, setStartDate]       = useState(initialPreset?.start || '');
  const [endDate, setEndDate]           = useState(initialPreset?.end   || '');
  const [activeBimestre, setActiveBimestre] = useState(initialBim);
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(false);

  useEffect(() => { fetchReport(); }, []); // eslint-disable-line

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;
      const { data: res } = await apiClient.get('/reportes/iva-neto', { params });
      setData(res);
    } catch {
      toast.error('Error al generar el reporte tributario.');
    } finally {
      setLoading(false);
    }
  };

  const handleBimestreClick = (bim) => {
    setActiveBimestre(bim.key);
    setStartDate(bim.start);
    setEndDate(bim.end);
    // Fetch using bimestre dates directly (state update is async)
    setLoading(true);
    apiClient
      .get('/reportes/iva-neto', { params: { start_date: bim.start, end_date: bim.end } })
      .then(({ data: res }) => setData(res))
      .catch(() => toast.error('Error al generar el reporte tributario.'))
      .finally(() => setLoading(false));
  };

  const handleStartChange = (val) => {
    setStartDate(val);
    setActiveBimestre(null);
  };

  const handleEndChange = (val) => {
    setEndDate(val);
    setActiveBimestre(null);
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    setActiveBimestre(null);
    setTimeout(fetchReport, 0);
  };

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Concepto', 'Valor'],
      ['Ventas brutas', data.ventas_brutas],
      ['Base gravable ventas', data.base_gravable_ventas],
      ['IVA Generado (ventas)', data.iva_generado_ventas],
      ['Compras brutas', data.compras_brutas],
      ['Base gravable compras', data.base_gravable_compras],
      ['IVA Descontable (compras)', data.iva_descontable_compras],
      ['IVA Neto', data.iva_neto_resultado],
      ['Estado', data.iva_neto_resultado >= 0 ? 'A pagar' : 'A favor'],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iva-reporte-${startDate || 'periodo'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Valores derivados ─────────────────────────────────────────────────────
  const ivaNeto  = data?.iva_neto_resultado ?? 0;
  const netColor = ivaNeto >= 0 ? RED : GREEN;
  const netLabel = ivaNeto >= 0 ? 'A pagar' : 'A favor';

  const icaEstimado = data ? (data.base_gravable_ventas ?? 0) * 0.01 : 0;

  // ─── Período visible ───────────────────────────────────────────────────────
  const periodoLabel = data?.periodo
    ? `${data.periodo.desde} — ${data.periodo.hasta}`
    : null;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Chips de bimestre ─────────────────────────────────────────────── */}
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CalendarToday sx={{ fontSize: 13, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.7 }}>
            Período bimestral DIAN
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {BIMESTRES.map(bim => {
            const isActive = activeBimestre === bim.key;
            return (
              <Chip
                key={bim.key}
                label={bim.label}
                size="small"
                icon={<CalendarToday sx={{ fontSize: '13px !important' }} />}
                variant={isActive ? 'filled' : 'outlined'}
                onClick={() => handleBimestreClick(bim)}
                sx={{
                  borderRadius: 1.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 11,
                  bgcolor: isActive ? accentColor : 'transparent',
                  color: isActive ? '#fff' : 'text.secondary',
                  borderColor: isActive ? accentColor : 'divider',
                  '& .MuiChip-icon': { color: isActive ? '#fff' : 'text.secondary' },
                  '&:hover': {
                    bgcolor: isActive ? accentColor : `${accentColor}15`,
                    borderColor: accentColor,
                  },
                }}
              />
            );
          })}
        </Stack>
      </Box>

      {/* ── FilterPanel (rango personalizado) ────────────────────────────── */}
      <FilterPanel
        startDate={startDate} onStartChange={handleStartChange}
        endDate={endDate}     onEndChange={handleEndChange}
        onFilter={fetchReport} onClear={handleClear}
        loading={loading}     accentColor={accentColor}
      />

      {/* ── Botón exportar CSV (fuera del loading) ────────────────────────── */}
      {data && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownload />}
            onClick={handleExportCSV}
            sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12 }}
          >
            Exportar CSV
          </Button>
        </Box>
      )}

      {/* ── Estado de carga ───────────────────────────────────────────────── */}
      {loading ? <LoadingState /> : !data ? null : (
        <>
          {/* Período mostrado */}
          {periodoLabel && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.5, fontWeight: 500 }}>
              Período: <strong>{periodoLabel}</strong>
            </Typography>
          )}

          {/* ── KPI Cards (5 cards) ──────────────────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2.5, width: '100%' }}>

            {/* Ventas brutas — GREEN */}
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard
                label="Ventas Brutas"
                value={formatCurrency(data.ventas_brutas)}
                icon={<TrendingUp />}
                color={GREEN}
                sub="Total facturado inc. IVA"
              />
            </Box>

            {/* Base gravable ventas — BLUE */}
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard
                label="Base Gravable Ventas"
                value={formatCurrency(data.base_gravable_ventas)}
                icon={<AccountBalance />}
                color={BLUE}
                sub="Ventas sin IVA"
              />
            </Box>

            {/* IVA Generado — AMBER */}
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard
                label="IVA Generado"
                value={formatCurrency(data.iva_generado_ventas)}
                icon={<TrendingUp />}
                color={AMBER}
                sub="IVA cobrado en ventas"
              />
            </Box>

            {/* IVA Descontable — PURPLE */}
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <KpiCard
                label="IVA Descontable"
                value={formatCurrency(data.iva_descontable_compras)}
                icon={<TrendingDown />}
                color={PURPLE}
                sub="IVA pagado en compras"
              />
            </Box>

            {/* IVA Neto — full width, large, dynamic color */}
            <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
              <Paper
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  bgcolor: `${netColor}08`,
                  border: `2px solid ${netColor}40`,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: `${netColor}18`,
                    color: netColor,
                  }}
                >
                  <AttachMoney sx={{ fontSize: 26 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 11, color: netColor, fontWeight: 700, mb: 0.3, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    IVA Neto — {netLabel}
                  </Typography>
                  <Typography sx={{ fontSize: 26, fontWeight: 900, color: netColor, lineHeight: 1 }}>
                    {formatCurrency(Math.abs(ivaNeto))}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.4 }}>
                    {ivaNeto >= 0
                      ? 'Debe declarar y pagar este valor a la DIAN (Form. 300)'
                      : 'Saldo a favor — puede solicitar devolución o compensación ante DIAN'}
                  </Typography>
                </Box>
                <Chip
                  label={netLabel.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: `${netColor}18`,
                    color: netColor,
                    fontWeight: 800,
                    fontSize: 11,
                    borderRadius: 1.5,
                    border: `1px solid ${netColor}40`,
                  }}
                />
              </Paper>
            </Box>
          </Box>

          {/* ── Tabla contable completa ──────────────────────────────────── */}
          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflowX: 'auto',
              width: '100%',
              boxSizing: 'border-box',
              mb: 2.5,
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Concepto</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>

                {/* — VENTAS — */}
                <SectionHeader color={GREEN}>Ventas</SectionHeader>
                <AccountRow
                  label="Ventas brutas totales (inc. IVA)"
                  value={data.ventas_brutas}
                  indent
                />
                <AccountRow
                  label="(-) IVA incluido en ventas"
                  value={data.iva_generado_ventas}
                  color="text.secondary"
                  indent
                />
                <AccountRow
                  label="= Base gravable ventas"
                  value={data.base_gravable_ventas}
                  color={BLUE}
                  bold
                  indent
                />
                <AccountRow
                  label="IVA generado (≈19% s/ base gravable)"
                  value={data.iva_generado_ventas}
                  color={GREEN}
                  bold
                  indent
                />

                {/* — COMPRAS — */}
                <SectionHeader color={BLUE}>Compras</SectionHeader>
                <AccountRow
                  label="Compras brutas totales (inc. IVA)"
                  value={data.compras_brutas}
                  indent
                />
                <AccountRow
                  label="(-) IVA incluido en compras"
                  value={data.iva_descontable_compras}
                  color="text.secondary"
                  indent
                />
                <AccountRow
                  label="= Base gravable compras"
                  value={data.base_gravable_compras}
                  color={BLUE}
                  bold
                  indent
                />
                <AccountRow
                  label="IVA descontable (crédito fiscal)"
                  value={data.iva_descontable_compras}
                  color={PURPLE}
                  bold
                  indent
                />

                {/* — RESULTADO — */}
                <SectionHeader color={netColor}>Resultado</SectionHeader>
                <TableRow sx={{ bgcolor: `${netColor}08` }}>
                  <TableCell
                    sx={{
                      fontWeight: 900,
                      fontSize: 14,
                      color: netColor,
                      pl: 2,
                    }}
                  >
                    IVA Neto — {netLabel}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 900,
                      fontSize: 15,
                      color: netColor,
                      pr: 2,
                    }}
                  >
                    {formatCurrency(Math.abs(ivaNeto))}
                  </TableCell>
                </TableRow>

              </TableBody>
            </Table>
          </TableContainer>

          {/* ── Estimado ICA ─────────────────────────────────────────────── */}
          <Paper
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${SKY}30`,
              bgcolor: `${SKY}06`,
              mb: 2.5,
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: `${SKY}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: SKY,
                  flexShrink: 0,
                }}
              >
                <AccountBalance sx={{ fontSize: 18 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: SKY }}>
                  Estimado ICA — Industria y Comercio
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18, color: SKY }}>
                  {formatCurrency(icaEstimado)}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 1, borderColor: `${SKY}20` }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              Calculado sobre base gravable ventas ({formatCurrency(data.base_gravable_ventas)}) × tasa estimada 10‰ (1%).
              Verifica la tarifa vigente de tu municipio con tu contador — la tasa varía según actividad económica y localidad.
            </Typography>
          </Paper>

          {/* ── Guía DIAN ─────────────────────────────────────────────────── */}
          <Paper
            sx={{
              p: 2,
              borderRadius: 2.5,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <InfoOutlined sx={{ fontSize: 18, color: AMBER }} />
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                Información tributaria Colombia
              </Typography>
            </Box>
            <Stack spacing={0.75}>
              {[
                'Declaración de IVA: Formulario 300 ante DIAN.',
                'Período: Bimestral (grandes contribuyentes y responsables del régimen común).',
                'Tarifa general IVA: 19% | Bienes especiales: 5% | Excluidos: 0%.',
                'Tasa ReteIVA (si aplica): 15% sobre IVA facturado — aplica cuando el comprador es gran contribuyente o agente retenedor.',
                'Nota: Este reporte muestra IVA consolidado. Consulta tu contador para la declaración definitiva.',
              ].map((text, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Typography sx={{ fontSize: 13, color: AMBER, flexShrink: 0, lineHeight: 1.6 }}>•</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.6 }}>
                    {text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default ReporteIVA;
