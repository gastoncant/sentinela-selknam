# Auditoría de cierre del piloto

**Dictamen.** Hay un recorrido reproducible de análisis y revisión para una demostración técnica. La puesta en servicio institucional queda condicionada a validar la señal ambiental y ensayar la operación en la cuenta AWS de destino.

## Evidencia ejecutada

| Control | Resultado observado |
| --- | --- |
| Estado inicial | Checkout del escritorio con solo .git, rama master sin commits. La consulta de referencias de origin a GitHub terminó correctamente sin devolver ninguna. |
| Reproducción | Dos ejecuciones de la versión final leyeron los COG públicos en carpetas independientes. Los dos manifiestos tienen SHA-256 11f7ad0de35b1d6b42cea81a007c213b30b43a587aacee1b561ee1fb5b92c5f9 e incluyen hashes de los cuatro productos. |
| Pruebas de aplicación y método | manage.py test ejecutó controles de alcance organizacional, publicación y datos privados, versiones obsoletas, CSRF, texto escapado, límites de ingreso, reimportación, NDVI/NDWI, denominadores inválidos y máscara conjunta. |
| Concurrencia | verify_restore.py envió cuatro escrituras simultáneas de la misma versión a una SQLite en disco. Una respuesta 302 y tres 409. Quedó una fila de historial. |
| Recuperación | Se respaldó en caliente, se copió a otra ruta y se reabrió desde Django. Integridad SQLite correcta, 625 candidatos, usuario autor, acceso privado, ficha y cuatro productos con sus hashes verificados. |
| Dependencias Python | pip-audit sobre requirements.txt y requirements-gis.txt, incluida resolución transitiva, informó cero vulnerabilidades conocidas en la consulta. |
| Infraestructura | cfn-lint aceptó infra/lightsail.yaml. check --deploy produjo dos advertencias por el alcance HSTS a subdominios y preload. HSTS queda restringido al dominio configurado. |
| Integración continua | Workflow preparado para repetir pruebas y construir la imagen en Linux. Ejecución remota pendiente. |

## Hallazgos por severidad

| Severidad | Evidencia, corrección o pendiente |
| --- | --- |
| Alta · validez ambiental | 625 componentes para 3,6864 km² y dos fechas de meses distintos. Puede haber cambios estacionales, sombra y señales coincidentes. Las fichas admiten causas alternativas y conservan descartes. Faltan etiquetas independientes, revisión de omisiones y calibración por ambiente. |
| Alta · operación AWS | El control de plantilla es estático. Faltan cuenta, región, dominio, despliegue, verificación TLS, snapshots restaurados y alarmas con destinatario. Docker no estaba disponible en la estación. Un solo host es un punto de falla. |
| Media · preservación | La auditoría de implementación detectó que servir productos desde una carpeta mutable rompería análisis históricos. Se corrigió almacenando los cuatro archivos con cada ejecución, dentro de la misma transacción. El ensayo de restauración verificó los cuatro desde la copia. |
| Media · permisos y exposición | El acceso se decide en el servidor para cada análisis y producto. La publicación libera todas las geometrías espectrales del análisis. Retirar una publicación cierra futuras lecturas; las copias exportadas persisten. La consola del host es de confianza y puede operar sobre todos los grupos. |
| Media · escala y abuso | Cuatro escrituras conflictivas verificadas en la estación. Faltan pruebas sostenidas con usuarios y datos representativos, cuota distribuida y monitoreo del host. El limitador por IP vive en memoria y se reinicia con el proceso. |
| Media · privacidad y operación | El servicio guarda identidad de operador, motivo, evidencia textual y sesión. No incorpora analítica ni scripts de terceros. Faltan responsable y contacto reales, retención, gestión de derechos y revisión institucional antes de incorporar datos personales. |
| Media · facilidad de uso | Existen navegación por teclado, etiquetas y lista textual. Faltan prueba con lector de pantalla, contraste medido y evaluación por operadores. No se midió cuánto tiempo ahorra frente al flujo actual. |
| Media · cadena de suministro | Auditoría Python ejecutada; imágenes base y Caddy referenciadas por etiqueta. Faltan fijación por digest tras validar la imagen, escaneo de contenedor y revisión integral de licencias. |
| Baja · alcance | Se procesa un AOI fijo por CLI. No hay carga pública de GeoJSON, despacho automático, cola distribuida ni clasificación biológica. La transcripción automática de audio aporta requisitos cualitativos; quedan inciertos algunos términos y topónimos. |

## Criterio de salida

Para una evaluación de campo, seleccionar una muestra con clases positivas y negativas, contrastarla con evidencia independiente y documentar acuerdo y errores. Para habilitar servicio externo, desplegar en una cuenta designada, ensayar restauración desde almacenamiento externo, verificar acceso, gastos y alertas y asignar responsables de plataforma y revisión ambiental. Los objetivos de recuperación y la mejora de decisiones aún carecen de medición operacional.

