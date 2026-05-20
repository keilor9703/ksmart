import React, { useState, useEffect } from 'react';
import { Box, Tooltip, Typography, IconButton } from '@mui/material';
import { Close, LightbulbOutlined, WarningAmberOutlined, CheckCircleOutline } from '@mui/icons-material';
import { useOnboarding } from '../../context/OnboardingContext';

const VARIANT_CONFIG = {
  info:    { color: '#3B82F6', bg: '#1d4ed8', icon: <LightbulbOutlined sx={{ fontSize: 13 }} /> },
  warning: { color: '#F59E0B', bg: '#b45309', icon: <WarningAmberOutlined sx={{ fontSize: 13 }} /> },
  success: { color: '#10B981', bg: '#065f46', icon: <CheckCircleOutline sx={{ fontSize: 13 }} /> },
};

const SmartTooltip = ({
  id,
  title,
  description,
  children,
  placement = 'top',
  arrow = true,
  pulse = true,
  variant = 'info',
}) => {
  const { isGuideViewed, markGuideAsViewed, tooltipsVisible } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(pulse && !isGuideViewed(id));
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;

  useEffect(() => {
    if (isPulsing) {
      const timer = setTimeout(() => setIsPulsing(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [isPulsing]);

  if (!tooltipsVisible) return children;

  const handleClose = (e) => {
    e?.stopPropagation();
    setOpen(false);
    markGuideAsViewed(id);
    setIsPulsing(false);
  };

  const tooltipContent = (
    <Box sx={{ p: 1, maxWidth: 240 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ color: 'rgba(255,255,255,0.8)' }}>{cfg.icon}</Box>
          <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: 13, lineHeight: 1.2 }}>
            {title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}
          sx={{ color: 'rgba(255,255,255,0.5)', p: 0.2, flexShrink: 0, '&:hover': { color: '#fff' } }}>
          <Close sx={{ fontSize: 13 }} />
        </IconButton>
      </Box>
      <Typography sx={{ color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 1.5 }}>
        {description}
      </Typography>
    </Box>
  );

  return (
    <Tooltip
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      title={tooltipContent}
      placement={placement}
      arrow={arrow}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: cfg.bg,
            boxShadow: `0 8px 24px rgba(0,0,0,0.2)`,
            borderRadius: 2,
            p: 0,
            '& .MuiTooltip-arrow': { color: cfg.bg },
          },
        },
      }}
    >
      <Box component="span" sx={{ display: 'inline-block', position: 'relative' }}>
        {isPulsing && (
          <Box
            sx={{
              position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
              borderRadius: 'inherit',
              border: `2px solid ${cfg.color}`,
              opacity: 0,
              animation: 'smartPulse 2s ease-in-out infinite',
              pointerEvents: 'none',
              zIndex: 0,
              '@keyframes smartPulse': {
                '0%':   { opacity: 0.7, transform: 'scale(1)' },
                '50%':  { opacity: 0,   transform: 'scale(1.12)' },
                '100%': { opacity: 0,   transform: 'scale(1.12)' },
              },
            }}
          />
        )}
        {children}
      </Box>
    </Tooltip>
  );
};

export default SmartTooltip;
