import React from "react";
import { Box, Paper, Typography, Tabs, Tab } from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function Inventario() {
  const [tab, setTab] = React.useState(0);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Inventory2OutlinedIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Inventarios</Typography>
      </Box>

      <Paper sx={{ p: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Movimientos" />
          <Tab label="Alertas" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <Typography color="text.secondary">
            Aquí listaremos los movimientos (entrada/salida/ajuste) según lo
            que implementamos en el backend. (Fase 2 los conectamos).
          </Typography>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Typography color="text.secondary">
            Aquí mostraremos alertas de stock bajo (stock_actual &lt; stock_minimo).
          </Typography>
        </TabPanel>
      </Paper>
    </Box>
  );
}
