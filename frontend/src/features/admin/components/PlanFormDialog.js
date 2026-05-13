import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, Stack, Box,
  FormControlLabel, Switch, useMediaQuery, useTheme, Typography, IconButton
} from '@mui/material';
import { Close } from '@mui/icons-material';
import CurrencyField from '../../components/common/CurrencyField'; // Ajusta la ruta si es necesario

export default function PlanFormDialog({
  open, onClose, onSubmit, formPlan, setFormPlan, isEditing
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullScreen={isMobile} 
      maxWidth="sm" 
      fullWidth
      PaperProps={isMobile ? { sx: { m: 0, borderRadius: 0 } } : { sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ 
        fontWeight: 800, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: { xs: 2.5, sm: 3 },
        pb: { xs: 1.5, sm: 2 }
      }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {isEditing ? 'Editar Plan' : 'Nuevo Plan'}
        </Typography>
        {isMobile && (
          <IconButton onClick={onClose} size="small" edge="end">
            <Close />
          </IconButton>
        )}
      </DialogTitle>
      
      <form onSubmit={onSubmit}>
        <DialogContent sx={{ p: { xs: 2.5, sm: 3 }, pt: { xs: 1, sm: 1 } }}>
          <Stack spacing={{ xs: 3, sm: 2.5 }}>
            <TextField 
              autoFocus={!isMobile} // Evita que el teclado tape todo en móvil al abrir
              label="Nombre del Plan" 
              required 
              fullWidth 
              size={isMobile ? "medium" : "small"} // Inputs más grandes en móvil
              value={formPlan.nombre} 
              onChange={e => setFormPlan({...formPlan, nombre: e.target.value})} 
            />
            
            <TextField 
              label="Código Interno (ej: plan_oro)" 
              required 
              fullWidth 
              size={isMobile ? "medium" : "small"} 
              value={formPlan.codigo_interno} 
              onChange={e => setFormPlan({...formPlan, codigo_interno: e.target.value})} 
              disabled={isEditing} 
            />
            
            <Grid container spacing={{ xs: 3, sm: 2 }}>
              {/* Cambiado xs={6} a xs={12} sm={6} para que en móvil bajen a la siguiente línea */}
              <Grid item xs={12} sm={6}>
                <CurrencyField 
                  label="Precio Mensual" 
                  required 
                  fullWidth 
                  value={formPlan.precio} 
                  onChange={val => setFormPlan({...formPlan, precio: val})} 
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField 
                  label="Días de duración" 
                  type="number" 
                  required 
                  fullWidth 
                  size={isMobile ? "medium" : "small"} 
                  value={formPlan.dias_duracion} 
                  onChange={e => setFormPlan({...formPlan, dias_duracion: e.target.value})} 
                />
              </Grid>
            </Grid>
            
            <TextField 
              label="Características del Plan" 
              placeholder="Ej: Facturación Ilimitada, Soporte 24/7, Módulo de Inventario..." 
              multiline 
              rows={isMobile ? 5 : 4} 
              fullWidth 
              size={isMobile ? "medium" : "small"} 
              value={formPlan.caracteristicas} 
              onChange={e => setFormPlan({...formPlan, caracteristicas: e.target.value})} 
              helperText="Escribe las ventajas principales separadas por comas."
            />

            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' }, 
              gap: { xs: 2.5, sm: 2 }, 
              alignItems: { xs: 'stretch', sm: 'center' },
              pt: 1
            }}>
               <TextField 
                 label="Color (Hex)" 
                 size={isMobile ? "medium" : "small"} 
                 value={formPlan.color || '#3B82F6'} 
                 onChange={e => setFormPlan({...formPlan, color: e.target.value})} 
                 sx={{ width: { xs: '100%', sm: 120 } }} 
               />
               <FormControlLabel 
                 control={<Switch checked={formPlan.is_active} onChange={e => setFormPlan({...formPlan, is_active: e.target.checked})} />} 
                 label="Plan Activo y Visible" 
                 sx={{ m: 0 }}
               />
            </Box>
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ 
          p: { xs: 2.5, sm: 3 }, 
          pt: { xs: 0, sm: 0 }, 
          justifyContent: isMobile ? 'stretch' : 'flex-end', 
          flexDirection: isMobile ? 'column' : 'row', 
          gap: isMobile ? 1.5 : 0 
        }}>
          {/* Orden alterado en móvil para poner el CTA principal arriba */}
          <Button 
            onClick={onClose} 
            fullWidth={isMobile} 
            variant={isMobile ? "outlined" : "text"}
            sx={{ order: isMobile ? 2 : 1 }}
          >
            {isMobile ? 'Cancelar' : 'Cerrar'}
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            fullWidth={isMobile}
            sx={{ order: isMobile ? 1 : 2, py: isMobile ? 1.2 : undefined }}
          >
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
