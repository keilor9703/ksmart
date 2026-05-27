import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Payments } from '@mui/icons-material';
import { apiClient } from '../../api';
import { toast } from 'react-toastify';

const WompiButton = ({ planName, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // 1. Obtener hash de integridad y datos del plan desde el backend
      const { data } = await apiClient.post('/wompi/generar-hash', {
        plan_name: planName
      });

      if (data.public_key === "pub_test_...") {
        alert("❌ ERROR DE ENTORNO:\nEl backend sigue enviando la llave de prueba falsa ('pub_test_...').\n\nVe a Render, asegúrate de que WOMPI_PUBLIC_KEY esté bien escrita y reinicia el servidor manualmente.");
        setLoading(false);
        return;
      }

      let safePublicKey = data.public_key.replace(/['"]/g, '');

      // 2. Configuración del widget — SIN redirectUrl para evitar recarga de página.
      //    La recarga causaba que checkAuth() corriera antes de que el webhook de
      //    Wompi llegara, dejando al usuario en la pantalla de plan expirado.
      const checkoutData = {
        currency: data.currency,
        amountInCents: parseInt(data.amount_in_cents),
        reference: data.reference,
        publicKey: safePublicKey,
        signature: { integrity: data.signature },
        // redirectUrl eliminado intencionalmente
      };

      if (!window.WidgetCheckout) {
        alert("❌ ERROR DE LIBRERÍA:\nEl script de Wompi no cargó. Verifica que pusiste la etiqueta <script> en tu index.html correctamente.");
        setLoading(false);
        return;
      }

      // 3. Abrir el widget
      const checkout = new window.WidgetCheckout(checkoutData);

      checkout.open(async (result) => {
        const transaction = result.transaction;
        if (transaction.status === 'APPROVED') {
          toast.info("¡Pago aprobado! Activando tu cuenta...");
          try {
            // 4. Activar suscripción de forma síncrona, sin esperar el webhook.
            //    El endpoint es idempotente: si el webhook llega después, no duplica.
            await apiClient.post('/wompi/confirmar-pago-widget', {
              wompi_id:            transaction.id,
              reference:           transaction.reference,
              amount_in_cents:     transaction.amountInCents,
              currency:            transaction.currency,
              payment_method_type: transaction.paymentMethodType,
              customer_email:      transaction.customerEmail,
            });
            toast.success("¡Suscripción activada! Bienvenido.");
          } catch (activationErr) {
            // Si ya fue procesado por el webhook, el endpoint responde OK igual.
            // Solo loguear si es un error real.
            const status = activationErr?.response?.status;
            if (status !== 200 && status !== 409) {
              console.warn("confirmar-pago-widget error:", activationErr?.response?.data);
            }
          }
          // 5. Refrescar auth y navegar — la suscripción ya está activa en BD
          if (onSuccess) await onSuccess();
        } else {
          toast.warning(`Transacción no completada. Estado: ${transaction.status}`);
        }
      });

    } catch (error) {
      let errorMsg = "Error Desconocido";
      if (error.response) {
        errorMsg = error.response.data?.detail || JSON.stringify(error.response.data);
      } else if (error.message) {
        errorMsg = error.message;
      } else {
        try { errorMsg = JSON.stringify(error); } catch(e) {}
      }
      toast.error("No se pudo iniciar el pago.");
      alert("🔎 DIAGNÓSTICO DE ERROR:\n" + errorMsg);
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
      {loading ? 'Conectando...' : 'Pagar con Wompi / Nequi'}
    </Button>
  );
};

export default WompiButton;
