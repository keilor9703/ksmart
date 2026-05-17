import sqlite3
import os
import json

db_path = "backend/sales.db"
if not os.path.exists(db_path):
    db_path = "sales.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT id, nombre, imagenes, mostrar_en_catalogo FROM productos WHERE mostrar_en_catalogo = 1 LIMIT 5;")
rows = cursor.fetchall()
print("Productos en catálogo:")
for row in rows:
    print(f"ID: {row[0]}, Nombre: {row[1]}, Mostrar: {row[3]}")
    print(f"Imagenes (raw): {row[2][:50]}..." if row[2] else "Imagenes: None")
conn.close()
