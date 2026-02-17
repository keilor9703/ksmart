import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api';
import { formatCurrency } from '../utils/formatters';
import { Typography } from '@mui/material';

const ClienteHistory = () => {
    const { clienteId } = useParams();
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchClienteHistory = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get(`/clientes/${clienteId}/history`);
                setHistory(response.data);
            } catch (err) {
                console.error('Error fetching client history:', err);
                setError('No se pudo cargar el historial del cliente.');
            } finally {
                setLoading(false);
            }
        };

        fetchClienteHistory();
    }, [clienteId]);

    if (loading) {
        return <p>Cargando historial del cliente...</p>;
    }

    if (error) {
        return <p className="text-danger">{error}</p>;
    }

    if (!history) {
        return <p>No se encontró historial para este cliente.</p>;
    }

    const getEstadoPagoBadge = (estado) => {
        switch (estado) {
            case 'pagado':
                return <span className="badge bg-success">Pagada</span>;
            case 'parcial':
                return <span className="badge bg-warning text-dark">Parcial</span>;
            case 'pendiente':
                return <span className="badge bg-danger">Pendiente</span>;
            default:
                return <span className="badge bg-secondary">Desconocido</span>;
        }
    };

    return (
        <div>
            <Link to="/clientes" className="btn btn-secondary mb-3">Volver a Clientes</Link>
            <h3>Historial de {history.cliente.nombre}</h3>

            <div className="card mb-4">
                <div className="card-header">Resumen Financiero</div>
                <div className="card-body">
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item">Total Ventas: <strong>{formatCurrency(history.total_ventas_general)}</strong></li>
                        <li className="list-group-item">Total Pagado: <strong>{formatCurrency(history.total_pagado_general)}</strong></li>
                        <li className="list-group-item">Deuda Total Pendiente: <strong>{formatCurrency(history.total_deuda)}</strong></li>
                    </ul>
                </div>
            </div>

            <div className="card">
                <div className="card-header">Detalle de Ventas y Pagos</div>
                <div className="card-body">
                    {history.ventas.length > 0 ? (
                        <div className="accordion" id="accordionVentasCliente">
                            {history.ventas.map((venta, index) => (
                                <div className="accordion-item" key={venta.id}>
                                    <h2 className="accordion-header" id={`ventaHeading${venta.id}`}>
                                        <button 
                                            className="accordion-button collapsed"
                                            type="button" 
                                            data-bs-toggle="collapse" 
                                            data-bs-target={`#ventaCollapse${venta.id}`}
                                            aria-expanded="false" 
                                            aria-controls={`ventaCollapse${venta.id}`}
                                        >
                                            Venta #{venta.id} - {venta.detalles.map(d => `${d.producto?.nombre} (x${d.cantidad})`).join(', ')} - {formatCurrency(venta.total)} - {getEstadoPagoBadge(venta.estado_pago)}
                                        </button>
                                    </h2>
                                    <div 
                                        id={`ventaCollapse${venta.id}`}
                                        className="accordion-collapse collapse"
                                        aria-labelledby={`ventaHeading${venta.id}`}
                                        data-bs-parent="#accordionVentasCliente"
                                    >
                                        <div className="accordion-body">
                                            <p><strong>Fecha:</strong> {new Date(venta.fecha).toLocaleString()}</p>
                                            <h6>Productos de la Venta:</h6>
                                            <ul className="list-unstyled">
                                                {venta.detalles.map(detalle => (
                                                    <li key={detalle.id}>
                                                        {detalle.producto ? detalle.producto.nombre : 'N/A'} (x{detalle.cantidad}) - {formatCurrency(detalle.precio_unitario * detalle.cantidad)}
                                                    </li>
                                                ))}
                                            </ul>
                                            <p><strong>Monto Pagado:</strong> {formatCurrency(venta.monto_pagado)}</p>
                                            <p><strong>Monto Pendiente:</strong> {formatCurrency(venta.total - venta.monto_pagado)}</p>

                                            {venta.pagos.length > 0 && (
                                                <div className="mt-3">
                                                    <h6>Historial de Pagos para esta Venta:</h6>
                                                    <table className="table table-sm table-bordered">
                                                        <thead>
                                                            <tr>
                                                                <th>ID Pago</th>
                                                                <th>Monto</th>
                                                                <th>Fecha</th>
                                                                <th>Método</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {venta.pagos.map(pago => (
                                                                <tr key={pago.id}>
                                                                    <td>{pago.id}</td>
                                                                    <td>{formatCurrency(pago.monto)}</td>
                                                                    <td>{new Date(pago.fecha).toLocaleString()}</td>
                                                                    <td>{pago.metodo_pago || 'N/A'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Typography color="text.primary">No hay ventas registradas para este cliente.</Typography>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClienteHistory;
