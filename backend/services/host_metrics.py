"""
Métricas del host (la VM de Oracle Cloud donde corre el backend), leídas con la
librería estándar (/proc, os, shutil) — sin dependencias externas.

Se comparan contra los límites de Oracle Cloud "Always Free" para que el
SuperAdmin vigile que no se exceda lo gratuito.
"""
import os
import shutil
import time

# ── Límites Oracle Cloud Always Free ──────────────────────────────────────────
# https://www.oracle.com/cloud/free/  (categoría Always Free)
LIMITES = {
    "ocpu":            4,                      # 4 OCPU ARM Ampere A1
    "ram_gb":          24,                     # 24 GB RAM
    "almacenamiento_gb": 200,                  # 200 GB de almacenamiento en bloque (total)
    "egress_tb_mes":   10,                     # 10 TB de transferencia saliente / mes
}

_GB = 1024 ** 3
_TB = 1024 ** 4


def _leer_meminfo():
    """Devuelve (total_bytes, disponible_bytes) desde /proc/meminfo."""
    total = disponible = None
    try:
        with open("/proc/meminfo", "r") as f:
            for linea in f:
                if linea.startswith("MemTotal:"):
                    total = int(linea.split()[1]) * 1024
                elif linea.startswith("MemAvailable:"):
                    disponible = int(linea.split()[1]) * 1024
                if total is not None and disponible is not None:
                    break
    except Exception:
        pass
    return total, disponible


def _leer_red():
    """Suma bytes enviados/recibidos de todas las interfaces (excepto lo)."""
    enviados = recibidos = 0
    try:
        with open("/proc/net/dev", "r") as f:
            for linea in f.readlines()[2:]:
                if ":" not in linea:
                    continue
                iface, datos = linea.split(":", 1)
                if iface.strip() == "lo":
                    continue
                campos = datos.split()
                recibidos += int(campos[0])
                enviados  += int(campos[8])
    except Exception:
        pass
    return enviados, recibidos


def _uptime_segundos():
    try:
        with open("/proc/uptime", "r") as f:
            return float(f.read().split()[0])
    except Exception:
        return None


def _pct(usado, total):
    if not total:
        return 0.0
    return round(min(100.0, max(0.0, usado / total * 100)), 1)


def get_recursos() -> dict:
    """Snapshot de uso de recursos del host vs límites Always Free."""
    cpu_count = os.cpu_count() or LIMITES["ocpu"]

    # CPU: carga promedio (Unix). load/cpu_count ≈ utilización.
    try:
        load1, load5, load15 = os.getloadavg()
    except (OSError, AttributeError):
        load1 = load5 = load15 = 0.0
    cpu_pct = _pct(load1, cpu_count)

    # RAM
    ram_total, ram_disp = _leer_meminfo()
    ram_usado = (ram_total - ram_disp) if (ram_total and ram_disp is not None) else None

    # Disco (raíz)
    try:
        du = shutil.disk_usage("/")
        disco_total, disco_usado, disco_libre = du.total, du.used, du.free
    except Exception:
        disco_total = disco_usado = disco_libre = None

    # Red (acumulado desde el último arranque)
    net_env, net_rec = _leer_red()
    uptime = _uptime_segundos()

    return {
        "timestamp": int(time.time()),
        "uptime_segundos": uptime,
        "cpu": {
            "ocpu": cpu_count,
            "limite_ocpu": LIMITES["ocpu"],
            "uso_pct": cpu_pct,
            "load_1": round(load1, 2),
            "load_5": round(load5, 2),
            "load_15": round(load15, 2),
        },
        "ram": {
            "total_gb": round(ram_total / _GB, 2) if ram_total else None,
            "usado_gb": round(ram_usado / _GB, 2) if ram_usado is not None else None,
            "limite_gb": LIMITES["ram_gb"],
            "uso_pct": _pct(ram_usado, ram_total) if (ram_total and ram_usado is not None) else None,
        },
        "disco": {
            "total_gb": round(disco_total / _GB, 2) if disco_total else None,
            "usado_gb": round(disco_usado / _GB, 2) if disco_usado else None,
            "libre_gb": round(disco_libre / _GB, 2) if disco_libre else None,
            "limite_gb": LIMITES["almacenamiento_gb"],
            # El % se mide contra el límite Always Free (200 GB), no contra el disco físico.
            "uso_pct": _pct(disco_usado, LIMITES["almacenamiento_gb"] * _GB) if disco_usado else None,
        },
        "red": {
            "enviado_gb": round(net_env / _GB, 2),
            "recibido_gb": round(net_rec / _GB, 2),
            "limite_egress_tb_mes": LIMITES["egress_tb_mes"],
            # Acumulado desde el arranque, NO mensual (el contador se reinicia al reiniciar).
            "egress_pct_aprox": _pct(net_env, LIMITES["egress_tb_mes"] * _TB),
            "nota": "Tráfico acumulado desde el último reinicio (no es el total mensual).",
        },
    }
