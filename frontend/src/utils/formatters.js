
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0, // No decimales para pesos colombianos
        maximumFractionDigits: 0,
    }).format(amount);
};
