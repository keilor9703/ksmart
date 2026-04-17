import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Grid, TextField, MenuItem, Button, Typography, Paper, Chip,
  Autocomplete, Divider, CircularProgress, InputAdornment, IconButton, Stack
} from '@mui/material';
import { Calculate, Save, AttachMoney, PersonSearch, Close, Info } from '@mui/icons-material';
import apiClient, { createPrestamo } from '../api';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';


const ACCENT = '#3B82F6'; 
const MODALIDADES = ['Diario', 'Semanal', 'Quincenal', 'Mensual'];

const PrestamoForm = ({ onPrestamoAdded, onCancel }) => {
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados del Formulario
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [monto, setMonto] = useState('');
  const [tasaInteres, setTasaInteres] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [modalidad, setModalidad] = useState('Mensual');

  useEffect(() => {
    apiClient.get('/clientes/')
      .then(res => setClientes(res.data))
      .catch(() => toast.error("Error al cargar la lista de clientes"))
      .finally(() => setLoadingClientes(false));
  }, []);

  const simulacion = useMemo(() => {
    const capital = parseFloat(monto) || 0;
    const interesPct = parseFloat(tasaInteres) || 0;
    const numeroCuotas = parseInt(cuotas) || 0;
    if (capital <= 0 || interesPct <= 0 || numeroCuotas <= 0) return null;

    const gananciaInteres = capital * (interesPct / 100);
    const totalPagar = capital + gananciaInteres;
    const valorCuota = totalPagar / numeroCuotas;

    return { capital, gananciaInteres, totalPagar, valorCuota, numeroCuotas };
  }, [monto, tasaInteres, cuotas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCliente) return toast.warning("Debes seleccionar un cliente");
    if (!simulacion) return toast.warning("Revisa los montos. Deben ser mayores a 0.");

    setIsSubmitting(true);
    try {
      const payload = {
        cliente_id: selectedCliente.id,
        monto_prestado: simulacion.capital,
        tasa_interes: parseFloat(tasaInteres),
        cantidad_cuotas: simulacion.numeroCuotas,
        modalidad: modalidad
      };
      const res = await createPrestamo(payload);
      toast.success("¡Préstamo generado exitosamente!");
      setSelectedCliente(null);
      setMonto(''); setTasaInteres(''); setCuotas('');
      if (onPrestamoAdded) onPrestamoAdded(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear el préstamo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, margin: '0 auto' }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid', borderColor: 'divider' }}>
        
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: `${ACCENT}15`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calculate fontSize="medium" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>Simular y Crear Préstamo</Typography>
              <Typography variant="caption" color="text.secondary">Configura los parámetros del nuevo crédito</Typography>
            </Box>
          </Box>
          {onCancel && <IconButton onClick={onCancel} size="small"><Close /></IconButton>}
        </Box>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={5}>
            
            {/* LADO IZQUIERDO: FORMULARIO VERTICAL */}
            <Grid item xs={12} md={6}>
              <Stack spacing={3}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: ACCENT, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonSearch fontSize="small" /> INFORMACIÓN DEL DEUDOR
                  </Typography>
                  <Autocomplete
                    fullWidth
                    options={clientes}
                    getOptionLabel={(o) => o ? `${o.nombre} (${o.cedula || 'Sin ID'})` : ''}
                    value={selectedCliente}
                    onChange={(_, v) => setSelectedCliente(v)}
                    loading={loadingClientes}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Seleccionar cliente" 
                        required 
                        placeholder="Busca por nombre o documento..."
                      />
                    )}
                  />
                </Box>

                <Divider />

                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 2, color: ACCENT, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachMoney fontSize="small" /> CONDICIONES DEL PRÉSTAMO
                  </Typography>
                  <Stack spacing={2.5}>
                    <TextField
                      fullWidth required label="Monto a prestar (Capital)"
                      type="number" value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    />
                    
                    <TextField
                      fullWidth required label="Tasa de interés"
                      type="number" value={tasaInteres}
                      onChange={(e) => setTasaInteres(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                      helperText="Porcentaje fijo sobre el capital total"
                    />

                    <TextField
                      select fullWidth required label="Modalidad de Cobro"
                      value={modalidad} onChange={(e) => setModalidad(e.target.value)}
                    >
                      {MODALIDADES.map(mod => <MenuItem key={mod} value={mod}>{mod}</MenuItem>)}
                    </TextField>

                    <TextField
                      fullWidth required label="Número de cuotas"
                      type="number" value={cuotas}
                      onChange={(e) => setCuotas(e.target.value)}
                    />
                  </Stack>
                </Box>
              </Stack>
            </Grid>

            {/* LADO DERECHO: RESULTADOS Y RESUMEN */}
            <Grid item xs={12} md={6}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info fontSize="small" /> PROYECCIÓN FINANCIERA
                </Typography>

                <Paper variant="outlined" sx={{ 
                  p: 4, borderRadius: 4, bgcolor: 'action.hover', borderStyle: 'dashed', 
                  flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' 
                }}>
                  {simulacion ? (
                    <Stack spacing={3}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">Capital solicitado:</Typography>
                        <Typography fontWeight={700} variant="h6">{formatCurrency(simulacion.capital)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography color="text.secondary">Intereses calculados:</Typography>
                        <Typography fontWeight={700} color="success.main" variant="h6">+{formatCurrency(simulacion.gananciaInteres)}</Typography>
                      </Box>
                      
                      <Divider sx={{ borderBottomWidth: 2 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography fontWeight={800} variant="h6">Total a Recaudar:</Typography>
                        <Typography variant="h5" fontWeight={900} color="primary.main">{formatCurrency(simulacion.totalPagar)}</Typography>
                      </Box>
                      
                      <Box sx={{ mt: 2, p: 3, bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>Cada cuota será de:</Typography>
                        <Typography variant="h4" fontWeight={900} color="success.main" sx={{ mb: 1 }}>
                          {formatCurrency(simulacion.valorCuota)}
                        </Typography>
                        <Chip 
                          label={`${simulacion.numeroCuotas} PAGOS ${modalidad.toUpperCase()}S`} 
                          size="small" 
                          sx={{ fontWeight: 800, bgcolor: `${ACCENT}15`, color: ACCENT }}
                        />
                      </Box>
                    </Stack>
                  ) : (
                    <Box sx={{ textAlign: 'center', opacity: 0.4 }}>
                      <AttachMoney sx={{ fontSize: 80, mb: 2 }} />
                      <Typography variant="h6">Simulador de Crédito</Typography>
                      <Typography variant="body2">Ingresa el monto y cuotas para ver el cálculo</Typography>
                    </Box>
                  )}
                </Paper>

                {/* Botón de Acción */}
                <Button 
                  type="submit" 
                  variant="contained" 
                  fullWidth
                  disabled={isSubmitting || !simulacion}
                  startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Save />}
                  sx={{ 
                    mt: 3, py: 2, 
                    borderRadius: 3, 
                    fontWeight: 800, 
                    fontSize: 16,
                    boxShadow: `0 8px 24px ${ACCENT}40`,
                    bgcolor: ACCENT,
                    '&:hover': { bgcolor: '#2563EB' }
                  }}
                >
                  Confirmar y Generar Cuotas
                </Button>
              </Box>
            </Grid>

          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default PrestamoForm;