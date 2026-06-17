import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, Box, Typography, Button, IconButton,
  TextField, Divider, Collapse, InputAdornment, ToggleButtonGroup,
  ToggleButton, Chip, Stack, Paper, useTheme
} from '@mui/material';
import {
  Close, Print, WhatsApp, ExpandMore, ExpandLess,
  Receipt, CheckCircleOutline, Store
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';

// ─── Paper size definitions ────────────────────────────────────────────────────
const SIZES = {
  a4:  { id: 'a4',  label: 'A4',    cssSize: 'A4',       margin: '15mm', compact: false, previewWidth: '100%' },
  p80: { id: 'p80', label: '80 mm', cssSize: '80mm auto', margin: '4mm',  compact: true,  previewWidth: 290 },
  p58: { id: 'p58', label: '58 mm', cssSize: '58mm auto', margin: '2mm',  compact: true,  previewWidth: 210 },
};

// ─── Format text for WhatsApp ─────────────────────────────────────────────────
function buildWhatsAppText(venta, empresa, vendedor) {
  const fecha = new Date(venta.fecha + (venta.fecha?.includes('Z') ? '' : 'Z'));
  const dateStr = fecha.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const sep = '─────────────────────';
  let t = '';
  t += `*${empresa?.nombre || 'Mi Negocio'}*\n`;
  if (empresa?.nit) t += `NIT: ${empresa.nit}\n`;
  t += `\n*COMPROBANTE DE VENTA #${venta.id}*\n`;
  t += `📅 ${dateStr}\n`;
  if (venta.cliente?.nombre) t += `👤 Cliente: ${venta.cliente.nombre}\n`;
  if (vendedor) t += `🧑‍💼 Vendedor: ${vendedor}\n`;
  t += `\n${sep}\n`;
  (venta.detalles || []).forEach(d => {
    const nombre = d.producto?.nombre || `Producto #${d.producto_id}`;
    const precio = d.precio_unitario || 0;
    t += `▸ ${nombre}\n`;
    t += `  ${d.cantidad} × ${formatCurrency(precio)} = *${formatCurrency(d.cantidad * precio)}*\n`;
  });
  t += `${sep}\n`;
  if (venta.iva_porcentaje > 0)
    t += `IVA (${venta.iva_porcentaje}%): ${formatCurrency(venta.iva_total || 0)}\n`;
  t += `*TOTAL: ${formatCurrency(venta.total)}*\n`;
  t += `Método de pago: ${venta.metodo_pago || 'Efectivo'}\n`;
  const saldo = (venta.total || 0) - (venta.monto_pagado || venta.total || 0);
  if (saldo > 0) t += `⚠️ Saldo pendiente: ${formatCurrency(saldo)}\n`;
  t += `\n_¡Gracias por su compra!_ 🙏\n`;
  if (empresa?.whatsapp_pedidos)
    t += `\n📞 wa.me/${empresa.whatsapp_pedidos.replace(/\D/g, '')}`;
  return t;
}

// ─── Generate full HTML for print/PDF ────────────────────────────────────────
function buildPrintHTML(venta, empresa, vendedor, size) {
  const fecha = new Date(venta.fecha + (venta.fecha?.includes('Z') ? '' : 'Z'));
  const dateStr = fecha.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const saldo = (venta.total || 0) - (venta.monto_pagado || venta.total || 0);
  const { compact, cssSize, margin } = size;
  const fontFamily = compact ? "'Courier New', Courier, monospace" : "Arial, Helvetica, sans-serif";

  const itemsHtml = (venta.detalles || []).map(d => {
    const nombre = d.producto?.nombre || `Prod. #${d.producto_id}`;
    const precio = d.precio_unitario || 0;
    const sub    = d.cantidad * precio;
    const desc   = d.descuento_pct || 0;
    if (compact) {
      return `
        <tr><td colspan="3" style="padding:2px 0;font-weight:700;">${nombre}${desc > 0 ? ` (-${desc}%)` : ''}</td></tr>
        <tr>
          <td style="padding:0 0 5px;">${d.cantidad}</td>
          <td style="text-align:right;padding:0 0 5px;">${formatCurrency(precio)}</td>
          <td style="text-align:right;padding:0 0 5px;font-weight:700;">${formatCurrency(sub)}</td>
        </tr>`;
    }
    return `
      <tr>
        <td style="padding:7px 6px;border-bottom:1px solid #f0f0f0;">
          ${nombre}${desc > 0 ? `<br><small style="color:#888">Desc. ${desc}%</small>` : ''}
        </td>
        <td style="padding:7px 6px;text-align:right;border-bottom:1px solid #f0f0f0;">${d.cantidad}</td>
        <td style="padding:7px 6px;text-align:right;border-bottom:1px solid #f0f0f0;">${formatCurrency(precio)}</td>
        <td style="padding:7px 6px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:700;">${formatCurrency(sub)}</td>
      </tr>`;
  }).join('');

  if (compact) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page { size: ${cssSize}; margin: ${margin}; }
*{box-sizing:border-box;}
body{font-family:${fontFamily};font-size:12px;color:#000;margin:0;padding:0;}
.c{text-align:center;}.r{text-align:right;}.b{font-weight:700;}
.big{font-size:15px;}.sep{border:none;border-top:1px dashed #000;margin:5px 0;}
table{width:100%;border-collapse:collapse;}
</style></head><body>
<div class="c b big">${empresa?.nombre || 'Mi Negocio'}</div>
${empresa?.nit ? `<div class="c">NIT: ${empresa.nit}</div>` : ''}
<br>
<div class="c b">** COMPROBANTE DE VENTA **</div>
<div class="c">No. ${venta.id} — ${dateStr}</div>
<hr class="sep">
${venta.cliente?.nombre ? `<div>Cliente: ${venta.cliente.nombre}</div>` : '<div>Cliente: Consumidor Final</div>'}
${venta.cliente?.cedula ? `<div>NIT/CC: ${venta.cliente.cedula}</div>` : ''}
${vendedor ? `<div>Vendedor: ${vendedor}</div>` : ''}
<hr class="sep">
<table>
  <tr><td class="b">PRODUCTO</td><td class="r b">CANT</td><td class="r b">TOTAL</td></tr>
  <tr><td colspan="3"><hr class="sep"></td></tr>
  ${itemsHtml}
  <tr><td colspan="3"><hr class="sep"></td></tr>
  ${venta.iva_porcentaje > 0 ? `<tr><td>IVA ${venta.iva_porcentaje}%</td><td></td><td class="r">${formatCurrency(venta.iva_total || 0)}</td></tr>` : ''}
  <tr><td class="b big">TOTAL</td><td></td><td class="r b big">${formatCurrency(venta.total)}</td></tr>
  <tr><td colspan="3"><hr class="sep"></td></tr>
  <tr><td>Forma de pago</td><td></td><td class="r">${venta.metodo_pago || 'Efectivo'}</td></tr>
  ${saldo > 0 ? `<tr><td class="b">Saldo pendiente</td><td></td><td class="r b">${formatCurrency(saldo)}</td></tr>` : ''}
</table>
<hr class="sep">
${venta.cufe && venta.estado_electronico === 'exitoso' ? `
<hr class="sep">
${empresa?.matias_test_mode ? '<div class="c" style="color:#b45309;font-size:9px;font-weight:700;">⚠ AMBIENTE DE PRUEBAS — No válido ante la DIAN</div>' : '<div class="c" style="color:#16a34a;font-size:9px;font-weight:700;">✓ FACTURA ELECTRÓNICA — Registrada ante la DIAN</div>'}
${venta.numero_factura ? `<div class="c" style="font-size:10px;">Factura N°: ${venta.numero_factura}</div>` : ''}
<div style="font-size:8px;word-break:break-all;">CUFE: ${venta.cufe}</div>
<hr class="sep">` : ''}
<div class="c">¡Gracias por su compra!</div>
${empresa?.whatsapp_pedidos ? `<div class="c">WhatsApp: ${empresa.whatsapp_pedidos}</div>` : ''}
<br>
<div class="c" style="font-size:10px;color:#666;">Comprobante de venta — No es factura fiscal</div>
</body></html>`;
  }

  // A4 format
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page{size:${cssSize};margin:${margin};}
*{box-sizing:border-box;}
body{font-family:${fontFamily};font-size:13px;color:#333;margin:0;padding:24px;}
.header{text-align:center;padding-bottom:16px;border-bottom:2px solid #eee;margin-bottom:20px;}
.co-name{font-size:22px;font-weight:700;color:#111;margin:0 0 4px;}
.nit{font-size:12px;color:#777;}
.doc-title{font-size:14px;font-weight:700;color:#555;margin:10px 0 4px;letter-spacing:1px;text-transform:uppercase;}
.doc-num{font-size:13px;color:#777;}
.info-grid{display:flex;justify-content:space-between;background:#f8f8f8;border-radius:8px;padding:12px 16px;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
th{padding:8px 6px;border-bottom:2px solid #eee;text-align:left;font-size:11px;text-transform:uppercase;color:#999;letter-spacing:0.5px;}
th.r,td.r{text-align:right;}
td{padding:8px 6px;border-bottom:1px solid #f2f2f2;font-size:13px;}
.totals{max-width:260px;margin-left:auto;}
.trow{display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;}
.grand{font-size:20px;font-weight:700;color:#FF6020;}
.footer{text-align:center;margin-top:24px;padding-top:16px;border-top:1px dashed #ddd;color:#999;font-size:11px;}
.badge{display:inline-block;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;}
</style></head><body>
<div class="header">
  ${empresa?.logo_base64 ? `<img src="${empresa.logo_base64}" style="height:52px;margin-bottom:10px;display:block;margin:0 auto 10px;">` : `<div style="width:52px;height:52px;border-radius:12px;background:#FF602018;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:22px;">🏪</div>`}
  <div class="co-name">${empresa?.nombre || 'Mi Negocio'}</div>
  ${empresa?.nit ? `<div class="nit">NIT: ${empresa.nit}</div>` : ''}
  <div class="doc-title">Comprobante de Venta</div>
  <div class="doc-num">No. ${venta.id} &nbsp;·&nbsp; ${dateStr}</div>
</div>

<div class="info-grid">
  <div>
    <div style="font-size:11px;color:#999;text-transform:uppercase;margin-bottom:3px;">Cliente</div>
    <div style="font-weight:700;">${venta.cliente?.nombre || 'Consumidor Final'}</div>
    ${venta.cliente?.cedula ? `<div style="font-size:12px;color:#777;">NIT/CC: ${venta.cliente.cedula}</div>` : ''}
    ${venta.cliente?.telefono ? `<div style="font-size:12px;color:#777;">Tel: ${venta.cliente.telefono}</div>` : ''}
  </div>
  <div style="text-align:right;">
    <div style="font-size:11px;color:#999;text-transform:uppercase;margin-bottom:3px;">Vendedor</div>
    <div style="font-weight:700;">${vendedor || '—'}</div>
    <div style="margin-top:6px;"><span class="badge">${venta.estado_pago === 'pagado' ? '✓ Pagada' : '⏳ Pendiente'}</span></div>
  </div>
</div>

<table>
  <thead><tr>
    <th>Producto</th>
    <th class="r">Cant.</th>
    <th class="r">Precio unit.</th>
    <th class="r">Subtotal</th>
  </tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>

<div class="totals">
  ${venta.iva_porcentaje > 0 ? `<div class="trow"><span style="color:#777">IVA incluido (${venta.iva_porcentaje}%)</span><span style="color:#777">${formatCurrency(venta.iva_total || 0)}</span></div>` : ''}
  <div class="trow grand"><span>TOTAL</span><span>${formatCurrency(venta.total)}</span></div>
  <div class="trow"><span style="color:#777">Pagado · ${venta.metodo_pago || 'Efectivo'}</span><span style="color:#16a34a;font-weight:700;">${formatCurrency(venta.monto_pagado || venta.total)}</span></div>
  ${saldo > 0 ? `<div class="trow"><span style="color:#dc2626;font-weight:700;">Saldo pendiente</span><span style="color:#dc2626;font-weight:700;">${formatCurrency(saldo)}</span></div>` : ''}
</div>

<div class="footer">
  <div style="font-size:14px;margin-bottom:4px;">¡Gracias por su compra! 🙏</div>
  ${empresa?.whatsapp_pedidos ? `<div>📞 WhatsApp: ${empresa.whatsapp_pedidos}</div>` : ''}
  ${venta.cufe && venta.estado_electronico === 'exitoso'
  ? (empresa?.matias_test_mode
      ? `<div style="margin-top:8px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;font-size:11px;color:#92400e;"><strong>⚠ Ambiente de pruebas</strong><br>Esta factura electrónica fue generada en modo sandbox. No está registrada ante la DIAN.<br>${venta.numero_factura ? `Factura N°: <strong>${venta.numero_factura}</strong><br>` : ''}CUFE: <span style="font-size:9px;word-break:break-all;">${venta.cufe}</span></div>`
      : `<div style="margin-top:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:8px;font-size:11px;color:#166534;"><strong>✓ Factura Electrónica registrada ante la DIAN</strong><br>${venta.numero_factura ? `Factura N°: <strong>${venta.numero_factura}</strong><br>` : ''}CUFE: <span style="font-size:9px;word-break:break-all;">${venta.cufe}</span>${venta.pdf_url ? `<br><a href="${venta.pdf_url}" style="color:#15803d;">Ver factura PDF →</a>` : ''}</div>`)
  : `<div style="margin-top:8px;">Este documento es un comprobante de venta · No es factura con validez fiscal DIAN</div>`
}
</div>
</body></html>`;
}

// ─── Thermal preview (JSX) ────────────────────────────────────────────────────
const ThermalPreview = ({ venta, empresa, vendedor, dateStr, saldo }) => {
  const sep = <Box sx={{ borderTop: '1px dashed #555', my: 0.8 }} />;
  return (
    <Box sx={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 12, color: '#111', lineHeight: 1.6 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 900, fontSize: 15, fontFamily: 'inherit' }}>{empresa?.nombre || 'Mi Negocio'}</Typography>
        {empresa?.nit && <Typography sx={{ fontSize: 11, fontFamily: 'inherit' }}>NIT: {empresa.nit}</Typography>}
      </Box>
      <Box sx={{ my: 1, textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 700, fontFamily: 'inherit' }}>** COMPROBANTE DE VENTA **</Typography>
        <Typography sx={{ fontSize: 11, fontFamily: 'inherit' }}>No. {venta.id} — {dateStr}</Typography>
      </Box>
      {sep}
      <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>Cliente: {venta.cliente?.nombre || 'Consumidor Final'}</Typography>
      {venta.cliente?.cedula && <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>NIT/CC: {venta.cliente.cedula}</Typography>}
      {vendedor && <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>Vendedor: {vendedor}</Typography>}
      {sep}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: 11 }}>PRODUCTO</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: 11 }}>CANT</Typography>
          <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: 11 }}>TOTAL</Typography>
        </Box>
      </Box>
      {sep}
      {(venta.detalles || []).map((d, i) => {
        const nombre = d.producto?.nombre || `Prod #${d.producto_id}`;
        const sub    = (d.cantidad) * (d.precio_unitario || 0);
        return (
          <Box key={i}>
            <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nombre}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>  {formatCurrency(d.precio_unitario || 0)}</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>{d.cantidad}</Typography>
                <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: 11 }}>{formatCurrency(sub)}</Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
      {sep}
      {venta.iva_porcentaje > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>IVA {venta.iva_porcentaje}%</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>{formatCurrency(venta.iva_total || 0)}</Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 14, fontFamily: 'inherit' }}>TOTAL</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: 14, fontFamily: 'inherit' }}>{formatCurrency(venta.total)}</Typography>
      </Box>
      {sep}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>Forma de pago</Typography>
        <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>{venta.metodo_pago || 'Efectivo'}</Typography>
      </Box>
      {saldo > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700, color: '#dc2626', fontFamily: 'inherit', fontSize: 11 }}>Saldo pendiente</Typography>
          <Typography sx={{ fontWeight: 700, color: '#dc2626', fontFamily: 'inherit', fontSize: 11 }}>{formatCurrency(saldo)}</Typography>
        </Box>
      )}
      {sep}
      <Box sx={{ textAlign: 'center', mt: 0.5 }}>
        <Typography sx={{ fontFamily: 'inherit', fontSize: 11 }}>¡Gracias por su compra!</Typography>
        {empresa?.whatsapp_pedidos && (
          <Typography sx={{ fontFamily: 'inherit', fontSize: 10 }}>WhatsApp: {empresa.whatsapp_pedidos}</Typography>
        )}
        {venta.cufe && venta.estado_electronico === 'exitoso' ? (
          <Box sx={{ mt: 0.5, border: '1px dashed', borderColor: empresa?.matias_test_mode ? '#d97706' : '#16a34a', borderRadius: 1, p: 0.5 }}>
            <Typography sx={{ fontFamily: 'inherit', fontSize: 9, fontWeight: 700, color: empresa?.matias_test_mode ? '#92400e' : '#15803d', textAlign: 'center' }}>
              {empresa?.matias_test_mode ? '⚠ PRUEBAS — No válido ante la DIAN' : '✓ FACTURA ELECTRÓNICA DIAN'}
            </Typography>
            {venta.numero_factura && <Typography sx={{ fontFamily: 'inherit', fontSize: 9, textAlign: 'center' }}>N°: {venta.numero_factura}</Typography>}
            <Typography sx={{ fontFamily: 'inherit', fontSize: 8, color: '#666', wordBreak: 'break-all' }}>CUFE: {venta.cufe?.substring(0,40)}...</Typography>
          </Box>
        ) : (
          <Typography sx={{ fontFamily: 'inherit', fontSize: 9, color: '#888', mt: 0.5 }}>Comprobante de venta · No es factura DIAN</Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── A4 preview (JSX) ────────────────────────────────────────────────────────
const A4Preview = ({ venta, empresa, vendedor, dateStr, saldo }) => {
  const ACCENT = '#FF6020';
  return (
    <Box sx={{ fontFamily: 'sans-serif', color: '#333' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', pb: 2, mb: 2, borderBottom: '2px solid #eee' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1 }}>
          <Store sx={{ color: ACCENT, fontSize: 22 }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#111', lineHeight: 1.1 }}>{empresa?.nombre || 'Mi Negocio'}</Typography>
        {empresa?.nit && <Typography sx={{ fontSize: 11, color: '#888' }}>NIT: {empresa.nit}</Typography>}
        <Typography sx={{ fontWeight: 700, fontSize: 11, color: '#777', letterSpacing: 1, textTransform: 'uppercase', mt: 1 }}>Comprobante de Venta</Typography>
        <Typography sx={{ fontSize: 12, color: '#999' }}>No. {venta.id} · {dateStr}</Typography>
      </Box>

      {/* Cliente / Vendedor */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f8f8f8', borderRadius: 2, p: 1.5, mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 10, color: '#999', textTransform: 'uppercase', mb: 0.3 }}>Cliente</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{venta.cliente?.nombre || 'Consumidor Final'}</Typography>
          {venta.cliente?.cedula && <Typography sx={{ fontSize: 11, color: '#777' }}>NIT/CC: {venta.cliente.cedula}</Typography>}
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 10, color: '#999', textTransform: 'uppercase', mb: 0.3 }}>Vendedor</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{vendedor || '—'}</Typography>
          <Chip label={venta.estado_pago === 'pagado' ? 'Pagada' : 'Pendiente'}
            size="small" color={venta.estado_pago === 'pagado' ? 'success' : 'warning'}
            sx={{ fontSize: 10, height: 18, mt: 0.5 }} />
        </Box>
      </Box>

      {/* Items */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 0.5, pb: 0.5, borderBottom: '1.5px solid #eee', mb: 0.5 }}>
          {['Producto', 'Cant.', 'Precio unit.', 'Subtotal'].map((h, i) => (
            <Typography key={h} sx={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i > 0 ? 'right' : 'left' }}>{h}</Typography>
          ))}
        </Box>
        {(venta.detalles || []).map((d, i) => {
          const nombre = d.producto?.nombre || `Producto #${d.producto_id}`;
          const sub    = (d.cantidad) * (d.precio_unitario || 0);
          return (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 0.5, py: 0.8, borderBottom: '1px solid #f4f4f4' }}>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{nombre}</Typography>
                {(d.descuento_pct || 0) > 0 && <Typography sx={{ fontSize: 10, color: '#16a34a' }}>Desc. {d.descuento_pct}%</Typography>}
              </Box>
              <Typography sx={{ fontSize: 12, textAlign: 'right', color: '#555' }}>{d.cantidad}</Typography>
              <Typography sx={{ fontSize: 12, textAlign: 'right', color: '#555' }}>{formatCurrency(d.precio_unitario || 0)}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{formatCurrency(sub)}</Typography>
            </Box>
          );
        })}
      </Box>

      {/* Totals */}
      <Box sx={{ ml: 'auto', maxWidth: 240 }}>
        {venta.iva_porcentaje > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: '#777' }}>IVA incluido ({venta.iva_porcentaje}%)</Typography>
            <Typography sx={{ fontSize: 12, color: '#777' }}>{formatCurrency(venta.iva_total || 0)}</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: ACCENT }}>TOTAL</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: ACCENT }}>{formatCurrency(venta.total)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
          <Typography sx={{ fontSize: 11, color: '#777' }}>Pagado · {venta.metodo_pago || 'Efectivo'}</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>{formatCurrency(venta.monto_pagado || venta.total)}</Typography>
        </Box>
        {saldo > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Saldo pendiente</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(saldo)}</Typography>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', mt: 3, pt: 2, borderTop: '1px dashed #ddd', color: '#aaa' }}>
        <Typography sx={{ fontSize: 13, mb: 0.3 }}>¡Gracias por su compra! 🙏</Typography>
        {empresa?.whatsapp_pedidos && (
          <Typography sx={{ fontSize: 11 }}>📞 WhatsApp: {empresa.whatsapp_pedidos}</Typography>
        )}
        {venta.cufe && venta.estado_electronico === 'exitoso' ? (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: empresa?.matias_test_mode ? '#fffbeb' : '#f0fdf4', border: '1px solid', borderColor: empresa?.matias_test_mode ? '#fcd34d' : '#86efac' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: empresa?.matias_test_mode ? '#92400e' : '#166534' }}>
              {empresa?.matias_test_mode ? '⚠ Ambiente de pruebas — No registrada ante la DIAN' : '✓ Factura Electrónica registrada ante la DIAN'}
            </Typography>
            {venta.numero_factura && <Typography sx={{ fontSize: 11, color: empresa?.matias_test_mode ? '#b45309' : '#15803d' }}>Factura N°: <strong>{venta.numero_factura}</strong></Typography>}
            <Typography sx={{ fontSize: 9, color: '#666', wordBreak: 'break-all', mt: 0.5 }}>CUFE: {venta.cufe}</Typography>
            {!empresa?.matias_test_mode && venta.pdf_url && (
              <Typography component="a" href={venta.pdf_url} target="_blank" sx={{ fontSize: 10, color: '#15803d', display: 'block', mt: 0.5 }}>Ver factura electrónica PDF →</Typography>
            )}
          </Box>
        ) : (
          <Typography sx={{ fontSize: 9, mt: 1 }}>Este documento es un comprobante de venta · No es factura con validez fiscal DIAN</Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── Main dialog ──────────────────────────────────────────────────────────────
const ReciboDialog = ({ open, onClose, venta, empresa, vendedor }) => {
  const theme   = useTheme();
  const isDark  = theme.palette.mode === 'dark';
  const [paperSize, setPaperSize]     = useState('a4');
  const [waOpen, setWaOpen]           = useState(false);
  const [waNumber, setWaNumber]       = useState('');

  const handleOpen = useCallback(() => {
    if (!open) return;
    // Pre-fill WhatsApp with client phone when dialog opens
    setWaNumber(venta?.cliente?.telefono || '');
    setWaOpen(false);
  }, [open, venta]);

  // Reset WhatsApp panel when dialog opens
  React.useEffect(handleOpen, [open]);

  if (!venta) return null;

  const size    = SIZES[paperSize];
  const fecha   = new Date(venta.fecha + (venta.fecha?.includes('Z') ? '' : 'Z'));
  const dateStr = fecha.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const saldo   = (venta.total || 0) - (venta.monto_pagado || venta.total || 0);

  const handlePrint = () => {
    const html = buildPrintHTML(venta, empresa, vendedor, size);
    const w    = window.open('', '_blank', 'width=700,height=900');
    if (!w) { alert('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 350);
  };

  const handleWhatsApp = () => {
    const num = waNumber.replace(/\D/g, '');
    if (!num) return;
    const text = buildWhatsAppText(venta, empresa, vendedor);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
    >
      {/* ── Top bar ─────────────────────────────────── */}
      <Box sx={{ height: 4, bgcolor: '#FF6020', flexShrink: 0 }} />

      {/* ── Header ──────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: '#FF602018', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt sx={{ color: '#FF6020', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
              Comprobante de Venta #{venta.id}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              Vista previa · Elige formato y acción
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Venta registrada ─ success banner ──────── */}
      <Box sx={{
        mx: 2.5, mb: 1.5, px: 2, py: 1, borderRadius: 2,
        bgcolor: isDark ? 'rgba(22,163,74,0.12)' : '#f0fdf4',
        border: '1px solid',
        borderColor: isDark ? 'rgba(22,163,74,0.3)' : '#bbf7d0',
        display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0
      }}>
        <CheckCircleOutline sx={{ color: isDark ? '#4ade80' : '#16a34a', fontSize: 18 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: isDark ? '#4ade80' : '#16a34a' }}>
          Venta registrada — Total: {formatCurrency(venta.total)}
        </Typography>
      </Box>

      {/* ── Paper size selector ─────────────────────── */}
      <Box sx={{ px: 2.5, mb: 1.5, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.8 }}>Formato de impresión</Typography>
        <ToggleButtonGroup
          value={paperSize}
          exclusive
          onChange={(_, v) => v && setPaperSize(v)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 2, py: 0.5, fontSize: 12, fontWeight: 600, borderRadius: '8px !important', textTransform: 'none' } }}
        >
          <ToggleButton value="a4">📄 A4 / Carta</ToggleButton>
          <ToggleButton value="p80">🖨️ Térmica 80mm</ToggleButton>
          <ToggleButton value="p58">🖨️ Térmica 58mm</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      {/* ── Receipt preview ─────────────────────────── */}
      <DialogContent sx={{ p: 2, bgcolor: '#f3f4f6', overflowY: 'auto', flexGrow: 1 }}>
        <Box
          sx={{
            mx: 'auto',
            width: size.compact ? size.previewWidth : '100%',
            bgcolor: 'white',
            p: size.compact ? 2 : 3,
            borderRadius: 2,
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            // Zigzag bottom effect for thermal
            ...(size.compact && {
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -8,
                left: 0,
                right: 0,
                height: 8,
                background: 'linear-gradient(135deg, #f3f4f6 25%, transparent 25%) -8px 0, linear-gradient(225deg, #f3f4f6 25%, transparent 25%) -8px 0, linear-gradient(315deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, #f3f4f6 25%, transparent 25%)',
                backgroundSize: '16px 8px',
                backgroundPosition: 'left bottom',
              }
            })
          }}
        >
          {size.compact
            ? <ThermalPreview venta={venta} empresa={empresa} vendedor={vendedor} dateStr={dateStr} saldo={saldo} />
            : <A4Preview      venta={venta} empresa={empresa} vendedor={vendedor} dateStr={dateStr} saldo={saldo} />
          }
        </Box>
      </DialogContent>

      {/* ── WhatsApp collapsible panel ──────────────── */}
      <Collapse in={waOpen} sx={{ flexShrink: 0 }}>
        <Box sx={{
          px: 2.5, py: 2,
          bgcolor: isDark ? 'rgba(37,211,102,0.08)' : '#f0fdf4',
          borderTop: '1px solid',
          borderColor: isDark ? 'rgba(37,211,102,0.22)' : '#bbf7d0',
        }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: isDark ? '#4ade80' : '#166534', mb: 1.2 }}>
            📲 Enviar comprobante por WhatsApp
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              label="Número de WhatsApp"
              value={waNumber}
              onChange={e => setWaNumber(e.target.value)}
              placeholder="57 300 123 4567"
              helperText="Incluye el indicativo del país (57 para Colombia)"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WhatsApp sx={{ color: '#25D366', fontSize: 18 }} />
                  </InputAdornment>
                )
              }}
              onKeyDown={e => e.key === 'Enter' && handleWhatsApp()}
            />
            <Button
              variant="contained"
              onClick={handleWhatsApp}
              disabled={!waNumber.replace(/\D/g, '')}
              sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' }, minWidth: 90, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-start', mt: 0.1 }}
            >
              Enviar
            </Button>
          </Stack>
          <Typography sx={{ fontSize: 11, color: isDark ? '#86efac' : '#15803d', mt: 1 }}>
            💡 Se abrirá el PDF para guardar y luego se abrirá WhatsApp. Adjunta el PDF en la conversación.
          </Typography>
        </Box>
      </Collapse>

      <Divider sx={{ flexShrink: 0 }} />

      {/* ── Action buttons ──────────────────────────── */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', gap: 1.5, flexShrink: 0, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<WhatsApp />}
          endIcon={waOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          onClick={() => setWaOpen(o => !o)}
          sx={{
            flex: 1, fontWeight: 600, textTransform: 'none', borderRadius: 2,
            color: '#25D366', borderColor: '#25D366',
            '&:hover': { bgcolor: '#25D36610', borderColor: '#25D366' },
          }}
        >
          WhatsApp
        </Button>
        <Button
          variant="contained"
          startIcon={<Print />}
          onClick={handlePrint}
          sx={{
            flex: 1, fontWeight: 700, textTransform: 'none', borderRadius: 2,
            bgcolor: '#FF6020', '&:hover': { bgcolor: '#e65520' },
          }}
        >
          Imprimir / PDF
        </Button>
      </Box>

      <Box sx={{ px: 2.5, pb: 2, pt: 0, flexShrink: 0 }}>
        <Button
          fullWidth
          variant="text"
          onClick={onClose}
          sx={{ color: 'text.secondary', textTransform: 'none', fontSize: 13 }}
        >
          Cerrar sin imprimir
        </Button>
      </Box>
    </Dialog>
  );
};

export default ReciboDialog;
