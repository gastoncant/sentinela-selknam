# Módulos de Sentinela Selknam

Este inventario describe la demo pública. Para usarla, consultá el [instructivo](GUIA_DE_USO.md). Las etapas de infraestructura futura se documentan en [Arquitectura objetivo](../ARQUITECTURA_OBJETIVO.md).

| Módulo | Qué hace | Dónde está |
| --- | --- | --- |
| Selector de recortes | Usa el contorno del sector argentino de la Isla Grande, atajos norte/centro/sur y capas de relieve, ríos y caminos como referencia. | [CropSelector.tsx](src/CropSelector.tsx), [cartografía y fuentes](public/province/manifest.json) |
| Procesamiento Sentinel-2 | Busca escenas, lee bandas COG y analiza el recorte a 10 m en un Worker. Usa máscaras comunes para calcular NDWI, NDVI, superficie y contornos candidatos. | [crop.worker.ts](src/crop.worker.ts), [crop-analysis.ts](src/crop-analysis.ts), [método](README.md#método-de-los-recortes-bajo-demanda) |
| Piloto preparado | Incluye imágenes, geometrías y manifiesto de un recorte costero real de 3,69 km² con 200 componentes exploratorios. Permite ensayar el recorrido sin consultar nuevas escenas. | [productos del piloto](public/pilot), [manifiesto](public/pilot/manifest.json) |
| Indicador de progreso | Señala la etapa de búsqueda, lectura y preparación de las imágenes y acompaña la opción de cancelar. El porcentaje de procesamiento es estimado. | [LoadingProgress.tsx](src/LoadingProgress.tsx), [control del recorte](src/main.tsx) |
| Comparador y lectura visual | Muestra las fechas efectivas, la cortina 2020/2026, la cobertura común, la lista de zonas y su leyenda. La ficha encuadra la misma zona en las dos imágenes. | [main.tsx](src/main.tsx), [ReadingGuide.tsx](src/ReadingGuide.tsx), [EvidencePair.tsx](src/EvidencePair.tsx), [evidence-crop.ts](src/evidence-crop.ts) |
| Lista de pendientes | Filtra zonas todavía sin revisión y permite ordenar por superficie, cambio de señal o número de zona. | [review-queue.ts](src/review-queue.ts) |
| Identidad de recortes | Vincula la revisión con el producto calculado usando escenas, fechas, grilla, método y hashes de bandas. | [run-identity.ts](src/run-identity.ts), [crop.worker.ts](src/crop.worker.ts) |
| Guardado y reapertura | Conserva hasta seis recortes en IndexedDB y la última revisión por zona en `localStorage` en la demo pública. Valida el motivo y controla la versión para evitar sobrescrituras silenciosas. | [crop-cache.ts](src/crop-cache.ts), [main.tsx](src/main.tsx) |
| Panel Descargar revisiones | Reúne el PDF de la zona revisada y el CSV de todas las zonas revisadas del recorte. | [ReviewExports.tsx](src/ReviewExports.tsx), [review-export.ts](src/review-export.ts) |
| Descargas para especialistas | Entrega geometrías GeoJSON, imágenes PNG y manifiesto JSON del recorte activo. | [main.tsx](src/main.tsx), [tipos y manifiesto](src/crop-types.ts) |
| Integración Supabase | Prepara autenticación, permisos por organización y revisiones compartidas para el piloto. Probada con PostgreSQL embebido. La configuración remota sigue pendiente y los recortes bajo demanda conservan revisión local. | [configuración y alcance](README.md#conectar-supabase-free), [migración inicial](supabase/001_pilot.sql), [datos del piloto](supabase/002_seed.sql) |

El PDF se genera en el navegador a partir de la última revisión guardada y de los PNG de origen, recortados con la misma geometría que usa la ficha. El CSV incluye una fila por zona revisada del recorte activo. Los borradores y el historial de versiones quedan fuera de esas exportaciones. El GeoJSON aporta la geometría y el JSON conserva fuentes, fechas y parámetros.

GitHub Actions verifica el build, el análisis de recortes, la integridad de la cartografía y las reglas SQL del piloto. La [bitácora de verificación](VERIFICACION.md) registra los ensayos observados en navegador. La [propuesta DevOps](../DEVOPS_AWS.md) y el [Terraform](../infra/terraform/README.md) describen el despliegue AWS previsto, incluidas alertas y observabilidad. La demo procesa y exporta desde el navegador.
