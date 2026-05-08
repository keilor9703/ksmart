import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import apiClient, { 
  fetchPlanesAdmin, 
  fetchDashboardStats, 
  fetchAuditLogs,
  impersonateCompany
} from '../api';

/**
 * Hook personalizado para centralizar la lógica de datos del Command Center SaaS.
 * Maneja el fetching de múltiples fuentes, filtrado, búsqueda y acciones administrativas.
 */
export const useSaaSData = () => {
  const [loading, setLoading] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [planesCatalog, setPlanesCatalog] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [stats, setStats] = useState({ 
    total_tenants: 0, 
    activos: 0, 
    premium: 0, 
    total_recaudado: 0, 
    total_usuarios: 0 
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Estados de filtrado y UI (compartidos pero lógicos)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');

  const fetchAnnouncements = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/superadmin/announcements');
      setAnnouncements(data);
    } catch (e) {
      console.error("Error cargando anuncios");
    }
  }, []);

  const fetchEmpresas = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/superadmin/empresas');
      setEmpresas(data);
    } catch (e) {
      toast.error('Error al cargar inquilinos');
    }
  }, []);

  const fetchCatalogoPlanes = useCallback(async () => {
    try {
      const { data } = await fetchPlanesAdmin();
      setPlanesCatalog(data);
    } catch (e) {
      console.error("Error cargando planes");
    }
  }, []);

  const fetchHistorialPagos = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/superadmin/historial-pagos');
      setPagos(data);
    } catch (e) {
      console.error("Error cargando historial de pagos");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await fetchDashboardStats();
      setStats(data);
    } catch (e) {
      console.error("Error cargando estadísticas");
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await fetchAuditLogs();
      setAuditLogs(data);
    } catch (e) {
      console.error("Error cargando logs de auditoría");
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchEmpresas(),
      fetchCatalogoPlanes(),
      fetchHistorialPagos(),
      fetchStats(),
      fetchLogs(),
      fetchAnnouncements()
    ]);
    setLoading(false);
  }, [fetchEmpresas, fetchCatalogoPlanes, fetchHistorialPagos, fetchStats, fetchLogs, fetchAnnouncements]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Acciones Administrativas
  const handleToggleStatus = async (id, is_active) => {
    const action = is_active ? 'suspender' : 'reactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${action} esta cuenta?`)) return false;
    
    try {
      await apiClient.patch(`/superadmin/empresas/${id}/toggle`);
      toast.success(`Cuenta ${is_active ? 'suspendida' : 'reactivada'}`);
      refreshAll();
      return true;
    } catch (err) {
      toast.error('Error al cambiar estado');
      return false;
    }
  };

  const handleToggleProtection = async (id) => {
    try {
      await apiClient.patch(`/superadmin/empresas/${id}/protection`);
      toast.success('Estado de protección actualizado');
      fetchEmpresas();
    } catch (err) {
      toast.error('Error al actualizar protección');
    }
  };

  const handleToggleAnnouncement = async (id) => {
    try {
      await apiClient.patch(`/superadmin/announcements/${id}/toggle`);
      fetchAnnouncements();
    } catch (err) {
      toast.error('Error al cambiar estado del anuncio');
    }
  };

  const handleImpersonate = async (empresaId) => {
    if (!window.confirm("¿Entrar al sistema como este cliente? Tu sesión de Admin se cerrará temporalmente.")) return;
    try {
      const { data } = await impersonateCompany(empresaId);
      localStorage.setItem('token', data.access_token);
      localStorage.removeItem('userModules'); 
      toast.success("Iniciando sesión de soporte...");
      setTimeout(() => { window.location.href = '/'; }, 1000);
    } catch (err) {
      toast.error("No se pudo iniciar la suplantación.");
    }
  };

  // Lógica de filtrado derivada (evita re-renders innecesarios por estado duplicado)
  const filteredEmpresas = empresas.filter(emp => {
    const matchBusqueda = emp.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (emp.nit && emp.nit.includes(searchTerm)) ||
                         emp.id.toString() === searchTerm;
    
    const dias = emp.dias_restantes;
    let matchFiltro = true;
    if (filterState === 'premium') matchFiltro = emp.plan_type === 'premium';
    if (filterState === 'trial') matchFiltro = emp.plan_type !== 'premium' && dias > 0;
    if (filterState === 'expired') matchFiltro = emp.plan_type !== 'premium' && dias <= 0;
    if (filterState === 'inactive') {
        if (!emp.last_activity_at) matchFiltro = true;
        else {
            const hours = (new Date() - new Date(emp.last_activity_at)) / (1000 * 60 * 60);
            matchFiltro = hours > 168; // +7 días
        }
    }
    return matchBusqueda && matchFiltro;
  });

  return {
    loading,
    empresas,
    filteredEmpresas,
    planesCatalog,
    pagos,
    stats,
    auditLogs,
    announcements,
    searchTerm,
    setSearchTerm,
    filterState,
    setFilterState,
    refreshAll,
    handleToggleStatus,
    handleToggleAnnouncement,
    handleToggleProtection,
    handleImpersonate,
    fetchEmpresas,
    fetchCatalogoPlanes,
    fetchAnnouncements
  };
};
