import axios from 'axios';

// const apiClient = axios.create({
//   baseURL: `${window.location.protocol}////${window.location.hostname}:8000`,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// const apiClient = axios.create({
//   baseURL: 'https://peleteria-jeylor-app.onrender.com',    
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

const base = process.env.REACT_APP_API_URL || "https://api.ksmart360.com";

export const apiClient = axios.create({
  baseURL: base,
  headers: { "Content-Type": "application/json" },
  // Sin timeout, un request atascado (p.ej. la pila de red suspendida por el
  // sistema mientras la app estaba en background/bloqueada) se queda colgado
  // para siempre y ninguna pantalla puede recuperarse — ver interceptor de
  // 401 más abajo para el otro extremo del mismo problema.
  timeout: 20000,
});

// Interceptor para añadir el token de autenticación a las solicitudes
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuesta: ante un 401 de un endpoint no-auth (sesión
// expirada mientras había pantallas montadas), antes se "silenciaba" con una
// promesa que jamás se resolvía — para evitar que esos componentes mostraran
// su propio toast de error. Pero eso dejaba el loading de esa pantalla
// colgado para siempre, porque el await nunca terminaba. En la web esto se
// disimulaba porque el usuario podía hacer scroll-to-refresh y recargar toda
// la página; en la APK (WebView, sin ese gesto) el usuario quedaba atrapado
// sin ninguna forma de salir. Ahora se rechaza normalmente (cada componente
// sale de su loading vía catch/finally) y además se emite un evento global
// para que App.js redirija a /login de inmediato, sin depender de que cada
// pantalla individual maneje el error.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const status = error.response?.status;

    if (status === 401) {
      const esAuthEndpoint =
        url.includes('/users/me') || url.includes('/auth/token') || url.includes('/auth/pin');
      const esEndpointPublico =
        url.includes('/catalogo/') || url.includes('/planes-activos') || url.includes('/agendamiento/publico/');

      if (!esAuthEndpoint && !esEndpointPublico) {
        window.dispatchEvent(new CustomEvent('ksmart:sesion-expirada'));
      }
    }

    return Promise.reject(error);
  }
);

export const getProductoByBarcode = (barcode) => apiClient.get(`/productos/barcode/${barcode}`);

export const fetchMovimientosTemplate = () => apiClient.get('/inventario/movimientos/template', { responseType: 'blob' });

// --- API para Panel del Operador ---

export const getPanelOperadorPendientes = () => {
  return apiClient.get('/panel_operador/pendientes');
};

export const getPanelOperadorProductividad = (startDate, endDate) => {
  return apiClient.get('/panel_operador/productividad', {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });
};

export const getPanelOperadorHistorial = () => {
  return apiClient.get('/panel_operador/historial');
};

export const uploadFile = async (uploadType, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const config = {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    };

    try {
        const response = await apiClient.post(`/${uploadType}/upload`, formData, config);
        return response.data;
    } catch (error) {
        throw error?.response?.data ?? { message: 'Error de conexión al servidor' };
    }
};



// =========================
// API PRÉSTAMOS
// =========================
export const createPrestamo = (data) => apiClient.post('/prestamos/', data);
export const fetchPrestamos = () => apiClient.get('/prestamos/');


export const fetchCuotasPendientes = () => apiClient.get('/prestamos/cuotas-pendientes');
export const pagarCuotaPrestamo = (id) => apiClient.post(`/prestamos/cuotas/${id}/pagar`);

// Actualizar módulos permitidos para un cliente SaaS
export const updateModulosEmpresa = (id, modulos) => apiClient.patch(`/superadmin/empresas/${id}/modulos`, { modulos });

// Funciones para Ruta de Cobro
export const registrarPagoRuta = (id, data) => apiClient.post(`/prestamos/cuotas/${id}/pagar`, data);
export const reprogramarCuotaRuta = (id, data) => apiClient.post(`/prestamos/cuotas/${id}/reprogramar`, data);

export const impersonateCompany = (id) => apiClient.post(`/superadmin/impersonate/${id}`);

export const fetchMovements = (params = {}) =>
  apiClient.get('/inventario/movimientos', { params });

export const createMovement = (data) =>
  apiClient.post('/inventario/movimientos', data);

export const fetchLowStockAlerts = () =>
  apiClient.get('/inventario/alertas/bajo-stock');

export const updateProductoStockMinimo = (productoId, minimo) =>
  apiClient.patch(`/productos/${productoId}/stock-minimo`, { stock_minimo: minimo });

