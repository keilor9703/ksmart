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

  PointOfSale,TwoWheeler,DirectionsRun

} from '@mui/icons-material';
// Importaciones individuales (Best Practice para evitar lentitud de compilación)
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import RequestQuote from '@mui/icons-material/RequestQuote';
import Gavel from '@mui/icons-material/Gavel';
import LocalMall from '@mui/icons-material/LocalMall';
import Groups from '@mui/icons-material/Groups';
import Category from '@mui/icons-material/Category';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import Layers from '@mui/icons-material/Layers';
import AccountBalanceWallet from '@mui/icons-material/AccountBalanceWallet';
import PrecisionManufacturing from '@mui/icons-material/PrecisionManufacturing';
import MenuBook from '@mui/icons-material/MenuBook';
import Build from '@mui/icons-material/Build';
import Dvr from '@mui/icons-material/Dvr';
import MonetizationOn from '@mui/icons-material/MonetizationOn';
import Map from '@mui/icons-material/Map';
import QueryStats from '@mui/icons-material/QueryStats';
import BarChart from '@mui/icons-material/BarChart';
import LocalParking from '@mui/icons-material/LocalParking';
import ManageSearch from '@mui/icons-material/ManageSearch';
import Commute from '@mui/icons-material/Commute';
import DirectionsCar from '@mui/icons-material/DirectionsCar';
import LocalCarWash from '@mui/icons-material/LocalCarWash';

import Autorenew from '@mui/icons-material/Autorenew';
import SettingsSuggest from '@mui/icons-material/SettingsSuggest';
import HelpOutline from '@mui/icons-material/HelpOutline';


// ─── DICCIONARIO de iconos y colores por frontend_path ────────────────────
// He diversificado los colores e iconos para que no se repitan y sea más fácil
// identificar cada módulo visualmente de un vistazo rápido.
// ───────────────────────────────────────────────────────────────────────────
export const MODULE_ICONS = {
  // Ventas y comercial (Tonos Naranjas y Ámbar)
  '/ventas':              { icon: <ShoppingCart />,           color: '#FF6020', label: 'Ventas (POS)' },
  '/cotizaciones':        { icon: <RequestQuote />,           color: '#E65100', label: 'Cotizaciones' },
  '/admin/resoluciones':  { icon: <Gavel />,                  color: '#FFB300', label: 'Resoluciones DIAN' },
  
  // Compras y Terceros (Tonos Verdes y Azules)
  '/compras':             { icon: <LocalMall />,              color: '#10B981', label: 'Compras y Gastos' },
  '/clientes':            { icon: <Groups />,                 color: '#3B82F6', label: 'Gestión de Terceros' },
  
  // Productos e Inventario (Tonos Morados y Amarillos)
  '/productos':           { icon: <Category />,               color: '#673AB7', label: 'Catálogo de Productos' },
  '/inventario':          { icon: <Inventory2OutlinedIcon />, color: '#F59E0B', label: 'Control de Inventarios' },
  '/inventario/lotes':    { icon: <Layers />,                 color: '#8B5CF6', label: 'Lotes y Perecederos' },

  // Finanzas y Operaciones (Tonos Rosados y Turquesas)
  '/caja':                { icon: <PointOfSale />,   color: '#E91E63', label: 'Corte de Caja' },
  '/produccion/lotes':    { icon: <PrecisionManufacturing />, color: '#06B6D4', label: 'Producción de Lotes' },
  '/produccion/recetas':  { icon: <MenuBook />,               color: '#3F51B5', label: 'Recetas' },
  '/ordenes-trabajo':     { icon: <Build />,                  color: '#EC4899', label: 'Órdenes de Trabajo' },
  '/panel-operador':      { icon: <Dvr />,                    color: '#14B8A6', label: 'Panel de Operador' },

  // Préstamos / cobranza (Tonos Verdes Lima y Azules Claros)
  '/prestamos':           { icon: <MonetizationOn />,         color: '#8BC34A', label: 'Préstamos' },
  '/ruta-cobro':          { icon: <DirectionsRun />,                    color: '#03A9F4', label: 'Ruta de Cobro' },

  // Reportes (Tonos Rojos y Marrones)
  '/reportes':            { icon: <QueryStats />,             color: '#F43F5E', label: 'Reportes Financieros' },
  '/reportes-inventario': { icon: <BarChart />,               color: '#795548', label: 'Reportes Inventario' },

  // Parqueadero (Paleta de grises y colores vibrantes específicos)
  '/parqueadero':                { icon: <LocalParking />,    color: '#3B82F6', label: 'Parqueadero' },
  '/parqueadero/buscar':         { icon: <ManageSearch />,    color: '#CDDC39', label: 'Buscar placa' },
  '/parqueadero/vehiculos':      { icon: <TwoWheeler />,      color: '#9C27B0', label: 'Vehículos' },
  '/parqueadero/suscripciones':  { icon: <Autorenew />,       color: '#FF4081', label: 'Suscripciones' },
  '/parqueadero/config':         { icon: <SettingsSuggest />, color: '#6B7280', label: 'Tarifas y cupo' },

  // Lavadero
  '/lavadero/ventas':   { icon: <LocalCarWash />,  color: '#0EA5E9', label: 'POS Lavadero' },
  '/lavadero/reporte':  { icon: <DirectionsCar />, color: '#0284C7', label: 'Reporte por trabajador' },
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
