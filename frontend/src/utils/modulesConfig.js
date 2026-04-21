// src/utils/modulesConfig.js
import React from 'react';
import {
  ShoppingCart, ShoppingBag, People, Inventory, Layers,
  PointOfSale, PrecisionManufacturing, Assignment, Dashboard,
  AttachMoney, DirectionsRun, Assessment, ReceiptLong
} from '@mui/icons-material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

// PUNTO ÚNICO DE VERDAD PARA LOS MÓDULOS DEL SISTEMA
export const APP_MODULES = [
  { path: '/ventas',             label: 'Ventas (POS)',          icon: <ShoppingCart />,               color: '#FF6020' },
  { path: '/cotizaciones',       label: 'Cotizaciones',          icon: <ReceiptLong />,                color: '#FF6020' }, // 👈 NUEVO
  { path: '/admin/resoluciones', label: 'Resoluciones DIAN',     icon: <Assignment />,                 color: '#FF6020' }, // 👈 NUEVO
  { path: '/compras',            label: 'Compras y Gastos',      icon: <ShoppingBag />,                color: '#10B981' },
  { path: '/clientes',           label: 'Gestión de Terceros',   icon: <People />,                     color: '#3B82F6' },
  { path: '/productos',          label: 'Catálogo de Productos', icon: <Inventory />,                  color: '#8B5CF6' },
  { path: '/inventario',         label: 'Control de Inventarios',icon: <Inventory2OutlinedIcon />,     color: '#F59E0B' },
  { path: '/inventario/lotes',   label: 'Lotes y Perecederos',   icon: <Layers />,                     color: '#8B5CF6' },
  { path: '/caja',               label: 'Corte de Caja',         icon: <PointOfSale />,                color: '#FF6020' },
  { path: '/produccion/lotes',   label: 'Producción y Recetas',  icon: <PrecisionManufacturing />,     color: '#06B6D4' },
  { path: '/ordenes-trabajo',    label: 'Órdenes de Trabajo',    icon: <Assignment />,                 color: '#EC4899' },
  { path: '/panel-operador',     label: 'Panel de Operador',     icon: <Dashboard />,                  color: '#14B8A6' },
  { path: '/prestamos',          label: 'Préstamos',             icon: <AttachMoney />,                color: '#10B981' },
  { path: '/ruta-cobro',         label: 'Ruta de Cobro',         icon: <DirectionsRun />,              color: '#3B82F6' },
  { path: '/reportes',           label: 'Reportes Financieros',  icon: <Assessment />,                 color: '#F43F5E' }
];

// Módulos exclusivos del SuperAdmin
export const ADMIN_MODULES = [
  { path: '/admin/usuarios',     label: 'Usuarios y Permisos',   icon: null, color: '#a78bfa' }
];