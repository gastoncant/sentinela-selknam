# Verificación del primer avance

- Compilación TypeScript y Vite final ejecutada correctamente. Vite avisa que el paquete JS supera 500 kB sin comprimir, con unos 166 kB gzip. El rendimiento debe medirse con conexiones representativas.
- npm install informó cero vulnerabilidades conocidas para las dependencias resueltas.
- node verify-db.mjs ejecutó el SQL en PostgreSQL embebido PGlite. Verificó 200 candidatos, lectura anónima, prohibición de modificar publicaciones y membresías, aislamiento de motivos e historial, autor desde sesión, control de versión y rollback.
- Navegador real sobre la compilación. Verificados mapa, cortina temporal, ficha, guardado local, persistencia tras recarga y filtro de vegetación con 131 resultados.
- El recorte anterior estaba sobre agua abierta y tenía una representación oscura. Para esta entrega se procesó un recorte costero diferente, se fijó una escala visual común con gamma 0,5 y se separaron los ensayos locales por versión del producto.
- PDF exportado desde Word y revisado visualmente en sus tres páginas. No se encontró LibreOffice en esta estación.
- Pendiente configurar un proyecto Supabase remoto, comprobar Auth y API reales, repetir aislamiento con cuentas reales, ensayar respaldo remoto y validar las señales con evidencia independiente.
- El proceso de lectura del catálogo y las escenas se ejecutó contra recursos públicos. Los polígonos son resultados espectrales exploratorios y no cuentan con confirmación biológica.

## Reproducir el análisis

Desde un entorno Python 3.12 con Rasterio, NumPy y Pillow instalados:

```sh
python process_pilot.py recalculo
```

El manifiesto de la versión entregada conserva el método, las escenas y hashes. La carpeta sources contiene los dos metadatos STAC utilizados. El centro solicitado es −67,30029166119341°, −54,5262142810433°. La grilla efectiva es EPSG 32719, con límites 609040, 3955640, 610960, 3957560 metros.

