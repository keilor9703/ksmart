import { createFilterOptions } from '@mui/material/Autocomplete';

// Para Autocomplete con catálogos grandes (clientes, productos con cientos de
// filas): MUI filtra en memoria por el texto tecleado, pero por defecto
// renderiza TODAS las coincidencias en el DOM — con 200-500 opciones eso se
// siente lento al abrir/escribir. limit acota cuántas filas se renderizan sin
// cambiar qué se puede encontrar (basta con seguir escribiendo para afinar).
export const filterOptions50 = createFilterOptions({ limit: 50 });
