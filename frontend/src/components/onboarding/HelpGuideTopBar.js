import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Drawer, List, ListItem, ListItemText,
  Divider, Button, useTheme, Collapse, Chip, Avatar
} from '@mui/material';
import {
  HelpOutline, Close, LightbulbCircle, PlayCircleOutline,
  AutoFixHigh, QuestionMark, ExpandMore, ExpandLess,
  CheckCircleOutline, RadioButtonUnchecked, ContactSupport,
  TipsAndUpdates, MenuBook
} from '@mui/icons-material';
import { useOnboarding } from '../../context/OnboardingContext';

const DEFAULT_FAQ = [
  {
    q: '¿Cómo activo los Tips de ayuda?',
    a: 'Usa el botón "Activar Tips" que aparece abajo. Los tips son pequeños íconos de ayuda que aparecen junto a los campos importantes y te explican para qué sirven.',
  },
  {
    q: '¿Puedo editar los datos después?',
    a: 'Sí, todos los registros son editables. Haz clic en el ícono de lápiz ✏️ junto a cualquier registro para modificarlo.',
  },
  {
    q: '¿Cómo busco un registro específico?',
    a: 'Usa la barra de búsqueda en la parte superior del listado para filtrar por nombre, código o cualquier otro dato.',
  },
  {
    q: '¿Qué hago si cometí un error?',
    a: 'Puedes editar o eliminar cualquier registro en cualquier momento desde el historial o listado del módulo.',
  },
];

const HelpGuideTopBar = ({ moduleName, steps = [], moduleColor, faqItems }) => {
  const activeFaq = faqItems && faqItems.length > 0 ? faqItems : DEFAULT_FAQ;
  const [open, setOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const theme = useTheme();
  const { toggleTooltips, tooltipsVisible } = useOnboarding();
  const accentColor = moduleColor || theme.palette.primary.main;

  return (
    <>
      {/* ── Trigger Button ── */}
      <Box
        onClick={() => setOpen(true)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
          px: 1.5, py: 0.8, borderRadius: 2,
          bgcolor: `${accentColor}12`,
          border: `1px solid ${accentColor}30`,
          transition: 'all 0.2s',
          '&:hover': { bgcolor: `${accentColor}20`, borderColor: `${accentColor}60` },
        }}
      >
        <QuestionMark sx={{ fontSize: 15, color: accentColor }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: accentColor, display: { xs: 'none', sm: 'block' } }}>
          Ayuda
        </Typography>
      </Box>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 380 },
            borderRadius: { xs: 0, sm: '20px 0 0 20px' },
            display: 'flex', flexDirection: 'column',
          }
        }}
      >
        {/* ── Header ── */}
        <Box sx={{ p: 3, pb: 2, background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}06)`, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ width: 40, height: 40, bgcolor: `${accentColor}20`, color: accentColor }}>
                <MenuBook />
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Centro de Ayuda</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{moduleName}</Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* ── Scrollable content ── */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>

          {/* Steps */}
          {steps.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
                Cómo usar este módulo
              </Typography>
              <List disablePadding>
                {steps.map((step, index) => (
                  <ListItem key={index} sx={{ px: 0, py: 1, alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      bgcolor: `${accentColor}15`, color: accentColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, mt: 0.2,
                    }}>
                      {index + 1}
                    </Box>
                    <ListItemText
                      primary={<Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{step.title}</Typography>}
                      secondary={<Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5, mt: 0.3 }}>{step.description}</Typography>}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          <Divider sx={{ mb: 3 }} />

          {/* FAQ */}
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
              Preguntas frecuentes
            </Typography>
            {activeFaq.map((item, i) => (
              <Box
                key={i}
                sx={{ mb: 1, border: '1px solid', borderColor: expandedFaq === i ? `${accentColor}40` : 'divider', borderRadius: 2, overflow: 'hidden', transition: 'border-color 0.2s' }}
              >
                <Box
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: expandedFaq === i ? `${accentColor}06` : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, pr: 1 }}>{item.q}</Typography>
                  {expandedFaq === i ? <ExpandLess sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} /> : <ExpandMore sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />}
                </Box>
                <Collapse in={expandedFaq === i}>
                  <Box sx={{ px: 1.5, pb: 1.5 }}>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.6 }}>{item.a}</Typography>
                  </Box>
                </Collapse>
              </Box>
            ))}
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Tips toggle */}
          <Box
            onClick={toggleTooltips}
            sx={{
              p: 2, borderRadius: 2, cursor: 'pointer', mb: 2,
              border: '1.5px solid', transition: 'all 0.2s',
              borderColor: tooltipsVisible ? '#F59E0B' : 'divider',
              bgcolor: tooltipsVisible ? '#FFFBEB' : 'action.hover',
              display: 'flex', alignItems: 'center', gap: 1.5,
              '&:hover': { borderColor: '#F59E0B', bgcolor: '#FFFBEB' },
            }}
          >
            <TipsAndUpdates sx={{ color: tooltipsVisible ? '#F59E0B' : 'text.secondary', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: tooltipsVisible ? '#B45309' : 'text.primary' }}>
                {tooltipsVisible ? '✓ Tips contextuales activos' : 'Activar Tips Contextuales'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                Íconos de ayuda junto a cada campo del formulario
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            fullWidth
            startIcon={<PlayCircleOutline />}
            sx={{ borderRadius: 2, py: 1.2, textTransform: 'none', fontWeight: 700, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, mb: 2 }}
            onClick={() => setOpen(false)}
          >
            Ver Tutorial en Video
          </Button>

        </Box>

        {/* ── Footer ── */}
        <Box sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ContactSupport sx={{ color: 'text.secondary', fontSize: 22 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>¿Necesitas más ayuda?</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Contacta a soporte técnico</Typography>
            </Box>
            <Button 
              size="small" 
              variant="outlined" 
              href="https://wa.me/573175882321?text=Hola,%20necesito%20ayuda%20con%20soporte%20t%C3%A9cnico."
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: 2, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}
            >
              Soporte
            </Button>
          </Box> 
        </Box>
      </Drawer>
    </>
  );
};

export default HelpGuideTopBar;
