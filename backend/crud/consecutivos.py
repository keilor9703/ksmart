"""Consecutivos por empresa (multi-tenant).

Cada empresa lleva sus propios contadores (ultimo_numero_venta,
ultimo_numero_lote) en su fila de 'empresas'. El incremento se hace con un
UPDATE atómico con RETURNING: Postgres serializa los UPDATE sobre la misma
fila, así que dos ventas simultáneas de la misma empresa nunca reciben el
mismo número, sin locks explícitos ni transacciones serializables.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

# Whitelist: nunca interpolar nombres de columna que vengan de afuera.
_CAMPOS_VALIDOS = {"ultimo_numero_venta", "ultimo_numero_lote"}


def next_consecutivo(db: Session, empresa_id: int, campo: str) -> int:
    """Incrementa atómicamente el contador `campo` de la empresa y devuelve el nuevo valor.

    Participa en la transacción abierta de `db` (no hace commit): si la venta o
    el lote se revierte, el número también, sin dejar huecos por errores.
    """
    if campo not in _CAMPOS_VALIDOS:
        raise ValueError(f"Campo de consecutivo no permitido: {campo}")
    row = db.execute(
        text(
            f"UPDATE empresas SET {campo} = COALESCE({campo}, 0) + 1 "
            f"WHERE id = :empresa_id RETURNING {campo}"
        ),
        {"empresa_id": empresa_id},
    ).first()
    if row is None:
        raise ValueError(f"Empresa {empresa_id} no existe")
    return int(row[0])
