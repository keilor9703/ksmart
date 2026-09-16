import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const CatalogoVirtual = lazy(() => import('./features/saas/CatalogoVirtual'));

const root = ReactDOM.createRoot(document.getElementById('root'));

const isCatalogoDomain = window.location.hostname === 'catalogo.appjeylor.com';

root.render(
  <React.StrictMode>
    <BrowserRouter>
      {isCatalogoDomain ? (
        <Suspense fallback={null}>
          <Routes>
            <Route path="/:slug" element={<CatalogoVirtual />} />
            <Route path="*" element={<CatalogoVirtual />} />
          </Routes>
        </Suspense>
      ) : (
        <App />
      )}
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
