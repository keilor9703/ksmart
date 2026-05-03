@echo off
echo Iniciando entorno de desarrollo de Ksmart...

:: Iniciar el Backend en una nueva ventana
start "Ksmart - Backend" cmd /k "python -m venv .venv && call .venv\Scripts\activate && pip install -r backend\requirements.txt && cd backend && uvicorn main:app --reload"

:: Iniciar el Frontend en otra nueva ventana
start "Ksmart - Frontend" cmd /k "cd frontend && npm install && npm start"

echo Las terminales se estan abriendo en segundo plano...
exit