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

## Recortes Sentinel-2 bajo demanda

Se sustituyó el comparador MODIS regional por un selector de áreas que abre comparaciones detalladas de Sentinel-2. Se retiró de la interfaz la sección de alertas y su enlace; SNS queda en la documentación de arquitectura futura.

`node verify-crop.mjs` comprueba grilla y alineación, índices, denominadores, nodata, nubes, conectividad de cuatro vecinos, ruido menor de cuatro celdas, aislamiento de identificadores y conservación de superficies y huecos. La compilación incluye el procesador en un Worker independiente y no requiere un servidor de análisis.

El navegador procesó el centro −67,65°, −54,48° con escenas S2A_19FEV_20200208_1_L2A y S2A_19FEV_20260313_1_L2A. El resultado final usó 243.104 de 262.144 píxeles (92,7 %) y produjo 185 componentes de agua y 471 de vegetación. El contraste Python/Rasterio sobre las mismas escenas reprodujo cobertura, conteos y los ocho hashes de bandas muestreadas. Durante la revisión se corrigió una diferencia en el umbral causada por redondeo float32; las bandas e índices finales usan float64. Son señales exploratorias; no se validó su causa biológica.

Un segundo recorte en −68,05°, −53,55° generó 130 componentes con 99,6 % de cobertura común. Se verificó la reapertura del recorte central desde IndexedDB después de recargar, el guardado de una revisión propia y la conservación de un comentario al cancelar el cambio de área. La revisión del recorte central no apareció en la zona homónima del norte. No se registraron errores JavaScript en esos recorridos. En 390 × 844, el documento midió 375 px de ancho, sin desbordamiento horizontal. Se comprobó la ausencia de la sección de alertas en el contenido de la aplicación.

Las pruebas de PostgreSQL embebido siguen cubriendo el piloto original y sus 200 candidatos. El SQL actual no importa ejecuciones nuevas: sus revisiones se mantienen locales. Persistencia compartida, validación ambiental, lectores de pantalla y rendimiento con conectividad limitada siguen pendientes. La compilación avisa que el paquete JS supera 500 kB, con aproximadamente 330 kB gzip, al incorporar el lector COG y el Worker.

## Indicadores de carga

En el navegador sobre la compilación se verificó la carga inicial del piloto (50 %), una comparación nueva con avance visible entre búsqueda y lectura de escenas (4 % a 54 %), la apertura correcta del resultado y la cancelación inmediata con retirada del indicador y controles habilitados. Al abrir el piloto preparado, la barra llegó al 100 % después de cargar las dos imágenes. No se registraron errores JavaScript durante la comparación. Los porcentajes del proceso son estimaciones por etapas; la animación no cambia el código científico del Worker ni la identidad de sus productos, y la revisión local de la ejecución existente se conservó.

## Reproducir el análisis del piloto

Desde un entorno Python 3.12 con Rasterio, NumPy y Pillow instalados:

```sh
python process_pilot.py recalculo
```

El manifiesto de la versión entregada conserva el método, las escenas y hashes. La carpeta sources contiene los dos metadatos STAC utilizados. El centro solicitado es −67,30029166119341°, −54,5262142810433°. La grilla efectiva es EPSG 32719, con límites 609040, 3955640, 610960, 3957560 metros.

