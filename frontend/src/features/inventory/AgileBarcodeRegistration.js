import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Card, Grid, 
  InputAdornment, IconButton, CircularProgress, Divider,
  MenuItem, Select, FormControl, InputLabel, Paper,
  Switch, FormControlLabel, Collapse, Dialog, DialogContent, 
  AppBar, Toolbar, Slide
} from '@mui/material';
import {
  QrCodeScanner, Save, Clear, Inventory, Close,
  AttachMoney, ShoppingCart, ShoppingBag, Videocam, VideocamOff,
  Description, Science, Event
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { apiClient, getProductoByBarcode } from '../../api';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const ACCENT = '#10B981'; // Esmeralda/Verde

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const AgileBarcodeRegistration = ({ open, onClose, onProductoAdded }) => {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo_barras: '',
    descripcion: '',
    precio: '',
    costo: '',
    stock_actual: '',
    stock_minimo: 0,
    unidad_medida: 'UND',
    grupo_item: 2,
    es_servicio: false,
    maneja_lotes: false,
    numero_lote: '',
    fecha_vencimiento: ''
  });

  const scannerRef = useRef(null);
  const barcodeRef = useRef(null);
  const nombreRef = useRef(null);
  const descRef = useRef(null);
  const precioRef = useRef(null);
  const costoRef = useRef(null);
  const stockRef = useRef(null);
  const loteRef = useRef(null);

  // Efecto para mantener el foco en el código de barras al abrir el modal
  useEffect(() => {
    if (open) {
        setTimeout(() => barcodeRef.current?.focus(), 500);
    }
  }, [open]);

  // Lógica para el escáner de cámara
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
        /* verbose= */ false
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
    setCameraActive(false); // Apagar cámara tras éxito
  };

  const onScanFailure = (error) => {
    // Errores de escaneo comunes
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
    } catch (e) {}
  };

  const handleSearch = async (barcode) => {
    if (!barcode) return;
    setSearching(true);
    try {
      const res = await getProductoByBarcode(barcode);
      if (res.data) {
        const isMatch = res.data.id !== undefined; // Si tiene ID, es de MI empresa
        
        setFormData({
          ...res.data,
          precio: isMatch ? (res.data.precio || '') : '',
          costo: isMatch ? (res.data.costo || '') : '',
          stock_actual: isMatch ? (res.data.stock_actual || '') : '',
          numero_lote: '',
          fecha_vencimiento: ''
        });

        if (isMatch) {
            toast.info(`Producto encontrado: ${res.data.nombre}`);
        } else {
            toast.success(`Info obtenida automáticamente: ${res.data.nombre}`);
        }
        
        playBeep('success');
        
        if (res.data.nombre) {
            setTimeout(() => precioRef.current?.focus(), 150);
        } else {
            setTimeout(() => nombreRef.current?.focus(), 150);
        }
      } else {
        toast.warning('Producto no encontrado');
        playBeep('success');
        setFormData(prev => ({
          ...prev,
          nombre: '', precio: '', costo: '', descripcion: '', stock_actual: '', 
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
    if (e.key === 'Enter') {
      handleSearch(formData.codigo_barras.trim());
    }
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
      sx={{ '& .MuiDialog-paper': { bgcolor: 'background.default' } }}
    >
      <AppBar sx={{ position: 'relative', bgcolor: ACCENT }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1, fontWeight: 700 }} variant="h6" component="div">
            Registro Ágil de Productos
          </Typography>
          <Button autoFocus color="inherit" onClick={onClose} sx={{ fontWeight: 600 }}>
            Cerrar Modo Ágil
          </Button>
        </Toolbar>
      </AppBar>
      
      <DialogContent sx={{ p: { xs: 2, md: 5 } }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>Entrada Rápida</Typography>
                    <Typography variant="body2" color="text.secondary">Escanea códigos de barras para registrar stock en segundos</Typography>
                </Box>

                <Button
                    variant={cameraActive ? "outlined" : "contained"}
                    color={cameraActive ? "error" : "primary"}
                    startIcon={cameraActive ? <VideocamOff /> : <Videocam />}
                    onClick={() => setCameraActive(!cameraActive)}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                >
                    {cameraActive ? "Cerrar Cámara" : "Usar Cámara"}
                </Button>
            </Box>

            {cameraActive && (
                <Paper elevation={4} sx={{ mb: 4, p: 2, borderRadius: 4, bgcolor: '#000', overflow: 'hidden' }}>
                    <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
                </Paper>
            )}

            <Card sx={{ p: { xs: 2, md: 4 }, borderRadius: 5, boxShadow: '0 12px 48px rgba(0,0,0,0.12)' }}>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth label="Escanear Código de Barras"
                            value={formData.codigo_barras}
                            onChange={(e) => setFormData({...formData, codigo_barras: e.target.value})}
                            onKeyDown={handleKeyDown}
                            inputRef={barcodeRef}
                            autoComplete="off"
                            disabled={loading || searching}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><QrCodeScanner color="primary" /></InputAdornment>,
                                endAdornment: searching && <CircularProgress size={20} />,
                                sx: { fontSize: { xs: '1.2rem', md: '1.6rem' }, fontWeight: 800, bgcolor: `${ACCENT}08` }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12}><Divider sx={{ my: 1 }}>Detalles del Producto</Divider></Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth label="Nombre del Producto"
                            value={formData.nombre}
                            onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                            inputRef={nombreRef}
                            onKeyDown={(e) => e.key === 'Enter' && descRef.current?.focus()}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Inventory /></InputAdornment> }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth label="Característica / Descripción"
                            value={formData.descripcion}
                            onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                            inputRef={descRef}
                            onKeyDown={(e) => e.key === 'Enter' && precioRef.current?.focus()}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Description /></InputAdornment> }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth type="number" label="Precio de Venta"
                            value={formData.precio}
                            onChange={(e) => setFormData({...formData, precio: e.target.value})}
                            inputRef={precioRef}
                            onKeyDown={(e) => e.key === 'Enter' && costoRef.current?.focus()}
                            InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney color="success" /></InputAdornment> }}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth type="number" label="Costo de Compra"
                            value={formData.costo}
                            onChange={(e) => setFormData({...formData, costo: e.target.value})}
                            inputRef={costoRef}
                            onKeyDown={(e) => e.key === 'Enter' && stockRef.current?.focus()}
                            InputProps={{ startAdornment: <InputAdornment position="start"><ShoppingBag color="warning" /></InputAdornment> }}
                        />
                    </Grid>

                    <Grid item xs={12}><Divider sx={{ my: 1 }}>Inventario</Divider></Grid>

                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth type="number" label="Stock Inicial"
                            value={formData.stock_actual}
                            onChange={(e) => setFormData({...formData, stock_actual: e.target.value})}
                            inputRef={stockRef}
                            onKeyDown={(e) => e.key === 'Enter' && (formData.maneja_lotes ? loteRef.current?.focus() : handleSave())}
                            InputProps={{ startAdornment: <InputAdornment position="start"><ShoppingCart color="primary" /></InputAdornment> }}
                        />
                    </Grid>

                    <Grid item xs={12} md={8}>
                        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: formData.maneja_lotes ? '#10B981' : 'divider', bgcolor: formData.maneja_lotes ? '#ECFDF5' : 'transparent', height: '100%', display: 'flex', alignItems: 'center' }}>
                        <FormControlLabel 
                            control={<Switch checked={formData.maneja_lotes} onChange={(e) => setFormData({...formData, maneja_lotes: e.target.checked})} color="success" />} 
                            label={<Typography sx={{ fontWeight: 600, fontSize: 14, color: formData.maneja_lotes ? '#059669' : 'text.primary' }}>Maneja Lotes y Vencimiento</Typography>} 
                            sx={{ m: 0 }}
                        />
                        </Box>
                    </Grid>

                    <Grid item xs={12}>
                        <Collapse in={formData.maneja_lotes && formData.stock_actual > 0}>
                            <Grid container spacing={3} sx={{ pt: 1 }}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth label="Número de Lote"
                                        value={formData.numero_lote}
                                        onChange={(e) => setFormData({...formData, numero_lote: e.target.value})}
                                        inputRef={loteRef}
                                        InputProps={{ startAdornment: <InputAdornment position="start"><Science color="secondary" /></InputAdornment> }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth type="date" label="Fecha de Vencimiento"
                                        value={formData.fecha_vencimiento}
                                        onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})}
                                        InputLabelProps={{ shrink: true }}
                                        InputProps={{ startAdornment: <InputAdornment position="start"><Event color="error" /></InputAdornment> }}
                                    />
                                </Grid>
                            </Grid>
                        </Collapse>
                    </Grid>

                    <Grid item xs={12} sx={{ mt: 2 }}>
                        <Button
                            fullWidth variant="contained" size="large"
                            onClick={handleSave} disabled={loading}
                            sx={{ height: 64, borderRadius: 3, bgcolor: ACCENT, fontSize: '1.2rem', fontWeight: 800, '&:hover': { bgcolor: '#059669' } }}
                        >
                            {formData.id ? 'Actualizar Producto' : 'Guardar y Siguiente'}
                        </Button>
                    </Grid>
                </Grid>
            </Card>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AgileBarcodeRegistration;