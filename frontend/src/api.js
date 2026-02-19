import axios from 'axios';

//const apiClient = axios.create({
 // baseURL: `${window.location.protocol}////${window.location.hostname}:8000`,
  //headers: {
   // 'Content-Type': 'application/json',
 //},
//});

//  const apiClient = axios.create({
//     baseURL: 'https://peleteria-jeylor-app.onrender.com',     headers: {
//     'Content-Type': 'application/json',
//      },
//       });


const base = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: base,
  headers: { "Content-Type": "application/json" },
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
        throw error.response.data;
    }
};


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

export const deleteReceta = (id) =>
  apiClient.delete(`/produccion/recetas/${id}`);

export const fetchLotes = (params = {}) =>
  apiClient.get('/produccion/lotes/', { params });

export const createLote = (data) =>
  apiClient.post('/produccion/lotes/', data);

// export const confirmarLote = (id) =>
//   apiClient.post(`/produccion/lotes/${id}/confirmar`);

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


export default apiClient;
