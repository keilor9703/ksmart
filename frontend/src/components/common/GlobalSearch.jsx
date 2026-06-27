import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, Box, InputBase, List, ListItemButton, ListItemIcon,
  ListItemText, Typography, Chip, Divider,
} from '@mui/material';
import { Search, KeyboardReturn } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const SIDEBAR_BG     = '#0A0A0A';
const SIDEBAR_ACTIVE = 'rgba(255,100,30,0.18)';
const ACCENT         = '#0891B2';

/**
 * Búsqueda global activada con Ctrl+K / ⌘K.
 *
 * Props:
 *  - modulosVisibles: array de { path, label, icon, color } — los mismos que Sidebar
 */
export default function GlobalSearch({ modulosVisibles = [] }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef            = useRef(null);
  const navigate            = useNavigate();

  // ── Atajos de teclado globales ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  }, []);

  // Enfocar input cuando abre
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const results = query.trim()
    ? modulosVisibles.filter(m =>
        m.label?.toLowerCase().includes(query.toLowerCase()) ||
        m.path?.toLowerCase().includes(query.toLowerCase())
      )
    : modulosVisibles;

  // ── Navegación con teclado dentro del modal ───────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && results[cursor]) {
      navigate(results[cursor].path);
      close();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const handleSelect = (path) => {
    navigate(path);
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      PaperProps={{
        sx: {
          width: '100%', maxWidth: 560, borderRadius: 3, overflow: 'hidden',
          background: SIDEBAR_BG, border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          m: { xs: 1.5, sm: 3 }, mt: { xs: '12vh', sm: '10vh' },
          alignSelf: 'flex-start',
        },
      }}
      slotProps={{ backdrop: { sx: { backdropFilter: 'blur(4px)' } } }}
    >
      {/* ── Barra de búsqueda ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Search sx={{ color: '#64748b', mr: 1.5, flexShrink: 0 }} />
        <InputBase
          inputRef={inputRef}
          fullWidth
          placeholder="Buscar módulo o pantalla…"
          value={query}
          onChange={e => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={handleKeyDown}
          sx={{ color: '#e2e8f0', fontSize: 15, fontFamily: "'Geist', sans-serif", '& input::placeholder': { color: '#475569' } }}
        />
        <Chip
          label="Esc"
          size="small"
          onClick={close}
          sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer', flexShrink: 0, ml: 1 }}
        />
      </Box>

      {/* ── Resultados ── */}
      <List dense sx={{ py: 1, maxHeight: 380, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.1)', borderRadius: 4 } }}>
        {results.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ color: '#475569', fontSize: 13 }}>Sin resultados para "{query}"</Typography>
          </Box>
        ) : results.map((item, idx) => (
          <ListItemButton
            key={item.path}
            selected={idx === cursor}
            onClick={() => handleSelect(item.path)}
            onMouseEnter={() => setCursor(idx)}
            sx={{
              mx: 1, mb: 0.25, borderRadius: 2, px: 2, py: 0.75,
              backgroundColor: idx === cursor ? SIDEBAR_ACTIVE : 'transparent',
              '&.Mui-selected': { backgroundColor: SIDEBAR_ACTIVE },
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: item.color || ACCENT, fontSize: 20 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              secondary={item.path}
              primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500, color: '#e2e8f0', fontFamily: "'Geist', sans-serif" }}
              secondaryTypographyProps={{ fontSize: 11, color: '#475569' }}
            />
            {idx === cursor && (
              <KeyboardReturn sx={{ fontSize: 16, color: '#475569', ml: 1 }} />
            )}
          </ListItemButton>
        ))}
      </List>

      {/* ── Hint de teclado ── */}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
      <Box sx={{ display: 'flex', gap: 2.5, px: 2.5, py: 1, alignItems: 'center' }}>
        {[['↑↓', 'Navegar'], ['↵', 'Ir'], ['Esc', 'Cerrar']].map(([key, hint]) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label={key} size="small" sx={{ fontSize: 10, height: 18, bgcolor: 'rgba(255,255,255,0.06)', color: '#64748b', fontFamily: 'monospace' }} />
            <Typography sx={{ fontSize: 11, color: '#475569' }}>{hint}</Typography>
          </Box>
        ))}
        <Typography sx={{ fontSize: 11, color: '#334155', ml: 'auto' }}>
          Ctrl+K para abrir
        </Typography>
      </Box>
    </Dialog>
  );
}
