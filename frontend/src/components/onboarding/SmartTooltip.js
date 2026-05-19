import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Tooltip, 
  Typography, 
  IconButton, 
  useTheme 
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '../../context/OnboardingContext';

const SmartTooltip = ({ 
  id, 
  title, 
  description, 
  children, 
  placement = 'top',
  arrow = true,
  pulse = true 
}) => {
  const theme = useTheme();
  const { isGuideViewed, markGuideAsViewed, tooltipsVisible } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(pulse && !isGuideViewed(id));

  // Detener el pulso después de 5 segundos
  useEffect(() => {
    if (isPulsing) {
      const timer = setTimeout(() => setIsPulsing(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isPulsing]);

  // Si los tooltips están desactivados globalmente, solo mostramos el contenido normal
  if (!tooltipsVisible) return children;

  const handleClose = () => {
    setOpen(false);
    markGuideAsViewed(id);
  };

  const tooltipContent = (
    <Box sx={{ p: 1, maxWidth: 220 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#fff', fontSize: 13, lineHeight: 1.2 }}>
          {title}
        </Typography>
        <IconButton 
          size="small" 
          onClick={handleClose}
          sx={{ color: 'rgba(255,255,255,0.6)', p: 0.2, ml: 1, '&:hover': { color: '#fff' } }}
        >
          <Close sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, lineHeight: 1.4 }}>
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
            bgcolor: theme.palette.primary.main, // O un color que contraste elegantemente
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            borderRadius: 3,
            p: 0,
            '& .MuiTooltip-arrow': {
              color: theme.palette.primary.main,
            },
          },
        },
      }}
    >
      <Box component="span" sx={{ display: 'inline-block', position: 'relative' }}>
        <AnimatePresence>
          {isPulsing && (
            <motion.div
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ 
                scale: [1, 1.15, 1],
                opacity: [0.6, 0, 0.6]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 'inherit',
                border: `2px solid ${theme.palette.primary.main}`,
                pointerEvents: 'none',
                zIndex: -1
              }}
            />
          )}
        </AnimatePresence>
        {children}
      </Box>
    </Tooltip>
  );
};

export default SmartTooltip;
