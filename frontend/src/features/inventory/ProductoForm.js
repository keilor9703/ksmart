import React, { useState, useEffect } from 'react';
import apiClient from '../../api';
import { toast } from 'react-toastify';
import BulkUpload from '../../components/common/BulkUpload';
import CurrencyField from '../../components/common/CurrencyField';
import ImageCropperDialog from '../../components/common/ImageCropperDialog';
import { compressImageToWebP } from '../../utils/imageOptimizer';

import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Collapse,
  Divider,
  Chip,
  IconButton,
  ButtonGroup,
  Switch,
  FormControlLabel,
  Autocomplete,
  Tooltip,
  Paper
} from '@mui/material';

import {
  Inventory,
  ExpandMore,
  ExpandLess,
  Upload,
  Close,
  Category,
  Science,
  Storefront,
  AddPhotoAlternate,
  Delete
} from '@mui/icons-material';

import { UNIDADES_MEDIDA } from '../../utils/constants';

const DEFAULT_ACCENT = '#8B5CF6';

const Panel = ({
  title,
  icon,
  chip,
  open,
  onToggle,
  forceOpen,
  onClose,
  children,
  accentColor
}) => (
  <Box
    sx={{
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      mb: 2,
      boxShadow: open
        ? '0 4px 24px rgba(0,0,0,0.08)'
        : '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s'
    }}
  >
    <Box
      onClick={() => {
        if (!forceOpen) onToggle();
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 1.5, md: 2.5 },
        py: 1.5,
        cursor: forceOpen ? 'default' : 'pointer',
        '&:hover': {
          bgcolor: forceOpen ? 'transparent' : 'action.hover'
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
          flex: 1
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1.5,
            flexShrink: 0,
            bgcolor: `${accentColor}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor
          }}
        >
          {icon}
        </Box>

        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
          {title}
        </Typography>

        {chip && <Box sx={{ flexShrink: 0 }}>{chip}</Box>}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexShrink: 0,
          ml: 1
        }}
      >
        {open && onClose && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            sx={{ color: 'text.secondary' }}
          >
            <Close fontSize="small" />
          </IconButton>
        )}

        {!forceOpen &&
          (open ? (
            <ExpandLess sx={{ color: 'text.secondary', fontSize: 20 }} />
          ) : (
            <ExpandMore sx={{ color: 'text.secondary', fontSize: 20 }} />
          ))}
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

const ProductoForm = ({
  onProductoAdded,
  productoToEdit,
  onProductoUpdated,
  forceOpen,
  onClose,
  accentColor = DEFAULT_ACCENT
}) => {
  const [nombre, setNombre] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [esServicio, setEsServicio] = useState(false);
  const [unidadMedida, setUnidadMedida] = useState('UND');
  const [grupoItem, setGrupoItem] = useState(2);
  const [stockMinimo, setStockMinimo] = useState('');
  const [stockActual, setStockActual] = useState(0);
  const [manejaLotes, setManejaLotes] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [grupos, setGrupos] = useState([]);

  // 👇 ESTADOS CATÁLOGO
  const [imagenes, setImagenes] = useState([]);
  const [mostrarEnCatalogo, setMostrarEnCatalogo] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // 👇 ESTADOS CROPPER
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    apiClient
      .get('/grupos-producto/')
      .then((r) => setGrupos(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (forceOpen !== undefined) setFormOpen(forceOpen);
  }, [forceOpen]);

  useEffect(() => {
    if (productoToEdit) {
      setNombre(productoToEdit.nombre);
      setCodigoBarras(productoToEdit.codigo_barras || '');
      setPrecio(productoToEdit.precio || '');
      setCosto(productoToEdit.costo || '');
      setEsServicio(productoToEdit.es_servicio);
      setUnidadMedida(productoToEdit.unidad_medida || 'UND');
      setGrupoItem(productoToEdit.grupo_item || 2);
      setStockMinimo(
        productoToEdit.stock_minimo != null
          ? String(productoToEdit.stock_minimo)
          : ''
      );
      setStockActual(productoToEdit.stock_actual ?? 0);
      setManejaLotes(productoToEdit.maneja_lotes || false);

      // 👇 CARGAR CAMPOS DE CATÁLOGO
      setImagenes(productoToEdit.imagenes || []);
      setMostrarEnCatalogo(productoToEdit.mostrar_en_catalogo || false);
      setDescripcion(productoToEdit.descripcion || '');
    } else {
      resetFields();
    }
  }, [productoToEdit]);

  const resetFields = () => {
    setNombre('');
    setCodigoBarras('');
    setPrecio('');
    setCosto('');
    setEsServicio(false);
    setUnidadMedida('UND');
    setGrupoItem(2);
    setStockMinimo('');
    setStockActual(0);
    setManejaLotes(false);
    setImagenes([]);
    setMostrarEnCatalogo(false);
    setDescripcion('');
  };

  // 👇 NUEVO FLUJO DE IMÁGENES CON CROPPER
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Límite de 4 imágenes
    if (imagenes.length + files.length > 4) {
      toast.warning('Máximo 4 imágenes por producto');
      return;
    }

    // Cargamos el primer archivo en el cropper.
    // Los demás quedan en cola para procesarse uno por uno.
    const [first, ...rest] = files;
    setPendingFiles(rest);
    openCropperWithFile(first);

    // Limpiamos el input para permitir re-subir el mismo archivo si se cancela
    e.target.value = '';
  };

  const openCropperWithFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedFile) => {
    try {
      setIsCompressing(true);
      const webpBase64 = await compressImageToWebP(croppedFile);
      setImagenes((prev) => [...prev, webpBase64]);
      setMostrarEnCatalogo(true);

      // Cerrar cropper
      setCropperOpen(false);
      setImageToCrop(null);

      // Si hay más archivos en cola, abrir el siguiente
      if (pendingFiles.length > 0) {
        const [next, ...rest] = pendingFiles;
        setPendingFiles(rest);
        // Pequeño delay para que el dialog se cierre suavemente
        setTimeout(() => openCropperWithFile(next), 200);
      }
    } catch (error) {
      toast.error('Error al procesar la imagen');
      console.error(error);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCropCancel = () => {
    setCropperOpen(false);
    setImageToCrop(null);
    setPendingFiles([]); // descartamos la cola si cancela
  };

  const removeImage = (index) => {
    setImagenes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    resetFields();
    setFormOpen(false);

    if (onClose) onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const data = {
      nombre,
      codigo_barras: codigoBarras || null,
      precio: parseFloat(precio) || 0.0,
      costo: esServicio ? 0.0 : parseFloat(costo) || 0.0,
      es_servicio: esServicio,
      unidad_medida: esServicio ? 'UND' : unidadMedida,
      grupo_item: esServicio ? 2 : parseInt(grupoItem),
      stock_minimo:
        esServicio || stockMinimo === ''
          ? 0
          : parseFloat(stockMinimo),
      maneja_lotes: esServicio ? false : manejaLotes,
      imagenes: imagenes,
      mostrar_en_catalogo: mostrarEnCatalogo,
      descripcion: descripcion || null,
    };

    const req = productoToEdit
      ? apiClient.put(`/productos/${productoToEdit.id}`, data)
      : apiClient.post('/productos/', data);

    req
      .then((res) => {
        toast.success(
          `Ítem ${
            productoToEdit ? 'actualizado' : 'agregado'
          } exitosamente`
        );

        if (productoToEdit) {
          onProductoUpdated(res.data);
        } else {
          resetFields();
          onProductoAdded(res.data);
        }

        handleClose();
      })
      .catch(() =>
        toast.error(
          `Error al ${
            productoToEdit ? 'actualizar' : 'agregar'
          } el ítem.`
        )
      );
  };

  const isEditing = Boolean(productoToEdit);

  const precioN = parseFloat(precio) || 0;
  const costoN  = parseFloat(costo) || 0;
  const margenPct = precioN > 0 ? ((precioN - costoN) / precioN * 100) : 0;
  const margenAbs = precioN - costoN;
  const margenColor = margenPct >= 30 ? '#10B981' : margenPct >= 10 ? '#F59E0B' : '#EF4444';

  return (
    <Box sx={{ mb: 3 }}>
      <Panel
        title={isEditing ? 'Editar Ítem' : 'Agregar Nuevo Ítem'}
        icon={<Category fontSize="small" />}
        chip={
          isEditing && (
            <Chip
              label="Editando"
              size="small"
              sx={{
                bgcolor: `${accentColor}18`,
                color: accentColor,
                fontWeight: 600,
                fontSize: 11
              }}
            />
          )
        }
        open={formOpen}
        onToggle={() => setFormOpen((o) => !o)}
        forceOpen={forceOpen && formOpen}
        onClose={handleClose}
        accentColor={accentColor}
      >
        <Box component="form" onSubmit={handleSubmit}>
          {/* SELECTOR PRINCIPAL */}
          <Box
            sx={{
              mb: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                mb: 1.5
              }}
            >
              ¿QUÉ TIPO DE ÍTEM DESEAS CREAR?
            </Typography>

            <ButtonGroup
              variant="outlined"
              sx={{
                '& .MuiButton-root': {
                  py: 1.5,
                  px: { xs: 2, sm: 4 },
                  borderColor: 'divider'
                }
              }}
            >
              <Button
                onClick={() => setEsServicio(false)}
                sx={{
                  bgcolor: !esServicio
                    ? `${accentColor}15`
                    : 'transparent',
                  color: !esServicio
                    ? accentColor
                    : 'text.secondary',
                  borderColor: !esServicio
                    ? `${accentColor} !important`
                    : 'divider',
                  fontWeight: !esServicio ? 700 : 500
                }}
              >
                📦 Producto Físico
              </Button>

              <Button
                onClick={() => setEsServicio(true)}
                sx={{
                  bgcolor: esServicio
                    ? '#06B6D415'
                    : 'transparent',
                  color: esServicio
                    ? '#06B6D4'
                    : 'text.secondary',
                  borderColor: esServicio
                    ? '#06B6D4 !important'
                    : 'divider',
                  fontWeight: esServicio ? 700 : 500
                }}
              >
                ⚙️ Servicio Intangible
              </Button>
            </ButtonGroup>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* FORMULARIO */}
          <Grid container spacing={2.5}>
            {/* FILA 1 */}
            <Grid item xs={12} md={esServicio ? 8 : 4}>
              <TextField
                label={
                  esServicio
                    ? 'Nombre del Servicio *'
                    : 'Nombre del Producto *'
                }
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                fullWidth
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Descripción del producto"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder={esServicio ? 'Ej: Servicio de instalación y configuración incluida...' : 'Ej: Presentación de 500g, sabor original, apto para veganos...'}
                helperText="Opcional — aparece en el catálogo virtual y en cotizaciones"
              />
            </Grid>

            {!esServicio && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Código de Barras"
                    value={codigoBarras}
                    onChange={(e) =>
                      setCodigoBarras(e.target.value)
                    }
                    fullWidth
                    placeholder="Escanea o escribe..."
                  />
                </Grid>

                <Grid item xs={12} md={5}>
                  <TextField
                    label="Alerta de Stock Mínimo"
                    value={stockMinimo}
                    onChange={(e) =>
                      setStockMinimo(
                        e.target.value.replace(/[^0-9.]/g, '')
                      )
                    }
                    fullWidth
                    placeholder="Ej: 10"
                    helperText="Te avisaremos cuando baje de este número"
                  />
                </Grid>
              </>
            )}

            {/* FILA 2 */}
            <Grid
              item
              xs={12}
              sx={{
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap',
                alignItems: 'stretch'
              }}
            >
              {/* PRECIO */}
              <Box
                sx={{
                  flex: '1 1 220px',
                  minWidth: 220
                }}
              >
                <CurrencyField
                  label={
                    esServicio
                      ? 'Precio de Venta *'
                      : 'Precio de Venta (Opcional)'
                  }
                  value={precio}
                  onChange={(val) => setPrecio(val)}
                  required={esServicio}
                />
              </Box>

              {!esServicio && (
                <>
                  {/* COSTO */}
                  <Box
                    sx={{
                      flex: '1 1 220px',
                      minWidth: 220
                    }}
                  >
                    <CurrencyField
                      label="Costo Actual *"
                      value={costo}
                      onChange={(val) => setCosto(val)}
                      required
                    />
                  </Box>

                  {precio && costo && (
                    <Box sx={{ flex: '1 1 180px', minWidth: 160, display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${margenColor}10`, border: `1px solid ${margenColor}30`, width: '100%' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.3 }}>Margen</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: 18, color: margenColor, lineHeight: 1 }}>{margenPct.toFixed(1)}%</Typography>
                        <Typography sx={{ fontSize: 11, color: margenColor, fontWeight: 600 }}>+{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(margenAbs)}</Typography>
                      </Box>
                    </Box>
                  )}

                  {/* GRUPO */}
                  <Box
                    sx={{
                      flex: '2 1 420px',
                      minWidth: 320
                    }}
                  >
                    <Autocomplete
                      fullWidth
                      options={grupos}
                      getOptionLabel={(option) =>
                        option.nombre || ''
                      }
                      value={
                        grupos.find((g) => g.id === grupoItem) ||
                        null
                      }
                      onChange={(_, newValue) =>
                        setGrupoItem(newValue ? newValue.id : 2)
                      }
                      renderOption={(props, option) => (
                        <Box
                          component="li"
                          {...props}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: option.color,
                              flexShrink: 0
                            }}
                          />

                          <span>{option.nombre}</span>

                          <Typography
                            sx={{
                              ml: 'auto',
                              fontSize: 10,
                              color: 'text.secondary'
                            }}
                          >
                            {option.codigo}
                          </Typography>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Grupo o Categoría *"
                          required
                        />
                      )}
                    />
                  </Box>

                  {/* UNIDAD */}
                  <Box
                    sx={{
                      flex: '1 1 auto',
                      minWidth: 220,
                      width: 'fit-content'
                    }}
                  >
                    <Autocomplete
                      fullWidth
                      freeSolo
                      options={UNIDADES_MEDIDA.map(
                        (u) => u.value
                      )}
                      value={unidadMedida}
                      onChange={(_, newValue) =>
                        setUnidadMedida(newValue || 'UND')
                      }
                      onInputChange={(_, newInputValue) =>
                        setUnidadMedida(
                          newInputValue
                            ? newInputValue.toUpperCase()
                            : ''
                        )
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Unidad de Medida *"
                          required
                          placeholder="Ej: CAJAx12"
                        />
                      )}
                    />
                  </Box>
                </>
              )}
            </Grid>

            {/* LOTES */}
            {!esServicio && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: manejaLotes
                      ? '#10B981'
                      : 'divider',
                    bgcolor: manejaLotes
                      ? '#ECFDF5'
                      : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={manejaLotes}
                        onChange={(e) =>
                          setManejaLotes(e.target.checked)
                        }
                        color="success"
                      />
                    }
                    label={
                      <Typography
                        sx={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: manejaLotes
                            ? '#059669'
                            : 'text.primary'
                        }}
                      >
                        Este es un Producto Perecedero
                        (Control por Lotes y Vencimiento)
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />

                  {manejaLotes && (
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: '#059669',
                        mt: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}
                    >
                      <Science fontSize="small" />
                      Activado: podrás registrar lotes y
                      vencimientos en compras y entradas.
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}

            {/* 👇 SECCIÓN CATÁLOGO VIRTUAL */}
            <Grid item xs={12}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: mostrarEnCatalogo
                    ? `${accentColor}05`
                    : 'transparent',
                  borderColor: mostrarEnCatalogo
                    ? accentColor
                    : 'divider',
                  transition: 'all 0.3s'
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Storefront
                      sx={{
                        color: mostrarEnCatalogo
                          ? accentColor
                          : 'text.secondary'
                      }}
                    />
                    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                      Catálogo Virtual / Tienda Online
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={mostrarEnCatalogo}
                        onChange={(e) =>
                          setMostrarEnCatalogo(e.target.checked)
                        }
                        disabled={
                          imagenes.length === 0 && !mostrarEnCatalogo
                        }
                      />
                    }
                    label={
                      mostrarEnCatalogo ? 'Visible al público' : 'Oculto'
                    }
                  />
                </Box>

                <Grid container spacing={2}>
                  {/* Slots de Imágenes */}
                  {[0, 1, 2, 3].map((idx) => (
                    <Grid item xs={6} sm={3} key={idx}>
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '1/1',
                          borderRadius: 2,
                          border: '2px dashed',
                          borderColor: imagenes[idx]
                            ? accentColor
                            : 'divider',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          bgcolor: 'background.default',
                          transition: 'all 0.2s'
                        }}
                      >
                        {imagenes[idx] ? (
                          <>
                            <img
                              src={imagenes[idx]}
                              alt={`Product ${idx}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => removeImage(idx)}
                              sx={{
                                position: 'absolute',
                                top: 5,
                                right: 5,
                                bgcolor: 'rgba(255,255,255,0.8)',
                                '&:hover': { bgcolor: '#fff' }
                              }}
                            >
                              <Delete fontSize="small" color="error" />
                            </IconButton>
                          </>
                        ) : (
                          <Button
                            component="label"
                            disabled={
                              isCompressing ||
                              (idx > 0 && !imagenes[idx - 1])
                            }
                            sx={{
                              flexDirection: 'column',
                              gap: 0.5,
                              width: '100%',
                              height: '100%',
                              color: 'text.secondary',
                              textTransform: 'none'
                            }}
                          >
                            <input
                              hidden
                              accept="image/*"
                              type="file"
                              multiple
                              onChange={handleImageChange}
                            />
                            {isCompressing ? (
                              <Typography
                                variant="caption"
                                sx={{ fontSize: 9 }}
                              >
                                Procesando...
                              </Typography>
                            ) : (
                              <>
                                <AddPhotoAlternate fontSize="medium" />
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 600, fontSize: 9 }}
                                >
                                  Subir
                                </Typography>
                              </>
                            )}
                          </Button>
                        )}
                      </Box>
                    </Grid>
                  ))}

                  <Grid item xs={12}>
                    <Typography
                      sx={{ fontSize: 12, color: 'text.secondary' }}
                    >
                      • Puedes subir hasta <strong>4 fotos</strong> por
                      producto. Se recomienda formato cuadrado.
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* STOCK */}
            {!esServicio && isEditing && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                  }}
                >
                  <Inventory color="action" />

                  <Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: 'text.secondary'
                      }}
                    >
                      Stock Actual en Bodega
                    </Typography>

                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: 16
                      }}
                    >
                      {stockActual} {unidadMedida}
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 11,
                        color: 'text.secondary'
                      }}
                    >
                      *Este valor se actualiza automáticamente.
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {/* BOTONES */}
            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  justifyContent: 'flex-end',
                  mt: 1,
                  flexWrap: 'wrap'
                }}
              >
                <Button
                  onClick={handleClose}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    fontWeight: 600,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    px: 3
                  }}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    background: esServicio
                      ? `linear-gradient(135deg, #06B6D4, #22d3ee)`
                      : `linear-gradient(135deg, ${accentColor}, #a78bfa)`,
                    boxShadow: esServicio
                      ? `0 4px 14px rgba(6,182,212,0.3)`
                      : `0 4px 14px rgba(139,92,246,0.3)`,
                    borderRadius: 2,
                    fontWeight: 600,
                    px: 4
                  }}
                >
                  {isEditing
                    ? 'Actualizar Cambios'
                    : `Guardar ${
                        esServicio ? 'Servicio' : 'Producto'
                      }`}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Panel>

      {!isEditing && (
        <Panel
          title="Carga Masiva de Inventario"
          icon={<Upload fontSize="small" />}
          chip={
            <Chip
              label="Excel / CSV"
              size="small"
              sx={{
                bgcolor: 'rgba(139,92,246,0.1)',
                color: accentColor,
                fontWeight: 600,
                fontSize: 11
              }}
            />
          }
          open={bulkOpen}
          onToggle={() => setBulkOpen((o) => !o)}
          accentColor={accentColor}
        >
          <BulkUpload
            uploadType="productos"
            onUploadSuccess={onProductoAdded}
          />
        </Panel>
      )}

      {/* 👇 MODAL DE RECORTE DE IMAGEN */}
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
