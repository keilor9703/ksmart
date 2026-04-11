import React, { useState, useRef } from 'react';
import { Box, Button, Typography, CircularProgress, Chip, LinearProgress } from '@mui/material';
import { uploadFile, fetchProductTemplate, fetchTercerosTemplate } from '../api';
import { toast } from 'react-toastify';
import {
  Upload, CheckCircle, Error as ErrorIcon,
  FilePresent, Download, Close
} from '@mui/icons-material';

const ACCENT  = '#8B5CF6';
const GREEN   = '#10B981';
const RED     = '#EF4444';

const REQUIRED_HEADERS = {
  clientes:    ['nombre', 'cedula', 'telefono', 'direccion', 'cupo_credito'],
  productos:   ['nombre', 'precio', 'costo', 'es_servicio', 'unidad_medida'],
  movimientos: ['tipo', 'cantidad'],
};

const BulkUpload = ({ uploadType, onUploadSuccess }) => {
  const [file, setFile]                   = useState(null);
  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState(null); // 'success' | 'error' | null
  const [message, setMessage]             = useState('');
  const [validationError, setValidationError] = useState(null);
  const [dragging, setDragging]           = useState(false);
  const inputRef                          = useRef(null);

  const reset = () => {
    setFile(null); setStatus(null);
    setMessage(''); setValidationError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const validateFile = (selectedFile) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split('.').pop().toLowerCase();

    if (!['xls', 'xlsx', 'csv'].includes(ext)) {
      setValidationError('Tipo de archivo no soportado. Use .xls, .xlsx o .csv');
      return;
    }

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const headers = e.target.result.split('\n')[0].split(',')
          .map(h => h.trim().toLowerCase());
        const required = REQUIRED_HEADERS[uploadType] || [];
        const missing  = required.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          setValidationError(`Columnas faltantes: ${missing.join(', ')}`);
        } else {
          setValidationError(null);
        }
      };
      reader.onerror = () => setValidationError('Error al leer el archivo.');
      reader.readAsText(selectedFile);
    } else {
      setValidationError(null);
    }

    setFile(selectedFile);
    setStatus(null); setMessage('');
  };

  const handleFileChange = (e) => validateFile(e.target.files[0]);

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
      setMessage(res.message || 'Archivo procesado correctamente');
      toast.success('Carga masiva completada');
      onUploadSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.message || `Error al cargar el archivo de ${uploadType}`);
    } finally { setLoading(false); }
  };

  const handleDownloadTemplate = async () => {
    try {
      let response, filename;
      if (uploadType === 'productos') {
        response = await fetchProductTemplate(); filename = 'plantilla_productos.xlsx';
      } else if (uploadType === 'clientes') {
        response = await fetchTercerosTemplate(); filename = 'plantilla_terceros.xlsx';
      } else if (uploadType === 'movimientos') {
        filename = 'movimientos_template.csv';
        window.location.href = `/${filename}`; return;
      }
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url; link.setAttribute('download', filename);
      document.body.appendChild(link); link.click(); link.remove();
    } catch { toast.error('Error al descargar la plantilla.'); }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      {/* Zona de drop */}
      <Box
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        sx={{
          border: `2px dashed ${dragging ? ACCENT : (validationError ? RED : (file ? GREEN : 'divider'))}`,
          borderRadius: 3, p: 4, mb: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1.5, cursor: file ? 'default' : 'pointer',
          bgcolor: dragging ? `${ACCENT}06` : (file ? `${GREEN}05` : 'action.hover'),
          transition: 'all 0.2s',
          minHeight: 140,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {!file ? (
          <>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
              <Upload />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                {dragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo o haz clic para seleccionar'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                Formatos aceptados: .xlsx, .xls, .csv
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              {(REQUIRED_HEADERS[uploadType] || []).map(h => (
                <Chip key={h} label={h} size="small"
                  sx={{ bgcolor: `${ACCENT}10`, color: ACCENT, fontSize: 10, fontWeight: 600, borderRadius: 1 }} />
              ))}
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', maxWidth: 400 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 2, flexShrink: 0,
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
                <Typography sx={{ fontSize: 11, color: RED, fontWeight: 600, mt: 0.3 }}>
                  ⚠ {validationError}
                </Typography>
              )}
            </Box>
            <Box
              onClick={e => { e.stopPropagation(); reset(); }}
              sx={{ cursor: 'pointer', color: 'text.secondary', display: 'flex', '&:hover': { color: RED } }}
            >
              <Close fontSize="small" />
            </Box>
          </Box>
        )}
      </Box>

      {/* Barra de progreso al subir */}
      {loading && <LinearProgress sx={{ mb: 1.5, borderRadius: 1, height: 4, bgcolor: `${ACCENT}20`, '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />}

      {/* Resultado */}
      {status && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          p: 2, mb: 2, borderRadius: 2,
          bgcolor: status === 'success' ? `${GREEN}0D` : `${RED}0D`,
          border: `1px solid ${status === 'success' ? GREEN : RED}30`,
        }}>
          {status === 'success'
            ? <CheckCircle sx={{ color: GREEN, flexShrink: 0 }} />
            : <ErrorIcon sx={{ color: RED, flexShrink: 0 }} />
          }
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: status === 'success' ? GREEN : RED }}>
            {message}
          </Typography>
        </Box>
      )}

      {/* Acciones */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={loading || !file || !!validationError}
          startIcon={loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Upload />}
          sx={{
            background: `linear-gradient(135deg, ${ACCENT}, #a78bfa)`,
            boxShadow: `0 4px 14px rgba(139,92,246,0.3)`,
            borderRadius: 2, fontWeight: 600,
            '&.Mui-disabled': { opacity: 0.5 },
          }}
        >
          {loading ? 'Procesando…' : 'Cargar Archivo'}
        </Button>

        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleDownloadTemplate}
          disabled={loading}
          sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'divider', color: 'text.secondary' }}
        >
          Descargar Plantilla
        </Button>

        {file && !loading && (
          <Button onClick={reset} variant="text"
            sx={{ borderRadius: 2, fontWeight: 600, color: 'text.secondary', ml: 'auto' }}>
            Limpiar
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default BulkUpload;
