# Validación y uso en campo

Sentinela organiza señales para revisión ambiental. Cada PDF o CSV aporta imágenes, fechas, estado y un motivo. La decisión de inspeccionar requiere evidencia independiente y el criterio del equipo ambiental.

## Evidencia disponible para la presentación

| Prueba | Resultado y límite |
| --- | --- |
| Recorte central bajo demanda | El ensayo con Rasterio reprodujo las métricas de cobertura, los conteos y los ocho hashes de bandas muestreadas del Worker sobre las mismas escenas. Es una comprobación de cálculo. |
| Piloto costero | La zona de agua 60 del piloto cubre 222.100 m² y tiene un aumento medio de NDWI de 0,2953. Se documentó como información insuficiente: un cambio costero puede reflejar variaciones de nivel de agua. La ficha, el PDF y el CSV permiten conservar ese razonamiento. |
| Lista de revisión | El filtro de pendientes usa revisiones guardadas. El orden por intensidad usa el cambio del índice de cada tipo de señal. Sirve para organizar la pantalla y no es una puntuación de presencia animal ni de prioridad de campo. |
| Trazabilidad | El identificador de un recorte nuevo se calcula con la versión del método, grilla, escenas, fechas y hashes de las bandas muestreadas. Una prueba comprueba que cambiar un insumo bajo el mismo ID de escena cambia la identidad. |

Detalles del procesamiento y ensayos observados en la [bitácora de verificación](VERIFICACION.md).

## Contraste con evidencia independiente

El inventario de diques de Huertas Herrera y coautores es un antecedente para elegir sectores de contraste en el archipiélago. Las imágenes usadas por ese estudio llegan hasta 2019. Usarlo como referencia histórica requiere corroborar fecha y alcance de cada etiqueta antes de compararla con la ventana 2020–2026 de Sentinela. [Estudio y materiales suplementarios](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0232057)

El [SIAT de GEF Castor](https://gefcastor.mma.gob.cl/sistema-de-informacion-y-alerta-temprana-para-la-gestion-de-especies-exoticas-invasoras-siat/) es un antecedente regional para la gestión de la especie. La contribución que se propone medir es la utilidad de un flujo de revisión para operadores del sector argentino de la Isla Grande, con imágenes comparables, motivo documentado y exportación por zona y recorte.

1. Acordar con dos operadores y un especialista un sector, sus fechas y la unidad de decisión. Para cada referencia registrar fuente, fecha, geometría y nivel de certeza.
2. Seleccionar casos confirmados para el período, cambios por otras causas y lugares sin señal de la app. Incluir sectores de baja cobertura y registrar qué parte se pudo evaluar.
3. Pedir una selección de sitios para inspeccionar con el procedimiento habitual y con Sentinela. Usar casos equivalentes y alternar el orden de las pruebas. Registrar tiempo, sitios, cobertura y motivo.
4. Cuantificar entre los primeros diez candidatos cuántos justifican seguimiento según el criterio acordado. Revisar también los controles sin señal y anotar omisiones. Separar los casos no evaluables. La muestra de un sector no permite inferir el rendimiento para toda la isla.
5. Contrastar los casos y discutir desacuerdos antes de ajustar el orden o el umbral. Repetir con otro sector que no se usó para ajustar la regla.

## Trabajo compartido y operación

Hoy el recorte y sus revisiones se conservan en el navegador y se pueden compartir como PDF, CSV y GeoJSON. El CSV puede acompañar los insumos en un intercambio manual. Para una revisión compartida en la app, el siguiente ensayo es importar una ejecución versionada en Supabase y verificar que dos operadores con permisos vean la misma zona y su historial. La configuración remota y el ensayo están pendientes. AWS se describe como [arquitectura objetivo con escenarios y costos](../DEVOPS_AWS.md).
