import React, { useState, useEffect } from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/formatters';

/**
 * CurrencyField — TextField que formatea automáticamente en pesos colombianos.
 *
 * Props:
 *   value        {number}   — valor numérico controlado
 *   onChange     {fn}       — recibe el número parseado (no el string)
 *   label        {string}
 *   required     {bool}
 *   disabled     {bool}
 *   size         {string}   — 'small' | 'medium'
 *   fullWidth    {bool}
 *   helperText   {string}
 *   sx           {object}
 *   error        {bool}
 *
 * Uso:
 *   <CurrencyField
 *     label="Precio"
 *     value={precio}
 *     onChange={(num) => setPrecio(num)}
 *   />
 */
const CurrencyField = ({
  value,
  onChange,
  label = 'Valor',
  required = false,
  disabled = false,
  size = 'small',
  fullWidth = true,
  helperText,
  sx,
  error,
  ...rest
}) => {
  // Estado interno del string formateado
  const [display, setDisplay] = useState('');

  // Sincronizar con value externo
  useEffect(() => {
    const num = Number(value);
    if (!isNaN(num) && num !== parseCurrencyInput(display)) {
      if (num > 0) {
        // Convertir número a formato colombiano (1234.56 → "1.234,56")
        setDisplay(num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
      } else {
        setDisplay('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    const formatted = formatCurrencyInput(raw);
    setDisplay(formatted);
    const num = parseCurrencyInput(formatted);
    if (onChange) onChange(num);
  };

  return (
    <TextField
      {...rest}
      label={label}
      value={display}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      size={size}
      fullWidth={fullWidth}
      helperText={helperText}
      error={error}
      sx={sx}
      inputMode="decimal"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <span style={{ fontSize: 13, color: 'inherit', opacity: 0.7 }}>$</span>
          </InputAdornment>
        ),
      }}
      placeholder="0"
    />
  );
};

export default CurrencyField;
