import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Payments } from '@mui/icons-material';
import { apiClient } from '../api'; // Asegúrate de importar correctamente
import { toast } from 'react-toastify';

const WompiButton = ({ planName, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // 1. Obtener datos del backend
      const { data } = await apiClient.post('/pagos/generar-hash-wompi', {
        plan_name: planName
      });

      console.log("Datos recibidos para Wompi:", data);

      // 2. Configuración ESTRICTA para el Widget de Wompi
      const checkoutData = {
        currency: data.currency,           
        amountInCents: parseInt(data.amount_in_cents), 
        reference: data.reference,         
        publicKey: data.public_key,        
        // 👇 CORRECCIÓN CLAVE: Wompi exige que la firma sea un objeto con la propiedad "integrity"
        signature: { integrity: data.signature }, 
        redirectUrl: `${window.location.origin}/`, 
      };

      if (!window.WidgetCheckout) {
        throw new Error("La librería de Wompi no cargó. Revisa tu conexión o desactiva tu bloqueador de anuncios.");
      }

      // 3. Invocar el Widget
      const checkout = new window.WidgetCheckout(checkoutData);

      checkout.open((result) => {
        const transaction = result.transaction;
        console.log("Resultado Wompi:", transaction);
        
        if (transaction.status === 'APPROVED') {
          toast.success("¡Pago aprobado! Tu cuenta se activará en segundos.");
          if (onSuccess) onSuccess();
        } else {
          toast.info(`Transacción: ${transaction.status}`);
        }
      });

    } catch (error) {
      console.error("DEBUG COMPLETO ERROR WOMPI:", error);
      if (error.response) {
        toast.error(`Error del servidor: ${error.response.data?.detail || 'Fallo en Hash'}`);
      } else {
        // Mejor manejo de errores para que no salga 'undefined'
        const msg = error.message || JSON.stringify(error);
        toast.error(`Error de pasarela: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      fullWidth
      onClick={handlePayment}
      disabled={loading}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Payments />}
      sx={{ 
        bgcolor: '#F43F5E', 
        borderRadius: 3, 
        py: 1.8, 
        fontWeight: 800,
        fontSize: '0.95rem',
        boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4)',
        '&:hover': { bgcolor: '#E11D48', boxShadow: '0 6px 20px rgba(244, 63, 94, 0.6)' },
        textTransform: 'none'
      }}
    >
      {loading ? 'Cargando Pasarela...' : 'Pagar con Wompi / Nequi'}
    </Button>
  );
};

export default WompiButton;
