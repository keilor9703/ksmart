import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient, { getProductoByBarcode } from '../../api';
import { toast } from 'react-toastify';
import BulkUpload from '../../components/common/BulkUpload';
import CurrencyField from '../../components/common/CurrencyField';
import ImageCropperDialog from '../../components/common/ImageCropperDialog';
import { compressImageToWebP } from '../../utils/imageOptimizer';
import SmartTooltip from '../../components/onboarding/SmartTooltip';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  Box, Typography, Grid, TextField, Button, Collapse, Divider, Chip,
  IconButton, ButtonGroup, Switch, FormControlLabel, Autocomplete,
  Tooltip, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

import {
  Inventory, ExpandMore, ExpandLess, Upload, Close, Category, Science,
  Storefront, AddPhotoAlternate, Delete, InfoOutlined, LocalOffer,
  Tag, Add, Tune, QrCodeScanner, CameraAlt as CameraAltIcon,
  CheckCircle, FiberNew, Sync, Warning,
} from '@mui/icons-material';

import { UNIDADES_MEDIDA } from '../../utils/constants';

const ATRIBUTOS_SUGERIDOS = ['Talla', 'Color', 'Tamaño', 'Peso', 'Presentación', 'Material', 'Sabor'];
import { onScanFisico } from '../../utils/sunmiScanner';

const DEFAULT_ACCENT  = '#8B5CF6';
const PRICE_COLOR     = '#F43F5E';
const INVENTORY_COLOR = '#10B981';
const CATALOG_COLOR   = '#F59E0B';

// ─── Helper: estilos premium para TextField (focus/hover con accent) ──────────
const getInputSx = (accentColor) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    transition: 'box-shadow 0.2s',
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(accentColor, 0.5),
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: accentColor,
      borderWidth: 2,
    },
    '&.Mui-focused': {
      boxShadow: `0 0 0 3px ${alpha(accentColor, 0.1)}`,
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: accentColor,
  },
});

const HAS_BARCODE_DETECTOR = typeof window !== 'undefined' && 'BarcodeDetector' in window;
const HAS_CAMERA = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_e', 'code_39', 'itf'];

const STATUS_CONFIG = {
  existing:    { color: '#3B82F6', icon: Sync,        label: 'Producto existente — se actualizará al guardar' },
  suggested:   { color: '#F59E0B', icon: FiberNew,     label: 'Encontrado en catálogo global — completa precio y stock' },
  unverified:  { color: '#EF4444', icon: Warning,      label: '⚠️ Sugerencia de búsqueda web SIN VERIFICAR — revisa el nombre antes de guardar' },
  new:         { color: '#10B981', icon: CheckCircle,  label: 'Producto nuevo — completa los datos' },
};

