import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, IconButton,
  CircularProgress, InputAdornment, Divider, Switch, FormControlLabel,
  Autocomplete, Collapse, Grid
} from '@mui/material';
import {
  Close, PersonAdd, Inventory2Outlined,
  CheckCircle, Science, Add, Inventory2, MiscellaneousServices,
  ReceiptLong, ExpandMore, ExpandLess
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import apiClient from '../../api';
import { UNIDADES_MEDIDA } from '../../utils/constants';
import CurrencyField from './CurrencyField';

// Cálculo del dígito de verificación (DV) para NIT — mismo algoritmo que ClienteForm.
const PESOS_DV = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
const calcularDV = (nit) => {
  const digits = String(nit || '').replace(/\D/g, '');
  if (!digits || digits.length < 4) return '';
  const padded = digits.padStart(15, '0');
  const suma = padded.split('').reduce((acc, d, i) => acc + parseInt(d) * PESOS_DV[i], 0);
  const residuo = suma % 11;
  return String(residuo === 0 || residuo === 1 ? residuo : 11 - residuo);
};

// ─── Colores y configuración por tipo ─────────────────────────────────────────
const TYPE_CONFIG = {
  tercero: {
    title:       'Crear nuevo proveedor / cliente',
    subtitle:    'Solo los campos esenciales — puedes completar el resto después',
    icon:        <PersonAdd />,
    color:       '#3B82F6',
    colorLight:  '#EFF6FF',
    btnLabel:    'Crear Tercero',
  },
  producto: {
    title:       'Crear nuevo producto',
    subtitle:    'Solo los campos esenciales — puedes completar el resto después',
    icon:        <Inventory2Outlined />,
    color:       '#10B981',
    colorLight:  '#ECFDF5',
    btnLabel:    'Crear Producto',
  },
};

// ─── Formulario de Tercero ────────────────────────────────────────────────────
const TerceroForm = ({ data, onChange, errors }) => {
  const [showDian, setShowDian] = useState(false);
  const esNit = Number(data.tipo_documento_id) === 31;
  return (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <TextField
      label="Nombre o razón social *"
      value={data.nombre}
      onChange={e => onChange('nombre', e.target.value)}
      fullWidth size="small"
      error={!!errors.nombre}
      helperText={errors.nombre}
      autoFocus
      placeholder="Ej: Distribuciones García S.A.S."
    />
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <TextField label="NIT / Cédula" value={data.cedula} onChange={e => onChange('cedula', e.target.value)} size="small" error={!!errors.cedula} helperText={errors.cedula || 'Único por tercero'} sx={{ flex: 1 }} />
      <TextField label="Teléfono" value={data.telefono} onChange={e => onChange('telefono', e.target.value)} size="small" sx={{ flex: 1 }} />
    </Box>
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <TextField label="Correo electrónico" type="email" value={data.email} onChange={e => onChange('email', e.target.value)} size="small" sx={{ flex: 1 }} placeholder="correo@ejemplo.com" helperText="Requerido para Factura Electrónica" />
      <TextField
        label="Fecha de cumpleaños" type="date"
        value={data.fecha_nacimiento} onChange={e => onChange('fecha_nacimiento', e.target.value)}
        size="small" sx={{ flex: 1 }}
        InputLabelProps={{ shrink: true }}
        inputProps={{ max: new Date().toLocaleDateString('en-CA') }}
      />
    </Box>
    <TextField label="Dirección" value={data.direccion} onChange={e => onChange('direccion', e.target.value)} size="small" fullWidth />
    <CurrencyField
      label="Cupo de crédito"
      value={data.cupo_credito}
      onChange={val => onChange('cupo_credito', val)}
      helperText="Límite máximo de ventas a crédito. Deja en 0 si no aplica."
    />

    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.8 }}>Tipo de tercero</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {[
          { key: 'es_proveedor', label: '🏭 Proveedor' },
          { key: 'es_cliente',   label: '👤 Cliente'   },
        ].map(({ key, label }) => (
          <Box
            key={key}
            onClick={() => onChange(key, !data[key])}
            sx={{
              flex: 1, py: 1, borderRadius: 2, textAlign: 'center',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: '1.5px solid', borderColor: data[key] ? '#3B82F6' : 'divider',
              bgcolor: data[key] ? '#EFF6FF' : 'background.paper',
              color: data[key] ? '#3B82F6' : 'text.secondary',
              transition: 'all 0.15s', userSelect: 'none',
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
    </Box>

    {/* ── Datos DIAN (colapsable) ── */}
    <Box
      onClick={() => setShowDian(v => !v)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
        p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'rgba(245,158,11,0.35)',
        bgcolor: 'rgba(245,158,11,0.07)', transition: 'all 0.15s',
        '&:hover': { borderColor: '#F59E0B' },
      }}
    >
      <ReceiptLong sx={{ fontSize: 18, color: '#F59E0B' }} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>Identidad Legal y Tributaria (DIAN)</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Requerido para emitir Factura Electrónica</Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mr: 0.5 }}>{showDian ? 'Ocultar' : 'Ver campos'}</Typography>
      {showDian ? <ExpandLess sx={{ color: 'text.secondary', fontSize: 18 }} /> : <ExpandMore sx={{ color: 'text.secondary', fontSize: 18 }} />}
    </Box>

    <Collapse in={showDian}>
      <Grid container spacing={1.5} sx={{ pt: 0.5 }}>
        <Grid item xs={12} sm={6}>
          <TextField select label="Tipo de Documento" value={data.tipo_documento_id}
            onChange={(e) => onChange('tipo_documento_id', Number(e.target.value))}
            fullWidth size="small" SelectProps={{ native: true }}>
            <option value={13}>Cédula de Ciudadanía</option>
            <option value={31}>NIT</option>
            <option value={11}>Registro Civil</option>
            <option value={12}>Tarjeta de Identidad</option>
            <option value={22}>Cédula de Extranjería</option>
            <option value={41}>Pasaporte</option>
            <option value={42}>Doc. extranjero</option>
            <option value={50}>NIT otro país</option>
            <option value={91}>NUIP</option>
          </TextField>
        </Grid>
        <Grid item xs={6} sm={6}>
          <TextField label="DV" value={data.dv}
            onChange={(e) => onChange('dv', e.target.value)}
            fullWidth size="small"
            placeholder={esNit ? 'Auto' : 'Solo NIT'}
            disabled={!esNit}
            InputProps={{ readOnly: esNit }}
            helperText={esNit && data.dv ? 'Calculado automáticamente' : ''}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField select label="Organización" value={data.tipo_organizacion_id}
            onChange={(e) => onChange('tipo_organizacion_id', Number(e.target.value))}
            fullWidth size="small" SelectProps={{ native: true }}>
            <option value={1}>Jurídica</option>
            <option value={2}>Natural</option>
          </TextField>
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField select label="Régimen Fiscal" value={data.tipo_regimen_id}
            onChange={(e) => onChange('tipo_regimen_id', Number(e.target.value))}
            fullWidth size="small" SelectProps={{ native: true }}>
            <option value={48}>Responsable de IVA</option>
            <option value={49}>No responsable de IVA</option>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField label="Responsabilidad Fiscal" value={data.responsabilidad_fiscal_codes}
            onChange={(e) => onChange('responsabilidad_fiscal_codes', e.target.value)}
            fullWidth size="small" placeholder="R-99-PN" />
        </Grid>
      </Grid>
    </Collapse>
  </Box>
  );
};

// ─── Formulario de Producto ───────────────────────────────────────────────────
const ProductoForm = ({ data, onChange, errors }) => {
  const [grupos, setGrupos] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    apiClient.get('/grupos-producto/')
      .then(r => setGrupos(r.data || []))
      .catch(() => {});
  }, []);

  const handleCreateGroup = async (nombre) => {
    const codigo = nombre.trim().substring(0, 4).toUpperCase().replace(/\s+/g, '');
    setCreatingGroup(true);
    try {
      const res = await apiClient.post('/grupos-producto/', { nombre: nombre.trim(), codigo, color: '#94a3b8', orden: 99 });
      const newGroup = res.data;
      setGrupos(prev => [...prev, newGroup]);
      onChange('grupo_item', newGroup.id);
      toast.success(`Categoría "${newGroup.nombre}" creada`);
    } catch {
      toast.error('Error al crear la categoría');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Nombre del producto *"
        value={data.nombre}
        onChange={e => onChange('nombre', e.target.value)}
        fullWidth size="small"
        error={!!errors.nombre}
        helperText={errors.nombre}
        autoFocus
      />
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <CurrencyField
          label="Costo de compra *"
          value={data.costo}
          onChange={val => onChange('costo', val)}
          error={!!errors.costo}
          helperText={errors.costo}
          sx={{ flex: 1 }}
        />
        <CurrencyField
          label="Precio de venta"
          value={data.precio}
          onChange={val => onChange('precio', val)}
          sx={{ flex: 1 }}
        />
      </Box>

      {/* Empaque: solo cuando no es servicio */}
      {!data.es_servicio && (
        <Box sx={{
          p: 1.5, borderRadius: 2, border: '1px solid',
          borderColor: parseFloat(data.unidades_por_empaque) > 1 ? '#F59E0B' : 'divider',
          bgcolor: parseFloat(data.unidades_por_empaque) > 1 ? '#FFFBEB' : 'transparent',
          transition: 'all 0.2s',
        }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            📦 ¿Lo compras en empaque con varias unidades?
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField
              type="number"
              label="Unidades por empaque"
              value={data.unidades_por_empaque}
              onChange={e => onChange('unidades_por_empaque', Math.max(1, parseFloat(e.target.value) || 1))}
              inputProps={{ min: 1, step: 1 }}
              size="small"
              sx={{ width: 170 }}
              helperText="Deja 1 si lo compras por unidad"
            />
            {parseFloat(data.unidades_por_empaque) > 1 && parseFloat(data.costo) > 0 && (
              <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: '#FEF3C7', border: '1px solid #F59E0B40', fontSize: 12 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>Costo / unidad:</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(parseFloat(data.costo) / parseFloat(data.unidades_por_empaque))}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Autocomplete
        size="small"
        freeSolo
        options={UNIDADES_MEDIDA.map(u => u.value)}
        value={data.unidad_medida}
        onChange={(_, newValue) => onChange('unidad_medida', newValue || 'UND')}
        onInputChange={(_, newValue) => onChange('unidad_medida', newValue ? newValue.toUpperCase() : '')}
        renderInput={(params) => (
          <TextField {...params} label="Unidad de medida" size="small" placeholder="UND, KGS, LTS, CJA..." />
        )}
      />

      <Autocomplete
        size="small"
        options={grupos}
        getOptionLabel={(option) => option.nombre || ''}
        value={grupos.find(g => g.id === data.grupo_item) || null}
        loading={creatingGroup}
        onChange={(_, newValue) => {
          if (newValue?.id === '__create__') {
            handleCreateGroup(newValue._inputValue);
          } else {
            onChange('grupo_item', newValue?.id || 2);
          }
        }}
        filterOptions={(options, state) => {
          const q = (state.inputValue || '').toLowerCase();
          const filtered = options.filter(o => o.nombre.toLowerCase().includes(q));
          if (state.inputValue.trim() && !filtered.some(o => o.nombre.toLowerCase() === state.inputValue.toLowerCase())) {
            filtered.push({ id: '__create__', nombre: `Crear "${state.inputValue}"`, _inputValue: state.inputValue });
          }
          return filtered;
        }}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id}>
            {option.id === '__create__'
              ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#10B981', fontWeight: 700 }}>
                  <Add fontSize="small" />{option.nombre}
                </Box>
              : <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: option.color || '#94a3b8', flexShrink: 0 }} />
                  {option.nombre}
                  <Typography sx={{ ml: 'auto', fontSize: 10, color: 'text.secondary' }}>{option.codigo}</Typography>
                </Box>
            }
          </Box>
        )}
        renderInput={(params) => (
          <TextField {...params} label="Categoría / Grupo" size="small" />
        )}
      />

      {/* Tipo: Físico / Servicio */}
      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.8 }}>Tipo de producto</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[
            { key: false, label: 'Físico',   icon: <Inventory2 sx={{ fontSize: 15 }} /> },
            { key: true,  label: 'Servicio', icon: <MiscellaneousServices sx={{ fontSize: 15 }} /> },
          ].map(({ key, label, icon }) => (
            <Box
              key={String(key)}
              onClick={() => onChange('es_servicio', key)}
              sx={{
                flex: 1, py: 1, px: 1.5, borderRadius: 2, textAlign: 'center',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                border: '1.5px solid', borderColor: data.es_servicio === key ? '#10B981' : 'divider',
                bgcolor: data.es_servicio === key ? '#ECFDF5' : 'background.paper',
                color: data.es_servicio === key ? '#059669' : 'text.secondary',
                transition: 'all 0.15s', userSelect: 'none',
              }}
            >
              {icon}{label}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Stock inicial — solo para productos físicos */}
      {!data.es_servicio && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Stock inicial"
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={data.stock_inicial}
            onChange={e => onChange('stock_inicial', e.target.value)}
            fullWidth size="small"
            helperText="Unidades disponibles al crear. Deja en 0 si lo agregas después."
            InputProps={{
              endAdornment: <InputAdornment position="end"><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.unidad_medida || 'UND'}</Typography></InputAdornment>
            }}
          />

          {/* Lotes — solo si maneja lotes Y hay stock inicial */}
          <Box sx={{
            p: 1.5, borderRadius: 2, border: '1px solid',
            borderColor: data.maneja_lotes ? '#10B981' : 'divider',
            bgcolor: data.maneja_lotes ? '#ECFDF5' : 'transparent',
            transition: 'all 0.2s'
          }}>
            <FormControlLabel
              control={<Switch checked={data.maneja_lotes} onChange={(e) => onChange('maneja_lotes', e.target.checked)} color="success" />}
              label={<Typography sx={{ fontWeight: 600, fontSize: 14, color: data.maneja_lotes ? '#059669' : 'text.primary' }}>Producto Perecedero (Maneja Lotes)</Typography>}
              sx={{ m: 0 }}
            />
            {data.maneja_lotes && (
              <Typography sx={{ fontSize: 11, color: '#059669', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Science fontSize="small" /> Las entradas requerirán fecha de vencimiento y las salidas usarán lógica FEFO.
              </Typography>
            )}
          </Box>

          {data.maneja_lotes && parseFloat(data.stock_inicial) > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                label="N° de lote"
                value={data.numero_lote}
                onChange={e => onChange('numero_lote', e.target.value)}
                size="small" sx={{ flex: 1 }}
                placeholder="Ej: LOTE-001"
              />
              <TextField
                label="Fecha de vencimiento"
                type="date"
                value={data.fecha_vencimiento}
                onChange={e => onChange('fecha_vencimiento', e.target.value)}
                size="small" sx={{ flex: 1 }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────
// defaultTipo: 'cliente' | 'proveedor' — controla qué toggle viene marcado por
// defecto. Ventas/POS lo abren como 'cliente'; Compras/Caja como 'proveedor'
// (default si no se pasa, para no cambiar el comportamiento existente).
const terceroInicial = (initialName, defaultTipo) => ({
  nombre: initialName, cedula: '', telefono: '', direccion: '', email: '',
  fecha_nacimiento: '', cupo_credito: 0,
  es_cliente:   defaultTipo === 'cliente',
  es_proveedor: defaultTipo !== 'cliente',
  tipo_documento_id: 13, dv: '', tipo_organizacion_id: 2, tipo_regimen_id: 49,
  responsabilidad_fiscal_codes: 'R-99-PN',
});

const QuickCreateModal = ({ open, onClose, type, initialName = '', onCreated, defaultTipo = 'proveedor' }) => {
  const baseCfg = TYPE_CONFIG[type] || TYPE_CONFIG.tercero;
  const cfg = (type === 'tercero' && defaultTipo === 'cliente')
    ? { ...baseCfg, title: 'Crear nuevo cliente', btnLabel: 'Crear Cliente' }
    : baseCfg;

  const [terceroData, setTerceroData] = useState(() => terceroInicial('', defaultTipo));
  const [productoData, setProductoData] = useState({ nombre: '', costo: '', precio: '', unidad_medida: 'UND', grupo_item: 1, es_servicio: false, stock_minimo: 0, maneja_lotes: false, stock_inicial: 0, numero_lote: '', fecha_vencimiento: '', unidades_por_empaque: 1 });
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [savedItem, setSavedItem] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSavedItem(null); setErrors({});
    if (type === 'tercero') {
      setTerceroData(terceroInicial(initialName, defaultTipo));
    } else {
      setProductoData({ nombre: initialName, costo: '', precio: '', unidad_medida: 'UND', grupo_item: 1, es_servicio: false, stock_minimo: 0, maneja_lotes: false, stock_inicial: 0, numero_lote: '', fecha_vencimiento: '', unidades_por_empaque: 1 });
    }
  }, [open, type, initialName, defaultTipo]);

  // Auto-calcular el DV cuando el tercero es NIT y cambia la cédula.
  useEffect(() => {
    if (type !== 'tercero') return;
    if (Number(terceroData.tipo_documento_id) === 31) {
      const dvCalc = calcularDV(terceroData.cedula);
      setTerceroData(p => (p.dv === dvCalc ? p : { ...p, dv: dvCalc }));
    } else if (terceroData.dv) {
      setTerceroData(p => ({ ...p, dv: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terceroData.cedula, terceroData.tipo_documento_id, type]);

  const handleTerceroChange  = (k, v) => { setTerceroData(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const handleProductoChange = (k, v) => { setProductoData(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validateTercero = () => { const errs = {}; if (!terceroData.nombre.trim()) errs.nombre = 'El nombre es obligatorio'; return errs; };
  const validateProducto = () => { const errs = {}; if (!productoData.nombre.trim()) errs.nombre = 'El nombre es obligatorio'; if (!productoData.costo && productoData.costo !== 0) errs.costo = 'Ingresa el costo'; return errs; };

  const handleSave = async () => {
    const errs = type === 'tercero' ? validateTercero() : validateProducto();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      let response;
      if (type === 'tercero') {
        response = await apiClient.post('/clientes/', {
          ...terceroData,
          cupo_credito: parseFloat(terceroData.cupo_credito) || 0,
          email: terceroData.email?.trim() || null,
          fecha_nacimiento: terceroData.fecha_nacimiento || null,
          dv: terceroData.dv || null,
        });
      } else {
        response = await apiClient.post('/productos/', {
          ...productoData,
          costo:         parseFloat(productoData.costo)         || 0,
          precio:        parseFloat(productoData.precio)        || 0,
          stock_inicial: productoData.es_servicio ? 0 : (parseFloat(productoData.stock_inicial) || 0),
          numero_lote:       productoData.numero_lote       || undefined,
          fecha_vencimiento: productoData.fecha_vencimiento || undefined,
          unidades_por_empaque: productoData.es_servicio ? 1 : (parseFloat(productoData.unidades_por_empaque) > 1 ? parseFloat(productoData.unidades_por_empaque) : 1),
        });
      }

      const nuevo = response.data;
      setSavedItem(nuevo);
      toast.success(`${type === 'tercero' ? 'Tercero' : 'Producto'} "${nuevo.nombre}" creado y seleccionado`);
      setTimeout(() => { onCreated(nuevo); onClose(); }, 700);
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.toLowerCase().includes('cedula') || detail.toLowerCase().includes('unique')) {
        setErrors({ cedula: 'Ya existe un tercero con ese NIT/cédula' });
      } else { toast.error(detail || `Error al crear el ${type === 'tercero' ? 'tercero' : 'producto'}`); }
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' } }}>
      <Box sx={{ height: 4, bgcolor: cfg.color }} />
      <DialogTitle sx={{ pb: 1, pt: 2, pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${cfg.color}18`, color: cfg.color }}>{cfg.icon}</Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{cfg.title}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{cfg.subtitle}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={saving} sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}><Close fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5, pb: 2 }}>
        {type === 'tercero' ? <TerceroForm data={terceroData} onChange={handleTerceroChange} errors={errors} /> : <ProductoForm data={productoData} onChange={handleProductoChange} errors={errors} />}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary', flex: 1 }}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : savedItem ? <CheckCircle sx={{ fontSize: 16 }} /> : null} sx={{ borderRadius: 2, fontWeight: 600, flex: 1, bgcolor: savedItem ? '#10B981' : cfg.color, '&:hover': { bgcolor: savedItem ? '#059669' : cfg.color }, color: '#fff' }}>
          {saving ? 'Guardando…' : savedItem ? '¡Creado!' : cfg.btnLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickCreateModal;