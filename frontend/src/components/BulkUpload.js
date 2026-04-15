import React, { useState, useRef } from 'react';
import { 
  Box, Button, Typography, CircularProgress, Chip, LinearProgress, 
  Collapse, IconButton, useTheme
} from '@mui/material';

import { uploadFile, fetchProductTemplate, fetchTercerosTemplate, fetchMovimientosTemplate } from '../api';
import { toast } from 'react-toastify';
import { 
  Upload, CheckCircle, Error as ErrorIcon, 
  FilePresent, Download, Close, InfoOutlined, ExpandMore
} from '@mui/icons-material';

const ACCENT  = '#8B5CF6';
const GREEN   = '#10B981';
const RED     = '#EF4444';

const UPLOAD_CONFIG = {
  clientes: {
    headers: ['nombre', 'cedula', 'telefono', 'direccion', 'cupo_credito'],
    tips: [
      { col: 'nombre', desc: 'Razón social o nombre completo del tercero.' },
      { col: 'cedula', desc: 'NIT o Documento. Debe ser único.' },
      { col: 'cupo_credito', desc: 'Monto máximo de deuda permitida (solo números).' }
    ]
  },
  productos: {
    headers: ['nombre', 'precio', 'costo', 'grupo_item', 'unidad_medida', 'es_servicio', 'stock_minimo'],
    tips: [
      { col: 'grupo_item', desc: '1=Materia Prima, 2=Prod. Terminado, 3=Activo, 4=Insumo.' },
      { col: 'es_servicio', desc: '0=Físico (controla inventario), 1=Intangible (ej. Maquila).' },
      { col: 'costo', desc: 'Valor de compra. Si es servicio (1), pon 0.' }
    ]
  },
  movimientos: {
    headers: ['producto_id', 'tipo', 'cantidad', 'costo_unitario', 'motivo'],
    tips: [
      { col: 'tipo', desc: 'Usa exactamente "entrada", "salida" o "ajuste".' },
      { col: 'cantidad', desc: 'Debe ser mayor a 0 (solo números).' }
    ]
  }
};

const BulkUpload = ({ uploadType, onUploadSuccess }) => {
  const theme = useTheme();
  const [file, setFile]                   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState(null);
  const [message, setMessage]             = useState('');
  const [validationError, setValidationError] = useState(null);
  const [dragging, setDragging]           = useState(false);
  const [showTips, setShowTips]           = useState(false);
  const inputRef                          = useRef(null);

  const config = UPLOAD_CONFIG[uploadType] || { headers: [], tips: [] };

  const reset = () => {
    setFile(null); setStatus(null);
    setMessage(''); setValidationError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const validateFile = (selectedFile) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split('.').pop().toLowerCase();

    if (!['xls', 'xlsx', 'csv'].includes(ext)) {
      setValidationError('Formato inválido. Sube un archivo .xls, .xlsx o .csv');
      return;
    }

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const headers = e.target.result.split('\n')[0].split(',').map(h => h.trim().toLowerCase());
        const missing = config.headers.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          setValidationError(`Columnas faltantes: ${missing.join(', ')}`);
        } else {
          setValidationError(null);
        }
      };
      reader.onerror = () => setValidationError('No pudimos leer el archivo CSV.');
      reader.readAsText(selectedFile);
    } else {
      // Para Excel, confiamos en la validación del Backend
      setValidationError(null);
    }

    setFile(selectedFile);
    setStatus(null); setMessage('');
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateFile(dropped);
  };

  const handleUpload = async () => {
    if (!file || validationError) return;
    setLoading(true); setStatus(null);
    try {
      const res = await uploadFile(uploadType, file);
      setStatus('success');
      setMessage(res.message || 'Datos sincronizados exitosamente.');
      toast.success('Carga masiva completada');
      onUploadSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.message || `Falló la importación de ${uploadType}`);
    } finally { setLoading(false); }
  };

