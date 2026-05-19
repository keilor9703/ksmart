import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, Grid,
  InputAdornment, IconButton, CircularProgress,
  Switch, FormControlLabel, Collapse, Dialog, DialogContent,
  AppBar, Toolbar, Slide, Paper, Stack, Divider, Autocomplete,
  Chip, Tooltip, List, ListItem, ListItemText, ListItemIcon
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  QrCodeScanner, Inventory, Close,
  ShoppingCart, Videocam, VideocamOff,
  Description, Science, Event, LocalOffer, Add, Category, Straighten,
  CheckCircle, AutoAwesome, FiberNew, History, TrendingUp,
  Search, WarningAmber, KeyboardReturn
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { apiClient, getProductoByBarcode } from '../../api';
import CurrencyField from '../../components/common/CurrencyField';
import { UNIDADES_MEDIDA } from '../../utils/constants';

const ACCENT = '#FF723B';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const HAS_BARCODE_DETECTOR = typeof window !== 'undefined' && 'BarcodeDetector' in window;
const HAS_CAMERA = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_e', 'code_39', 'itf'];

const fmtCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

// ─── Status banner config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  existing:  { color: GREEN,  icon: <CheckCircle  sx={{ fontSize: 18 }} />, label: 'Producto existente — actualizando datos' },
  suggested: { color: BLUE,   icon: <AutoAwesome  sx={{ fontSize: 18 }} />, label: 'Encontrado en catálogo global — completa precio y costo' },
  new:       { color: ACCENT, icon: <FiberNew      sx={{ fontSize: 18 }} />, label: 'Producto nuevo — completa la información' },
};

