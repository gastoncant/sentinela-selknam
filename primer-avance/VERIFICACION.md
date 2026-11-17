# Verificación del primer avance

- Compilación TypeScript y Vite final ejecutada correctamente. Vite avisa que el paquete JS supera 500 kB sin comprimir, con unos 166 kB gzip. El rendimiento debe medirse con conexiones representativas.
- npm install informó cero vulnerabilidades conocidas para las dependencias resueltas.
- node verify-db.mjs ejecutó el SQL en PostgreSQL embebido PGlite. Verificó 200 candidatos, lectura anónima, prohibición de modificar publicaciones y membresías, aislamiento de motivos e historial, autor desde sesión, control de versión y rollback.
- Navegador real sobre la compilación. Verificados mapa, cortina temporal, ficha, guardado local, persistencia tras recarga y filtro de vegetación con 131 resultados.
- El recorte anterior estaba sobre agua abierta y tenía una representación oscura. Para esta entrega se procesó un recorte costero diferente, se fijó una escala visual común con gamma 0,5 y se separaron los ensayos locales por versión del producto.
- PDF exportado desde Word y revisado visualmente en sus tres páginas. No se encontró LibreOffice en esta estación.
- Pendiente configurar un proyecto Supabase remoto, comprobar Auth y API reales, repetir aislamiento con cuentas reales, ensayar respaldo remoto y validar las señales con evidencia independiente.
- El proceso de lectura del catálogo y las escenas se ejecutó contra recursos públicos. Los polígonos son resultados espectrales exploratorios y no cuentan con confirmación biológica.

## Revisión de la interfaz

Se simplificó el recorrido a comparar imágenes, elegir una zona y guardar una revisión. El navegador verificó activación con Enter, ajuste del comparador con flechas, apertura de ficha con traslado de foco, validación de un motivo vacío y confirmación de guardado. El aviso de comentario pendiente conserva el texto al elegir seguir escribiendo y permite volver a la lista tras descartarlo explícitamente.

En una ventana de 390 × 844 se verificó ausencia de desbordamiento horizontal, texto base de 18 px y botones principales con alturas entre 50 y 84 px. Los contrastes calculados son 12,85 para texto principal sobre blanco, 6,78 para texto secundario, 6,31 para texto blanco en el botón azul y 9,12 para la confirmación de guardado. Son controles puntuales de la implementación. Sigue pendiente una evaluación con usuarios del perfil previsto y lector de pantalla.

## Reproducir el análisis

Desde un entorno Python 3.12 con Rasterio, NumPy y Pillow instalados:

```sh
python process_pilot.py recalculo
```

El manifiesto de la versión entregada conserva el método, las escenas y hashes. La carpeta sources contiene los dos metadatos STAC utilizados. El centro solicitado es −67,30029166119341°, −54,5262142810433°. La grilla efectiva es EPSG 32719, con límites 609040, 3955640, 610960, 3957560 metros.

