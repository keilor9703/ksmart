import React, { useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * Botón con acabado "liquid metal" (metálico líquido, look premium) hecho con
 * MUI puro: gradiente cónico animado + capas de sombra para profundidad +
 * ripple radial al click. Sin WebGL/shaders — liviano para POS en tablets.
 *
 * Reemplazo drop-in de <Button variant="contained">: mismos props básicos
 * (onClick, disabled, startIcon, fullWidth, type, children/label).
 */
export default function LiquidButton({
  children, label, onClick, disabled, loading,
  startIcon, fullWidth, type = 'button', color, id,
  size = 'large', sx = {}, ...rest
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const accent = color || theme.palette.primary.main;

  const [hover, setHover]     = useState(false);
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState([]);
  const btnRef = useRef(null);
  const rippleId = useRef(0);

  const handleClick = (e) => {
    if (disabled || loading) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const id = rippleId.current++;
      setRipples(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 650);
    }
    onClick?.(e);
  };

  const sizePad = size === 'small' ? '8px 18px' : size === 'medium' ? '10px 22px' : '14px 26px';
  const fontSize = size === 'small' ? 13 : size === 'medium' ? 14.5 : 16;

  return (
    <Box
      component="button"
      ref={btnRef}
      id={id}
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        width: fullWidth ? '100%' : 'auto',
        border: 'none',
        borderRadius: 100,
        padding: sizePad,
        fontFamily: 'inherit',
        fontWeight: 800,
        fontSize,
        letterSpacing: 0.1,
        color: '#fff',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transform: pressed ? 'scale(0.97) translateY(1px)' : hover ? 'scale(1.015)' : 'scale(1)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s, box-shadow 0.2s',
        // Base metálica: gradiente casi negro con reflejo superior, como el
        // cuerpo del botón "liquid metal" original.
        backgroundImage: `linear-gradient(180deg, ${isDark ? '#2a2a2a' : '#26313a'} 0%, #0a0a0a 100%)`,
        boxShadow: pressed
          ? `0 0 0 1px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.5)`
          : hover
            ? `0 0 0 1px ${accent}55, 0 10px 24px -6px ${accent}66, 0 2px 6px rgba(0,0,0,0.35)`
            : `0 0 0 1px rgba(0,0,0,0.35), 0 6px 16px -6px rgba(0,0,0,0.4)`,
        '&::before': {
          // Capa "líquida": gradiente cónico animado con el acento como tinte
          // metálico, girando lento; se acelera y brilla más en hover.
          content: '""',
          position: 'absolute',
          inset: '-40%',
          zIndex: -1,
          background: `conic-gradient(from 0deg, ${accent}00, ${accent}99, #fff8, ${accent}00, ${accent}66, ${accent}00)`,
          opacity: hover ? 0.55 : 0.32,
          animation: `liquidSpin ${hover ? 3.5 : 8}s linear infinite`,
          transition: 'opacity 0.3s ease',
        },
        '&::after': {
          // Velo interior para que el gradiente cónico se vea como reflejo
          // sutil en el borde, no relleno completo.
          content: '""',
          position: 'absolute',
          inset: '2px',
          zIndex: -1,
          borderRadius: 100,
          background: `linear-gradient(180deg, ${isDark ? '#232323' : '#1c252c'} 0%, #050505 100%)`,
        },
        '@keyframes liquidSpin': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        ...sx,
      }}
      {...rest}
    >
      {loading ? <CircularProgress size={fontSize + 4} sx={{ color: '#fff' }} /> : startIcon}
      <Box component="span" sx={{ whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
        {children ?? label}
      </Box>

      {ripples.map(r => (
        <Box key={r.id} sx={{
          position: 'absolute', left: r.x, top: r.y, width: 18, height: 18, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none', transform: 'translate(-50%,-50%) scale(0)',
          animation: 'liquidRipple 0.65s ease-out',
          '@keyframes liquidRipple': {
            from: { transform: 'translate(-50%,-50%) scale(0)', opacity: 0.7 },
            to:   { transform: 'translate(-50%,-50%) scale(9)', opacity: 0 },
          },
        }} />
      ))}
    </Box>
  );
}
