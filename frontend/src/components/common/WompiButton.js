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
      // 1. Obtener datos del backend
      const { data } = await apiClient.post('/wompi/generar-hash', {
        plan_name: planName
      });

      // 🛡️ DEFENSA 1: Verificamos si Render sigue enviando la llave de relleno
      if (data.public_key === "pub_test_...") {
         alert("❌ ERROR DE ENTORNO:\nEl backend sigue enviando la llave de prueba falsa ('pub_test_...').\n\nVe a Render, asegúrate de que WOMPI_PUBLIC_KEY esté bien escrita y reinicia el servidor manualmente.");
         setLoading(false);
         return;
      }

      // 🛡️ DEFENSA 2: Limpiamos comillas accidentales de las variables de entorno
      let safePublicKey = data.public_key;
      if (safePublicKey.includes('"') || safePublicKey.includes("'")) {
         safePublicKey = safePublicKey.replace(/['"]/g, '');
      }

      // 2. Configuración ESTRICTA para el Widget de Wompi
      const checkoutData = {
        currency: data.currency,           
        amountInCents: parseInt(data.amount_in_cents), 
        reference: data.reference,         
        publicKey: safePublicKey,        
        signature: { integrity: data.signature }, 
        redirectUrl: window.location.origin, // Sin el slash final para mayor compatibilidad
      };

      // 🛡️ DEFENSA 3: Verificar que el script de index.html sí haya cargado
      if (!window.WidgetCheckout) {
         alert("❌ ERROR DE LIBRERÍA:\nEl script de Wompi no cargó. Verifica que pusiste la etiqueta <script> en tu index.html correctamente.");
         setLoading(false);
         return;
      }

      // 3. Invocar el Widget
      const checkout = new window.WidgetCheckout(checkoutData);

      checkout.open((result) => {
        const transaction = result.transaction;
        if (transaction.status === 'APPROVED') {
          toast.success("¡Pago aprobado! Activando tu cuenta...");
          if (onSuccess) onSuccess();
        } else {
          toast.warning(`Transacción no aprobada. Estado: ${transaction.status}`);
        }
      });

    } catch (error) {
      // 🛡️ DEFENSA 4: Extracción agresiva del error para móviles
      let errorMsg = "Error Desconocido";
      if (error.response) {
         errorMsg = error.response.data?.detail || JSON.stringify(error.response.data);
      } else if (error.message) {
         errorMsg = error.message;
      } else {
         try { errorMsg = JSON.stringify(error); } catch(e) {}
      }
      
      toast.error(`No se pudo iniciar el pago.`);
      // Este alert saltará en tu celular mostrándote LA VERDAD
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