// --- API PRODUCCIÓN (VIALMAR) ---

export const fetchRecetas = (params = {}) =>
  apiClient.get('/produccion/recetas/', { params });

export const createReceta = (data) =>
  apiClient.post('/produccion/recetas/', data);

export const updateReceta = (id, data) =>
  apiClient.put(`/produccion/recetas/${id}`, data);

export const deleteReceta = (id) =>
  apiClient.delete(`/produccion/recetas/${id}`);

export const fetchLotes = (params = {}) =>
  apiClient.get('/produccion/lotes/', { params });

export const createLote = (data) =>
  apiClient.post('/produccion/lotes/', data);

export const confirmarLote = (id, payload) =>
  apiClient.post(`/produccion/lotes/${id}/confirmar`, payload);

export const cancelarLote = (id) =>
  apiClient.put(`/produccion/lotes/${id}/cancelar`);

// --- API COMPRAS (VIALMAR) ---

export const fetchCompras = (params = {}) =>
  apiClient.get('/compras/', { params });

export const createCompra = (data) =>
  apiClient.post('/compras/', data);

export const addPagoCompra = (data) =>
  apiClient.post('/compras/pagos/', data);

export const fetchProductTemplate = () =>
  apiClient.get('/productos/template', { responseType: 'blob' });

export const fetchTercerosTemplate = () =>
  apiClient.get('/clientes/template', { responseType: 'blob' });


// =========================
// API PLANES SAAS
// =========================
export const fetchPlanesAdmin = () => apiClient.get('/superadmin/planes');
export const createPlan = (data) => apiClient.post('/superadmin/planes', data);
export const updatePlan = (id, data) => apiClient.patch(`/superadmin/planes/${id}`, data);
export const fetchPlanesPublicos = () => apiClient.get('/planes-activos');

// ✅ NUEVOS ENDPOINTS SUPERADMIN FASE 1
export const fetchDashboardStats = () => apiClient.get('/superadmin/dashboard-stats');
export const fetchAuditLogs = (params = {}) => apiClient.get('/superadmin/audit-logs', { params });

// Configuración de módulos por tipo de negocio
export const fetchTiposNegocio = () => apiClient.get('/superadmin/tipos-negocio');
export const updateTipoNegocio = (tipo, data) => apiClient.put(`/superadmin/tipos-negocio/${tipo}`, data);

// =========================
// API AGENDAMIENTO DE CITAS
// =========================
export const fetchServiciosAgendables = (soloActivos = false) =>
  apiClient.get('/agendamiento/servicios', { params: { solo_activos: soloActivos } });
export const configurarServicioAgendable = (productoId, data) =>
  apiClient.put(`/agendamiento/servicios/${productoId}`, data);
export const fetchDisponibilidad = (productoId, fecha) =>
  apiClient.get('/agendamiento/disponibilidad', { params: { producto_id: productoId, fecha } });
export const fetchCitas = (params = {}) =>
  apiClient.get('/agendamiento/citas', { params });
export const fetchCita = (id) => apiClient.get(`/agendamiento/citas/${id}`);
export const createCita = (data) => apiClient.post('/agendamiento/citas', data);
export const updateCita = (id, data) => apiClient.put(`/agendamiento/citas/${id}`, data);
export const cambiarEstadoCita = (id, estado) =>
  apiClient.patch(`/agendamiento/citas/${id}/estado`, null, { params: { estado } });
export const deleteCita = (id) => apiClient.delete(`/agendamiento/citas/${id}`);

// Configuración de agendamiento
export const fetchAgendamientoConfig = () => apiClient.get('/agendamiento/config');
export const updateAgendamientoConfig = (data) => apiClient.put('/agendamiento/config', data);

// Portal público de agendamiento (sin login)
export const fetchAgendamientoPublico = (slug) =>
  apiClient.get(`/agendamiento/publico/${slug}`);
export const fetchDisponibilidadPublica = (slug, productoId, fecha) =>
  apiClient.get(`/agendamiento/publico/${slug}/disponibilidad`, { params: { producto_id: productoId, fecha } });
export const crearCitaPublica = (slug, data) =>
  apiClient.post(`/agendamiento/publico/${slug}/cita`, data);

// Preparar cobro de cita → garantiza el cliente y devuelve servicio + trabajador
// para redirigir a Ventas (POS), donde se registra la venta.
export const prepararCobroCita = (citaId) =>
  apiClient.post(`/agendamiento/citas/${citaId}/preparar-cobro`);

export default apiClient;