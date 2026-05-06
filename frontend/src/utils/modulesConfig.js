// ═══════════════════════════════════════════════════════════════════════════
// modulesConfig.js — VERSIÓN 2 (refactorizada)
//
// Antes: este archivo era la fuente de verdad de qué módulos existen.
// Ahora: solo es un DICCIONARIO de iconos y colores. La fuente de verdad
// son los módulos que vienen del backend en /users/me.
//
// ¿Por qué el cambio?
// Los iconos no se pueden serializar en BD, así que el frontend los aporta.
// Pero la LISTA de módulos viene del backend, así nunca se desincroniza.
//
// Si añades un módulo nuevo en BD:
//   - Solo añade aquí su entrada (path → icono + color)
//   - El sidebar lo mostrará automáticamente para usuarios con ese permiso
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import {
  ShoppingCart, ShoppingBag, People, Inventory, Layers,
  PointOfSale, PrecisionManufacturing, Assignment, Dashboard,
  AttachMoney, DirectionsRun, Assessment, ReceiptLong, HelpOutline
} from '@mui/icons-material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  TwoWheeler, Search, DirectionsCar, EventRepeat, Settings, QrCodeScanner
} from '@mui/icons-material';


// ─── DICCIONARIO de iconos y colores por frontend_path ────────────────────
// El backend dice "este módulo existe", aquí decimos "así se ve"
// ───────────────────────────────────────────────────────────────────────────
export const MODULE_ICONS = {
  // Ventas y comercial
  '/ventas':              { icon: <ShoppingCart />,           color: '#FF6020', label: 'Ventas (POS)' },
  '/cotizaciones':        { icon: <ReceiptLong />,            color: '#FF6020', label: 'Cotizaciones' },
  '/admin/resoluciones':  { icon: <Assignment />,             color: '#FF6020', label: 'Resoluciones DIAN' },
  '/compras':             { icon: <ShoppingBag />,            color: '#10B981', label: 'Compras y Gastos' },
  '/clientes':            { icon: <People />,                 color: '#3B82F6', label: 'Gestión de Terceros' },
  '/productos':           { icon: <Inventory />,              color: '#8B5CF6', label: 'Catálogo de Productos' },

  // Inventario
  '/inventario':          { icon: <Inventory2OutlinedIcon />, color: '#F59E0B', label: 'Control de Inventarios' },
  '/inventario/lotes':    { icon: <Layers />,                 color: '#8B5CF6', label: 'Lotes y Perecederos' },

  // Caja y producción
  '/caja':                { icon: <PointOfSale />,            color: '#FF6020', label: 'Corte de Caja' },
  '/produccion/lotes':    { icon: <PrecisionManufacturing />, color: '#06B6D4', label: 'Producción y Recetas' },
  '/produccion/recetas':  { icon: <PrecisionManufacturing />, color: '#06B6D4', label: 'Recetas' },
  '/ordenes-trabajo':     { icon: <Assignment />,             color: '#EC4899', label: 'Órdenes de Trabajo' },
  '/panel-operador':      { icon: <Dashboard />,              color: '#14B8A6', label: 'Panel de Operador' },

  // Préstamos / cobranza
  '/prestamos':           { icon: <AttachMoney />,            color: '#10B981', label: 'Préstamos' },
  '/ruta-cobro':          { icon: <DirectionsRun />,          color: '#3B82F6', label: 'Ruta de Cobro' },

  // Reportes
  '/reportes':            { icon: <Assessment />,             color: '#F43F5E', label: 'Reportes Financieros' },
  '/reportes-inventario': { icon: <Assessment />,             color: '#F43F5E', label: 'Reportes Inventario' },

  // Parqueadero
  '/parqueadero':                { icon: <TwoWheeler />,    color: '#3B82F6', label: 'Parqueadero' },
  '/parqueadero/buscar':         { icon: <Search />,        color: '#10B981', label: 'Buscar placa' },
  '/parqueadero/vehiculos':      { icon: <DirectionsCar />, color: '#8B5CF6', label: 'Vehículos' },
  '/parqueadero/suscripciones':  { icon: <EventRepeat />,   color: '#F59E0B', label: 'Suscripciones' },
  '/parqueadero/config':         { icon: <Settings />,      color: '#6B7280', label: 'Tarifas y cupo' },
};


// ─── HELPER — Obtener config de un módulo por path ────────────────────────
// Si el path no existe en el diccionario, devuelve un fallback decente
// (icono genérico + nombre del backend) para que NUNCA el sidebar falle.
// ───────────────────────────────────────────────────────────────────────────
export const getModuleConfig = (frontendPath, backendName = null) => {
  const config = MODULE_ICONS[frontendPath];
  if (config) return config;
  // Fallback: módulo desconocido en el frontend
  return {
    icon: <HelpOutline />,
    color: '#6B7280',
    label: backendName || frontendPath,
  };
};


// ─── Módulos exclusivos del SuperAdmin (siguen siendo hardcoded) ──────────
// Estos no vienen del backend porque son del propio sistema, no de roles
// ───────────────────────────────────────────────────────────────────────────
export const ADMIN_MODULES = [
  { path: '/admin/usuarios', label: 'Usuarios y Permisos', icon: null, color: '#a78bfa' }
];


// ─── COMPATIBILIDAD HACIA ATRÁS ────────────────────────────────────────────
// Si algún código viejo importa APP_MODULES, lo seguimos exportando.
// Pero MARCADO COMO DEPRECATED — no usar en código nuevo.
// ───────────────────────────────────────────────────────────────────────────
export const APP_MODULES = Object.entries(MODULE_ICONS).map(([path, config]) => ({
  path,
  label: config.label,
  text:  config.label,
  icon:  config.icon,
  color: config.color,
}));
