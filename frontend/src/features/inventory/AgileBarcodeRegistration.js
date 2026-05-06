import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Grid, 
  InputAdornment, IconButton, CircularProgress,
  Switch, FormControlLabel, Collapse, Dialog, DialogContent, 
  AppBar, Toolbar, Slide, Paper, Stack, Divider
} from '@mui/material';
import {
  QrCodeScanner, Inventory, Close,
  AttachMoney, ShoppingCart, ShoppingBag, Videocam, VideocamOff,
  Description, Science, Event, LocalOffer
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { apiClient, getProductoByBarcode } from '../../api';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// Ajustado al color naranja que muestras en tu captura
const ACCENT = '#FF723B'; 

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const AgileBarcodeRegistration = ({ open, onClose, onProductoAdded }) => {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', codigo_barras: '', descripcion: '', precio: '', costo: '',
    stock_actual: '', stock_minimo: 0, unidad_medida: 'UND', grupo_item: 2,
    es_servicio: false, maneja_lotes: false, numero_lote: '', fecha_vencimiento: ''
  });

  const scannerRef = useRef(null);
  const barcodeRef = useRef(null);
  const nombreRef = useRef(null);
  const descRef = useRef(null);
  const precioRef = useRef(null);
  const costoRef = useRef(null);
  const stockRef = useRef(null);
  const loteRef = useRef(null);

  useEffect(() => {
    if (open) {
        setTimeout(() => barcodeRef.current?.focus(), 500);
    }
  }, [open]);

  useEffect(() => {
    if (cameraActive && open) {
      const scanner = new Html5QrcodeScanner(
        "reader", 
        { 
          fps: 10, 
          qrbox: { width: 250, height: 150 },
          rememberLastUsedCamera: true,
          formatsToSupport: [ 
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.EAN_8, 
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE 
          ]
        },
        false
      );

      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
      }
    };
  }, [cameraActive, open]);

  const onScanSuccess = (decodedText) => {
    setFormData(prev => ({ ...prev, codigo_barras: decodedText }));
    handleSearch(decodedText);
    setCameraActive(false);
  };

  const onScanFailure = (error) => {};

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
    } catch (e) {}
  };

  const handleSearch = async (barcode) => {
    if (!barcode) return;
    setSearching(true);
    try {
      const res = await getProductoByBarcode(barcode);
      if (res.data) {
        const isMatch = res.data.id !== undefined; 
        
        setFormData({
          ...res.data,
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
    } catch (error) {
      toast.error("Error al buscar producto");
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch(formData.codigo_barras.trim());
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.precio) {
      toast.error("Nombre y Precio son obligatorios");
      playBeep('error');
      return;
    }

    if (formData.maneja_lotes && formData.stock_actual > 0 && (!formData.numero_lote || !formData.fecha_vencimiento)) {
      toast.warning("Ingresa Lote y Vencimiento");
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
        toast.success("Producto actualizado");
      } else {
        await apiClient.post('/productos/', payload);
        toast.success("Producto registrado");
        if (onProductoAdded) onProductoAdded();
      }
      playBeep('success');
      resetForm();
    } catch (error) {
      toast.error("Error al guardar");
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
      fullScreen
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
      sx={{ '& .MuiDialog-paper': { bgcolor: '#121418' } }} // Fondo oscuro consistente
    >
      <AppBar sx={{ position: 'relative', bgcolor: '#1A1D23', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Toolbar>
          <IconButton edge="start" sx={{ color: 'white' }} onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1, fontWeight: 700, color: 'white' }} variant="h6" component="div">
            Registro Ágil de Productos
          </Typography>
        </Toolbar>
      </AppBar>
      
      <DialogContent sx={{ p: { xs: 2, md: 5 } }}>
        <Box sx={{ maxWidth: 750, mx: 'auto', pb: 5 }}>
            
            {/* Header y Botón Cámara */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800} color="white">Entrada Rápida</Typography>
                    <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
                        Escanea o digita el código de barras para registrar stock en segundos
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={cameraActive ? <VideocamOff /> : <Videocam />}
                    onClick={() => setCameraActive(!cameraActive)}
                    sx={{ 
                        bgcolor: cameraActive ? '#ef4444' : ACCENT,
                        borderRadius: 2, fontWeight: 700, px: 3, py: 1.5, textTransform: 'none',
                        '&:hover': { bgcolor: cameraActive ? '#dc2626' : '#E65D2A' }
                    }}
                >
                    {cameraActive ? "Cerrar Cámara" : "Usar Cámara"}
                </Button>
            </Box>

            {cameraActive && (
                <Paper elevation={0} sx={{ mb: 4, p: 2, borderRadius: 4, bgcolor: '#1A1D23', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
                </Paper>
            )}

            {/* Contenedor Principal: Stack asegura flujo vertical perfecto */}
            <Stack spacing={4}>
                
                {/* SECCIÓN 1: Código de Barras */}
                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#1A1D23', border: `1px solid rgba(255,114,59,0.3)` }}>
                    <TextField
                        fullWidth label="Código de Barras"
                        placeholder="Escanea o escribe y presiona Enter..."
                        value={formData.codigo_barras}
                        onChange={(e) => setFormData({...formData, codigo_barras: e.target.value})}
                        onKeyDown={handleKeyDown}
                        inputRef={barcodeRef}
                        autoComplete="off"
                        disabled={loading || searching}
                        InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                        sx={{ input: { color: 'white' } }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><QrCodeScanner sx={{ color: ACCENT }} fontSize="large" /></InputAdornment>,
                            endAdornment: searching && <CircularProgress size={24} sx={{ color: ACCENT }} />,
                            sx: { fontSize: { xs: '1.2rem', md: '1.4rem' }, fontWeight: 700 }
                        }}
                    />
                </Paper>

                {/* SECCIÓN 2: Detalles del Producto */}
                <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <LocalOffer sx={{ color: ACCENT }} /> Detalles del Producto
                    </Typography>
                    <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, bgcolor: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth label="Nombre del Producto"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                                    inputRef={nombreRef}
                                    onKeyDown={(e) => e.key === 'Enter' && descRef.current?.focus()}
                                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                                    sx={{ input: { color: 'white' } }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Inventory sx={{ color: 'rgba(255,255,255,0.5)' }} /></InputAdornment> }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth label="Característica / Descripción"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                                    inputRef={descRef}
                                    onKeyDown={(e) => e.key === 'Enter' && precioRef.current?.focus()}
                                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                                    sx={{ input: { color: 'white' } }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><Description sx={{ color: 'rgba(255,255,255,0.5)' }} /></InputAdornment> }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth type="number" label="Precio de Venta"
                                    value={formData.precio}
                                    onChange={(e) => setFormData({...formData, precio: e.target.value})}
                                    inputRef={precioRef}
                                    onKeyDown={(e) => e.key === 'Enter' && costoRef.current?.focus()}
                                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                                    sx={{ input: { color: 'white' } }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney sx={{ color: '#4ade80' }} /></InputAdornment> }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth type="number" label="Costo de Compra"
                                    value={formData.costo}
                                    onChange={(e) => setFormData({...formData, costo: e.target.value})}
                                    inputRef={costoRef}
                                    onKeyDown={(e) => e.key === 'Enter' && stockRef.current?.focus()}
                                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                                    sx={{ input: { color: 'white' } }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><ShoppingBag sx={{ color: '#fbbf24' }} /></InputAdornment> }}
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                </Box>

                {/* SECCIÓN 3: Control de Inventario */}
                <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <ShoppingCart sx={{ color: ACCENT }} /> Control de Inventario
                    </Typography>
                    <Paper elevation={0} sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, bgcolor: '#1A1D23', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} md={5}>
                                <TextField
                                    fullWidth type="number" label="Stock Inicial"
                                    value={formData.stock_actual}
                                    onChange={(e) => setFormData({...formData, stock_actual: e.target.value})}
                                    inputRef={stockRef}
                                    onKeyDown={(e) => e.key === 'Enter' && (formData.maneja_lotes ? loteRef.current?.focus() : handleSave())}
                                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                                    sx={{ input: { color: 'white' } }}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><ShoppingCart sx={{ color: 'rgba(255,255,255,0.5)' }} /></InputAdornment> }}
                                />
                            </Grid>

                            <Grid item xs={12} md={7}>
                                <Box sx={{ 
                                    p: 1.5, borderRadius: 2, 
                                    border: '1px solid', borderColor: formData.maneja_lotes ? ACCENT : 'rgba(255,255,255,0.1)', 
                                    bgcolor: formData.maneja_lotes ? 'rgba(255,114,59,0.05)' : 'transparent', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                }}>
                                    <FormControlLabel 
                                        control={<Switch checked={formData.maneja_lotes} onChange={(e) => setFormData({...formData, maneja_lotes: e.target.checked})} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: ACCENT } }} />} 
                                        label={<Typography sx={{ fontWeight: 600, color: formData.maneja_lotes ? ACCENT : 'rgba(255,255,255,0.7)' }}>Requiere Lotes y Vencimiento</Typography>} 
                                        sx={{ m: 0 }}
                                    />
                                </Box>
                            </Grid>

                            <Grid item xs={12}>
                                <Collapse in={formData.maneja_lotes && formData.stock_actual > 0}>
                                    <Box sx={{ pt: 1 }}>
                                        <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.05)' }} />
                                        <Grid container spacing={3}>
                                            <Grid item xs={12} md={6}>
                                                <TextField
                                                    fullWidth label="Número de Lote"
                                                    value={formData.numero_lote}
                                                    onChange={(e) => setFormData({...formData, numero_lote: e.target.value})}
                                                    inputRef={loteRef}
                                                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                                                    sx={{ input: { color: 'white' } }}
                                                    InputProps={{ startAdornment: <InputAdornment position="start"><Science sx={{ color: '#a78bfa' }} /></InputAdornment> }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <TextField
                                                    fullWidth type="date" label="Fecha de Vencimiento"
                                                    value={formData.fecha_vencimiento}
                                                    onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})}
                                                    InputLabelProps={{ shrink: true, sx: { color: 'rgba(255,255,255,0.7)' } }}
                                                    sx={{ input: { color: 'white', colorScheme: 'dark' } }}
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

                {/* Botón de Acción Principal */}
                <Button
                    fullWidth variant="contained" size="large"
                    onClick={handleSave} disabled={loading}
                    sx={{ 
                        height: 64, borderRadius: 3, bgcolor: ACCENT, 
                        fontSize: '1.2rem', fontWeight: 800, textTransform: 'none',
                        color: '#fff',
                        '&:hover': { bgcolor: '#E65D2A', transform: 'translateY(-2px)' },
                        transition: 'all 0.2s ease-in-out',
                        boxShadow: `0 8px 24px rgba(255,114,59,0.3)`
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