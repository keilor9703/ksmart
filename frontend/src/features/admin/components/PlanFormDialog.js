import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, Stack, Box,
  FormControlLabel, Switch, useMediaQuery, useTheme, Typography, IconButton,
  Autocomplete, Chip, Divider
} from '@mui/material';
import { Close, Lock, Public } from '@mui/icons-material';
import CurrencyField from '../../../components/common/CurrencyField';
import apiClient from '../../../api';

export default function PlanFormDialog({
  open, onClose, onSubmit, formPlan, setFormPlan, isEditing
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [empresas, setEmpresas] = useState([]);

  useEffect(() => {
    if (open && empresas.length === 0) {
      apiClient.get('/superadmin/empresas').then(r => setEmpresas(r.data || [])).catch(() => {});
    }
  }, [open]);

  const empresaSeleccionada = empresas.find(e => e.id === formPlan.empresa_id_exclusivo) || null;
  const esPrivado = !!formPlan.empresa_id_exclusivo;

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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        p: { xs: 2.5, sm: 3 }, pb: { xs: 1.5, sm: 2 }
      }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {isEditing ? 'Editar Plan' : 'Nuevo Plan'}
        </Typography>
        {isMobile && <IconButton onClick={onClose} size="small"><Close /></IconButton>}
      </DialogTitle>

      <form onSubmit={onSubmit}>
        <DialogContent sx={{ p: { xs: 2.5, sm: 3 }, pt: { xs: 1, sm: 1 } }}>
          <Stack spacing={{ xs: 3, sm: 2.5 }}>

            <TextField
              autoFocus={!isMobile}
              label="Nombre del Plan"
              required fullWidth
              size={isMobile ? 'medium' : 'small'}
              value={formPlan.nombre}
              onChange={e => setFormPlan({ ...formPlan, nombre: e.target.value })}
            />

            <TextField
              label="Código Interno (ej: starter_mes)"
              required fullWidth
              size={isMobile ? 'medium' : 'small'}
              value={formPlan.codigo_interno}
              onChange={e => setFormPlan({ ...formPlan, codigo_interno: e.target.value })}
              disabled={isEditing}
            />

            <Grid container spacing={{ xs: 3, sm: 2 }}>
              <Grid item xs={12} sm={6}>
                <CurrencyField
                  label="Precio"
                  required fullWidth
                  value={formPlan.precio}
                  onChange={val => setFormPlan({ ...formPlan, precio: val })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Días de duración"
                  type="number" required fullWidth
                  size={isMobile ? 'medium' : 'small'}
                  value={formPlan.dias_duracion}
                  onChange={e => setFormPlan({ ...formPlan, dias_duracion: e.target.value })}
                />
              </Grid>
            </Grid>

            <TextField
              label="Características del Plan"
              placeholder="Facturación Ilimitada, Soporte 24/7, Inventario..."
              multiline rows={isMobile ? 5 : 4} fullWidth
              size={isMobile ? 'medium' : 'small'}
              value={formPlan.caracteristicas}
              onChange={e => setFormPlan({ ...formPlan, caracteristicas: e.target.value })}
              helperText="Separa las ventajas por comas."
            />

            <Divider />

            {/* Visibilidad del plan */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                Visibilidad del plan
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                <Chip
                  icon={<Public sx={{ fontSize: 16 }} />}
                  label="Público (todas las empresas)"
                  size="small"
                  onClick={() => setFormPlan({ ...formPlan, empresa_id_exclusivo: null })}
                  color={!esPrivado ? 'primary' : 'default'}
                  variant={!esPrivado ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer', fontWeight: 600 }}
                />
                <Chip
                  icon={<Lock sx={{ fontSize: 16 }} />}
                  label="Privado (empresa específica)"
                  size="small"
                  onClick={() => setFormPlan({ ...formPlan, empresa_id_exclusivo: -1 })}
                  color={esPrivado ? 'warning' : 'default'}
                  variant={esPrivado ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer', fontWeight: 600 }}
                />
              </Box>

              {esPrivado && (
                <Autocomplete
                  options={empresas}
                  getOptionLabel={e => `${e.nombre} (ID: ${e.id})`}
                  value={empresaSeleccionada}
                  onChange={(_, val) => setFormPlan({ ...formPlan, empresa_id_exclusivo: val?.id || null })}
                  size="small"
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Empresa que verá este plan"
                      required={esPrivado}
                      placeholder="Busca por nombre..."
                      helperText="Solo esta empresa verá el plan al activar su suscripción."
                    />
                  )}
                />
              )}

              {!esPrivado && (
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
                  Este plan será visible para todas las empresas en el selector de suscripción.
                </Typography>
              )}
            </Box>

            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2.5, sm: 2 },
              alignItems: { xs: 'stretch', sm: 'center' },
            }}>
              <TextField
                label="Color (Hex)"
                size={isMobile ? 'medium' : 'small'}
                value={formPlan.color || '#3B82F6'}
                onChange={e => setFormPlan({ ...formPlan, color: e.target.value })}
                sx={{ width: { xs: '100%', sm: 120 } }}
              />
              <FormControlLabel
                control={<Switch checked={formPlan.is_active} onChange={e => setFormPlan({ ...formPlan, is_active: e.target.checked })} />}
                label="Plan Activo y Visible"
                sx={{ m: 0 }}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{
          p: { xs: 2.5, sm: 3 }, pt: 0,
          justifyContent: isMobile ? 'stretch' : 'flex-end',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 1.5 : 0,
        }}>
          <Button onClick={onClose} fullWidth={isMobile} variant={isMobile ? 'outlined' : 'text'} sx={{ order: isMobile ? 2 : 1 }}>
            {isMobile ? 'Cancelar' : 'Cerrar'}
          </Button>
          <Button type="submit" variant="contained" fullWidth={isMobile} sx={{ order: isMobile ? 1 : 2, py: isMobile ? 1.2 : undefined }}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
