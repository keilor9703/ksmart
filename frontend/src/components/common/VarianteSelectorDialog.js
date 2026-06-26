/**
 * VarianteSelectorDialog.js
 * Diálogo que aparece cuando el operario toca un producto con variantes.
 * Muestra las variantes activas con sus atributos, precio y stock.
 * Al seleccionar una, devuelve el detalle listo para el carrito.
 */
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Chip, Grid, Divider,
  Paper, RadioGroup, FormControlLabel, Radio,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryIcon from '@mui/icons-material/Inventory2';
import { formatCurrency } from '../../utils/formatters';

const ACCENT = '#6366F1';

/**
 * @param {object}   producto        — objeto producto completo (con .variantes)
 * @param {function} onSeleccionar   — (varianteElegida) => void
 * @param {function} onCancelar      — () => void
 */
export default function VarianteSelectorDialog({ producto, onSeleccionar, onCancelar }) {
  const variantes = (producto?.variantes || []).filter(v => v.activo);
  const [seleccionada, setSeleccionada] = useState(variantes[0]?.id ?? null);

  const varianteObj = variantes.find(v => v.id === seleccionada);

  const handleConfirmar = () => {
    if (!varianteObj) return;
    onSeleccionar(varianteObj);
  };

  const precioEfectivo = (v) =>
    v.precio != null ? v.precio : (producto?.precio || 0);

  const stockBajo = (v) =>
    v.stock_actual !== null && v.stock_actual <= (v.stock_minimo || 0);

  return (
    <Dialog open maxWidth="sm" fullWidth onClose={onCancelar}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={700}>{producto?.nombre}</Typography>
        <Typography variant="body2" color="text.secondary">
          Selecciona una variante para agregar al carrito
        </Typography>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {variantes.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={3}>
            Este producto no tiene variantes activas.
          </Typography>
        ) : (
          <RadioGroup
            value={seleccionada}
            onChange={(e) => setSeleccionada(Number(e.target.value))}
          >
            <Grid container spacing={1.5}>
              {variantes.map((v) => {
                const elegida  = seleccionada === v.id;
                const sinStock = v.stock_actual !== null && v.stock_actual <= 0;
                const atribs   = v.atributos || {};

                return (
                  <Grid item xs={12} sm={6} key={v.id}>
                    <Paper
                      variant="outlined"
                      onClick={() => !sinStock && setSeleccionada(v.id)}
                      sx={{
                        p: 1.5,
                        cursor: sinStock ? 'not-allowed' : 'pointer',
                        opacity: sinStock ? 0.5 : 1,
                        border: '2px solid',
                        borderColor: elegida ? ACCENT : 'divider',
                        borderRadius: 2,
                        position: 'relative',
                        transition: 'border-color 0.15s',
                        bgcolor: elegida ? `${ACCENT}08` : 'background.paper',
                      }}
                    >
                      {/* Radio oculto — accesibilidad */}
                      <FormControlLabel
                        value={v.id}
                        control={<Radio sx={{ display: 'none' }} />}
                        label=""
                        sx={{ position: 'absolute', m: 0, p: 0, opacity: 0 }}
                        disabled={sinStock}
                      />

                      {/* Check visible cuando está seleccionada */}
                      {elegida && (
                        <CheckCircleIcon
                          sx={{
                            position: 'absolute', top: 8, right: 8,
                            color: ACCENT, fontSize: 18,
                          }}
                        />
                      )}

                      {/* Nombre variante */}
                      <Typography fontWeight={600} fontSize={13} mb={0.5} pr={2.5}>
                        {v.nombre}
                      </Typography>

                      {/* Atributos */}
                      <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
                        {Object.entries(atribs).map(([k, val]) => (
                          <Chip
                            key={k}
                            label={`${k}: ${val}`}
                            size="small"
                            sx={{ fontSize: 10, height: 20 }}
                          />
                        ))}
                      </Box>

                      {/* Precio y stock */}
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight={800} color={ACCENT} fontSize={14}>
                          {formatCurrency(precioEfectivo(v))}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.4}>
                          <InventoryIcon
                            sx={{
                              fontSize: 13,
                              color: stockBajo(v) ? 'warning.main' : 'text.disabled',
                            }}
                          />
                          <Typography
                            variant="caption"
                            color={stockBajo(v) ? 'warning.main' : 'text.secondary'}
                            fontWeight={stockBajo(v) ? 700 : 400}
                          >
                            {sinStock
                              ? 'Sin stock'
                              : v.stock_actual != null
                                ? `${v.stock_actual} en stock`
                                : 'Sin control'}
                          </Typography>
                        </Box>
                      </Box>

                      {v.sku && (
                        <Typography variant="caption" color="text.disabled" display="block" mt={0.3}>
                          SKU: {v.sku}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </RadioGroup>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onCancelar} color="inherit">Cancelar</Button>
        <Button
          variant="contained"
          disabled={!varianteObj}
          onClick={handleConfirmar}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#e05518' } }}
        >
          Agregar al carrito
        </Button>
      </DialogActions>
    </Dialog>
  );
}
