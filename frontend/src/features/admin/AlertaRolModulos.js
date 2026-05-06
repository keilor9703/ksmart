// ═══════════════════════════════════════════════════════════════════════════
// AlertaRolModulos.jsx
// Componente reutilizable que se muestra al asignar un rol a un usuario.
// Avisa si el rol tiene módulos que la empresa NO tiene habilitados.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Alert, AlertTitle, Box, Chip, Stack, Typography } from '@mui/material';
import { Warning, CheckCircle } from '@mui/icons-material';

export default function AlertaRolModulos({ rolSeleccionado, empresaActual }) {
  // 1️⃣ REGLA DE REACT: Los Hooks siempre van arriba del todo
  const analisis = useMemo(() => {
    // Usamos el encadenamiento opcional (?.) para evitar errores si viene nulo
    const modulosDelRol = rolSeleccionado?.modules || [];
    const modulosEmpresa = empresaActual?.modulos_habilitados;

    // Si la empresa no tiene restricciones (campo null) → todo permitido
    if (modulosEmpresa === null || modulosEmpresa === undefined) {
      return {
        ok: true,
        modulosFaltantes: [],
        modulosOk: modulosDelRol,
      };
    }

    // Si tiene un array (incluso vacío) → analizar
    const modulosFaltantes = modulosDelRol.filter(
      m => !modulosEmpresa.includes(m.frontend_path)
    );
    const modulosOk = modulosDelRol.filter(
      m => modulosEmpresa.includes(m.frontend_path)
    );

    return {
      ok: modulosFaltantes.length === 0,
      modulosFaltantes,
      modulosOk,
    };
  }, [rolSeleccionado, empresaActual]);

  // 2️⃣ AHORA SÍ, hacemos los "early returns" (salir temprano si no hay que mostrar nada)
  if (!rolSeleccionado || !rolSeleccionado.modules) return null;

  const esSuperadmin = empresaActual?.id === 1;
  if (esSuperadmin) return null;

  // 3️⃣ RENDERIZADO DE LAS ALERTAS
  // Si todo OK, mostrar mini confirmación verde
  if (analisis.ok && analisis.modulosOk.length > 0) {
    return (
      <Alert
        icon={<CheckCircle fontSize="small" />}
        severity="success"
        sx={{ mt: 1.5, py: 0.5, fontSize: 12 }}
      >
        Este rol tiene <strong>{analisis.modulosOk.length}</strong> módulo(s) y todos están
        habilitados para tu empresa.
      </Alert>
    );
  }

  // Caso preocupante: rol sin módulos del todo
  if (analisis.modulosOk.length === 0 && analisis.modulosFaltantes.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 1.5, fontSize: 12 }}>
        Este rol no tiene módulos asignados. El usuario podrá iniciar sesión pero no
        verá ningún módulo en su menú.
      </Alert>
    );
  }

  // Caso: rol con módulos pero ninguno disponible para esta empresa
  if (analisis.modulosOk.length === 0 && analisis.modulosFaltantes.length > 0) {
    return (
      <Alert
        icon={<Warning fontSize="small" />}
        severity="error"
        sx={{ mt: 1.5 }}
      >
        <AlertTitle sx={{ fontSize: 13, fontWeight: 800 }}>
          Este rol no funcionará para tu empresa
        </AlertTitle>
        <Typography sx={{ fontSize: 12, mb: 1 }}>
          Todos los módulos de este rol NO están habilitados para tu empresa.
          Si asignas este rol, el usuario iniciará sesión pero verá un menú vacío.
        </Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
          Módulos del rol que tu empresa no tiene:
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {analisis.modulosFaltantes.map(m => (
            <Chip
              key={m.id || m.frontend_path}
              label={m.name || m.frontend_path}
              size="small"
              sx={{ fontSize: 10, bgcolor: 'rgba(239,68,68,0.15)', color: '#991B1B' }}
            />
          ))}
        </Stack>
        <Typography sx={{ fontSize: 11, mt: 1.5, fontStyle: 'italic' }}>
          💡 Pide a tu proveedor habilitar estos módulos para tu empresa, o asigna otro rol.
        </Typography>
      </Alert>
    );
  }

  // Caso parcial: rol con algunos módulos OK y otros faltantes
  return (
    <Alert
      icon={<Warning fontSize="small" />}
      severity="warning"
      sx={{ mt: 1.5 }}
    >
      <AlertTitle sx={{ fontSize: 13, fontWeight: 800 }}>
        Este rol tiene módulos no habilitados
      </AlertTitle>
      <Typography sx={{ fontSize: 12, mb: 1 }}>
        El usuario verá <strong>{analisis.modulosOk.length}</strong> módulo(s) pero
        <strong> {analisis.modulosFaltantes.length}</strong> no estarán disponibles porque
        tu empresa no los tiene habilitados.
      </Typography>

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'success.dark', mb: 0.5 }}>
        ✓ Verá ({analisis.modulosOk.length}):
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        {analisis.modulosOk.map(m => (
          <Chip
            key={m.id || m.frontend_path}
            label={m.name || m.frontend_path}
            size="small"
            sx={{ fontSize: 10, bgcolor: 'rgba(16,185,129,0.15)', color: '#065F46' }}
          />
        ))}
      </Stack>

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'error.dark', mb: 0.5 }}>
        ✗ NO verá ({analisis.modulosFaltantes.length}):
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {analisis.modulosFaltantes.map(m => (
          <Chip
            key={m.id || m.frontend_path}
            label={m.name || m.frontend_path}
            size="small"
            sx={{ fontSize: 10, bgcolor: 'rgba(239,68,68,0.15)', color: '#991B1B' }}
          />
        ))}
      </Stack>
    </Alert>
  );
}