// ─── Section Card — colapsable, con borde izquierdo de color accent ───────────
const SectionCard = ({ icon, title, accent = DEFAULT_ACCENT, children, defaultOpen = true }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{
      borderRadius: 3,
      border: '1px solid',
      borderColor: open ? alpha(accent, 0.25) : 'divider',
      bgcolor: 'background.paper',
      mb: 2.5,
      overflow: 'hidden',
      boxShadow: open
        ? `0 2px 16px ${alpha(accent, 0.1)}, 0 1px 4px rgba(0,0,0,0.04)`
        : '0 1px 4px rgba(0,0,0,0.03)',
      transition: 'box-shadow 0.2s, border-color 0.2s',
      // Franja izquierda de color
      borderLeft: `3px solid ${open ? accent : 'transparent'}`,
    }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          px: 2.5, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.4,
          borderBottom: open ? '1px solid' : 'none',
          borderColor: alpha(accent, 0.15),
          background: open
            ? `linear-gradient(90deg, ${alpha(accent, isDark ? 0.1 : 0.06)} 0%, transparent 100%)`
            : 'transparent',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            background: `linear-gradient(90deg, ${alpha(accent, isDark ? 0.14 : 0.09)} 0%, transparent 100%)`,
          },
          transition: 'background 0.2s',
        }}
      >
        <Box sx={{
          width: 32, height: 32, borderRadius: 2,
          background: open
            ? `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.7)})`
            : alpha(accent, 0.12),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? '#fff' : accent,
          flexShrink: 0,
          boxShadow: open ? `0 3px 10px ${alpha(accent, 0.4)}` : 'none',
          transition: 'all 0.2s',
        }}>
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, flex: 1, color: open ? 'text.primary' : 'text.secondary' }}>
          {title}
        </Typography>
        <Box sx={{
          width: 22, height: 22, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: open ? alpha(accent, 0.12) : 'transparent',
          transition: 'all 0.2s',
        }}>
          {open
            ? <ExpandLess sx={{ color: accent, fontSize: 18 }} />
            : <ExpandMore sx={{ color: 'text.secondary', fontSize: 18 }} />
          }
        </Box>
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 2.5 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Collapsible Panel wrapper premium ───────────────────────────────────────
const Panel = ({ title, icon, chip, open, onToggle, forceOpen, onClose, children, accentColor }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{
      borderRadius: 3.5,
      border: '1px solid',
      borderColor: open ? alpha(accentColor, 0.3) : 'divider',
      bgcolor: 'background.paper',
      mb: 2,
      overflow: 'hidden',
      boxShadow: open
        ? `0 0 0 1px ${alpha(accentColor, 0.08)}, 0 8px 32px rgba(0,0,0,${isDark ? 0.4 : 0.1})`
        : `0 2px 8px rgba(0,0,0,${isDark ? 0.25 : 0.04})`,
      transition: 'box-shadow 0.25s, border-color 0.25s',
    }}>
      {/* Franja superior gradiente cuando está abierto */}
      {open && (
        <Box sx={{
          height: 3,
          background: `linear-gradient(90deg, ${accentColor} 0%, ${alpha(accentColor, 0.4)} 60%, transparent 100%)`,
        }} />
      )}
      <Box
        onClick={() => { if (!forceOpen) onToggle(); }}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: { xs: 2, md: 2.5 }, py: 1.8,
          cursor: forceOpen ? 'default' : 'pointer',
          background: open
            ? `linear-gradient(90deg, ${alpha(accentColor, isDark ? 0.08 : 0.04)} 0%, transparent 100%)`
            : 'transparent',
          '&:hover': {
            background: forceOpen
              ? 'transparent'
              : `linear-gradient(90deg, ${alpha(accentColor, isDark ? 0.1 : 0.06)} 0%, transparent 100%)`,
          },
          transition: 'background 0.2s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2, flexShrink: 0,
            background: open
              ? `linear-gradient(135deg, ${accentColor}, ${alpha(accentColor, 0.75)})`
              : alpha(accentColor, 0.12),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: open ? '#fff' : accentColor,
            boxShadow: open ? `0 4px 12px ${alpha(accentColor, 0.4)}` : 'none',
            transition: 'all 0.25s',
          }}>
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{title}</Typography>
            {chip && <Box sx={{ mt: 0.3 }}>{chip}</Box>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
          {open && onClose && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onClose(); }}
              sx={{ color: 'text.secondary', bgcolor: 'action.hover', borderRadius: 1.5 }}>
              <Close fontSize="small" />
            </IconButton>
          )}
          {!forceOpen && (
            <Box sx={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: open ? alpha(accentColor, 0.12) : 'action.hover',
              transition: 'all 0.2s',
            }}>
              {open
                ? <ExpandLess sx={{ color: accentColor, fontSize: 18 }} />
                : <ExpandMore sx={{ color: 'text.secondary', fontSize: 18 }} />
              }
            </Box>
          )}
        </Box>
      </Box>
      <Collapse in={open}>
        <Divider sx={{ opacity: 0.5 }} />
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: isDark ? alpha(accentColor, 0.02) : alpha(accentColor, 0.01) }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProductoForm = ({
  onProductoAdded,
  productoToEdit,
  onProductoUpdated,
  forceOpen,
  onClose,
  accentColor = DEFAULT_ACCENT,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // ── State (logic unchanged) ──
  const [nombre,              setNombre]              = useState('');
  const [sku,                 setSku]                 = useState('');
  const [codigoBarras,        setCodigoBarras]        = useState('');
  const [precio,              setPrecio]              = useState('');
  const [costo,               setCosto]               = useState('');
  const [esServicio,          setEsServicio]          = useState(false);
  const [unidadMedida,        setUnidadMedida]        = useState('UND');
  const [grupoItem,           setGrupoItem]           = useState(2);
  const [stockMinimo,         setStockMinimo]         = useState('');
  const [stockActual,         setStockActual]         = useState(0);
  const [manejaLotes,         setManejaLotes]         = useState(false);
  const [unidadesPorEmpaque,  setUnidadesPorEmpaque]  = useState('1');
  const [stockInicial,        setStockInicial]        = useState('');
  const [numeroLote,          setNumeroLote]          = useState('');
  const [fechaVencimiento,    setFechaVencimiento]    = useState('');
  const [descripcion,         setDescripcion]         = useState('');
  const [grupos,              setGrupos]              = useState([]);
  const [tiposImpuesto,       setTiposImpuesto]       = useState([]);
  const [impuestoId,          setImpuestoId]          = useState('');
  const [imagenes,            setImagenes]            = useState([]);
  const [mostrarEnCatalogo,   setMostrarEnCatalogo]   = useState(false);
  const [isCompressing,       setIsCompressing]       = useState(false);
  const [cropperOpen,         setCropperOpen]         = useState(false);
  const [imageToCrop,         setImageToCrop]         = useState(null);
  const [pendingFiles,        setPendingFiles]        = useState([]);
  const [formOpen,            setFormOpen]            = useState(false);
  const [bulkOpen,            setBulkOpen]            = useState(false);
  const [isSaving,            setIsSaving]            = useState(false);
  // Reverse price calculator: type margin% to compute precio from costo
  const [marginInput,         setMarginInput]         = useState('');

  // ── Agile barcode scan state ──
  const [cameraActive,  setCameraActive]  = useState(false);
  const [scanConfirmCount, setScanConfirmCount] = useState(0);
  const [searchingCode, setSearchingCode] = useState(false);
  const [productStatus, setProductStatus] = useState(null); // 'existing' | 'suggested' | 'new'
  const videoRef        = useRef(null);
  const streamRef        = useRef(null);
  const rAFRef            = useRef(null);
  const zxingControlsRef  = useRef(null);
  const nombreRef         = useRef(null);
  const precioRef         = useRef(null);
  const codigoBarrasRef   = useRef(null);   // input del código de barras (para lectores)
  const handleSearchBarcodeRef = useRef(null); // para el botón físico Sunmi

  // ── Variant state ──
  const [tieneVariantes,    setTieneVariantes]    = useState(false);
  const [variantes,         setVariantes]         = useState([]);
  const [varianteDialog,    setVarianteDialog]    = useState(false);
  const [varianteEditing,   setVarianteEditing]   = useState(null);
  const [varianteForm,      setVarianteForm]      = useState({ nombre: '', sku: '', atributos: {}, precio: '', costo: '', stock_inicial: '' });
  const [skuPreview,        setSkuPreview]        = useState('');
  const [nuevoAtributo,     setNuevoAtributo]     = useState('');
  const [filasNuevaVariante, setFilasNuevaVariante] = useState([{ valor: '', costo: '', precio: '', stock: '' }]);
  const [guardandoVariantes, setGuardandoVariantes] = useState(false);

  // ── Lifecycle (unchanged) ──
  useEffect(() => {
    apiClient.get('/grupos-producto/').then(r => setGrupos(r.data || [])).catch(() => {});
    apiClient.get('/impuestos/?solo_activos=true').then(r => setTiposImpuesto(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (forceOpen !== undefined) setFormOpen(forceOpen);
  }, [forceOpen]);

  useEffect(() => {
    setCameraActive(false);
    setProductStatus(null);
    if (productoToEdit) {
      setNombre(productoToEdit.nombre);
      setSku(productoToEdit.sku || '');
      setCodigoBarras(productoToEdit.codigo_barras || '');
      setPrecio(productoToEdit.precio || '');
      setCosto(productoToEdit.costo || '');
      setEsServicio(productoToEdit.es_servicio);
      setUnidadMedida(productoToEdit.unidad_medida || 'UND');
      setGrupoItem(productoToEdit.grupo_item || 2);
      setStockMinimo(productoToEdit.stock_minimo != null ? String(productoToEdit.stock_minimo) : '');
      setStockActual(productoToEdit.stock_actual ?? 0);
      setManejaLotes(productoToEdit.maneja_lotes || false);
      setUnidadesPorEmpaque(String(productoToEdit.unidades_por_empaque || 1));
      setImagenes(productoToEdit.imagenes || []);
      setMostrarEnCatalogo(productoToEdit.mostrar_en_catalogo || false);
      setDescripcion(productoToEdit.descripcion || '');
      setImpuestoId(productoToEdit.impuesto?.id ? String(productoToEdit.impuesto.id) : '');
      setTieneVariantes(productoToEdit.tiene_variantes || false);
      if (productoToEdit.id && (productoToEdit.tiene_variantes || productoToEdit.variantes?.length > 0)) {
        apiClient.get(`/productos/${productoToEdit.id}/variantes`)
          .then(r => setVariantes(r.data || []))
          .catch(() => {});
      } else {
        setVariantes([]);
      }
    } else {
      resetFields();
    }
  }, [productoToEdit]);

  // ── SKU preview effect ──
  useEffect(() => {
    if (!nombre || !grupoItem) { setSkuPreview(''); return; }
    const t = setTimeout(() => {
      apiClient.get('/productos/sku-preview', { params: { grupo_id: grupoItem, nombre } })
        .then(r => setSkuPreview(r.data.sku))
        .catch(() => setSkuPreview(''));
    }, 400);
    return () => clearTimeout(t);
  }, [nombre, grupoItem]);

  // ── Handlers (unchanged) ──
  const resetFields = () => {
    setNombre(''); setSku(''); setCodigoBarras(''); setPrecio(''); setCosto('');
    setEsServicio(false); setUnidadMedida('UND'); setGrupoItem(2);
    setStockMinimo(''); setStockActual(0); setManejaLotes(false);
    setUnidadesPorEmpaque(1); setStockInicial(''); setNumeroLote('');
    setFechaVencimiento(''); setImagenes([]); setMostrarEnCatalogo(false);
    setDescripcion(''); setImpuestoId('');
    setTieneVariantes(false); setVariantes([]); setVarianteDialog(false); setVarianteEditing(null); setSkuPreview('');
    setProductStatus(null);
  };

  // ── Agile barcode scan: camera lifecycle ──
  const cleanupCamera = useCallback(() => {
    if (rAFRef.current) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
    if (zxingControlsRef.current) { try { zxingControlsRef.current.stop(); } catch {} zxingControlsRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
  }, []);

  useEffect(() => () => cleanupCamera(), [cleanupCamera]);

  const playBeep = (type = 'success') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = type === 'success' ? 880 : 220;
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    } catch {}
  };

  const handleSearchBarcode = async (code) => {
    if (!code) return;
    setSearchingCode(true);
    try {
      const res = await getProductoByBarcode(code);
      if (res.data && res.data.id > 0) {
        const p = res.data;
        setProductStatus('existing');
        setNombre(p.nombre || '');
        setSku(p.sku || '');
        setCodigoBarras(code);
        setPrecio(p.precio ?? '');
        setCosto(p.costo ?? '');
        setEsServicio(!!p.es_servicio);
        setUnidadMedida(p.unidad_medida || 'UND');
        setGrupoItem(p.grupo_item || 2);
        setStockMinimo(p.stock_minimo != null ? String(p.stock_minimo) : '');
        setManejaLotes(p.maneja_lotes || false);
        setDescripcion(p.descripcion || '');
        toast.info(`Producto existente: ${p.nombre}. Se actualizará al guardar.`);
        playBeep('success');
        precioRef.current?.focus();
      } else if (res.data && res.data.nombre) {
        const esNoVerificado = res.data.fuente === 'web_no_verificado';
        setProductStatus(esNoVerificado ? 'unverified' : 'suggested');
        setNombre(res.data.nombre || '');
        setCodigoBarras(code);
        setPrecio(''); setCosto(''); setStockMinimo('');
        if (esNoVerificado) {
          toast.warning('⚠️ Nombre sugerido por búsqueda web, SIN VERIFICAR — confirma que corresponde al producto antes de guardar.', { autoClose: 8000 });
        } else {
          toast.info('Encontrado en catálogo global. Completa precio y stock.');
        }
        playBeep('success');
        nombreRef.current?.focus();
      } else {
        setProductStatus('new');
        setCodigoBarras(code);
        toast.info('Código no encontrado en catálogos públicos. Completa los datos del nuevo producto.');
        playBeep('error');
        nombreRef.current?.focus();
      }
    } catch (err) {
      setProductStatus('new');
      setCodigoBarras(code);
      toast.warning('No se pudo consultar el código. Completa los datos manualmente.');
      nombreRef.current?.focus();
    } finally {
      setSearchingCode(false);
    }
  };
  handleSearchBarcodeRef.current = handleSearchBarcode;

  // Lector de código de barras (USB / WiFi / integrado que "escribe" el código):
  // mientras el formulario está abierto y la cámara apagada, si el usuario no
  // está escribiendo en otro campo, redirige la digitación al campo de código
  // para que el lector escriba ahí y el Enter final dispare la búsqueda. Igual
  // que en Ventas. Además escucha el botón físico del escáner Sunmi.
  useEffect(() => {
    if (!formOpen || cameraActive) return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const active = document.activeElement;
      const tag = active?.tagName?.toLowerCase();
      const escribiendoEnOtro = tag === 'input' || tag === 'textarea' || tag === 'select' || active?.isContentEditable;
      if (!escribiendoEnOtro && codigoBarrasRef.current) codigoBarrasRef.current.focus();
    };
    window.addEventListener('keydown', onKey);
    const offSunmi = onScanFisico((code) => handleSearchBarcodeRef.current?.(code));
    return () => { window.removeEventListener('keydown', onKey); offSunmi(); };
  }, [formOpen, cameraActive]);

  useEffect(() => {
    if (!cameraActive) { cleanupCamera(); setScanConfirmCount(0); return; }

    const onBarcode = (code) => {
      setCameraActive(false);
      setScanConfirmCount(0);
      handleSearchBarcode(code);
    };

    // El detector escanea ~10 veces/seg — aceptar la PRIMERA lectura cruda
    // es lo que causaba capturar dígitos incorrectos: un frame borroso o a
    // medio encuadre mientras el usuario todavía está acomodando la cámara
    // se tomaba como definitivo. Ahora se exige que el mismo código se lea
    // CONFIRM_READS veces seguidas antes de aceptarlo — en la práctica es
    // una pequeña pausa (unos ~200-300ms sosteniendo el código quieto)
    // que filtra lecturas parciales/erróneas sin sentirse lenta.
    const CONFIRM_READS = 3;
    let candidateCode = null;
    let candidateCount = 0;
    const registerDetection = (code) => {
      if (!code) return false;
      if (code === candidateCode) {
        candidateCount += 1;
      } else {
        candidateCode = code;
        candidateCount = 1;
      }
      setScanConfirmCount(candidateCount);
      if (candidateCount >= CONFIRM_READS) {
        onBarcode(candidateCode);
        return true;
      }
      return false;
    };

    let cancelled = false;

    const start = async () => {
      try {
        // `facingMode: 'environment'` como string plano se trata como
        // constraint EXACTA en algunos WebKit/iOS — si el navegador no
        // encuentra una cámara que matchee exactamente, getUserMedia
        // rechaza con OverconstrainedError y la cámara nunca abre (esto es
        // lo que fallaba en iPhone). `{ ideal: 'environment' }` pide la
        // trasera como preferencia, sin descartar el dispositivo si no
        // puede garantizarla; y si aun así falla, se reintenta pidiendo
        // cualquier cámara disponible en vez de rendirse.
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          // Refuerzo además del atributo JSX playsInline — algunas
          // versiones de Safari/iOS solo lo respetan si también se setea
          // como atributo del DOM antes de asignar el stream.
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (HAS_BARCODE_DETECTOR) {
          const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
          let lastCheck = 0;
          const tick = async (ts) => {
            if (cancelled) return;
            if (ts - lastCheck > 100 && videoRef.current) {
              lastCheck = ts;
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0 && registerDetection(codes[0].rawValue)) return;
              } catch {}
            }
            rAFRef.current = requestAnimationFrame(tick);
          };
          rAFRef.current = requestAnimationFrame(tick);
        } else {
          // BarcodeDetector no existe en Safari/iOS — este es el camino que
          // SIEMPRE toma un iPhone. Se reutiliza el stream ya abierto arriba
          // (con el fallback de constraints ya resuelto) en vez de dejar
          // que zxing pida su propio stream con constraints que podrían
          // volver a fallar igual que el getUserMedia original.
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(
            stream,
            videoRef.current,
            (result) => { if (result && !cancelled) registerDetection(result.getText()); }
          );
          zxingControlsRef.current = controls;
        }
      } catch (err) {
        if (err?.name === 'NotAllowedError') {
          toast.error('Permiso de cámara denegado.');
        } else if (err?.name === 'NotFoundError') {
          toast.error('No se encontró una cámara disponible.');
        } else {
          toast.error('No se pudo iniciar la cámara.');
        }
        setCameraActive(false);
      }
    };
    start();

    return () => { cancelled = true; cleanupCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive]);

  const handleToggleCamera = () => setCameraActive(a => !a);

  const handleSaveVariante = async () => {
    if (!varianteForm.nombre) { toast.warning('El nombre de la variante es obligatorio'); return; }
    const attrs = varianteForm.atributos || {};
    const payload = {
      nombre: varianteForm.nombre,
      sku: varianteForm.sku || undefined,
      atributos: attrs,
      precio: varianteForm.precio ? parseFloat(varianteForm.precio) : null,
      costo: varianteForm.costo ? parseFloat(varianteForm.costo) : null,
      stock_inicial: parseFloat(varianteForm.stock_inicial) || 0,
    };
    try {
      if (varianteEditing) {
        const res = await apiClient.put(`/productos/${productoToEdit.id}/variantes/${varianteEditing.id}`, payload);
        setVariantes(prev => prev.map(v => v.id === varianteEditing.id ? res.data : v));
        toast.success('Variante actualizada');
      } else {
        const res = await apiClient.post(`/productos/${productoToEdit.id}/variantes`, payload);
        setVariantes(prev => [...prev, res.data]);
        toast.success('Variante agregada');
      }
      setVarianteDialog(false);
      setVarianteEditing(null);
      setVarianteForm({ nombre: '', sku: '', atributos: {}, precio: '', costo: '', stock_inicial: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar la variante');
    }
  };

  const agregarFilaVariante = () => {
    setFilasNuevaVariante(prev => [...prev, { valor: '', costo: '', precio: '', stock: '' }]);
  };

  const actualizarFilaVariante = (idx, campo, valor) => {
    setFilasNuevaVariante(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f));
  };

  const eliminarFilaVariante = (idx) => {
    setFilasNuevaVariante(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  const handleGuardarFilasVariante = async () => {
    const atributo = nuevoAtributo.trim();
    if (!atributo) { toast.warning('Elige o escribe qué característica varía (ej: Talla)'); return; }
    const filas = filasNuevaVariante.filter(f => f.valor.trim());
    if (!filas.length) { toast.warning(`Escribe al menos un valor de ${atributo}`); return; }

    const payload = {
      atributo,
      valores: filas.map(f => ({
        valor: f.valor.trim(),
        stock_inicial: parseFloat(f.stock) || 0,
        costo: f.costo ? parseFloat(f.costo) : null,
        precio: f.precio ? parseFloat(f.precio) : null,
      })),
    };
    setGuardandoVariantes(true);
    try {
      const res = await apiClient.post(`/productos/${productoToEdit.id}/variantes/generar`, payload);
      setVariantes(prev => [...prev, ...res.data]);
      toast.success(`${res.data.length} variante${res.data.length === 1 ? '' : 's'} agregada${res.data.length === 1 ? '' : 's'}`);
      setNuevoAtributo('');
      setFilasNuevaVariante([{ valor: '', costo: '', precio: '', stock: '' }]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar las variantes');
    } finally {
      setGuardandoVariantes(false);
    }
  };

  const handleDeleteVariante = async (varId) => {
    if (!window.confirm('¿Eliminar esta variante?')) return;
    try {
      await apiClient.delete(`/productos/${productoToEdit.id}/variantes/${varId}`);
      setVariantes(prev => prev.filter(v => v.id !== varId));
      toast.success('Variante eliminada');
    } catch {
      toast.error('Error al eliminar la variante');
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (imagenes.length + files.length > 4) { toast.warning('Máximo 4 imágenes por producto'); return; }
    const [first, ...rest] = files;
    setPendingFiles(rest);
    openCropperWithFile(first);
    e.target.value = '';
  };

  const openCropperWithFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => { setImageToCrop(reader.result); setCropperOpen(true); };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedFile) => {
    try {
      setIsCompressing(true);
      const webpBase64 = await compressImageToWebP(croppedFile);
      setImagenes(prev => [...prev, webpBase64]);
      setMostrarEnCatalogo(true);
      setCropperOpen(false);
      setImageToCrop(null);
      if (pendingFiles.length > 0) {
        const [next, ...rest] = pendingFiles;
        setPendingFiles(rest);
        setTimeout(() => openCropperWithFile(next), 200);
      }
    } catch (error) {
      toast.error('Error al procesar la imagen');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCropCancel = () => { setCropperOpen(false); setImageToCrop(null); setPendingFiles([]); };
  const removeImage = (index) => setImagenes(prev => prev.filter((_, i) => i !== index));
  const handleClose = () => { resetFields(); setCameraActive(false); setFormOpen(false); if (onClose) onClose(); };

  const buildPayload = () => ({
    nombre,
    sku: sku.trim().toUpperCase() || undefined,
    codigo_barras: codigoBarras || null,
    precio: parseFloat(precio) || 0.0,
    costo: esServicio ? 0.0 : parseFloat(costo) || 0.0,
    es_servicio: esServicio,
    unidad_medida: esServicio ? 'UND' : unidadMedida,
    grupo_item: esServicio ? 2 : parseInt(grupoItem),
    stock_minimo: esServicio || stockMinimo === '' ? 0 : parseFloat(stockMinimo),
    maneja_lotes: esServicio ? false : manejaLotes,
    unidades_por_empaque: esServicio ? 1 : (parseFloat(unidadesPorEmpaque) > 1 ? parseFloat(unidadesPorEmpaque) : 1),
    imagenes,
    mostrar_en_catalogo: mostrarEnCatalogo,
    descripcion: descripcion || null,
    tiene_variantes: tieneVariantes,
    ...(!productoToEdit && !esServicio && {
      stock_inicial:     parseFloat(stockInicial) || 0,
      numero_lote:       numeroLote || undefined,
      fecha_vencimiento: fechaVencimiento || undefined,
    }),
  });

  const saveProducto = async (andCreateAnother = false) => {
    if (isSaving) return;
    setIsSaving(true);
    const data = buildPayload();
    try {
      const res = productoToEdit
        ? await apiClient.put(`/productos/${productoToEdit.id}`, data)
        : await apiClient.post('/productos/', data);
      const productoId = res.data.id;
      // Assign tax atomically — surface any error to the user
      try {
        if (impuestoId) {
          await apiClient.post(`/impuestos/producto/${productoId}`, { impuesto_id: parseInt(impuestoId) });
        } else {
          await apiClient.delete(`/impuestos/producto/${productoId}`).catch(() => {});
        }
      } catch {
        toast.warning('Producto guardado, pero no se pudo asignar el impuesto. Intente editarlo.');
      }
      toast.success(`Ítem ${productoToEdit ? 'actualizado' : 'agregado'} exitosamente`);
      if (productoToEdit) {
        onProductoUpdated(res.data);
        if (!andCreateAnother) handleClose();
      } else {
        onProductoAdded(res.data);
        if (andCreateAnother) {
          resetFields();
        } else {
          handleClose();
        }
      }
    } catch (err) {
      const msg = err.response?.data?.detail || `Error al ${productoToEdit ? 'actualizar' : 'agregar'} el ítem.`;
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); saveProducto(false); };

  // ── Computed values ──
  const isEditing      = Boolean(productoToEdit);
  const selectedGroup  = grupos.find(g => g.id === grupoItem);
  const isMateriaPrima = !esServicio && ['MP', 'INS'].includes(selectedGroup?.codigo);
  const precioN     = parseFloat(precio) || 0;
  const costoN      = parseFloat(costo)  || 0;
  const margenPct   = precioN > 0 ? ((precioN - costoN) / precioN * 100) : 0;
  const margenAbs   = precioN - costoN;
  const margenColor = margenPct >= 30 ? '#10B981' : margenPct >= 10 ? '#F59E0B' : '#EF4444';
  const fmtCOP      = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

  // ── Catalog section (shared between columns) ──────────────────────────────
  const CatalogSection = (
    <SectionCard icon={<Storefront fontSize="small" />} title="Catálogo Virtual" accent={CATALOG_COLOR} defaultOpen={false}>
      {/* Visible toggle */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 2, p: 1.5, borderRadius: 2,
        bgcolor: mostrarEnCatalogo ? alpha(CATALOG_COLOR, 0.08) : 'action.hover',
        border: '1px solid', borderColor: mostrarEnCatalogo ? alpha(CATALOG_COLOR, 0.35) : 'divider',
        transition: 'all 0.25s',
      }}>
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
            {mostrarEnCatalogo ? '✓ Visible al público' : 'Oculto'}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2 }}>
            {mostrarEnCatalogo ? 'Aparece en tu tienda online' : 'Solo visible internamente'}
          </Typography>
        </Box>
        <SmartTooltip id="prod_visible_switch" title="Visibilidad" description="Activa esto para que tus clientes puedan ver y pedir este producto desde el catálogo.">
          <Switch
            checked={mostrarEnCatalogo}
            onChange={e => setMostrarEnCatalogo(e.target.checked)}
            disabled={imagenes.length === 0 && !mostrarEnCatalogo}
            sx={{ '& .MuiSwitch-thumb': { bgcolor: mostrarEnCatalogo ? CATALOG_COLOR : undefined } }}
          />
        </SmartTooltip>
      </Box>

      {/* Image grid 2×2 */}
      <Grid container spacing={1.5}>
        {[0, 1, 2, 3].map(idx => {
          const isEmpty    = !imagenes[idx];
          const isPrimary  = idx === 0 && isEmpty;
          const isNext     = idx > 0 && isEmpty && !!imagenes[idx - 1];
          const borderClr  = imagenes[idx] ? accentColor : isPrimary ? '#2563EB' : 'divider';
          const bgClr      = isPrimary ? alpha('#2563EB', 0.07) : 'background.default';
          const iconClr    = isPrimary ? '#2563EB' : isNext ? 'text.secondary' : 'text.disabled';
          return (
            <Grid item xs={6} key={idx}>
              <Box sx={{
                width: '100%', aspectRatio: '1/1', borderRadius: 2,
                border: isPrimary ? '2px dashed' : '2px dashed',
                borderColor: borderClr,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden', bgcolor: bgClr,
                transition: 'border-color 0.2s, background-color 0.2s',
                boxShadow: isPrimary ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
              }}>
                {imagenes[idx] ? (
                  <>
                    <img src={imagenes[idx]} alt={`img-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <IconButton size="small" onClick={() => removeImage(idx)}
                      sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: '#fff' } }}>
                      <Delete fontSize="small" color="error" />
                    </IconButton>
                  </>
                ) : (
                  <Button component="label"
                    disabled={isCompressing || (idx > 0 && !imagenes[idx - 1])}
                    sx={{ flexDirection: 'column', gap: 0.5, width: '100%', height: '100%', color: iconClr, textTransform: 'none' }}>
                    <input hidden accept="image/*" type="file" multiple onChange={handleImageChange} />
                    {isCompressing && idx === 0
                      ? <Typography sx={{ fontSize: 9 }}>Procesando…</Typography>
                      : <>
                          <AddPhotoAlternate fontSize="medium" />
                          <Typography sx={{ fontWeight: isPrimary ? 700 : 600, fontSize: 9 }}>
                            {isPrimary ? 'Foto principal' : 'Subir'}
                          </Typography>
                          {isPrimary && (
                            <Typography sx={{ fontSize: 8, color: '#2563EB', fontWeight: 600, mt: 0.2 }}>
                              Toca aquí
                            </Typography>
                          )}
                        </>
                    }
                  </Button>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1.5 }}>
        Hasta <strong>4 fotos</strong>. Formato cuadrado recomendado.
      </Typography>
    </SectionCard>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ mb: 3 }}>
      <Panel
        title={isEditing ? 'Editar Ítem' : 'Agregar Nuevo Ítem'}
        icon={<Category fontSize="small" />}
        chip={isEditing && (
          <Chip label="Editando" size="small"
            sx={{ bgcolor: `${accentColor}18`, color: accentColor, fontWeight: 600, fontSize: 11 }} />
        )}
        open={formOpen}
        onToggle={() => setFormOpen(o => !o)}
        forceOpen={forceOpen && formOpen}
        onClose={handleClose}
        accentColor={accentColor}
      >
        <Box component="form" onSubmit={handleSubmit}>

          {/* ── Type selector — pill cards ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3.5 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1.2, mb: 1.8 }}>
              ¿Qué tipo de ítem deseas crear?
            </Typography>
            <Box sx={{
              display: 'flex', gap: 1.5,
              p: 0.6, borderRadius: 3,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              border: '1px solid',
              borderColor: 'divider',
            }}>
              {[
                { label: '📦 Producto Físico',    value: false, color: accentColor },
                { label: '⚙️ Servicio Intangible', value: true,  color: '#06B6D4' },
              ].map(({ label, value, color }) => {
                const isActive = esServicio === value;
                return (
                  <Box
                    key={String(value)}
                    onClick={() => setEsServicio(value)}
                    sx={{
                      px: { xs: 2.5, sm: 4 }, py: 1.2,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 13.5,
                      userSelect: 'none',
                      transition: 'all 0.2s',
                      background: isActive
                        ? `linear-gradient(135deg, ${color}, ${alpha(color, 0.75)})`
                        : 'transparent',
                      color: isActive ? '#fff' : 'text.secondary',
                      boxShadow: isActive ? `0 4px 14px ${alpha(color, 0.45)}` : 'none',
                      '&:hover': {
                        background: isActive
                          ? `linear-gradient(135deg, ${color}, ${alpha(color, 0.75)})`
                          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      },
                    }}
                  >
                    {label}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* § 0 — Escaneo Rápido: lo primero que ve el usuario al crear un
              producto, ANTES de nombre/descripción — el flujo ágil es
              escanear el código y dejar que se autocompleten nombre, SKU,
              precio, etc. (ver handleSearchBarcode), no llenar el formulario
              a mano y encontrarse con el escáner al final. Solo aplica a
              productos físicos (los servicios no tienen código de barras). */}
          {!esServicio && (
            <SectionCard icon={<QrCodeScanner fontSize="small" />} title="Escaneo Rápido" accent="#10B981">
              <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                  <TextField
                    label="Código de Barras"
                    value={codigoBarras}
                    onChange={e => setCodigoBarras(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchBarcode(codigoBarras.trim()); } }}
                    autoFocus
                    inputRef={codigoBarrasRef}
                    fullWidth
                    placeholder="Escanea, escribe o usa la cámara…"
                    inputProps={{ style: { fontFamily: 'monospace' } }}
                    sx={getInputSx('#10B981')}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><QrCodeScanner fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          {searchingCode
                            ? <CircularProgress size={18} />
                            : (
                              <SmartTooltip id="prod_scan_camera" title="Escanear con cámara" description="Activa la cámara para leer el código de barras automáticamente.">
                                <IconButton
                                  size="small"
                                  onClick={handleToggleCamera}
                                  disabled={!HAS_CAMERA}
                                  sx={{ color: cameraActive ? '#EF4444' : '#10B981' }}
                                >
                                  <CameraAltIcon fontSize="small" />
                                </IconButton>
                              </SmartTooltip>
                            )}
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5 }}>
                    Si el código ya existe, se autocompletan nombre, precio y demás datos.
                  </Typography>
                </Grid>

                {cameraActive && (
                  <Grid item xs={12} md={5}>
                    <Box sx={{
                      position: 'relative', width: '100%', maxWidth: 420, mx: 'auto',
                      borderRadius: 2, overflow: 'hidden', bgcolor: '#000',
                      aspectRatio: '4/3',
                    }}>
                      <video ref={videoRef} muted playsInline autoPlay
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <Box sx={{
                        position: 'absolute', inset: '18% 12%',
                        border: '2px solid #10B981', borderRadius: 1.5,
                        boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)',
                      }} />
                      <Typography sx={{
                        position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                      }}>
                        {scanConfirmCount > 0
                          ? `Manteniendo lectura… ${scanConfirmCount}/3`
                          : 'Apunta la cámara al código de barras y sostenla quieta'}
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {productStatus && (
                  <Grid item xs={12}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1, p: 1.2, borderRadius: 2,
                      bgcolor: alpha(STATUS_CONFIG[productStatus].color, 0.08),
                      border: `1px solid ${alpha(STATUS_CONFIG[productStatus].color, 0.3)}`,
                    }}>
                      {React.createElement(STATUS_CONFIG[productStatus].icon, { sx: { fontSize: 18, color: STATUS_CONFIG[productStatus].color } })}
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: STATUS_CONFIG[productStatus].color }}>
                        {STATUS_CONFIG[productStatus].label}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </SectionCard>
          )}

          {/* ── 2-column grid ── */}
          <Grid container spacing={2.5} alignItems="flex-start">

            {/* ══════════════════════════════════════
                LEFT COLUMN  (65%)
            ══════════════════════════════════════ */}
            <Grid item xs={12} md={8}>

              {/* § 1 — Información General */}
              <SectionCard icon={<Category fontSize="small" />} title="Información General" accent={accentColor}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Nombre — fila completa */}
                  <TextField
                    label={esServicio ? 'Nombre del Servicio *' : 'Nombre del Producto *'}
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    inputRef={nombreRef}
                    fullWidth required
                    sx={getInputSx(accentColor)}
                  />

                  {/* Descripción — fila completa, 2 líneas de alto */}
                  <TextField
                    label="Descripción"
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    fullWidth multiline rows={2}
                    placeholder={esServicio
                      ? 'Ej: Servicio de instalación y configuración incluida…'
                      : 'Ej: Presentación de 500 g, sabor original, apto para veganos…'}
                    helperText="Opcional — aparece en el catálogo virtual y en cotizaciones"
                    sx={getInputSx(accentColor)}
                  />

                  {!esServicio && (
                    <Grid container spacing={2}>
                      {/* Categoría — fila propia para que no se trunque */}
                      <Grid item xs={12} sx={{ width: '100%' }}>
                        <Autocomplete
                          fullWidth
                          disablePortal={false}
                          sx={{ width: '100%' }}
                          options={grupos}
                          getOptionLabel={o => o.nombre || ''}
                          value={grupos.find(g => g.id === grupoItem) || null}
                          onChange={(_, v) => setGrupoItem(v ? v.id : 2)}
                          renderOption={(props, option) => (
                            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: option.color, flexShrink: 0 }} />
                              <span>{option.nombre}</span>
                              <Typography sx={{ ml: 'auto', fontSize: 10, color: 'text.secondary' }}>{option.codigo}</Typography>
                            </Box>
                          )}
                          renderInput={params => <TextField {...params} label="Categoría / Grupo *" required />}
                        />
                      </Grid>

                      {/* Unidad de medida — fila propia */}
                      <Grid item xs={12} sx={{ width: '100%' }}>
                        <Autocomplete
                          fullWidth freeSolo
                          disablePortal={false}
                          sx={{ width: '100%' }}
                          options={UNIDADES_MEDIDA.map(u => u.value)}
                          value={unidadMedida}
                          onChange={(_, v) => setUnidadMedida(v || 'UND')}
                          onInputChange={(_, v) => setUnidadMedida(v ? v.toUpperCase() : '')}
                          renderInput={params => <TextField {...params} label="Unidad de Medida *" required placeholder="Ej: KG, LT, UND" />}
                        />
                      </Grid>

                      {/* SKU — Código de Barras se movió a la sección de
                          Escaneo Rápido, arriba de todo el formulario. */}
                      <Grid item xs={12}>
                        <TextField
                          label="SKU / Código Interno"
                          value={sku}
                          onChange={e => setSku(e.target.value.toUpperCase())}
                          fullWidth
                          placeholder={productoToEdit ? '' : 'Se genera automáticamente'}
                          inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 1 } }}
                          helperText={!sku && skuPreview ? `Se generará: ${skuPreview}` : 'Identificador único del ítem en tu inventario'}
                          sx={getInputSx(accentColor)}
                        />
                      </Grid>
                    </Grid>
                  )}
                </Box>
              </SectionCard>

              {/* § 2 — Precios e Impuestos */}
              <SectionCard icon={<LocalOffer fontSize="small" />} title="Precios e Impuestos" accent={PRICE_COLOR} defaultOpen={false}>
                <Grid container spacing={2}>
                  {/* Fila 1: Precio | Costo */}
                  <Grid item xs={12} md={6}>
                    {isMateriaPrima ? (
                      <Box sx={{
                        p: 1.5, borderRadius: 2, height: '100%', minHeight: 40,
                        display: 'flex', alignItems: 'center', gap: 1,
                        bgcolor: alpha('#3B82F6', 0.06),
                        border: '1px solid', borderColor: alpha('#3B82F6', 0.2),
                      }}>
                        <InfoOutlined sx={{ fontSize: 16, color: '#3B82F6', flexShrink: 0 }} />
                        <Typography fontSize={12} color="#1E40AF" lineHeight={1.4}>
                          Esta categoría no tiene precio de venta — se usa como insumo en producción.
                        </Typography>
                      </Box>
                    ) : (
                      <CurrencyField
                        label={esServicio ? 'Precio de Venta *' : 'Precio de Venta'}
                        value={precio}
                        onChange={val => setPrecio(val)}
                        required={esServicio}
                      />
                    )}
                  </Grid>

                  {!esServicio && (
                    <Grid item xs={12} md={6}>
                      <CurrencyField
                        label={isMateriaPrima ? 'Costo de Adquisición *' : 'Costo Actual *'}
                        value={costo}
                        onChange={val => { setCosto(val); setMarginInput(''); }}
                        required
                      />
                    </Grid>
                  )}

                  {/* Calculadora inversa: margen → precio */}
                  {!esServicio && (
                    <Grid item xs={12}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                          <Tune sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>Calcular precio por margen</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            size="small"
                            placeholder="Margen %"
                            value={marginInput}
                            onChange={e => {
                              const m = e.target.value;
                              setMarginInput(m);
                              const mNum = parseFloat(m);
                              const c = parseFloat(costo) || 0;
                              if (!isNaN(mNum) && mNum < 100 && c > 0) {
                                setPrecio(String(Math.round(c / (1 - mNum / 100))));
                              }
                            }}
                            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                            sx={{ width: 120 }}
                            type="number"
                            inputProps={{ min: 0, max: 99, step: 1 }}
                          />
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>→ precio automático</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}

                  {/* Fila 2: IVA — fila propia, ancho generoso */}
                  <Grid item xs={12} sx={{ width: '100%' }}>
                    <FormControl fullWidth sx={{ width: '100%', display: 'block' }}>
                      <InputLabel>Impuesto (IVA)</InputLabel>
                      <Select
                        fullWidth
                        label="Impuesto (IVA)"
                        value={String(impuestoId)}
                        onChange={e => setImpuestoId(e.target.value)}
                        renderValue={val => {
                          if (!val) return <em style={{ color: 'inherit', fontStyle: 'normal', opacity: 0.6 }}>Sin impuesto</em>;
                          const imp = tiposImpuesto.find(i => String(i.id) === val);
                          if (!imp) return val;
                          return (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={`${imp.porcentaje}%`} size="small"
                                sx={{ fontSize: 10, height: 18,
                                  bgcolor: imp.porcentaje > 0 ? alpha(PRICE_COLOR, 0.1) : alpha('#10B981', 0.1),
                                  color:   imp.porcentaje > 0 ? PRICE_COLOR : '#10B981' }} />
                              <span>{imp.nombre}</span>
                            </Box>
                          );
                        }}
                      >
                        <MenuItem value=""><em>Sin impuesto</em></MenuItem>
                        {tiposImpuesto.map(imp => (
                          <MenuItem key={imp.id} value={String(imp.id)}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={`${imp.porcentaje}%`} size="small"
                                sx={{ fontSize: 10, height: 18,
                                  bgcolor: imp.porcentaje > 0 ? alpha(PRICE_COLOR, 0.1) : alpha('#10B981', 0.1),
                                  color:   imp.porcentaje > 0 ? PRICE_COLOR : '#10B981' }} />
                              <span>{imp.nombre}</span>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Margen — banda completa debajo (no aplica a materias primas) */}
                  {!esServicio && !isMateriaPrima && precio && costo && (
                    <Grid item xs={12}>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        p: 2, borderRadius: 2.5,
                        bgcolor: alpha(margenColor, 0.07),
                        border: `1px solid ${alpha(margenColor, 0.2)}`,
                      }}>
                        <Box>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Margen
                          </Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: 24, color: margenColor, lineHeight: 1 }}>
                            {margenPct.toFixed(1)}%
                          </Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem sx={{ borderColor: alpha(margenColor, 0.2) }} />
                        <Box>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Ganancia por unidad
                          </Typography>
                          <Typography sx={{ fontSize: 18, fontWeight: 700, color: margenColor }}>
                            {fmtCOP(margenAbs)}
                          </Typography>
                        </Box>
                        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                          <Chip
                            label={margenPct >= 30 ? 'Saludable' : margenPct >= 10 ? 'Aceptable' : 'Bajo'}
                            size="small"
                            sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha(margenColor, 0.15), color: margenColor }}
                          />
                        </Box>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </SectionCard>

              {/* § Variantes */}
              <SectionCard icon={<Tune fontSize="small" />} title="Variantes" accent="#8B5CF6" defaultOpen={false}>
                <FormControlLabel
                  control={<Switch checked={tieneVariantes} onChange={e => setTieneVariantes(e.target.checked)} />}
                  label={<Box><Typography variant="body2" fontWeight={600}>Este ítem tiene variantes</Typography><Typography variant="caption" color="text.secondary">Tallas, colores, presentaciones, niveles de servicio…</Typography></Box>}
                />
                {tieneVariantes && !productoToEdit && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      💡 Guarda el producto primero. Luego podrás agregar sus variantes desde la lista de inventario.
                    </Typography>
                  </Box>
                )}
                {tieneVariantes && productoToEdit && (
                  <Box sx={{ mt: 2 }}>
                    {/* ── Constructor inline: elige el atributo, agrega filas de valores ── */}
                    <Box sx={{
                      p: 2, borderRadius: 2.5, mb: 3,
                      bgcolor: isDark ? alpha(accentColor, 0.06) : alpha(accentColor, 0.04),
                      border: '1px solid', borderColor: alpha(accentColor, 0.2),
                    }}>
                      <Autocomplete
                        freeSolo
                        options={ATRIBUTOS_SUGERIDOS}
                        value={nuevoAtributo}
                        onInputChange={(e, val) => setNuevoAtributo(val)}
                        renderInput={(params) => (
                          <TextField {...params} label="¿Qué característica varía?" size="small"
                            placeholder="Ej: Talla, Color, Tamaño, Peso…" fullWidth />
                        )}
                      />

                      {nuevoAtributo.trim() && (
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr 1fr', sm: '1.3fr 1fr 1fr 0.9fr auto' },
                            gap: 1, mb: 0.8, px: 0.5,
                          }}>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                              {nuevoAtributo}
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>Costo</Typography>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>Precio</Typography>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Stock</Typography>
                            <Box />
                          </Box>

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                            {filasNuevaVariante.map((fila, idx) => (
                              <Box key={idx} sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr 1fr', sm: '1.3fr 1fr 1fr 0.9fr auto' },
                                gap: 1, alignItems: 'center',
                                p: 1, borderRadius: 2, bgcolor: 'background.paper',
                                border: '1px solid', borderColor: 'divider',
                              }}>
                                <TextField size="small" placeholder={`Ej: ${nuevoAtributo === 'Talla' ? '38' : 'Rojo'}`}
                                  value={fila.valor}
                                  onChange={e => actualizarFilaVariante(idx, 'valor', e.target.value)}
                                  autoFocus={idx === filasNuevaVariante.length - 1 && filasNuevaVariante.length > 1}
                                />
                                <CurrencyField size="small" placeholder="Opcional" value={fila.costo}
                                  onChange={val => actualizarFilaVariante(idx, 'costo', val)} />
                                <CurrencyField size="small" placeholder="Opcional" value={fila.precio}
                                  onChange={val => actualizarFilaVariante(idx, 'precio', val)} />
                                <TextField size="small" type="number" placeholder="0"
                                  value={fila.stock}
                                  onChange={e => actualizarFilaVariante(idx, 'stock', e.target.value)} />
                                <IconButton size="small" color="error"
                                  onClick={() => eliminarFilaVariante(idx)}
                                  disabled={filasNuevaVariante.length === 1}
                                  sx={{ justifySelf: 'end' }}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                            <Button size="small" startIcon={<Add />} onClick={agregarFilaVariante}
                              sx={{ textTransform: 'none', fontWeight: 700, color: accentColor }}>
                              Añadir fila
                            </Button>
                            <Button size="small" variant="contained" onClick={handleGuardarFilasVariante}
                              disabled={guardandoVariantes || !filasNuevaVariante.some(f => f.valor.trim())}
                              sx={{
                                textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 2.5,
                                background: `linear-gradient(135deg, ${accentColor} 0%, #4F46E5 100%)`,
                              }}>
                              {guardandoVariantes ? 'Guardando…' : `Guardar ${filasNuevaVariante.filter(f => f.valor.trim()).length || ''} variante${filasNuevaVariante.filter(f => f.valor.trim()).length === 1 ? '' : 's'}`}
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </Box>

                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary', mb: 1.5 }}>
                      {variantes.length} variante{variantes.length !== 1 ? 's' : ''} registrada{variantes.length !== 1 ? 's' : ''}
                    </Typography>
                    {variantes.length > 0 && (
                      <Box sx={{
                        borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
                        overflow: 'hidden',
                        boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
                      }}>
                        <Table size="small" sx={{ '& td,& th': { fontSize: 12 } }}>
                          <TableHead>
                            <TableRow sx={{
                              background: isDark
                                ? `linear-gradient(90deg, ${alpha(accentColor, 0.12)}, transparent)`
                                : `linear-gradient(90deg, ${alpha(accentColor, 0.06)}, transparent)`,
                            }}>
                              <TableCell sx={{ fontWeight: 800, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6, color: accentColor, py: 1.2 }}>SKU</TableCell>
                              <TableCell sx={{ fontWeight: 800, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', py: 1.2 }}>Nombre / Atributos</TableCell>
                              <TableCell sx={{ fontWeight: 800, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', py: 1.2 }}>Precio</TableCell>
                              <TableCell sx={{ fontWeight: 800, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', py: 1.2 }}>Stock</TableCell>
                              <TableCell />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {variantes.map(v => (
                              <TableRow key={v.id} hover sx={{
                                transition: 'background-color 0.15s',
                                '&:hover': { bgcolor: isDark ? `${alpha(accentColor, 0.08)}` : `${alpha(accentColor, 0.04)}` },
                              }}>
                                <TableCell>
                                  <Typography sx={{
                                    fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                                    color: accentColor, bgcolor: alpha(accentColor, 0.1),
                                    px: 0.8, py: 0.2, borderRadius: 1, display: 'inline-block'
                                  }}>{v.sku}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>{v.nombre}</Typography>
                                  {v.atributos && Object.keys(v.atributos).length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.4 }}>
                                      {Object.entries(v.atributos).map(([k, val]) => (
                                        <Chip key={k} label={`${k}: ${val}`} size="small" sx={{
                                          height: 18, fontSize: 10, fontWeight: 600,
                                          bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                          borderRadius: 1,
                                        }} />
                                      ))}
                                    </Box>
                                  )}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>{v.precio != null ? `$${v.precio.toLocaleString('es-CO')}` : '—'}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{v.stock_actual}</TableCell>
                                <TableCell align="right">
                                  <IconButton size="small"
                                    onClick={() => { setVarianteEditing(v); setVarianteForm({ nombre: v.nombre, sku: v.sku, atributos: v.atributos || {}, precio: v.precio ?? '', costo: v.costo ?? '', stock_inicial: '' }); setVarianteDialog(true); }}
                                    sx={{ color: accentColor, bgcolor: alpha(accentColor, 0.08), borderRadius: 1.5, mr: 0.5, '&:hover': { bgcolor: alpha(accentColor, 0.18) } }}
                                  >
                                    <ExpandMore fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error"
                                    onClick={() => handleDeleteVariante(v.id)}
                                    sx={{ bgcolor: alpha('#EF4444', 0.08), borderRadius: 1.5, '&:hover': { bgcolor: alpha('#EF4444', 0.18) } }}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )}
                  </Box>
                )}
              </SectionCard>

              {/* § 3 — Inventario y Logística (solo productos físicos) */}
              {!esServicio && (
                <SectionCard icon={<Inventory fontSize="small" />} title="Inventario y Logística" accent={INVENTORY_COLOR} defaultOpen={false}>
                  <Grid container spacing={2}>

                    {/* Stock mínimo */}
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Alerta de Stock Mínimo"
                        value={stockMinimo}
                        onChange={e => setStockMinimo(e.target.value.replace(/[^0-9.]/g, ''))}
                        fullWidth
                        placeholder="Ej: 10"
                        helperText="Te avisaremos cuando el stock baje de este número"
                        sx={getInputSx(INVENTORY_COLOR)}
                      />
                    </Grid>

                    {/* Stock actual (solo al editar) */}
                    {isEditing && (
                      <Grid item xs={12} md={6}>
                        <Box sx={{
                          height: '100%', display: 'flex', alignItems: 'center', gap: 1.5,
                          p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
                          bgcolor: 'action.hover',
                        }}>
                          <Inventory sx={{ color: 'text.disabled', fontSize: 22 }} />
                          <Box>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Stock actual en bodega</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                              {stockActual} <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{unidadMedida}</Typography>
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    )}

                    {/* Perecedero switch */}
                    <Grid item xs={12}>
                      <Box sx={{
                        p: 1.5, borderRadius: 2, border: '1px solid',
                        borderColor: manejaLotes ? '#10B981' : 'divider',
                        bgcolor: manejaLotes ? alpha('#10B981', isDark ? 0.12 : 0.06) : 'transparent',
                        transition: 'all 0.2s',
                      }}>
                        <FormControlLabel
                          control={<Switch checked={manejaLotes} onChange={e => setManejaLotes(e.target.checked)} color="success" />}
                          label={
                            <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: manejaLotes ? '#059669' : 'text.primary' }}>
                              Producto Perecedero — Control por Lotes y Vencimiento
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                        {manejaLotes && (
                          <Typography sx={{ fontSize: 12, color: '#059669', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, pl: 4 }}>
                            <Science fontSize="small" />
                            Podrás registrar lotes y fechas de vencimiento en compras y entradas.
                          </Typography>
                        )}
                      </Box>
                    </Grid>

                    {/* Stock inicial (solo al crear) */}
                    {!isEditing && (
                      <Grid item xs={12}>
                        <Box sx={{
                          p: 2, borderRadius: 2, border: '1px solid',
                          borderColor: parseFloat(stockInicial) > 0 ? '#3B82F6' : 'divider',
                          bgcolor: parseFloat(stockInicial) > 0 ? (isDark ? alpha('#3B82F6', 0.1) : '#EFF6FF') : 'transparent',
                          transition: 'all 0.2s',
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>📊 Stock inicial disponible</Typography>
                            <Tooltip
                              arrow placement="top"
                              title={
                                <Box sx={{ p: 1, maxWidth: 240 }}>
                                  <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>¿Para qué sirve?</Typography>
                                  <Typography sx={{ fontSize: 12, lineHeight: 1.5 }}>
                                    Si ya tienes unidades en bodega, regístralas aquí. El sistema crea un movimiento de entrada automático.
                                  </Typography>
                                  <Typography sx={{ fontSize: 12, mt: 1 }}>Deja en <b>0</b> si aún no has recibido mercancía.</Typography>
                                </Box>
                              }
                            >
                              <InfoOutlined sx={{ fontSize: 17, color: 'text.secondary', cursor: 'help' }} />
                            </Tooltip>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <TextField
                              type="number" label="Cantidad en existencia"
                              value={stockInicial}
                              onChange={e => setStockInicial(e.target.value)}
                              inputProps={{ min: 0, step: 'any' }}
                              size="small" sx={{ width: 200 }}
                              helperText="Unidades ya en bodega"
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{unidadMedida || 'UND'}</Typography>
                                  </InputAdornment>
                                ),
                              }}
                            />
                            {manejaLotes && parseFloat(stockInicial) > 0 && (
                              <>
                                <TextField
                                  label="N° de lote" value={numeroLote}
                                  onChange={e => setNumeroLote(e.target.value)}
                                  size="small" sx={{ width: 155 }}
                                  placeholder="Ej: LOTE-001"
                                  helperText="Obligatorio si maneja lotes"
                                />
                                <TextField
                                  label="Fecha de vencimiento" type="date"
                                  value={fechaVencimiento}
                                  onChange={e => setFechaVencimiento(e.target.value)}
                                  size="small" sx={{ width: 185 }}
                                  InputLabelProps={{ shrink: true }}
                                  helperText="Fecha en que vence el lote"
                                />
                              </>
                            )}
                          </Box>
                          {parseFloat(stockInicial) > 0 && (
                            <Typography sx={{ fontSize: 11, color: '#1d4ed8', mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              ✓ Se registrará una entrada de <b>{stockInicial} {unidadMedida || 'UND'}</b> al guardar.
                            </Typography>
                          )}
                        </Box>
                      </Grid>
                    )}

                    {/* Empaque / Caja */}
                    <Grid item xs={12}>
                      <Box sx={{
                        p: 2, borderRadius: 2, border: '1px solid',
                        borderColor: parseFloat(unidadesPorEmpaque) > 1 ? '#F59E0B' : 'divider',
                        bgcolor: parseFloat(unidadesPorEmpaque) > 1 ? (isDark ? alpha('#F59E0B', 0.08) : '#FFFBEB') : 'transparent',
                        transition: 'all 0.2s',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>📦 Empaque / Caja con múltiples unidades</Typography>
                          <Tooltip arrow placement="top"
                            title={
                              <Box sx={{ p: 1, maxWidth: 255 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>¿Para qué sirve?</Typography>
                                <Typography sx={{ fontSize: 12, lineHeight: 1.5 }}>
                                  Si compras una <b>caja de 4 carnes por $12.000</b>, ingresa el costo como $12.000 y pon aquí <b>4</b>.
                                  El sistema calcula $3.000 por unidad para recetas.
                                </Typography>
                              </Box>
                            }
                          >
                            <InfoOutlined sx={{ fontSize: 17, color: 'text.secondary', cursor: 'help' }} />
                          </Tooltip>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <TextField
                            type="number" label="Unidades por empaque"
                            value={unidadesPorEmpaque}
                            onChange={e => setUnidadesPorEmpaque(e.target.value)}
                            onBlur={() => {
                              const v = parseFloat(unidadesPorEmpaque);
                              setUnidadesPorEmpaque((!v || v < 1) ? '1' : String(Math.round(v)));
                            }}
                            inputProps={{ min: 1, step: 1 }}
                            size="small" sx={{ width: 180 }}
                            helperText="Deja en 1 si compras por unidad"
                          />
                          {parseFloat(unidadesPorEmpaque) > 1 && parseFloat(costo) > 0 && (
                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#F59E0B', 0.1), border: `1px solid ${alpha('#F59E0B', 0.3)}` }}>
                              <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Costo real por unidad</Typography>
                              <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>
                                {fmtCOP(parseFloat(costo) / parseFloat(unidadesPorEmpaque))}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                                {fmtCOP(parseFloat(costo))} ÷ {unidadesPorEmpaque} uds
                              </Typography>
                            </Box>
                          )}
                          {parseFloat(unidadesPorEmpaque) > 1 && (
                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#10B981', 0.08), border: `1px solid ${alpha('#10B981', 0.25)}`, flex: 1, minWidth: 180 }}>
                              <Typography sx={{ fontSize: 12, color: isDark ? '#34d399' : '#059669', fontWeight: 600, lineHeight: 1.5 }}>
                                ✓ En recetas, usa la cantidad de <b>unidades individuales</b>, no cajas.
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Grid>

                  </Grid>
                </SectionCard>
              )}
            </Grid>

            {/* ══════════════════════════════════════
                RIGHT COLUMN  (35%)
            ══════════════════════════════════════ */}
            <Grid item xs={12} md={4}>
              {CatalogSection}
            </Grid>

          </Grid>

          {/* ── Action Buttons ── */}
          <Box sx={{
            display: 'flex', gap: 1.5, justifyContent: 'flex-end',
            mt: 1.5, pt: 2.5,
            borderTop: '1px solid', borderColor: 'divider',
            flexWrap: 'wrap', alignItems: 'center',
          }}>
            <Button
              onClick={handleClose}
              variant="outlined"
              disabled={isSaving}
              sx={{
                borderRadius: 2.5, fontWeight: 600,
                borderColor: 'divider', color: 'text.secondary',
                px: 3, py: 1,
                '&:hover': { bgcolor: 'action.hover', borderColor: 'text.secondary' },
              }}
            >
              Cancelar
            </Button>

            {!isEditing && (
              <Button
                variant="outlined"
                disabled={isSaving || !nombre}
                onClick={() => saveProducto(true)}
                sx={{
                  borderRadius: 2.5, fontWeight: 600,
                  borderColor: alpha(accentColor, 0.5),
                  color: accentColor, px: 2.5, py: 1,
                  '&:hover': { borderColor: accentColor, bgcolor: alpha(accentColor, 0.06) },
                }}
              >
                Guardar y crear otro
              </Button>
            )}

            <Button
              type="submit"
              variant="contained"
              disabled={isSaving || !nombre}
              sx={{
                background: isSaving
                  ? 'transparent'
                  : esServicio
                    ? 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)'
                    : `linear-gradient(135deg, ${accentColor} 0%, #4F46E5 100%)`,
                boxShadow: esServicio
                  ? '0 4px 16px rgba(6,182,212,0.4)'
                  : `0 4px 16px ${alpha(accentColor, 0.45)}`,
                borderRadius: 2.5, fontWeight: 700, px: 4, py: 1,
                fontSize: 14,
                letterSpacing: 0.3,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: esServicio
                    ? '0 8px 24px rgba(6,182,212,0.5)'
                    : `0 8px 24px ${alpha(accentColor, 0.55)}`,
                },
                '&:disabled': {
                  background: 'action.disabledBackground',
                  boxShadow: 'none',
                },
              }}
            >
              {isSaving ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ color: 'inherit' }} />
                  Guardando…
                </Box>
              ) : (
                isEditing ? '✓ Actualizar Cambios' : `Guardar ${esServicio ? 'Servicio' : 'Producto'}`
              )}
            </Button>
          </Box>

        </Box>
      </Panel>

      {/* ── Variant dialog ── */}
      <Dialog
        open={varianteDialog}
        onClose={() => setVarianteDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden' } }}
      >
        {/* Franja superior */}
        <Box sx={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, #4F46E5)` }} />
        <DialogTitle sx={{
          fontWeight: 800, fontSize: 17,
          display: 'flex', alignItems: 'center', gap: 1.2,
        }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 2,
            background: `linear-gradient(135deg, ${accentColor}, #4F46E5)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Tune sx={{ color: '#fff', fontSize: 16 }} />
          </Box>
          {varianteEditing ? 'Editar variante' : 'Nueva variante'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Nombre de la variante *" value={varianteForm.nombre}
                onChange={e => setVarianteForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: 500g Rojo, Talla M Azul, Plan Premium…" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="SKU" value={varianteForm.sku}
                onChange={e => setVarianteForm(p => ({ ...p, sku: e.target.value.toUpperCase() }))}
                placeholder="Se genera automáticamente"
                inputProps={{ style: { fontFamily: 'monospace' } }}
                helperText="Dejar vacío para auto-generar" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Stock inicial" type="number"
                value={varianteForm.stock_inicial}
                onChange={e => setVarianteForm(p => ({ ...p, stock_inicial: e.target.value }))}
                placeholder="0" disabled={!!varianteEditing} />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Atributos (define las características que diferencian esta variante)</Typography></Divider>
            </Grid>
            {['presentacion','color','talla','medida','tipo','nivel','material'].map(attr => (
              <Grid item xs={6} sm={4} key={attr}>
                <TextField fullWidth size="small"
                  label={attr.charAt(0).toUpperCase() + attr.slice(1)}
                  value={varianteForm.atributos[attr] || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setVarianteForm(p => ({
                      ...p,
                      atributos: val ? { ...p.atributos, [attr]: val } : Object.fromEntries(Object.entries(p.atributos).filter(([k]) => k !== attr))
                    }));
                  }}
                  placeholder={attr === 'presentacion' ? '500g, 1kg…' : attr === 'color' ? 'Azul, Rojo…' : attr === 'talla' ? 'XS, M, XL…' : ''}
                />
              </Grid>
            ))}
            <Grid item xs={12}><Divider /></Grid>
            <Grid item xs={6}>
              <CurrencyField label="Precio (opcional)" value={varianteForm.precio}
                onChange={val => setVarianteForm(p => ({ ...p, precio: val }))}
                helperText="Vacío = hereda del producto" />
            </Grid>
            <Grid item xs={6}>
              <CurrencyField label="Costo (opcional)" value={varianteForm.costo}
                onChange={val => setVarianteForm(p => ({ ...p, costo: val }))}
                helperText="Vacío = hereda del producto" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setVarianteDialog(false)}
            sx={{ textTransform: 'none', borderRadius: 2.5, fontWeight: 600, color: 'text.secondary' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveVariante}
            disabled={!varianteForm.nombre}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: 2.5, px: 3, py: 1,
              background: `linear-gradient(135deg, ${accentColor} 0%, #4F46E5 100%)`,
              boxShadow: `0 4px 14px ${alpha(accentColor, 0.45)}`,
              '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 6px 20px ${alpha(accentColor, 0.55)}` },
              '&:disabled': { background: 'rgba(0,0,0,0.12)', boxShadow: 'none' },
              transition: 'all 0.2s',
            }}
          >
            {varianteEditing ? '✓ Guardar cambios' : '+ Agregar variante'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Carga masiva (solo al crear) ── */}
      {!isEditing && (
        <Panel
          title="Carga Masiva de Inventario"
          icon={<Upload fontSize="small" />}
          chip={
            <Chip
              label="Excel / CSV"
              size="small"
              sx={{
                bgcolor: alpha(accentColor, 0.1),
                color: accentColor,
                fontWeight: 700,
                fontSize: 10.5,
                border: `1px solid ${alpha(accentColor, 0.25)}`,
              }}
            />
          }
          open={bulkOpen}
          onToggle={() => setBulkOpen(o => !o)}
          accentColor={accentColor}
        >
          <BulkUpload uploadType="productos" onUploadSuccess={onProductoAdded} />
        </Panel>
      )}

      <ImageCropperDialog
        open={cropperOpen}
        imageSrc={imageToCrop}
        onClose={handleCropCancel}
        onCropComplete={handleCropComplete}
        accentColor={accentColor}
      />
    </Box>
  );
};

export default ProductoForm;
