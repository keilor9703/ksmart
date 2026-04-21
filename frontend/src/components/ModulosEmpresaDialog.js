import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton, Switch,
  FormGroup, FormControlLabel, CircularProgress
} from '@mui/material';
import { Close, ViewModule } from '@mui/icons-material';
import { updateModulosEmpresa } from '../api';
import { toast } from 'react-toastify';
import { APP_MODULES } from '../utils/modulesConfig'; // 👈 IMPORTACIÓN MAESTRA

const ACCENT = '#F43F5E';

const ModulosEmpresaDialog = ({ open, handleClose, empresa, onModulosUpdated }) => {
  const [modulosActivos, setModulosActivos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar módulos iniciales
  useEffect(() => {
    if (open && empresa) {
      if (!empresa.modulos_habilitados) {
        setModulosActivos(APP_MODULES.map(m => m.path));
      } else {
        setModulosActivos(empresa.modulos_habilitados);
      }
    }
  }, [open, empresa]);

  // Manejar el toggle (Switch) de cada módulo
  const handleToggle = (path) => {
    setModulosActivos((prev) => {
      const current = prev || []; 
      return current.includes(path) 
        ? current.filter(p => p !== path) 
        : [...current, path];
    });
  };

  // Marcar todos o ninguno
  const handleMarcarTodos = (marcar) => {
    if (marcar) {
      setModulosActivos(APP_MODULES.map(m => m.path));
    } else {
      setModulosActivos([]);
    }
  };

  // Guardar en el backend
  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateModulosEmpresa(empresa.id, modulosActivos);
      toast.success('Módulos actualizados. El cliente verá los cambios en su próximo inicio de sesión.');
      if (onModulosUpdated) onModulosUpdated();
      handleClose();
    } catch (error) {
      toast.error('Error al guardar la configuración de módulos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!empresa) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${ACCENT}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
            <ViewModule />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Módulos del Cliente</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Empresa: {empresa.nombre}</Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose}><Close fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}>
            Enciende o apaga las funciones para este inquilino:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" sx={{ fontSize: 11, textTransform: 'none' }} onClick={() => handleMarcarTodos(true)}>Todos</Button>
            <Button size="small" sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary' }} onClick={() => handleMarcarTodos(false)}>Ninguno</Button>
          </Box>
        </Box>

        <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1 }}>
          {/* 👇 AQUÍ RECORREMOS APP_MODULES */}
          {APP_MODULES.map((modulo) => (
            <Box key={modulo.path} sx={{ 
                p: 1, borderRadius: 2, 
                border: '1px solid', borderColor: (modulosActivos || []).includes(modulo.path) ? `${ACCENT}50` : 'divider',
                bgcolor: (modulosActivos || []).includes(modulo.path) ? `${ACCENT}08` : 'transparent',
                transition: 'all 0.2s'
              }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={(modulosActivos || []).includes(modulo.path)} 
                    onChange={() => handleToggle(modulo.path)} 
                    color="primary"
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: ACCENT } }}
                  />
                }
                label={<Typography sx={{ fontSize: 13, fontWeight: (modulosActivos || []).includes(modulo.path) ? 700 : 500 }}>{modulo.label}</Typography>}
                sx={{ m: 0, width: '100%' }}
              />
            </Box>
          ))}
        </FormGroup>
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 3 }}>
        <Button onClick={handleClose} color="inherit" sx={{ fontWeight: 600, textTransform: 'none' }}>Cancelar</Button>
        <Button 
          variant="contained" 
          onClick={handleSave} 
          disabled={isSubmitting}
          startIcon={isSubmitting && <CircularProgress size={16} color="inherit" />}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#E11D48' }, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}
        >
          Guardar Configuración
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModulosEmpresaDialog;