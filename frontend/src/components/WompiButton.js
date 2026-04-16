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
      // 1. Pedimos el Hash de integridad a nuestro Backend
      const { data } = await apiClient.post('/pagos/generar-hash-wompi', {
        plan_name: planName
      });

      // 2. Configuramos el Checkout de Wompi
      const checkout = new window.WidgetCheckout({
        currency: data.currency,
        amountInCents: data.amount_in_cents,
        reference: data.reference,
        publicKey: data.public_key,
        signature: data.signature, // Hash generado en backend
        redirectUrl: `${window.location.origin}/pago-finalizado`, // A donde vuelve el cliente
      });

      // 3. Abrimos el Widget
      checkout.open((result) => {
        const transaction = result.transaction;
        if (transaction.status === 'APPROVED') {
          toast.success("¡Pago aprobado! Tu suscripción se está activando.");
          if (onSuccess) onSuccess();
        } else {
          toast.warning(`Estado del pago: ${transaction.status}`);
        }
      });

    } catch (error) {
      console.error("Error iniciando pago Wompi", error);
      toast.error("No se pudo iniciar el proceso de pago.");
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