// ─── Inline margin indicator ───────────────────────────────────────────────────
const MargenBadge = ({ precio, costo }) => {
  const p = parseFloat(precio) || 0;
  const c = parseFloat(costo) || 0;
  if (!p || !c) return null;
  const pct = ((p - c) / p * 100);
  const abs = p - c;
  const color = pct >= 30 ? GREEN : pct >= 10 ? '#F59E0B' : '#EF4444';
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}10`, border: `1px solid ${color}30`, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Margen</Typography>
      <Typography sx={{ fontWeight: 900, fontSize: 22, color, lineHeight: 1 }}>{pct.toFixed(1)}%</Typography>
      <Typography sx={{ fontSize: 11, color, fontWeight: 600 }}>+{fmtCurrency(abs)}</Typography>
    </Box>
  );
};

const AgileBarcodeRegistration = ({ open, onClose, onProductoAdded }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading]         = useState(false);
  const [searching, setSearching]     = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [grupos, setGrupos]           = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Session tracking
  const [sessionLog, setSessionLog]   = useState([]);
  const [logOpen, setLogOpen]         = useState(false);
  const [productStatus, setProductStatus] = useState(null); // null | 'existing' | 'suggested' | 'new'

  const [formData, setFormData] = useState({
    nombre: '', codigo_barras: '', descripcion: '', precio: '', costo: '',
    stock_actual: '', stock_minimo: '', unidad_medida: 'UND', grupo_item: 2,
    es_servicio: false, maneja_lotes: false, numero_lote: '', fecha_vencimiento: ''
  });

  // Refs
  const videoRef      = useRef(null);
  const streamRef     = useRef(null);
  const rAFRef        = useRef(null);
  const zxingControlsRef = useRef(null);
  const barcodeRef    = useRef(null);
  const nombreRef     = useRef(null);
  const descRef       = useRef(null);
  const precioRef     = useRef(null);
  const costoRef      = useRef(null);
  const stockRef      = useRef(null);
  const loteRef       = useRef(null);

  const sessionStats = useMemo(() => ({
    total:      sessionLog.length,
    nuevos:     sessionLog.filter(e => e.accion === 'nuevo').length,
    actualizados: sessionLog.filter(e => e.accion === 'actualizado').length,
  }), [sessionLog]);

  useEffect(() => {
    if (open) {
      setTimeout(() => barcodeRef.current?.focus(), 500);
      apiClient.get('/grupos-producto/')
        .then(r => setGrupos(r.data || []))
        .catch(() => {});
    }
  }, [open]);

  // ── Ctrl+Enter / Ctrl+S to save ──
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, formData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Camera cleanup ──
  const cleanupCamera = useCallback(() => {
    if (rAFRef.current) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
    if (zxingControlsRef.current) { try { zxingControlsRef.current.stop(); } catch {} zxingControlsRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── Camera init ──
  useEffect(() => {
    if (!cameraActive) return;
    let active = true;

    (async () => {
      try {
        if (!HAS_CAMERA) { toast.error('Tu navegador no soporta acceso a cámara.'); setCameraActive(false); return; }

        const onBarcode = (code) => {
          if (!active) return;
          active = false;
          cleanupCamera(); setCameraActive(false);
          setFormData(prev => ({ ...prev, codigo_barras: code }));
          handleSearch(code);
        };

        if (HAS_BARCODE_DETECTOR) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
          if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
          let lastScan = 0;
          const tick = async () => {
            if (!active || !videoRef.current) return;
            const now = Date.now();
            if (now - lastScan >= 100) {
              lastScan = now;
              const v = videoRef.current;
              if (v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
                try { const codes = await detector.detect(v); if (codes.length > 0) { onBarcode(codes[0].rawValue); return; } } catch {}
              }
            }
            rAFRef.current = requestAnimationFrame(tick);
          };
          rAFRef.current = requestAnimationFrame(tick);
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (!active) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' } }, videoRef.current,
            (result) => { if (result && active) onBarcode(result.getText()); }
          );
          if (!active) { controls.stop(); return; }
          zxingControlsRef.current = controls;
        }
      } catch (err) {
        if (!active) return;
        cleanupCamera(); setCameraActive(false);
        if (err.name === 'NotAllowedError') toast.error('Acceso a cámara denegado. Revisa los permisos.');
        else if (err.name === 'NotFoundError') toast.error('No se detectó ninguna cámara en este dispositivo.');
        else toast.error('Error al iniciar la cámara. Intenta de nuevo.');
      }
    })();

    return () => { active = false; cleanupCamera(); };
  }, [cameraActive, cleanupCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) { cleanupCamera(); setCameraActive(false); }
  }, [open, cleanupCamera]);

  const handleToggleCamera = () => {
    if (cameraActive) { cleanupCamera(); setCameraActive(false); setTimeout(() => barcodeRef.current?.focus(), 100); }
    else setCameraActive(true);
  };

  const handleCreateGroup = async (nombre) => {
    const codigo = nombre.trim().substring(0, 4).toUpperCase().replace(/\s+/g, '');
    setCreatingGroup(true);
    try {
      const res = await apiClient.post('/grupos-producto/', { nombre: nombre.trim(), codigo, color: '#94a3b8', orden: 99 });
      const newGroup = res.data;
      setGrupos(prev => [...prev, newGroup]);
      setFormData(prev => ({ ...prev, grupo_item: newGroup.id }));
      toast.success(`Categoría "${newGroup.nombre}" creada`);
    } catch { toast.error('Error al crear la categoría'); }
    finally { setCreatingGroup(false); }
  };

  const playBeep = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  };

  const handleSearch = async (barcode) => {
    const code = (barcode || formData.codigo_barras || '').trim();
    if (!code) return;
    setSearching(true);
    setProductStatus(null);
    try {
      const res = await getProductoByBarcode(code);
      if (res.data) {
        const isExisting = res.data.id > 0;
        const isSuggested = res.data.id === 0 && res.data.nombre;
        setFormData(prev => ({
          ...prev,
          ...res.data,
          id: isExisting ? res.data.id : undefined,
          precio: isExisting ? (res.data.precio || '') : '',
          costo: isExisting ? (res.data.costo || '') : '',
          stock_actual: isExisting ? (res.data.stock_actual || '') : '',
          stock_minimo: isExisting ? (res.data.stock_minimo || '') : '',
          numero_lote: '', fecha_vencimiento: ''
        }));
        setProductStatus(isExisting ? 'existing' : isSuggested ? 'suggested' : 'new');
        if (isExisting) toast.info(`Producto encontrado: ${res.data.nombre}`);
        else toast.success(`Info obtenida automáticamente: ${res.data.nombre}`);
        playBeep('success');
        if (res.data.nombre) setTimeout(() => precioRef.current?.focus(), 150);
        else setTimeout(() => nombreRef.current?.focus(), 150);
      } else {
        setProductStatus('new');
        toast.warning('Código no encontrado — registra el nuevo producto');
        playBeep('success');
        setFormData(prev => ({ ...prev, nombre: '', precio: '', costo: '', descripcion: '', stock_actual: '', stock_minimo: '', maneja_lotes: false, numero_lote: '', fecha_vencimiento: '', id: undefined }));
        setTimeout(() => nombreRef.current?.focus(), 150);
      }
    } catch { toast.error('Error al buscar producto'); }
    finally { setSearching(false); }
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.precio) {
      toast.error('Nombre y Precio son obligatorios');
      playBeep('error');
      return;
    }
    if (formData.maneja_lotes && formData.stock_actual > 0 && (!formData.numero_lote || !formData.fecha_vencimiento)) {
      toast.warning('Ingresa Lote y Vencimiento');
      playBeep('error');
      loteRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        stock_inicial: parseFloat(formData.stock_actual) || 0,
        precio: parseFloat(formData.precio) || 0,
        costo: parseFloat(formData.costo) || 0,
        stock_minimo: parseFloat(formData.stock_minimo) || 0,
        fecha_vencimiento: formData.fecha_vencimiento || null,
      };
      const isUpdate = Boolean(formData.id);
      if (isUpdate) {
        await apiClient.put(`/productos/${formData.id}`, payload);
        toast.success(`✓ "${formData.nombre}" actualizado`);
      } else {
        await apiClient.post('/productos/', payload);
        toast.success(`✓ "${formData.nombre}" registrado`);
        if (onProductoAdded) onProductoAdded();
      }
      playBeep('success');
      setSessionLog(prev => [{
        id: Date.now(),
        nombre: formData.nombre,
        accion: isUpdate ? 'actualizado' : 'nuevo',
        precio: parseFloat(formData.precio) || 0,
        codigo_barras: formData.codigo_barras,
        timestamp: new Date(),
      }, ...prev].slice(0, 20));
      resetForm();
    } catch {
      toast.error('Error al guardar');
      playBeep('error');
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({ nombre: '', codigo_barras: '', descripcion: '', precio: '', costo: '', stock_actual: '', stock_minimo: '', unidad_medida: 'UND', grupo_item: 2, es_servicio: false, maneja_lotes: false, numero_lote: '', fecha_vencimiento: '' });
    setProductStatus(null);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const statusCfg = productStatus ? STATUS_CONFIG[productStatus] : null;

  return (
    <Dialog
      fullScreen open={open} onClose={onClose} TransitionComponent={Transition}
      sx={{ '& .MuiDialog-paper': { bgcolor: 'background.default' } }}
    >
      {/* ── AppBar ── */}
      <AppBar sx={{ position: 'relative', bgcolor: isDark ? '#1A1D23' : ACCENT, boxShadow: 'none' }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" sx={{ color: 'white' }} onClick={onClose}>
            <Close />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 16, lineHeight: 1.2 }}>
              Modo Ágil — Registro Rápido
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
              Ctrl+Enter para guardar • Enter para buscar
            </Typography>
          </Box>

          {/* Session counter */}
          {sessionStats.total > 0 && (
            <Tooltip title="Ver historial de sesión">
              <Chip
                icon={<History sx={{ fontSize: '14px !important', color: 'white !important' }} />}
                label={`${sessionStats.total} registrado${sessionStats.total !== 1 ? 's' : ''}`}
                onClick={() => setLogOpen(o => !o)}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
              />
            </Tooltip>
          )}

          <Tooltip title={cameraActive ? 'Cerrar cámara' : 'Activar cámara'}>
            <IconButton sx={{ color: 'white' }} onClick={handleToggleCamera}>
              {cameraActive ? <VideocamOff /> : <Videocam />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <DialogContent sx={{ p: { xs: 2, md: 5 }, bgcolor: 'background.default' }}>
        <Box sx={{ maxWidth: 800, mx: 'auto', pb: 8 }}>

          {/* ── Session log (collapsible) ── */}
          <Collapse in={logOpen && sessionStats.total > 0}>
            <Paper sx={{ mb: 3, borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: 'action.hover' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <History sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Historial de esta sesión</Typography>
                  <Chip label={`${sessionStats.nuevos} nuevos`} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: `${ACCENT}15`, color: ACCENT }} />
                  {sessionStats.actualizados > 0 && <Chip label={`${sessionStats.actualizados} actualizados`} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: `${BLUE}15`, color: BLUE }} />}
                </Box>
                <IconButton size="small" onClick={() => setLogOpen(false)}><Close fontSize="small" /></IconButton>
              </Box>
              <List dense disablePadding sx={{ maxHeight: 220, overflowY: 'auto' }}>
                {sessionLog.map(entry => (
                  <ListItem key={entry.id} divider sx={{ py: 0.8 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.accion === 'nuevo' ? ACCENT : BLUE }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>{entry.nombre}</Typography>}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip label={entry.accion} size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: entry.accion === 'nuevo' ? `${ACCENT}15` : `${BLUE}15`, color: entry.accion === 'nuevo' ? ACCENT : BLUE }} />
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{fmtCurrency(entry.precio)}</Typography>
                          {entry.codigo_barras && <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'monospace' }}>{entry.codigo_barras}</Typography>}
                          <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 'auto' }}>{entry.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Collapse>

          {/* ── Camera ── */}
          {cameraActive && (
            <Paper elevation={0} sx={{ mb: 4, borderRadius: 4, overflow: 'hidden', position: 'relative', bgcolor: '#000', border: '1px solid', borderColor: 'divider', minHeight: 280 }}>
              <video ref={videoRef} style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'cover' }} playsInline muted />
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, pointerEvents: 'none' }}>
                <Box sx={{ position: 'relative', width: { xs: 220, sm: 280 }, height: { xs: 130, sm: 160 } }}>
                  <Box sx={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 100vw rgba(0,0,0,0.45)', borderRadius: 2 }} />
                  {[['top','-1px','left','-1px','borderTop','borderLeft','4px 0 0 0'],['top','-1px','right','-1px','borderTop','borderRight','0 4px 0 0'],['bottom','-1px','left','-1px','borderBottom','borderLeft','0 0 0 4px'],['bottom','-1px','right','-1px','borderBottom','borderRight','0 0 4px 0']].map(([v1,v1v,v2,v2v,b1,b2,r]) => (
                    <Box key={v1+v2} sx={{ position: 'absolute', [v1]: v1v, [v2]: v2v, width: 22, height: 22, [b1]: `3px solid ${ACCENT}`, [b2]: `3px solid ${ACCENT}`, borderRadius: r }} />
                  ))}
                  <Box sx={{ position: 'absolute', left: 4, right: 4, height: 2, background: `linear-gradient(90deg, transparent, ${ACCENT}CC, transparent)`, borderRadius: 1, animation: 'scanLine 1.8s ease-in-out infinite', '@keyframes scanLine': { '0%': { top: '5%' }, '50%': { top: '90%' }, '100%': { top: '5%' } } }} />
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: 500, bgcolor: 'rgba(0,0,0,0.45)', borderRadius: 5, px: 2, py: 0.5 }}>
                  Apunta el código de barras al recuadro
                </Typography>
              </Box>
            </Paper>
          )}

          <Stack spacing={3}>

            {/* ── SECCIÓN 1: Código de Barras ── */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper', border: `2px solid ${statusCfg ? statusCfg.color : ACCENT}60` }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <TextField
                  fullWidth label="Código de Barras"
                  placeholder="Escanea con pistola / cámara o escribe y presiona Enter…"
                  value={formData.codigo_barras}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo_barras: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(formData.codigo_barras.trim()); }}
                  inputRef={barcodeRef}
                  autoComplete="off"
                  disabled={loading || searching}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><QrCodeScanner sx={{ color: ACCENT }} fontSize="large" /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        {searching
                          ? <CircularProgress size={22} sx={{ color: ACCENT }} />
                          : formData.codigo_barras
                            ? <IconButton size="small" onClick={resetForm} sx={{ color: 'text.secondary' }}><Close fontSize="small" /></IconButton>
                            : null
                        }
                      </InputAdornment>
                    ),
                    sx: { fontSize: { xs: '1.1rem', md: '1.3rem' }, fontWeight: 700 }
                  }}
                />
                <Button
                  variant="contained" onClick={() => handleSearch(formData.codigo_barras.trim())}
                  disabled={loading || searching || !formData.codigo_barras.trim()}
                  startIcon={<Search />}
                  sx={{ bgcolor: ACCENT, borderRadius: 2, fontWeight: 700, px: 3, height: 56, flexShrink: 0, '&:hover': { bgcolor: '#E65D2A' } }}
                >
                  Buscar
                </Button>
              </Box>

              {/* Status banner */}
              {statusCfg && (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 2, bgcolor: `${statusCfg.color}10`, border: `1px solid ${statusCfg.color}30` }}>
                  <Box sx={{ color: statusCfg.color, display: 'flex' }}>{statusCfg.icon}</Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: statusCfg.color }}>{statusCfg.label}</Typography>
                  {productStatus === 'existing' && (
                    <Chip label="Actualización" size="small" sx={{ ml: 'auto', height: 18, fontSize: 9, fontWeight: 700, bgcolor: `${GREEN}15`, color: GREEN }} />
                  )}
                  {productStatus === 'new' && (
                    <Chip label="Creación" size="small" sx={{ ml: 'auto', height: 18, fontSize: 9, fontWeight: 700, bgcolor: `${ACCENT}15`, color: ACCENT }} />
                  )}
                </Box>
              )}

              <Typography sx={{ mt: 1.5, fontSize: 11, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <KeyboardReturn sx={{ fontSize: 13 }} /> Enter para buscar · Ctrl+Enter para guardar
              </Typography>
            </Paper>

            {/* ── SECCIÓN 2: Detalles del Producto ── */}
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <LocalOffer sx={{ color: ACCENT }} /> Detalles del Producto
              </Typography>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth label="Nombre del Producto *"
                      value={formData.nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                      inputRef={nombreRef}
                      onKeyDown={(e) => e.key === 'Enter' && descRef.current?.focus()}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Inventory sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth label="Descripción / Característica"
                      value={formData.descripcion}
                      onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                      inputRef={descRef}
                      onKeyDown={(e) => e.key === 'Enter' && precioRef.current?.focus()}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Description sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      fullWidth
                      options={grupos}
                      getOptionLabel={(opt) => opt.nombre || ''}
                      value={grupos.find(g => g.id === formData.grupo_item) || null}
                      onChange={(_, v) => {
                        if (v?.id === '__create__') handleCreateGroup(v._inputValue);
                        else setFormData(prev => ({ ...prev, grupo_item: v?.id || 2 }));
                      }}
                      filterOptions={(opts, state) => {
                        const q = (state.inputValue || '').toLowerCase();
                        const filtered = opts.filter(o => o.nombre.toLowerCase().includes(q));
                        if (state.inputValue.trim() && !filtered.some(o => o.nombre.toLowerCase() === state.inputValue.toLowerCase()))
                          filtered.push({ id: '__create__', nombre: `Crear "${state.inputValue}"`, _inputValue: state.inputValue, color: ACCENT });
                        return filtered;
                      }}
                      loading={creatingGroup}
                      renderOption={(props, opt) => (
                        <Box component="li" {...props} key={opt.id}>
                          {opt.id === '__create__'
                            ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: ACCENT, fontWeight: 700 }}><Add fontSize="small" />{opt.nombre}</Box>
                            : <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: opt.color || '#94a3b8', flexShrink: 0 }} />{opt.nombre}<Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>{opt.codigo}</Typography></Box>
                          }
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField {...params} label="Categoría / Grupo"
                          InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><Category sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment>{params.InputProps.startAdornment}</> }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      fullWidth freeSolo
                      options={UNIDADES_MEDIDA.map(u => u.value)}
                      value={formData.unidad_medida}
                      onChange={(_, v) => setFormData(prev => ({ ...prev, unidad_medida: v || 'UND' }))}
                      onInputChange={(_, v) => setFormData(prev => ({ ...prev, unidad_medida: v ? v.toUpperCase() : '' }))}
                      renderInput={(params) => (
                        <TextField {...params} label="Unidad de Medida" placeholder="UND, KGS, LTS..."
                          InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><Straighten sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment>{params.InputProps.startAdornment}</> }}
                        />
                      )}
                    />
                  </Grid>

                  {/* Precio + Costo + Margen */}
                  <Grid item xs={12} md={4}>
                    <CurrencyField
                      fullWidth label="Precio de Venta *"
                      value={formData.precio}
                      onChange={(val) => setFormData(prev => ({ ...prev, precio: val }))}
                      inputRef={precioRef}
                      onKeyDown={(e) => e.key === 'Enter' && costoRef.current?.focus()}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <CurrencyField
                      fullWidth label="Costo de Compra"
                      value={formData.costo}
                      onChange={(val) => setFormData(prev => ({ ...prev, costo: val }))}
                      inputRef={costoRef}
                      onKeyDown={(e) => e.key === 'Enter' && stockRef.current?.focus()}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MargenBadge precio={formData.precio} costo={formData.costo} />
                  </Grid>
                </Grid>
              </Paper>
            </Box>

            {/* ── SECCIÓN 3: Control de Inventario ── */}
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <ShoppingCart sx={{ color: ACCENT }} /> Control de Inventario
              </Typography>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={2.5} alignItems="center">
                  <Grid item xs={6} md={4}>
                    <TextField
                      fullWidth type="number" label="Stock Inicial"
                      value={formData.stock_actual}
                      onChange={(e) => setFormData(prev => ({ ...prev, stock_actual: e.target.value }))}
                      inputRef={stockRef}
                      onKeyDown={(e) => e.key === 'Enter' && (formData.maneja_lotes ? loteRef.current?.focus() : barcodeRef.current?.focus())}
                      InputProps={{ startAdornment: <InputAdornment position="start"><ShoppingCart sx={{ color: 'text.secondary', opacity: 0.5, fontSize: 18 }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={6} md={4}>
                    <TextField
                      fullWidth type="number" label="Stock Mínimo (alerta)"
                      value={formData.stock_minimo}
                      onChange={(e) => setFormData(prev => ({ ...prev, stock_minimo: e.target.value }))}
                      placeholder="Ej: 5"
                      helperText="Te avisamos cuando baje de aquí"
                      InputProps={{ startAdornment: <InputAdornment position="start"><WarningAmber sx={{ color: '#F59E0B', opacity: 0.7, fontSize: 18 }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: formData.maneja_lotes ? ACCENT : 'divider', bgcolor: formData.maneja_lotes ? `${ACCENT}08` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FormControlLabel
                        control={<Switch checked={formData.maneja_lotes} onChange={(e) => setFormData(prev => ({ ...prev, maneja_lotes: e.target.checked }))} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: ACCENT } }} />}
                        label={<Typography sx={{ fontWeight: 600, fontSize: 13, color: formData.maneja_lotes ? ACCENT : 'text.secondary' }}>Lotes y Vencimiento</Typography>}
                        sx={{ m: 0 }}
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Collapse in={formData.maneja_lotes && Number(formData.stock_actual) > 0}>
                      <Divider sx={{ mb: 2.5 }} />
                      <Grid container spacing={2.5}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth label="Número de Lote"
                            value={formData.numero_lote}
                            onChange={(e) => setFormData(prev => ({ ...prev, numero_lote: e.target.value }))}
                            inputRef={loteRef}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Science sx={{ color: '#a78bfa' }} /></InputAdornment> }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth type="date" label="Fecha de Vencimiento"
                            value={formData.fecha_vencimiento}
                            onChange={(e) => setFormData(prev => ({ ...prev, fecha_vencimiento: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                            sx={{ input: { colorScheme: isDark ? 'dark' : 'light' } }}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Event sx={{ color: '#f87171' }} /></InputAdornment> }}
                          />
                        </Grid>
                      </Grid>
                    </Collapse>
                  </Grid>
                </Grid>
              </Paper>
            </Box>

            {/* ── Botón guardar ── */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained" size="large" onClick={handleSave} disabled={loading}
                  sx={{ flex: 1, minWidth: 200, height: 56, borderRadius: 2, bgcolor: formData.id ? BLUE : ACCENT, fontSize: '1rem', fontWeight: 800, textTransform: 'none', color: '#fff', '&:hover': { bgcolor: formData.id ? '#2563EB' : '#E65D2A', transform: 'translateY(-1px)' }, transition: 'all 0.15s', boxShadow: `0 6px 20px ${formData.id ? BLUE : ACCENT}40` }}
                >
                  {loading
                    ? <CircularProgress size={20} color="inherit" />
                    : formData.id
                      ? '↗ Actualizar Producto'
                      : '✓ Guardar y Continuar Escaneando'
                  }
                </Button>
                {formData.nombre && (
                  <Button variant="outlined" size="large" onClick={resetForm} disabled={loading}
                    sx={{ height: 56, borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}>
                    Limpiar
                  </Button>
                )}
                <Tooltip title="Ctrl+Enter para guardar sin usar el mouse">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: { xs: 0, sm: 'auto' } }}>
                    <Chip label="Ctrl" size="small" sx={{ fontSize: 10, height: 20, fontFamily: 'monospace' }} />
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>+</Typography>
                    <Chip label="↵" size="small" sx={{ fontSize: 10, height: 20, fontFamily: 'monospace' }} />
                  </Box>
                </Tooltip>
              </Box>
              {sessionStats.total > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <TrendingUp sx={{ fontSize: 14, color: GREEN }} />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    Sesión: <strong style={{ color: GREEN }}>{sessionStats.nuevos} nuevo{sessionStats.nuevos !== 1 ? 's' : ''}</strong>
                    {sessionStats.actualizados > 0 && <> · <strong style={{ color: BLUE }}>{sessionStats.actualizados} actualizado{sessionStats.actualizados !== 1 ? 's' : ''}</strong></>}
                  </Typography>
                  <Button size="small" variant="text" onClick={() => setLogOpen(o => !o)} sx={{ ml: 'auto', fontSize: 11, fontWeight: 600, p: 0.5, minWidth: 0 }}>
                    {logOpen ? 'Ocultar' : 'Ver historial'}
                  </Button>
                </Box>
              )}
            </Paper>

          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AgileBarcodeRegistration;
