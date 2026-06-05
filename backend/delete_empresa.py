#!/usr/bin/env python3
"""
Elimina una empresa de prueba y TODOS sus registros asociados.

Uso (desde el directorio backend/):
  python delete_empresa.py --list
  python delete_empresa.py --dry-run --id 3 5
  python delete_empresa.py --id 3 5
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sales.db").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
)

# ---------------------------------------------------------------------------
# Orden de borrado: siempre hijos antes que padres para respetar FK.
# {eid} se reemplaza por el empresa_id real antes de ejecutar.
# ---------------------------------------------------------------------------
PASOS = [
    # ── hijos de cuotas_prestamo ────────────────────────────────────────────
    ("evidencias_cobro",
     "DELETE FROM evidencias_cobro WHERE cuota_id IN "
     "(SELECT id FROM cuotas_prestamo WHERE prestamo_id IN "
     "(SELECT id FROM prestamos WHERE empresa_id={eid}))"),

    # ── hijos de prestamos ──────────────────────────────────────────────────
    ("cuotas_prestamo",
     "DELETE FROM cuotas_prestamo WHERE prestamo_id IN "
     "(SELECT id FROM prestamos WHERE empresa_id={eid})"),

    # ── hijos de devoluciones ───────────────────────────────────────────────
    ("devolucion_items",
     "DELETE FROM devolucion_items WHERE devolucion_id IN "
     "(SELECT id FROM devoluciones WHERE empresa_id={eid})"),

    # ── hijos de compras ────────────────────────────────────────────────────
    ("detalles_compra",
     "DELETE FROM detalles_compra WHERE compra_id IN "
     "(SELECT id FROM compras WHERE empresa_id={eid})"),
    ("pagos_compra",
     "DELETE FROM pagos_compra WHERE compra_id IN "
     "(SELECT id FROM compras WHERE empresa_id={eid})"),

    # ── hijos de recetas ────────────────────────────────────────────────────
    ("receta_items",
     "DELETE FROM receta_items WHERE receta_id IN "
     "(SELECT id FROM recetas WHERE empresa_id={eid})"),
    ("receta_servicios",
     "DELETE FROM receta_servicios WHERE receta_id IN "
     "(SELECT id FROM recetas WHERE empresa_id={eid})"),
    ("lotes_produccion",
     "DELETE FROM lotes_produccion WHERE receta_id IN "
     "(SELECT id FROM recetas WHERE empresa_id={eid})"),

    # ── hijos de pedidos_virtuales ──────────────────────────────────────────
    ("detalles_pedido_virtual",
     "DELETE FROM detalles_pedido_virtual WHERE pedido_id IN "
     "(SELECT id FROM pedidos_virtuales WHERE empresa_id={eid})"),

    # ── hijos de restaurante_comandas (sin empresa_id propio) ───────────────
    ("restaurante_comanda_items",
     "DELETE FROM restaurante_comanda_items WHERE comanda_id IN "
     "(SELECT id FROM restaurante_comandas WHERE empresa_id={eid})"),

    # ── hijos de ordenes_trabajo ────────────────────────────────────────────
    ("orden_productos",
     "DELETE FROM orden_productos WHERE empresa_id={eid}"),
    ("orden_servicios",
     "DELETE FROM orden_servicios WHERE empresa_id={eid}"),
    ("evidencias",
     "DELETE FROM evidencias WHERE empresa_id={eid}"),

    # ── hijos de suscripciones_parqueadero ──────────────────────────────────
    ("pagos_parqueadero",
     "DELETE FROM pagos_parqueadero WHERE empresa_id={eid}"),

    # ── notificaciones: solo empresa_id (no tiene user_id) ──────────────────
    ("notificaciones",
     "DELETE FROM notificaciones WHERE empresa_id={eid}"),

    # ── credenciales biométricas (user_id → users) ──────────────────────────
    ("credenciales_biometricas",
     "DELETE FROM credenciales_biometricas WHERE user_id IN "
     "(SELECT id FROM users WHERE empresa_id={eid})"),

    # ── role_modules (sin empresa_id propio) ────────────────────────────────
    ("role_modules",
     "DELETE FROM role_modules WHERE role_id IN "
     "(SELECT id FROM roles WHERE empresa_id={eid})"),

    # ── tablas de negocio principales ────────────────────────────────────────
    ("prestamos",                  "DELETE FROM prestamos WHERE empresa_id={eid}"),
    ("devoluciones",               "DELETE FROM devoluciones WHERE empresa_id={eid}"),
    ("compras",                    "DELETE FROM compras WHERE empresa_id={eid}"),
    ("recetas",                    "DELETE FROM recetas WHERE empresa_id={eid}"),
    ("restaurante_comandas",       "DELETE FROM restaurante_comandas WHERE empresa_id={eid}"),
    ("pedidos_virtuales",          "DELETE FROM pedidos_virtuales WHERE empresa_id={eid}"),
    ("ordenes_trabajo",            "DELETE FROM ordenes_trabajo WHERE empresa_id={eid}"),
    ("suscripciones_parqueadero",  "DELETE FROM suscripciones_parqueadero WHERE empresa_id={eid}"),
    ("accesos_parqueadero",        "DELETE FROM accesos_parqueadero WHERE empresa_id={eid}"),
    ("envios_whatsapp_parqueadero","DELETE FROM envios_whatsapp_parqueadero WHERE empresa_id={eid}"),
    ("vehiculos",                  "DELETE FROM vehiculos WHERE empresa_id={eid}"),
    ("lavadero_orden_detalles",    "DELETE FROM lavadero_orden_detalles WHERE empresa_id={eid}"),
    ("lavadero_ordenes",           "DELETE FROM lavadero_ordenes WHERE empresa_id={eid}"),
    # detalles_venta: refs venta_id y producto_id → antes de ventas y productos
    ("detalles_venta (empresa)",   "DELETE FROM detalles_venta WHERE empresa_id={eid}"),
    ("detalles_venta (venta_id)",
     "DELETE FROM detalles_venta WHERE venta_id IN "
     "(SELECT id FROM ventas WHERE empresa_id={eid})"),
    # pagos: refs venta_id → antes de ventas
    ("pagos (empresa)",            "DELETE FROM pagos WHERE empresa_id={eid}"),
    ("pagos (venta_id)",
     "DELETE FROM pagos WHERE venta_id IN "
     "(SELECT id FROM ventas WHERE empresa_id={eid})"),
    # movimientos_puntos refs venta_id y cliente_id → antes de ventas y clientes
    ("movimientos_puntos (empresa)","DELETE FROM movimientos_puntos WHERE empresa_id={eid}"),
    ("movimientos_puntos (venta)",
     "DELETE FROM movimientos_puntos WHERE venta_id IN "
     "(SELECT id FROM ventas WHERE empresa_id={eid})"),
    ("movimientos_puntos (cliente)",
     "DELETE FROM movimientos_puntos WHERE cliente_id IN "
     "(SELECT id FROM clientes WHERE empresa_id={eid})"),
    # ventas: refs users.id (operador_id) y clientes.id → ANTES de users y clientes
    ("ventas",                     "DELETE FROM ventas WHERE empresa_id={eid}"),
    # clientes: después de ventas, prestamos, movimientos_puntos
    ("clientes",                   "DELETE FROM clientes WHERE empresa_id={eid}"),
    # users: después de ventas (ventas.operador_id → users.id)
    ("users",                      "DELETE FROM users WHERE empresa_id={eid}"),
    # roles: después de users (users.role_id → roles.id)
    ("roles",                      "DELETE FROM roles WHERE empresa_id={eid}"),
    ("producto_impuestos",         "DELETE FROM producto_impuestos WHERE empresa_id={eid}"),
    ("inventory_movements",        "DELETE FROM inventory_movements WHERE empresa_id={eid}"),
    ("lotes_existencias",          "DELETE FROM lotes_existencias WHERE empresa_id={eid}"),
    ("producto_variantes",         "DELETE FROM producto_variantes WHERE empresa_id={eid}"),
    ("productos",                  "DELETE FROM productos WHERE empresa_id={eid}"),
    ("tipos_impuesto",             "DELETE FROM tipos_impuesto WHERE empresa_id={eid}"),
    ("empresa_grupo_config",       "DELETE FROM empresa_grupo_config WHERE empresa_id={eid}"),
    ("grupos_producto",            "DELETE FROM grupos_producto WHERE empresa_id={eid}"),
    ("lavadero_config",            "DELETE FROM lavadero_config WHERE empresa_id={eid}"),
    ("parqueadero_config",         "DELETE FROM parqueadero_config WHERE empresa_id={eid}"),
    ("metodos_pago_parqueadero",   "DELETE FROM metodos_pago_parqueadero WHERE empresa_id={eid}"),
    ("plantillas_whatsapp",        "DELETE FROM plantillas_whatsapp WHERE empresa_id={eid}"),
    ("restaurante_mesas",          "DELETE FROM restaurante_mesas WHERE empresa_id={eid}"),
    ("restaurante_config",         "DELETE FROM restaurante_config WHERE empresa_id={eid}"),
    ("links_pago_empresa",         "DELETE FROM links_pago_empresa WHERE empresa_id={eid}"),
    ("registros_productividad",    "DELETE FROM registros_productividad WHERE empresa_id={eid}"),
    ("cortes_caja",                "DELETE FROM cortes_caja WHERE empresa_id={eid}"),
    ("gastos",                     "DELETE FROM gastos WHERE empresa_id={eid}"),
    ("resoluciones_dian",          "DELETE FROM resoluciones_dian WHERE empresa_id={eid}"),
    ("registros_pagos (SaaS)",     "DELETE FROM registros_pagos WHERE empresa_id={eid}"),
    ("saas_audit_logs",            "DELETE FROM saas_audit_logs WHERE empresa_id={eid}"),

    # ── empresa (último) ─────────────────────────────────────────────────────
    ("EMPRESA",                    "DELETE FROM empresas WHERE id={eid}"),
]


def listar_empresas(conn):
    rows = conn.execute(text("SELECT id, nombre, nit, plan_type, is_active FROM empresas ORDER BY id")).fetchall()
    print(f"\n{'ID':>4}  {'Nombre':<40}  {'NIT':<20}  {'Plan':<12}  Activa")
    print("─" * 90)
    for r in rows:
        activa = "✓" if r[4] else "✗"
        print(f"{r[0]:>4}  {(r[1] or '')[:40]:<40}  {(r[2] or ''):<20}  {(r[3] or ''):<12}  {activa}")
    print()


def get_existing_tables(conn) -> set:
    if IS_SQLITE:
        rows = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    else:
        rows = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'")).fetchall()
    return {r[0] for r in rows}


def table_from_sql(sql: str) -> str:
    """Extract the main table name from a DELETE or SELECT COUNT(*) statement."""
    # "DELETE FROM table_name WHERE ..." → "table_name"
    parts = sql.split()
    for i, w in enumerate(parts):
        if w.upper() in ("FROM", "INTO"):
            return parts[i + 1].split("(")[0].strip()
    return ""


def delete_empresa(conn, empresa_id: int, dry_run: bool = False) -> bool:
    row = conn.execute(
        text("SELECT id, nombre FROM empresas WHERE id = :eid"),
        {"eid": empresa_id}
    ).fetchone()
    if not row:
        print(f"  [!] Empresa ID {empresa_id} no encontrada.")
        return False

    existing = get_existing_tables(conn)
    tag = "[DRY-RUN] " if dry_run else ""
    print(f"\n{tag}Empresa {row[0]}: {row[1]}")
    print("─" * 60)

    for label, sql_tpl in PASOS:
        sql = sql_tpl.replace("{eid}", str(empresa_id))
        main_table = table_from_sql(sql)

        if main_table and main_table not in existing:
            print(f"  [n/a]  {label:<45}  (tabla no existe)")
            continue

        count_sql = sql.replace("DELETE FROM", "SELECT COUNT(*) FROM", 1)
        try:
            n = conn.execute(text(count_sql)).scalar() or 0
        except Exception:
            n = 0

        if not dry_run and n:
            conn.execute(text(sql))

        estado = "skip" if dry_run else ("ok" if n else "--")
        print(f"  [{estado}]  {label:<45} {n:>6}")

    return True


def main():
    import argparse
    p = argparse.ArgumentParser(
        description="Eliminar empresa(s) de prueba y todos sus datos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python delete_empresa.py --list
  python delete_empresa.py --dry-run --id 3 5
  python delete_empresa.py --id 3
""")
    p.add_argument("--list",    action="store_true", help="Listar todas las empresas")
    p.add_argument("--id",      nargs="+", type=int, help="ID(s) de empresa a eliminar")
    p.add_argument("--dry-run", action="store_true", help="Ver qué se borraría sin tocar la base de datos")
    args = p.parse_args()

    with engine.connect() as conn:
        if IS_SQLITE:
            # SQLite no enforces FK constraints by default; dejamos off para mayor robustez
            conn.execute(text("PRAGMA foreign_keys = OFF"))

        if args.list or not args.id:
            listar_empresas(conn)
            if not args.id:
                print("Usa --id ID1 ID2 ... para eliminar empresas")
                print("Usa --dry-run --id ID para previsualizar sin cambios")
                return

        if args.id:
            if not args.dry_run:
                print(f"\n⚠️  Se eliminarán PERMANENTEMENTE las empresa(s) con ID: {args.id}")
                print("    Esta acción NO se puede deshacer.")
                confirm = input("\nEscribe exactamente 'SI' para confirmar: ")
                if confirm.strip() != "SI":
                    print("Cancelado.")
                    return

            for eid in args.id:
                try:
                    ok = delete_empresa(conn, eid, dry_run=args.dry_run)
                    if ok and not args.dry_run:
                        conn.commit()
                        print(f"\n  ✅ Empresa {eid} eliminada correctamente.\n")
                    elif ok and args.dry_run:
                        print(f"\n  (dry-run completado — no se realizaron cambios)\n")
                except Exception as exc:
                    conn.rollback()
                    print(f"\n  ❌ Error eliminando empresa {eid}: {exc}")
                    import traceback; traceback.print_exc()
                    sys.exit(1)

        if IS_SQLITE:
            conn.execute(text("PRAGMA foreign_keys = ON"))


if __name__ == "__main__":
    main()
