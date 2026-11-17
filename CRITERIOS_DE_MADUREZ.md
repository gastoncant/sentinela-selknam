# De demostración a herramienta operativa

La interfaz actual permite elegir recortes, comparar dos observaciones, consultar señales y registrar revisiones locales. Una presentación cuidada mejora ese trabajo; la seriedad del sistema necesita también evidencia ambiental, continuidad de los datos y responsabilidades de operación.

| Prioridad | Trabajo concreto | Criterio de aceptación |
| --- | --- | --- |
| 1. Validación ambiental | Acordar áreas con especialistas, definir máscaras de océano y ambientes no pertinentes y contrastar candidatos y áreas sin señales con referencias independientes y observaciones de campo | Se conocen falsos positivos, omisiones, limitaciones por ambiente y acuerdo entre revisores. Las señales y la confirmación de castores tienen estados distintos |
| 2. Comparabilidad temporal | Ajustar ventanas y controles de nieve, sombras, agua, calidad SCL y estacionalidad; incorporar más de dos observaciones cuando la pregunta sea evolución | Cada conclusión conserva fechas, superficie observable y causas alternativas. Un par de imágenes no se presenta como tasa de avance de diques |
| 3. Datos compartidos | Configurar Supabase real, importar ejecuciones y candidatos nuevos con IDs durables, roles, organizaciones, evidencias e historial | Dos operadores revisan un mismo resultado sin perder decisiones; cuentas de organizaciones diferentes no acceden a información ajena |
| 4. Reproducibilidad | Conservar insumos o recortes inmutables, hashes de contenido, parámetros y versión del método; detectar cambios posteriores del proveedor | Una ejecución se reproduce y los cambios de insumos generan una versión distinta sin reutilizar revisiones incompatibles |
| 5. Procesamiento institucional | Cola de trabajos del servidor, cuotas, reintentos, productos por ejecución y cobertura territorial fechada | Cerrar el navegador no pierde un trabajo; fallos y áreas sin observación tienen estados visibles y responsables |
| 6. Recuperación y monitoreo | Copias de base y productos, restauración remota, métricas, manual operativo y presupuesto medido | Se restaura en otro entorno y se comprueban geometrías, permisos, archivos y tiempos; hay responsables para los fallos |
| 7. Accesibilidad y utilidad | Pruebas con operadores del perfil previsto, teclado, lector de pantalla y conexiones representativas | Las personas pueden ubicar un área, explicar un contorno y guardar una revisión sin asistencia. Se mide el esfuerzo frente a su procedimiento actual |
| 8. Adopción e identidad | Definir organismo responsable, formación, condiciones de uso, identidad institucional y revisión cultural del símbolo propuesto | Hay responsables y aprobación para el uso institucional de nombre, marca y presentación. El footer de la demo por sí solo no acredita esa adopción |

## Qué significa la pantalla

- La combinación de imagen usa infrarrojo cercano, rojo y verde. El rojo visible ayuda a distinguir vegetación y no representa por sí mismo daño.
- Un contorno celeste agrupa celdas vecinas donde aumentó el índice de agua entre las dos fechas. Un contorno naranja agrupa celdas donde disminuyó el índice de vegetación. Cada grupo supera los filtros del método actual.
- Las áreas grises se excluyeron de la comparación. Una ausencia de señales solo se refiere a la superficie que pudo observarse y a los umbrales usados.
- El comparador descubre alternativamente dos imágenes alineadas del mismo sitio. Los contornos muestran un resultado de la diferencia entre ambas fechas; por eso permanecen al mover el control.
- El algoritmo no delimita automáticamente diques individuales, cuencas, bosque muerto ni áreas confirmadas de impacto de castores. La diferencia puede ser sutil en la visualización; índices, resolución, fuentes y evidencia ayudan a interpretarla.

## Próximo incremento recomendado

Completar una prueba con operadores y especialistas sobre un conjunto acotado de áreas, mientras se configura la persistencia compartida de ejecuciones y revisiones en Supabase. Eso permite evaluar utilidad y método antes de ampliar la automatización territorial. Los avisos SNS y la operación AWS permanecen en la [arquitectura objetivo](ARQUITECTURA_OBJETIVO.md).

El selector muestra cartografía de referencia OpenTopoMap/OpenStreetMap para relieve, ríos y caminos. Sus fechas no son las de las escenas del análisis. Para uso sostenido se debe resolver disponibilidad del proveedor cartográfico y su política de uso. La aplicación mantiene la atribución y no ofrece descarga masiva de teselas.

Referencias: [interpretación de color infrarrojo Sentinel-2, NASA](https://science.data.nasa.gov/disasters/data-gallery/sentinel-2-color-infrared), [OpenTopoMap](https://github.com/der-stefan/OpenTopoMap), [política de teselas OSM](https://operations.osmfoundation.org/policies/tiles/).
