import React, { useState } from 'react';
import ProductoList from './ProductoList';
import ProductoForm from './ProductoForm';
import BulkUpload from './BulkUpload';

const Productos = () => {
    const [key, setKey] = useState(0); // Used to trigger re-fetch in ProductoList
    const [editingProducto, setEditingProducto] = useState(null);

    const handleProductoAdded = () => {
        setKey(prevKey => prevKey + 1); // Force re-render of ProductoList
        setEditingProducto(null); // Clear editing state after add
    };

    const handleProductoUpdated = () => {
        setKey(prevKey => prevKey + 1); // Force re-render of ProductoList
        setEditingProducto(null); // Clear editing state after update
    };

    const handleProductoDeleted = () => {
        setKey(prevKey => prevKey + 1); // Force re-render of ProductoList
        setEditingProducto(null); // Clear editing state if deleted was being edited
    };

    const handleEditProducto = (producto) => {
        setEditingProducto(producto);
    };

    return (
        <div>
            {/* <BulkUpload uploadType="productos" onUploadSuccess={handleProductoAdded} /> */}
            <ProductoForm 
                onProductoAdded={handleProductoAdded} 
                productoToEdit={editingProducto}
                onProductoUpdated={handleProductoUpdated}
            />
            <hr />
            <ProductoList 
                key={key} 
                onEditProducto={handleEditProducto}
                onProductoDeleted={handleProductoDeleted}
            />
        </div>
    );
};

export default Productos;