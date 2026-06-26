import React from 'react';
import { Box, Typography } from '@mui/material';

const PageHeader = ({ icon, title, subtitle, color = '#6366F1', actions }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {icon && (
        <Box sx={{
          width: 40, height: 40, borderRadius: 2, flexShrink: 0,
          bgcolor: `${color}18`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color,
        }}>
          {icon}
        </Box>
      )}
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 17, sm: 20 }, lineHeight: 1.2, color: 'text.primary' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.1 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
    {actions && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {actions}
      </Box>
    )}
  </Box>
);

export default PageHeader;
