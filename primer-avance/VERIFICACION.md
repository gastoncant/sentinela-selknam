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

## Identidad, relieve y lectura de evidencias

La compilación TypeScript/Vite pasó con el nuevo logo, las capas del selector, la guía visible y las ampliaciones por ficha. Se conservaron las escenas, el código del Worker científico y los identificadores de las ejecuciones. Las pruebas de índices, geometrías, máscaras y referencias geográficas siguen pasando.

En el navegador se comprobaron OpenTopoMap con teselas de relieve cargadas, el cambio a OpenStreetMap, el zoom y la apertura del piloto. La revisión detectó un error de limpieza de eventos al retirar una capa: se corrigió conservando los eventos internos de Leaflet y retirando solo el manejador propio. Al repetir el cambio de capa, zoom y apertura no se registraron errores JavaScript nuevos.

En la zona de agua 6 del piloto, las dos ampliaciones tienen el mismo viewBox `124 48 68 68`, la misma geometría y sus respectivas imágenes de 2020 y 2026. En 390 × 844 midieron 153 px por lado cada una y el documento 375 px de ancho, sin desbordamiento horizontal. Se comprobó el avance del deslizador con teclado a 51 %, la lista ordenada por superficie y el footer con únicamente el texto «Gobierno de TDF» y el logo cargado. Se revisó también la distribución en 1440 × 1000 y se mantuvieron controles principales de al menos 50 px.

La lectura visual no valida la causa ambiental de los polígonos. El piloto costero puede incluir cambios del agua que ya existía, variaciones de marea y otras causas ajenas a diques. Las limitaciones y criterios de validación se detallan en `CRITERIOS_DE_MADUREZ.md`. La evaluación con operadores, el lector de pantalla y las mediciones en conexiones lentas siguen pendientes. El PNG original del logo ocupa unos 661 kB y queda sujeto al presupuesto de recursos del futuro despliegue.

## Revisión del logo y footer para la hackathon

Se reemplazó la marca por una versión con cuernos laterales, máscara ovalada, franjas y colores fueguinos, generada a partir de dos referencias visuales aportadas por el usuario. El PNG anterior se conserva en `design/archive`; las referencias recibidas no se publicaron en el sitio. Cabecera y footer usan el nuevo nombre de archivo `ko-taix-sentinela-v2.png`, evitando reutilizar una versión cacheada de la marca anterior.

La compilación TypeScript/Vite pasó. El navegador mostró el logo cargado, Sentinela Selknam, Gobierno de TDF, Hackathon Soberanía Tech 2026 y las leyendas de derechos, licencias de terceros y alcance del prototipo. En 390 × 844, el documento midió 375 px de ancho, sin desbordamiento horizontal. La revisión también comprobó la composición del footer en escritorio. El análisis científico y sus datos no se modificaron.

## Guardado y exportación de revisiones

En una compilación local, se generó el recorte central, se abrió una zona desde la lista y se comprobó el foco en el formulario, la validación del motivo y la confirmación de guardado. El PDF de la zona de vegetación 461 contenía dos imágenes Sentinel-2 con el mismo contorno. Se verificaron el texto del comentario, las fechas, el estado y la composición de la página renderizada. El CSV del mismo recorte tenía una fila con el identificador, la revisión y la cobertura correspondiente.

Tras agrupar las descargas, se guardó una revisión en el piloto preparado y se verificó el panel al volver a la lista y al reabrir la zona después de recargar. Desde la lista, el CSV quedó disponible y el PDF se habilitó en la ficha revisada. Pasaron ambas compilaciones, la web y la del HTML único. GitHub Pages sirvió el paquete publicado con los dos botones y el módulo PDF. Los ensayos de guardado se hicieron con almacenamiento local de prueba.

