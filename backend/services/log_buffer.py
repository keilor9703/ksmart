"""
Buffer circular en memoria de los logs del backend.

Un handler de logging guarda los últimos N registros para que el SuperAdmin los
consulte en vivo desde la UI, sin entrar por SSH ni ejecutar journalctl/tail.

Captura todo lo que pase por el módulo `logging` (la app entera lo usa).
"""
import logging
import threading
import time
from collections import deque
from itertools import count

_MAX = 2000  # registros conservados en memoria

_seq = count(1)
_lock = threading.Lock()
_buffer = deque(maxlen=_MAX)


class RingBufferHandler(logging.Handler):
    """Handler que acumula registros formateados en un deque acotado."""

    def emit(self, record):
        try:
            msg = record.getMessage()
            if record.exc_info:
                msg += "\n" + self.format(record).split("\n", 1)[-1] if self.formatter else ""
        except Exception:
            msg = str(record.msg)
        item = {
            "id": next(_seq),
            "ts": record.created,
            "level": record.levelname,
            "logger": record.name,
            "message": msg,
        }
        with _lock:
            _buffer.append(item)


def get_logs(since_id: int = 0, level: str = None, q: str = None, limit: int = 500):
    """Devuelve registros con id > since_id (para refresco incremental),
    filtrados opcionalmente por nivel mínimo y texto."""
    niveles = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40, "CRITICAL": 50}
    min_lvl = niveles.get((level or "").upper())
    needle = (q or "").lower().strip()

    with _lock:
        items = list(_buffer)

    out = []
    for it in items:
        if it["id"] <= since_id:
            continue
        if min_lvl is not None and niveles.get(it["level"], 20) < min_lvl:
            continue
        if needle and needle not in it["message"].lower() and needle not in it["logger"].lower():
            continue
        out.append(it)

    # Si no es refresco incremental, devolver solo los últimos `limit`.
    if since_id == 0 and len(out) > limit:
        out = out[-limit:]
    return {"server_time": time.time(), "logs": out, "buffer_max": _MAX}


def install(level=logging.INFO):
    """Adjunta el handler al root logger (idempotente)."""
    root = logging.getLogger()
    if any(isinstance(h, RingBufferHandler) for h in root.handlers):
        return
    handler = RingBufferHandler()
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter("%(message)s"))
    root.addHandler(handler)
    if root.level > level:
        root.setLevel(level)
