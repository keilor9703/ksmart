import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Payments } from '@mui/icons-material';
import apiClient from '../api';
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
      // Nota: Wompi usa nombres de campos específicos en el objeto de configuración
      const checkoutData = {
        currency: data.currency,           // Ej: "COP"
        amountInCents: parseInt(data.amount_in_cents), // DEBE ser un entero
        reference: data.reference,         // Ej: "KSMART-..."
        publicKey: data.public_key,        // Tu llave pub_test_...
        signature: data.signature,         // El hash de integridad
        redirectUrl: `${window.location.origin}/`, 
      };

      // 3. Invocar el Widget
      // Verificamos si la librería cargó correctamente desde index.html
      if (!window.WidgetCheckout) {
        throw new Error("La librería de pagos de Wompi no se ha cargado. Verifica tu conexión.");
      }

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
      // ── LOG DE DIAGNÓSTICO SENIOR ──
      console.error("DEBUG COMPLETO ERROR WOMPI:", error);
      
      // Si el error viene de Axios (Backend)
      if (error.response) {
        toast.error(`Error del servidor: ${error.response.data?.detail || 'Fallo en Hash'}`);
      } 
      // Si el error es de JavaScript (Widget no cargado o mal configurado)
      else {
        toast.error(`Error de pasarela: ${error.message}`);
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
        bgcolor: '#3B82F6', 
        borderRadius: 2, 
        py: 1.5, 
        fontWeight: 700,
        '&:hover': { bgcolor: '#2563EB' }
      }}
    >
      {loading ? 'Preparando Pago...' : 'Pagar con Wompi / Nequi'}
    </Button>
  );
};

export default WompiButton;