import React from 'react';
import { Paper } from '@mui/material';

const SectionCard = ({ children, sx = {}, noPad = false }) => (
  <Paper sx={{
    borderRadius: 3,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    ...(noPad ? {} : { p: { xs: 2, md: 3 } }),
    ...sx,
  }}>
    {children}
  </Paper>
);

export default SectionCard;
