import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, Grid,
  InputAdornment, IconButton, CircularProgress,
  Switch, FormControlLabel, Collapse, Dialog, DialogContent,
  AppBar, Toolbar, Slide, Paper, Stack, Divider, Autocomplete
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  QrCodeScanner, Inventory, Close,
  AttachMoney, ShoppingCart, ShoppingBag, Videocam, VideocamOff,
  Description, Science, Event, LocalOffer, Add, Category, Straighten
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { apiClient, getProductoByBarcode } from '../../api';
import CurrencyField from '../../components/common/CurrencyField';
import { UNIDADES_MEDIDA } from '../../utils/constants';

const ACCENT = '#FF723B';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Detect capabilities at module level (stable, no re-evaluation)
const HAS_BARCODE_DETECTOR = typeof window !== 'undefined' && 'BarcodeDetector' in window;
const HAS_CAMERA = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_e', 'code_39', 'itf'];

const AgileBarcodeRegistration = ({ open, onClose, onProductoAdded }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', codigo_barras: '', descripcion: '', precio: '', costo: '',
    stock_actual: '', stock_minimo: 0, unidad_medida: 'UND', grupo_item: 2,
    es_servicio: false, maneja_lotes: false, numero_lote: '', fecha_vencimiento: ''
  });

  // Camera refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rAFRef = useRef(null);
  const zxingControlsRef = useRef(null);

  // Form field refs (for keyboard navigation & physical barcode reader)
  const barcodeRef = useRef(null);
  const nombreRef = useRef(null);
  const descRef = useRef(null);
  const precioRef = useRef(null);
  const costoRef = useRef(null);
  const stockRef = useRef(null);
  const loteRef = useRef(null);

  // Focus barcode field & load grupos when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => barcodeRef.current?.focus(), 500);
      apiClient.get('/grupos-producto/')
        .then(r => setGrupos(r.data || []))
        .catch(() => {});
    }
  }, [open]);

  // ── CAMERA CLEANUP (no state change — safe to call from effects) ──
  const cleanupCamera = useCallback(() => {
    if (rAFRef.current) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
    if (zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch {}
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── CAMERA INITIALIZATION: runs after <video> element is in DOM ──
  useEffect(() => {
    if (!cameraActive) return;
    let active = true;

    (async () => {
      try {
        if (!HAS_CAMERA) {
          toast.error('Tu navegador no soporta acceso a cámara.');
          setCameraActive(false);
          return;
        }

        // Callback fired when a barcode is successfully decoded
        const onBarcode = (code) => {
          if (!active) return;
          active = false;
          cleanupCamera();
          setCameraActive(false);
          setFormData(prev => ({ ...prev, codigo_barras: code }));
          handleSearch(code);
        };

        if (HAS_BARCODE_DETECTOR) {
          // ── Path A: Native BarcodeDetector API ──
          // Chrome 83+, Android Chrome, iOS Safari 17+ (iPhone 13 on iOS 17+)
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          if (!active) { stream.getTracks().forEach(t => t.stop()); return; }

          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
          let lastScan = 0;

          const tick = async () => {
            if (!active || !videoRef.current) return;
            const now = Date.now();
            // Throttle to ~10fps to reduce CPU load
            if (now - lastScan >= 100) {
              lastScan = now;
              const v = videoRef.current;
              if (v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
                try {
                  const codes = await detector.detect(v);
                  if (codes.length > 0) { onBarcode(codes[0].rawValue); return; }
                } catch {}
              }
            }
            rAFRef.current = requestAnimationFrame(tick);
          };
          rAFRef.current = requestAnimationFrame(tick);

        } else {
          // ── Path B: @zxing/browser fallback ──
          // Firefox, Safari < 17, older Android
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (!active) return;

          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            videoRef.current,
            (result) => { if (result && active) onBarcode(result.getText()); }
          );
          if (!active) { controls.stop(); return; }
          zxingControlsRef.current = controls;
        }

      } catch (err) {
        if (!active) return;
        cleanupCamera();
        setCameraActive(false);
        if (err.name === 'NotAllowedError') {
          toast.error('Acceso a cámara denegado. Revisa los permisos en tu navegador.');
        } else if (err.name === 'NotFoundError') {
          toast.error('No se detectó ninguna cámara en este dispositivo.');
        } else {
          toast.error('Error al iniciar la cámara. Intenta de nuevo.');
        }
      }
    })();

    return () => {
      active = false;
      cleanupCamera();
    };
  }, [cameraActive, cleanupCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop camera when dialog closes
  useEffect(() => {
    if (!open) {
      cleanupCamera();
      setCameraActive(false);
    }
  }, [open, cleanupCamera]);

  const handleToggleCamera = () => {
    if (cameraActive) {
      cleanupCamera();
      setCameraActive(false);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    } else {
      setCameraActive(true);
    }
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
    } catch {
      toast.error('Error al crear la categoría');
    } finally {
      setCreatingGroup(false);
    }
  };

  const playBeep = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      if (type === 'success') {
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch {}
  };

  const handleSearch = async (barcode) => {
    if (!barcode) return;
    setSearching(true);
    try {
      const res = await getProductoByBarcode(barcode);
      if (res.data) {
        const isMatch = res.data.id > 0;
        setFormData({
          ...res.data,
          id: isMatch ? res.data.id : undefined,
          precio: isMatch ? (res.data.precio || '') : '',
          costo: isMatch ? (res.data.costo || '') : '',
          stock_actual: isMatch ? (res.data.stock_actual || '') : '',
          numero_lote: '', fecha_vencimiento: ''
        });
        if (isMatch) toast.info(`Producto encontrado: ${res.data.nombre}`);
        else toast.success(`Info obtenida automáticamente: ${res.data.nombre}`);
        playBeep('success');
        if (res.data.nombre) setTimeout(() => precioRef.current?.focus(), 150);
        else setTimeout(() => nombreRef.current?.focus(), 150);
      } else {
        toast.warning('Producto no encontrado');
        playBeep('success');
        setFormData(prev => ({
          ...prev, nombre: '', precio: '', costo: '', descripcion: '', stock_actual: '',
          maneja_lotes: false, numero_lote: '', fecha_vencimiento: '', id: undefined
        }));
        setTimeout(() => nombreRef.current?.focus(), 150);
      }
    } catch {
      toast.error('Error al buscar producto');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch(formData.codigo_barras.trim());
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
        fecha_vencimiento: formData.fecha_vencimiento || null
      };
      if (formData.id) {
        await apiClient.put(`/productos/${formData.id}`, payload);
        toast.success('Producto actualizado');
      } else {
        await apiClient.post('/productos/', payload);
        toast.success('Producto registrado');
        if (onProductoAdded) onProductoAdded();
      }
      playBeep('success');
      resetForm();
    } catch {
      toast.error('Error al guardar');
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '', codigo_barras: '', descripcion: '', precio: '', costo: '',
      stock_actual: '', stock_minimo: 0, unidad_medida: 'UND', grupo_item: 2,
      es_servicio: false, maneja_lotes: false, numero_lote: '', fecha_vencimiento: ''
    });
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  return (
    <Dialog
      fullScreen open={open} onClose={onClose} TransitionComponent={Transition}
      sx={{ '& .MuiDialog-paper': { bgcolor: 'background.default' } }}
    >
      <AppBar sx={{
        position: 'relative',
        bgcolor: isDark ? '#1A1D23' : 'primary.main',
        boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider'
      }}>
        <Toolbar>
          <IconButton edge="start" sx={{ color: 'white' }} onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1, fontWeight: 700, color: 'white' }} variant="h6" component="div">
            Registro Ágil de Productos
          </Typography>
        </Toolbar>
      </AppBar>

      <DialogContent sx={{ p: { xs: 2, md: 5 }, bgcolor: 'background.default' }}>
        <Box sx={{ maxWidth: 750, mx: 'auto', pb: 5 }}>

          {/* ── Header ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight={800} color="text.primary">Entrada Rápida</Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Escanea o digita el código de barras para registrar stock en segundos
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={cameraActive ? <VideocamOff /> : <Videocam />}
              onClick={handleToggleCamera}
              sx={{
                bgcolor: cameraActive ? '#ef4444' : ACCENT,
                borderRadius: 2, fontWeight: 700, px: 3, py: 1.5, textTransform: 'none',
                '&:hover': { bgcolor: cameraActive ? '#dc2626' : '#E65D2A' }
              }}
            >
              {cameraActive ? 'Cerrar Cámara' : 'Usar Cámara'}
            </Button>
          </Box>

          {/* ── Camera Panel ── */}
          {cameraActive && (
            <Paper elevation={0} sx={{
              mb: 4, borderRadius: 4, overflow: 'hidden',
              position: 'relative', bgcolor: '#000',
              border: '1px solid', borderColor: 'divider',
              minHeight: 280
            }}>
              {/* playsInline is CRITICAL for iOS — prevents fullscreen hijack */}
              <video
                ref={videoRef}
                style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'cover' }}
                playsInline
                muted
              />

              {/* Scanning overlay */}
              <Box sx={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, pointerEvents: 'none'
              }}>
                {/* Reticle with corner accents */}
                <Box sx={{ position: 'relative', width: { xs: 220, sm: 280 }, height: { xs: 130, sm: 160 } }}>
                  {/* Darkened surround */}
                  <Box sx={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 100vw rgba(0,0,0,0.45)', borderRadius: 2 }} />
                  {/* Corner — Top Left */}
                  <Box sx={{ position: 'absolute', top: -1, left: -1, width: 22, height: 22, borderTop: `3px solid ${ACCENT}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: '4px 0 0 0' }} />
                  {/* Corner — Top Right */}
                  <Box sx={{ position: 'absolute', top: -1, right: -1, width: 22, height: 22, borderTop: `3px solid ${ACCENT}`, borderRight: `3px solid ${ACCENT}`, borderRadius: '0 4px 0 0' }} />
                  {/* Corner — Bottom Left */}
                  <Box sx={{ position: 'absolute', bottom: -1, left: -1, width: 22, height: 22, borderBottom: `3px solid ${ACCENT}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: '0 0 0 4px' }} />
                  {/* Corner — Bottom Right */}
                  <Box sx={{ position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderBottom: `3px solid ${ACCENT}`, borderRight: `3px solid ${ACCENT}`, borderRadius: '0 0 4px 0' }} />
                  {/* Animated scan line */}
                  <Box sx={{
                    position: 'absolute', left: 4, right: 4, height: 2,
                    background: `linear-gradient(90deg, transparent, ${ACCENT}CC, transparent)`,
                    borderRadius: 1,
                    animation: 'scanLine 1.8s ease-in-out infinite',
                    '@keyframes scanLine': {
                      '0%': { top: '5%' },
                      '50%': { top: '90%' },
                      '100%': { top: '5%' }
                    }
                  }} />
                </Box>

                <Typography sx={{
                  color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: 500,
                  bgcolor: 'rgba(0,0,0,0.45)', borderRadius: 5, px: 2, py: 0.5,
                  textAlign: 'center'
                }}>
                  Apunta el código de barras al recuadro
                </Typography>
              </Box>
            </Paper>
          )}

          <Stack spacing={4}>

            {/* ── SECCIÓN 1: Código de Barras ── */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper', border: `1px solid ${ACCENT}80` }}>
              <TextField
                fullWidth label="Código de Barras"
                placeholder="Escanea o escribe y presiona Enter..."
                value={formData.codigo_barras}
                onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                onKeyDown={handleKeyDown}
                inputRef={barcodeRef}
                autoComplete="off"
                disabled={loading || searching}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><QrCodeScanner sx={{ color: ACCENT }} fontSize="large" /></InputAdornment>,
                  endAdornment: searching && <CircularProgress size={24} sx={{ color: ACCENT }} />,
                  sx: { fontSize: { xs: '1.2rem', md: '1.4rem' }, fontWeight: 700 }
                }}
              />
            </Paper>

            {/* ── SECCIÓN 2: Detalles del Producto ── */}
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <LocalOffer sx={{ color: ACCENT }} /> Detalles del Producto
              </Typography>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth label="Nombre del Producto"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      inputRef={nombreRef}
                      onKeyDown={(e) => e.key === 'Enter' && descRef.current?.focus()}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Inventory sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth label="Característica / Descripción"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      inputRef={descRef}
                      onKeyDown={(e) => e.key === 'Enter' && precioRef.current?.focus()}
                      InputProps={{ startAdornment: <InputAdornment position="start"><Description sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      fullWidth
                      options={grupos}
                      getOptionLabel={(option) => option.nombre || ''}
                      value={grupos.find(g => g.id === formData.grupo_item) || null}
                      onChange={(_, newValue) => {
                        if (newValue?.id === '__create__') {
                          handleCreateGroup(newValue._inputValue);
                        } else {
                          setFormData(prev => ({ ...prev, grupo_item: newValue?.id || 2 }));
                        }
                      }}
                      filterOptions={(options, state) => {
                        const q = (state.inputValue || '').toLowerCase();
                        const filtered = options.filter(o => o.nombre.toLowerCase().includes(q));
                        if (state.inputValue.trim() && !filtered.some(o => o.nombre.toLowerCase() === state.inputValue.toLowerCase())) {
                          filtered.push({ id: '__create__', nombre: `Crear "${state.inputValue}"`, _inputValue: state.inputValue, color: ACCENT });
                        }
                        return filtered;
                      }}
                      loading={creatingGroup}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.id}>
                          {option.id === '__create__'
                            ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: ACCENT, fontWeight: 700 }}><Add fontSize="small" />{option.nombre}</Box>
                            : <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: option.color || '#94a3b8', flexShrink: 0 }} />
                                {option.nombre}
                                <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>{option.codigo}</Typography>
                              </Box>
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
                      onChange={(_, newValue) => setFormData(prev => ({ ...prev, unidad_medida: newValue || 'UND' }))}
                      onInputChange={(_, newValue) => setFormData(prev => ({ ...prev, unidad_medida: newValue ? newValue.toUpperCase() : '' }))}
                      renderInput={(params) => (
                        <TextField {...params} label="Unidad de Medida" placeholder="UND, KGS, LTS..."
                          InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><Straighten sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment>{params.InputProps.startAdornment}</> }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <CurrencyField
                      fullWidth label="Precio de Venta"
                      value={formData.precio}
                      onChange={(val) => setFormData({ ...formData, precio: val })}
                      inputRef={precioRef}
                      onKeyDown={(e) => e.key === 'Enter' && costoRef.current?.focus()}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <CurrencyField
                      fullWidth label="Costo de Compra"
                      value={formData.costo}
                      onChange={(val) => setFormData({ ...formData, costo: val })}
                      inputRef={costoRef}
                      onKeyDown={(e) => e.key === 'Enter' && stockRef.current?.focus()}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Box>

            {/* ── SECCIÓN 3: Control de Inventario ── */}
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <ShoppingCart sx={{ color: ACCENT }} /> Control de Inventario
              </Typography>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth type="number" label="Stock Inicial"
                      value={formData.stock_actual}
                      onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                      inputRef={stockRef}
                      onKeyDown={(e) => e.key === 'Enter' && (formData.maneja_lotes ? loteRef.current?.focus() : handleSave())}
                      InputProps={{ startAdornment: <InputAdornment position="start"><ShoppingCart sx={{ color: 'text.secondary', opacity: 0.5 }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <Box sx={{
                      p: 1.5, borderRadius: 2,
                      border: '1px solid', borderColor: formData.maneja_lotes ? ACCENT : 'divider',
                      bgcolor: formData.maneja_lotes ? `${ACCENT}08` : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <FormControlLabel
                        control={<Switch checked={formData.maneja_lotes} onChange={(e) => setFormData({ ...formData, maneja_lotes: e.target.checked })} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: ACCENT } }} />}
                        label={<Typography sx={{ fontWeight: 600, color: formData.maneja_lotes ? ACCENT : 'text.secondary' }}>Requiere Lotes y Vencimiento</Typography>}
                        sx={{ m: 0 }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Collapse in={formData.maneja_lotes && formData.stock_actual > 0}>
                      <Box sx={{ pt: 1 }}>
                        <Divider sx={{ mb: 3 }} />
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth label="Número de Lote"
                              value={formData.numero_lote}
                              onChange={(e) => setFormData({ ...formData, numero_lote: e.target.value })}
                              inputRef={loteRef}
                              InputProps={{ startAdornment: <InputAdornment position="start"><Science sx={{ color: '#a78bfa' }} /></InputAdornment> }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth type="date" label="Fecha de Vencimiento"
                              value={formData.fecha_vencimiento}
                              onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                              InputLabelProps={{ shrink: true }}
                              sx={{ input: { colorScheme: isDark ? 'dark' : 'light' } }}
                              InputProps={{ startAdornment: <InputAdornment position="start"><Event sx={{ color: '#f87171' }} /></InputAdornment> }}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    </Collapse>
                  </Grid>
                </Grid>
              </Paper>
            </Box>

            {/* ── Botón Principal ── */}
            <Button
              fullWidth variant="contained" size="large"
              onClick={handleSave} disabled={loading}
              sx={{
                height: 64, borderRadius: 3, bgcolor: ACCENT,
                fontSize: '1.2rem', fontWeight: 800, textTransform: 'none',
                color: '#fff',
                '&:hover': { bgcolor: '#E65D2A', transform: 'translateY(-2px)' },
                transition: 'all 0.2s ease-in-out',
                boxShadow: `0 8px 24px ${ACCENT}40`
              }}
            >
              {formData.id ? 'Actualizar Producto' : 'Guardar y Continuar Escaneando'}
            </Button>

          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AgileBarcodeRegistration;
