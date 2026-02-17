@echo off
REM Script para iniciar el backend y el frontend de la aplicacion.

echo Iniciando el servidor del backend (FastAPI)...
REM Activa el venv y ejecuta uvicorn desde la raiz del proyecto.
START "Backend Server" cmd /k "cd backend && .\venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Iniciando el servidor del frontend (React)...
START "Frontend Server" cmd /k "cd frontend && npm start"

echo.
echo Ambos servidores se estan iniciando en ventanas separadas.
echo La aplicacion estara lista en unos momentos.
echo Para detener la aplicacion, simplemente cierra las dos nuevas ventanas de la terminal.



REM cd /d D:\APP_JEYLOR\APP\peleteria-jeylor-app
REM call .venv\Scripts\activate.bat
REM python -V
REM where python


REM cd backend
REM uvicorn main:app --host 0.0.0.0 --port 8000 --reload
