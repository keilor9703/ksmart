#!/bin/bash

echo "🚀 Iniciando entorno de desarrollo de Ksmart..."

# =========================
# VALIDAR PYENV
# =========================
if ! command -v pyenv &> /dev/null
then
    echo "❌ pyenv no está instalado. Instálalo con: brew install pyenv"
    exit 1
fi

# Inicializar pyenv
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"

# =========================
# VALIDAR PYTHON 3.11
# =========================
PYTHON_VERSION="3.11.9"

if ! pyenv versions --bare | grep -q "$PYTHON_VERSION"; then
    echo "⚠️ Python $PYTHON_VERSION no está instalado. Instalando..."
    pyenv install $PYTHON_VERSION
fi

pyenv local $PYTHON_VERSION

echo "🐍 Usando Python: $(python --version)"

# =========================
# ENTORNO VIRTUAL
# =========================
if [ ! -d ".venv" ]; then
    echo "📦 Creando entorno virtual..."
    python -m venv .venv
fi

echo "⚙️ Activando entorno virtual..."
source .venv/bin/activate

echo "🐍 Python activo: $(which python)"
echo "📦 Pip activo: $(which pip)"

# =========================
# INSTALAR DEPENDENCIAS
# =========================
echo "📦 Instalando dependencias backend..."

# Forzar pip correcto del venv
./.venv/bin/python -m pip install --upgrade pip setuptools wheel

# Intentar instalar requirements
if ! ./.venv/bin/python -m pip install -r backend/requirements.txt; then
    echo "⚠️ Error instalando dependencias. Intentando solución para cbor2..."

    # Intento alternativo evitando compilación Rust
    ./.venv/bin/python -m pip install "cbor2<5.0"

    # Reintentar instalación
    ./.venv/bin/python -m pip install -r backend/requirements.txt
fi

# =========================
# LEVANTAR SERVICIOS
# =========================

echo "🖥️ Iniciando Backend..."
osascript -e 'tell application "Terminal"
    do script "cd \"'"$PWD"'\" && source .venv/bin/activate && cd backend && ../.venv/bin/python -m uvicorn main:app --reload"
end tell'

echo "🌐 Iniciando Frontend..."
osascript -e 'tell application "Terminal"
    do script "cd \"'"$PWD"'\" && cd frontend && npm install && npm start"
end tell'

echo "✅ Todo listo. Servicios iniciándose..."