const handleDownloadTemplate = async () => {
    try {
      let response, filename;
      if (uploadType === 'productos') {
        response = await fetchProductTemplate(); 
        filename = 'plantilla_productos_PRO.xlsx';
      } else if (uploadType === 'clientes') {
        response = await fetchTercerosTemplate(); 
        filename = 'plantilla_terceros_PRO.xlsx';
      } else if (uploadType === 'movimientos') {
        // ✅ AHORA CONSUME EL ENDPOINT INTELIGENTE, NO UN CSV ESTÁTICO
        response = await fetchMovimientosTemplate(); 
        filename = 'plantilla_movimientos_PRO.xlsx';
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; 
      link.setAttribute('download', filename);
      document.body.appendChild(link); 
      link.click(); 
      link.remove();
    } catch { 
      toast.error('Error al generar la plantilla inteligente.'); 
    }
  };
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      {/* ── Guía de Usuario (SaaS UX) ── */}
      <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowTips(!showTips)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoOutlined sx={{ color: ACCENT, fontSize: 20 }} />
            <Typography sx={{ fontWeight: 600, fontSize: 13, color: 'text.primary' }}>
              Recomendaciones para una carga exitosa
            </Typography>
          </Box>
          <ExpandMore sx={{ color: 'text.secondary', transform: showTips ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
        </Box>
        <Collapse in={showTips}>
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
              Asegúrate de que tu archivo contenga exactamente estas columnas en la fila 1:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {config.headers.map(h => (
                <Chip key={h} label={h} size="small" sx={{ bgcolor: 'action.hover', color: 'text.primary', fontSize: 11, fontWeight: 600, borderRadius: 1.5 }} />
              ))}
            </Box>
            {config.tips.map((t, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'flex-start' }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: ACCENT, mt: 1, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  <strong style={{ color: theme.palette.text.primary }}>{t.col}:</strong> {t.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      </Box>

      {/* ── Zona de Drag & Drop ── */}
      <Box
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        sx={{
          border: '2px dashed',
          borderColor: dragging ? ACCENT : (validationError ? RED : (file ? GREEN : 'divider')),
          borderRadius: 3, p: 4, mb: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1.5, cursor: file ? 'default' : 'pointer',
          bgcolor: dragging ? `${ACCENT}08` : (file ? `${GREEN}05` : 'background.paper'),
          transition: 'all 0.2s ease-in-out',
          minHeight: 160,
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => validateFile(e.target.files[0])} style={{ display: 'none' }} />

        {!file ? (
          <>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, transition: 'transform 0.2s', transform: dragging ? 'scale(1.1)' : 'none' }}>
              <Upload />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                {dragging ? 'Suelta el archivo para cargarlo' : 'Arrastra tu base de datos aquí o haz clic'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                Admite formatos Excel (.xlsx) o .csv 
              </Typography>
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', maxWidth: 400, p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2, flexShrink: 0,
              bgcolor: validationError ? `${RED}15` : `${GREEN}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: validationError ? RED : GREEN,
            }}>
              <FilePresent />
            </Box>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {formatSize(file.size)}
              </Typography>
              {validationError && (
                <Typography sx={{ fontSize: 11, color: RED, fontWeight: 700, mt: 0.5 }}>
                  ⚠ {validationError}
                </Typography>
              )}
            </Box>
            <IconButton size="small" onClick={e => { e.stopPropagation(); reset(); }} sx={{ color: 'text.secondary', '&:hover': { color: RED, bgcolor: `${RED}15` } }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* ── Progress & Status ── */}
      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1, height: 4, bgcolor: `${ACCENT}20`, '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />}

      {status && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, p: 2, mb: 3, borderRadius: 2,
          bgcolor: status === 'success' ? `${GREEN}10` : `${RED}10`,
          border: `1px solid ${status === 'success' ? GREEN : RED}30`,
        }}>
          {status === 'success' ? <CheckCircle sx={{ color: GREEN }} /> : <ErrorIcon sx={{ color: RED }} />}
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: status === 'success' ? GREEN : RED }}>
            {message}
          </Typography>
        </Box>
      )}

      {/* ── Acciones ── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleDownloadTemplate}
          disabled={loading}
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}
        >
          1. Bajar Plantilla Base
        </Button>

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={loading || !file || !!validationError}
          startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Upload />}
          sx={{
            background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
            boxShadow: `0 4px 14px rgba(139,92,246,0.3)`,
            borderRadius: 2, fontWeight: 600, px: 4,
            '&.Mui-disabled': { opacity: 0.6 },
          }}
        >
          {loading ? 'Procesando datos...' : '2. Subir Inventario'}
        </Button>
      </Box>
    </Box>
  );
};

export default BulkUpload;