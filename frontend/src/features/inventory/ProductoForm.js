import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import BulkUpload from '../../components/common/BulkUpload';
import CurrencyField from '../../components/common/CurrencyField';
import ImageCropperDialog from '../../components/common/ImageCropperDialog';
import { compressImageToWebP } from '../../utils/imageOptimizer';
import SmartTooltip from '../../components/onboarding/SmartTooltip';

import {
  Box, Typography, Grid, TextField, Button, Collapse, Divider, Chip,
  IconButton, ButtonGroup, Switch, FormControlLabel, Autocomplete,
  Tooltip, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

import {
  Inventory, ExpandMore, ExpandLess, Upload, Close, Category, Science,
  Storefront, AddPhotoAlternate, Delete, InfoOutlined, LocalOffer,
  Tag, Add, Tune,
} from '@mui/icons-material';

import { UNIDADES_MEDIDA } from '../../utils/constants';

const DEFAULT_ACCENT  = '#8B5CF6';
const PRICE_COLOR     = '#F43F5E';
const INVENTORY_COLOR = '#10B981';
const CATALOG_COLOR   = '#F59E0B';

// ─── Section Card ─────────────────────────────────────────────────────────────
const SectionCard = ({ icon, title, accent = DEFAULT_ACCENT, children }) => (
  <Box sx={{
    borderRadius: 3,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
    mb: 2.5,
    overflow: 'hidden',
    boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
  }}>
    <Box sx={{
      px: 2.5, py: 1.5,
      display: 'flex', alignItems: 'center', gap: 1.2,
      borderBottom: '1px solid', borderColor: 'divider',
      bgcolor: alpha(accent, 0.05),
    }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: 1.5,
        bgcolor: alpha(accent, 0.14),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{title}</Typography>
    </Box>
    <Box sx={{ p: 2.5 }}>
      {children}
    </Box>
  </Box>
);

// ─── Collapsible Panel wrapper (unchanged) ────────────────────────────────────
const Panel = ({ title, icon, chip, open, onToggle, forceOpen, onClose, children, accentColor }) => (
  <Box sx={{
    borderRadius: 3, border: '1px solid', borderColor: 'divider',
    bgcolor: 'background.paper', mb: 2,
    boxShadow: open ? '0 4px 24px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.2s',
  }}>
    <Box
      onClick={() => { if (!forceOpen) onToggle(); }}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: { xs: 1.5, md: 2.5 }, py: 1.5,
        cursor: forceOpen ? 'default' : 'pointer',
        '&:hover': { bgcolor: forceOpen ? 'transparent' : 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
        <Box sx={{
          width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
          bgcolor: `${accentColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor,
        }}>
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
        {chip && <Box sx={{ flexShrink: 0 }}>{chip}</Box>}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
        {open && onClose && (
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onClose(); }} sx={{ color: 'text.secondary' }}>
            <Close fontSize="small" />
          </IconButton>
        )}
        {!forceOpen && (open
          ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 20 }} />
          : <ExpandMore sx={{ color: 'text.secondary', fontSize: 20 }} />
        )}
      </Box>
    </Box>
    <Collapse in={open}>
      <Divider />
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>
        {children}
      </Box>
    </Collapse>
  </Box>
);

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

  // ── Variant state ──
  const [tieneVariantes,    setTieneVariantes]    = useState(false);
  const [variantes,         setVariantes]         = useState([]);
  const [varianteDialog,    setVarianteDialog]    = useState(false);
  const [varianteEditing,   setVarianteEditing]   = useState(null);
  const [varianteForm,      setVarianteForm]      = useState({ nombre: '', sku: '', atributos: {}, precio: '', costo: '', stock_inicial: '' });
  const [skuPreview,        setSkuPreview]        = useState('');

  // ── Lifecycle (unchanged) ──
  useEffect(() => {
    apiClient.get('/grupos-producto/').then(r => setGrupos(r.data || [])).catch(() => {});
    apiClient.get('/impuestos/?solo_activos=true').then(r => setTiposImpuesto(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (forceOpen !== undefined) setFormOpen(forceOpen);
  }, [forceOpen]);

  useEffect(() => {
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
  };

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
  const handleClose = () => { resetFields(); setFormOpen(false); if (onClose) onClose(); };

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
    <SectionCard icon={<Storefront fontSize="small" />} title="Catálogo Virtual" accent={CATALOG_COLOR}>
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
        {[0, 1, 2, 3].map(idx => (
          <Grid item xs={6} key={idx}>
            <Box sx={{
              width: '100%', aspectRatio: '1/1', borderRadius: 2,
              border: '2px dashed', borderColor: imagenes[idx] ? accentColor : 'divider',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden', bgcolor: 'background.default',
              transition: 'border-color 0.2s',
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
                  sx={{ flexDirection: 'column', gap: 0.5, width: '100%', height: '100%', color: 'text.disabled', textTransform: 'none' }}>
                  <input hidden accept="image/*" type="file" multiple onChange={handleImageChange} />
                  {isCompressing
                    ? <Typography sx={{ fontSize: 9 }}>Procesando…</Typography>
                    : <><AddPhotoAlternate fontSize="medium" /><Typography sx={{ fontWeight: 600, fontSize: 9 }}>Subir</Typography></>
                  }
                </Button>
              )}
            </Box>
          </Grid>
        ))}
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

          {/* ── Type selector ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
              ¿Qué tipo de ítem deseas crear?
            </Typography>
            <ButtonGroup variant="outlined" sx={{ '& .MuiButton-root': { py: 1.2, px: { xs: 2.5, sm: 5 }, borderColor: 'divider' } }}>
              <Button
                onClick={() => setEsServicio(false)}
                sx={{
                  bgcolor: !esServicio ? alpha(accentColor, 0.1) : 'transparent',
                  color: !esServicio ? accentColor : 'text.secondary',
                  borderColor: !esServicio ? `${accentColor} !important` : 'divider',
                  fontWeight: !esServicio ? 700 : 500,
                }}
              >
                📦 Producto Físico
              </Button>
              <Button
                onClick={() => setEsServicio(true)}
                sx={{
                  bgcolor: esServicio ? alpha('#06B6D4', 0.1) : 'transparent',
                  color: esServicio ? '#06B6D4' : 'text.secondary',
                  borderColor: esServicio ? '#06B6D4 !important' : 'divider',
                  fontWeight: esServicio ? 700 : 500,
                }}
              >
                ⚙️ Servicio Intangible
              </Button>
            </ButtonGroup>
          </Box>

          {/* ── 2-column grid ── */}
          <Grid container spacing={2.5} alignItems="flex-start">

            {/* ══════════════════════════════════════
                LEFT COLUMN  (65%)
            ══════════════════════════════════════ */}
            <Grid item xs={12} md={8}>

              {/* § 1 — Información General */}
              <SectionCard icon={<Category fontSize="small" />} title="Información General" accent={accentColor}>
                <Grid container spacing={2}>
                  {/* Nombre — fila propia, ancho completo */}
                  <Grid item xs={12}>
                    <TextField
                      label={esServicio ? 'Nombre del Servicio *' : 'Nombre del Producto *'}
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      fullWidth required
                    />
                  </Grid>

                  {/* Descripción — fila propia, ancho completo, 2 filas de alto */}
                  <Grid item xs={12}>
                    <TextField
                      label="Descripción"
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      fullWidth multiline rows={2}
                      placeholder={esServicio
                        ? 'Ej: Servicio de instalación y configuración incluida…'
                        : 'Ej: Presentación de 500 g, sabor original, apto para veganos…'}
                      helperText="Opcional — aparece en el catálogo virtual y en cotizaciones"
                    />
                  </Grid>

                  {!esServicio && (
                    <>
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

                      {/* SKU + Código de Barras — fila compartida */}
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="SKU / Código Interno"
                          value={sku}
                          onChange={e => setSku(e.target.value.toUpperCase())}
                          fullWidth
                          placeholder={productoToEdit ? '' : 'Se genera automáticamente'}
                          inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 1 } }}
                          helperText={!sku && skuPreview ? `Se generará: ${skuPreview}` : 'Identificador único del ítem en tu inventario'}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Código de Barras"
                          value={codigoBarras}
                          onChange={e => setCodigoBarras(e.target.value)}
                          fullWidth
                          placeholder="Escanea o escribe…"
                          inputProps={{ style: { fontFamily: 'monospace' } }}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </SectionCard>

              {/* § 2 — Precios e Impuestos */}
              <SectionCard icon={<LocalOffer fontSize="small" />} title="Precios e Impuestos" accent={PRICE_COLOR}>
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
              <SectionCard icon={<Tune fontSize="small" />} title="Variantes" accent="#8B5CF6">
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
                        {variantes.length} variante{variantes.length !== 1 ? 's' : ''} registrada{variantes.length !== 1 ? 's' : ''}
                      </Typography>
                      <Button size="small" startIcon={<Add />} variant="outlined"
                        onClick={() => { setVarianteEditing(null); setVarianteForm({ nombre: '', sku: '', atributos: {}, precio: '', costo: '', stock_inicial: '' }); setVarianteDialog(true); }}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
                        Agregar variante
                      </Button>
                    </Box>
                    {variantes.length > 0 && (
                      <Table size="small" sx={{ '& td,& th': { fontSize: 12 } }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Nombre / Atributos</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Precio</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Stock</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {variantes.map(v => (
                            <TableRow key={v.id} hover>
                              <TableCell><Typography sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{v.sku}</Typography></TableCell>
                              <TableCell>
                                <Typography sx={{ fontWeight: 600 }}>{v.nombre}</Typography>
                                {v.atributos && Object.keys(v.atributos).length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.3 }}>
                                    {Object.entries(v.atributos).map(([k, val]) => (
                                      <Chip key={k} label={`${k}: ${val}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                                    ))}
                                  </Box>
                                )}
                              </TableCell>
                              <TableCell>{v.precio != null ? `$${v.precio.toLocaleString('es-CO')}` : '—'}</TableCell>
                              <TableCell>{v.stock_actual}</TableCell>
                              <TableCell align="right">
                                <IconButton size="small" onClick={() => { setVarianteEditing(v); setVarianteForm({ nombre: v.nombre, sku: v.sku, atributos: v.atributos || {}, precio: v.precio ?? '', costo: v.costo ?? '', stock_inicial: '' }); setVarianteDialog(true); }}>
                                  <ExpandMore fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDeleteVariante(v.id)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Box>
                )}
              </SectionCard>

              {/* § 3 — Inventario y Logística (solo productos físicos) */}
              {!esServicio && (
                <SectionCard icon={<Inventory fontSize="small" />} title="Inventario y Logística" accent={INVENTORY_COLOR}>
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
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 1.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
            <Button onClick={handleClose} variant="outlined" disabled={isSaving}
              sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', px: 3 }}>
              Cancelar
            </Button>
            {!isEditing && (
              <Button
                variant="outlined"
                disabled={isSaving || !nombre}
                onClick={() => saveProducto(true)}
                sx={{ borderRadius: 2, fontWeight: 600, borderColor: accentColor, color: accentColor, px: 2 }}
              >
                Guardar y crear otro
              </Button>
            )}
            <Button type="submit" variant="contained" disabled={isSaving || !nombre}
              sx={{
                background: esServicio
                  ? 'linear-gradient(135deg, #06B6D4, #22d3ee)'
                  : `linear-gradient(135deg, ${accentColor}, #a78bfa)`,
                boxShadow: esServicio ? '0 4px 14px rgba(6,182,212,0.3)' : `0 4px 14px ${alpha(accentColor, 0.3)}`,
                borderRadius: 2, fontWeight: 700, px: 4,
              }}
            >
              {isSaving ? 'Guardando…' : (isEditing ? 'Actualizar Cambios' : `Guardar ${esServicio ? 'Servicio' : 'Producto'}`)}
            </Button>
          </Box>

        </Box>
      </Panel>

      {/* ── Variant dialog ── */}
      <Dialog open={varianteDialog} onClose={() => setVarianteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{varianteEditing ? 'Editar variante' : 'Nueva variante'}</DialogTitle>
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVarianteDialog(false)} sx={{ textTransform: 'none' }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveVariante} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {varianteEditing ? 'Guardar cambios' : 'Agregar variante'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Carga masiva (solo al crear) ── */}
      {!isEditing && (
        <Panel
          title="Carga Masiva de Inventario"
          icon={<Upload fontSize="small" />}
          chip={<Chip label="Excel / CSV" size="small" sx={{ bgcolor: alpha(accentColor, 0.1), color: accentColor, fontWeight: 600, fontSize: 11 }} />}
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
