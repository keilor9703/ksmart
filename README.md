<<<<<<< HEAD
# Sistema de Gestión - Peleteria Jeylor

## Descripción General

Este proyecto es un sistema de gestión de tipo ERP (Enterprise Resource Planning) diseñado a medida para **Peleteria Jeylor**. La aplicación web permite administrar de forma integral las operaciones del negocio, incluyendo la gestión de clientes, productos, inventario, órdenes de trabajo, ventas y reportes financieros.

La arquitectura está desacoplada, con un backend robusto que expone una API RESTful y un frontend moderno y reactivo para la interacción del usuario.

## Características Principales

- **Gestión de Clientes:** Creación, edición y consulta de clientes, con historial financiero detallado.
- **Catálogo de Productos:** Administración de productos (con stock) y servicios (sin stock).
- **Control de Inventario:** Manejo de movimientos (entradas, salidas, ajustes), alertas de stock bajo y consulta de Kardex por producto.
- **Órdenes de Trabajo (OT):** Flujo de trabajo completo desde la creación, revisión, aprobación (que genera una venta automática) y cierre.
- **Módulo de Ventas:** Registro de ventas directas (contado o crédito) y consulta de historial.
- **Reportes y Finanzas:** Módulo para consultar cuentas por cobrar, registrar pagos a deudas y visualizar reportes de rendimiento.
- **Dashboard de Admin:** Pantalla de inicio para administradores con KPIs (Indicadores Clave de Rendimiento) y accesos directos.
- **Gestión de Roles y Permisos:** Sistema para crear usuarios y asignarles roles con acceso a módulos específicos.
- **Carga Masiva:** Funcionalidad para importar clientes, productos y movimientos de inventario desde archivos Excel/CSV.

## Tech Stack

- **Backend:**
  - **Framework:** FastAPI (Python)
  - **Base de Datos:** PostgreSQL
  - **ORM:** SQLAlchemy
  - **Validación de Datos:** Pydantic
  - **Autenticación:** JWT (passlib, python-jose)

- **Frontend:**
  - **Framework:** React (Create React App)
  - **Librería de UI:** Material-UI (MUI)
  - **Enrutamiento:** React Router
  - **Cliente HTTP:** Axios
  - **Gráficos:** Chart.js

## Estructura del Proyecto

```
/
├── backend/
│   ├── crud.py         # Lógica de negocio y acceso a base de datos
│   ├── database.py     # Configuración de la conexión a la BD
│   ├── main.py         # API Endpoints (FastAPI)
│   ├── models.py       # Modelos de la base de datos (SQLAlchemy)
│   └── schemas.py      # Esquemas de validación de datos (Pydantic)
│
├── frontend/
│   ├── public/
│   │   └── index.html  # Plantilla HTML principal
│   ├── src/
│   │   ├── api.js      # Configuración del cliente Axios
│   │   ├── App.js      # Componente raíz y enrutamiento
│   │   ├── components/ # Componentes de React (vistas y UI)
│   │   └── theme.js    # Tema de Material-UI
│   ├── .env            # (Opcional) Variables de entorno del frontend
│   └── package.json    # Dependencias y scripts del frontend
│
├── .venv/              # Entorno virtual de Python
├── .env                # (Opcional) Variables de entorno del backend
├── README.md           # Este archivo
└── ...
```

## Requisitos Previos

- Python 3.10 o superior
- Node.js 16.x o superior
- npm (o yarn)
- Una instancia de PostgreSQL en ejecución.

---

## Guía de Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd <NOMBRE_DEL_PROYECTO>
```

### 2. Configuración del Backend

1.  **Crear y Activar Entorno Virtual:**
    Desde la raíz del proyecto, crea un entorno virtual para las dependencias de Python.
    ```bash
    # Crear el entorno
    python -m venv .venv

    # Activar en Windows
    .venv\Scripts\activate

    # Activar en macOS/Linux
    source .venv/bin/activate
    ```

2.  **Instalar Dependencias:**
    ```bash
    pip install -r backend/requirements.txt
    ```

3.  **Configurar la Conexión a la Base de Datos:**
    Abre el archivo `backend/database.py` y modifica la variable `SQLALCHEMY_DATABASE_URL` para que apunte a tu instancia de PostgreSQL.

4.  **Configurar Clave Secreta (Recomendado):**
    Por seguridad, la `SECRET_KEY` para JWT no debe estar directamente en el código. Se recomienda crear un archivo `.env` en la raíz del proyecto y añadir la clave allí.
    
    *Ejemplo de archivo `.env`:*
    ```
    SECRET_KEY="tu-clave-secreta-super-larga-y-aleatoria"
    ```
    Luego, deberás ajustar el código en `backend/main.py` para leer esta variable de entorno.

### 3. Configuración del Frontend

1.  **Navegar al Directorio del Frontend:**
    ```bash
    cd frontend
    ```

2.  **Instalar Dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar la URL de la API (Opcional):**
    La aplicación frontend se conectará al backend en `http://127.0.0.1:8000` por defecto. Si tu backend corre en una dirección diferente, crea un archivo `.env` en el directorio `frontend/`.

    *Ejemplo de archivo `frontend/.env`:*
    ```
    REACT_APP_API_URL=http://tu-direccion-del-backend:8000
    ```

---

## Cómo Ejecutar la Aplicación

Debes tener dos terminales abiertas, una para el backend y otra para el frontend.

1.  **Iniciar el Servidor del Backend:**
    Asegúrate de tener tu entorno virtual activado. Desde la **raíz del proyecto**, ejecuta:
    ```bash
    uvicorn backend.main:app --reload
    ```
    El servidor estará disponible en `http://127.0.0.1:8000`.

2.  **Iniciar la Aplicación del Frontend:**
    Desde el directorio `frontend/`, ejecuta:
    ```bash
    npm start
    ```
    La aplicación se abrirá automáticamente en tu navegador en `http://localhost:3000`.

---

## Documentación de la API

Una vez que el servidor del backend está en ejecución, FastAPI genera automáticamente la documentación interactiva de la API.

- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

Puedes usar estas interfaces para explorar y probar todos los endpoints de la API directamente desde tu navegador.
=======
# Ksmart360
App integral para el manejo del negocio
>>>>>>> f09ddf5e3895c084611d3f12882f85212a9b06e4
