import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Divider,
  Button,
  useTheme
} from '@mui/material';
import { 
  HelpOutline, 
  Close, 
  LightbulbCircle, 
  PlayCircleOutline,
  AutoFixHigh,
  QuestionMark
} from '@mui/icons-material';
import { useOnboarding } from '../../context/OnboardingContext';

const HelpGuideTopBar = ({ moduleName, steps = [] }) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const { toggleTooltips, tooltipsVisible } = useOnboarding();

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton 
          onClick={() => setOpen(true)}
          sx={{ 
            color: 'primary.main', 
            bgcolor: 'primary.main',
            color: '#fff',
            '&:hover': { bgcolor: 'primary.dark' },
            width: 32,
            height: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <QuestionMark sx={{ fontSize: 18 }} />
        </IconButton>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
          Centro de Ayuda
        </Typography>
      </Box>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 350 }, borderRadius: { xs: 0, sm: '24px 0 0 24px' }, p: 3 }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AutoFixHigh color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Guía de {moduleName}</Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)}><Close /></IconButton>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Bienvenido al centro de ayuda rápida. Sigue estos pasos para dominar este módulo en minutos.
        </Typography>

        <List sx={{ mb: 4 }}>
          {steps.map((step, index) => (
            <ListItem key={index} sx={{ px: 0, py: 2, alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                <Box sx={{ 
                  width: 24, height: 24, borderRadius: '50%', 
                  bgcolor: 'primary.main', color: '#fff', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800
                }}>
                  {index + 1}
                </Box>
              </ListItemIcon>
              <ListItemText 
                primary={<Typography sx={{ fontWeight: 700, fontSize: 14 }}>{step.title}</Typography>}
                secondary={<Typography sx={{ fontSize: 12.5 }}>{step.description}</Typography>}
              />
            </ListItem>
          ))}
        </List>

        <Divider sx={{ mb: 4 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button 
            variant="outlined" 
            fullWidth
            startIcon={<LightbulbCircle />}
            onClick={toggleTooltips}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 600 }}
          >
            {tooltipsVisible ? 'Desactivar Tips Contextuales' : 'Activar Tips Contextuales'}
          </Button>
          
          <Button 
            variant="contained" 
            fullWidth
            startIcon={<PlayCircleOutline />}
            sx={{ borderRadius: 3, py: 1.2, textTransform: 'none', fontWeight: 700 }}
            onClick={() => {
              // Aquí se podría disparar un tour guiado (ej: react-joyride) en el futuro
              setOpen(false);
            }}
          >
            Ver Vídeo Tutorial
          </Button>
        </Box>

        <Box sx={{ mt: 'auto', p: 2, bgcolor: 'action.hover', borderRadius: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            ¿Necesitas más ayuda?
          </Typography>
          <Button size="small" sx={{ fontWeight: 700 }}>Contactar a Soporte</Button>
        </Box>
      </Drawer>
    </>
  );
};

export default HelpGuideTopBar;
