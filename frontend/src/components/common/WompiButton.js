import React, { useState } from 'react';
import { Button, CircularProgress, Box, TextField, Typography, InputAdornment } from '@mui/material';
import { Payments, LocalOffer, CheckCircle, Close } from '@mui/icons-material';
import { apiClient } from '../../api';
import { toast } from 'react-toastify';

const fmtCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;

const WompiButton = ({ planName, onSuccess, enablePromo = true }) => {
  const [loading, setLoading] = useState(false);
  // Código promocional
  const [codigo, setCodigo]       = useState('');
  const [validando, setValidando] = useState(false);
  const [promo, setPromo]         = useState(null);  // { codigo, descuento, precio_final }

  const aplicarCodigo = async () => {
    const code = codigo.trim();
    if (!code) return;
    setValidando(true);
    try {
      const { data } = await apiClient.post('/promociones/validar', {
        codigo: code, plan_name: planName,
      });
      if (!data.valido) {
        toast.error(data.motivo || 'Código no válido.');
        setPromo(null);
        return;
      }
      setPromo(data);
      toast.success(`Código aplicado: ${fmtCOP(data.descuento)} de descuento.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo validar el código.');
      setPromo(null);
    } finally {
      setValidando(false);
    }
  };

  const quitarCodigo = () => { setPromo(null); setCodigo(''); };

  // Un código del 100% deja el total en $0 y Wompi rechaza cobrar cero
  // ("El monto debe ser un número entero mayor a 0"): en ese caso la
  // suscripción se activa directo en el backend, sin abrir la pasarela.
  const esGratis = !!promo && Number(promo.precio_final) <= 0;

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (esGratis) {
        await apiClient.post('/wompi/canjear-gratis', {
          plan_name: planName,
          codigo_promo: promo.codigo,
        });
        toast.success('¡Suscripción activada con tu código promocional!');
        if (onSuccess) await onSuccess();
        return;
      }

      // 1. Obtener hash de integridad y datos del plan desde el backend
      const { data } = await apiClient.post('/wompi/generar-hash', {
        plan_name: planName,
        codigo_promo: promo ? promo.codigo : undefined,
      });

      if (data.public_key === "pub_test_...") {
        alert("❌ ERROR DE ENTORNO:\nEl backend sigue enviando la llave de prueba falsa ('pub_test_...').\n\nVe a Render, asegúrate de que WOMPI_PUBLIC_KEY esté bien escrita y reinicia el servidor manualmente.");
        setLoading(false);
        return;
      }

      let safePublicKey = data.public_key.replace(/['"]/g, '');

      // 2. Configuración del widget — SIN redirectUrl para evitar recarga de página.
      const checkoutData = {
        currency: data.currency,
        amountInCents: parseInt(data.amount_in_cents),
        reference: data.reference,
        publicKey: safePublicKey,
        signature: { integrity: data.signature },
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
            // 4. Enviar SOLO el ID al backend. El backend verifica todo lo demás
            //    directamente con la API de Wompi (no confiamos en datos del cliente).
            await apiClient.post('/wompi/confirmar-pago-widget', {
              wompi_id: transaction.id,
            });
            toast.success("¡Suscripción activada! Bienvenido.");
          } catch (activationErr) {
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
      toast.error(errorMsg || "No se pudo iniciar el pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Código promocional */}
      {enablePromo && (
        <Box sx={{ mb: 1.5 }}>
          {promo ? (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 1, p: 1.2, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.35)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                <CheckCircle sx={{ fontSize: 18, color: '#10B981' }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#10B981' }} noWrap>
                    {promo.codigo} aplicado
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                    −{fmtCOP(promo.descuento)} · Total: {fmtCOP(promo.precio_final)}
                  </Typography>
                </Box>
              </Box>
              <Button size="small" onClick={quitarCodigo} startIcon={<Close sx={{ fontSize: 15 }} />}
                sx={{ color: 'text.secondary', minWidth: 0, fontSize: 11.5 }}>
                Quitar
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small" fullWidth placeholder="Código promocional"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') aplicarCodigo(); }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LocalOffer sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                }}
              />
              <Button variant="outlined" onClick={aplicarCodigo}
                disabled={validando || !codigo.trim()}
                sx={{ flexShrink: 0, borderRadius: 2 }}>
                {validando ? <CircularProgress size={16} /> : 'Aplicar'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      <Button
        variant="contained"
        fullWidth
        onClick={handlePayment}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : (esGratis ? <CheckCircle /> : <Payments />)}
        sx={{
          bgcolor: esGratis ? '#10B981' : '#F43F5E',
          borderRadius: 3,
          py: 1.8,
          fontWeight: 800,
          fontSize: '0.95rem',
          boxShadow: esGratis ? '0 4px 14px rgba(16,185,129,0.4)' : '0 4px 14px rgba(244, 63, 94, 0.4)',
          '&:hover': esGratis
            ? { bgcolor: '#059669', boxShadow: '0 6px 20px rgba(16,185,129,0.6)' }
            : { bgcolor: '#E11D48', boxShadow: '0 6px 20px rgba(244, 63, 94, 0.6)' },
          textTransform: 'none'
        }}
      >
        {loading
          ? (esGratis ? 'Activando…' : 'Conectando...')
          : (esGratis ? 'Activar suscripción · $0' : 'Pagar con Wompi / Nequi')}
      </Button>
    </Box>
  );
};

export default WompiButton;
