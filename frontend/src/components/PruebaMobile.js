import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';

const PruebaMobile = () => {
  return (
    // Fondo rojo extremo para ver exactamente dónde termina el componente
    <Box sx={{ width: '100%', p: 2, boxSizing: 'border-box', bgcolor: '#EF4444' }}>
      
      <Typography variant="h6" color="white" fontWeight="bold" gutterBottom>
        PRUEBA DE CONTENEDOR PADRE
      </Typography>

      {/* Tarjeta de prueba */}
      <Paper sx={{ width: '100%', p: 2, boxSizing: 'border-box', borderRadius: 2 }}>
        <Typography variant="body1" fontWeight="bold" color="error">
          ¿ESTO SE VE COMPLETO?
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
          Si el fondo rojo o esta tarjeta blanca se salen de tu pantalla hacia la derecha, 
          el error NUNCA fue de RutaCobro. El error está en tu Layout principal (Sidebar, App.js, Main).
        </Typography>
        
        {/* Botón al 100% para verificar el límite derecho */}
        <Button variant="contained" fullWidth sx={{ bgcolor: 'black', color: 'white' }}>
          ESTE BOTÓN DEBE VERSE COMPLETO
        </Button>
      </Paper>

    </Box>
  );
};

export default PruebaMobile;