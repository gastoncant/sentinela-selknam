# Método del piloto

Se eligió un área de análisis rectangular dentro de la tesela 19FFV por disponibilidad de observaciones L2A. El centro solicitado fue −67,305°, −54,555°. El recorte efectivo mide 1.920 × 1.920 m en EPSG:32719 tras ajustar la grilla a múltiplos de 20 m. Su extensión exacta está en pilot/manifest.json. Carece de delimitación hidrográfica oficial y de validación local de presencia animal.

Se consultó Earth Search para enero–marzo de 2020 y 2026 en una ventana próxima al centro. Entre las escenas devueltas de 19FFV se eligió la de menor nubosidad declarada por tesela para cada período. La prueba de observabilidad usa la máscara local en ambos momentos. Las adquisiciones fueron el 8 de febrero de 2020 y el 13 de marzo de 2026. La diferencia de mes y de elevación solar admite variaciones fenológicas, de sombra y de nivel del agua. Una pareja de observaciones brinda dos instantáneas.

El proceso lee B03, B04 y B08 a 10 m y SCL por vecino más cercano a la misma grilla. Conserva clases 4, 5 y 6. Excluye valores NoData, denominadores inválidos y píxeles sin validez conjunta. Los dos STAC declaran que el proveedor ya aplicó el offset BOA. Se aplica la escala de cada banda una sola vez. En el visor, ambas fechas usan la misma escala de falso color NIR/rojo/verde. [Catálogo Earth Search](https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a)

NDWI = (verde − NIR)/(verde + NIR). NDVI = (NIR − rojo)/(NIR + rojo). Se separan aumentos de NDWI ≥ 0,25 y descensos de NDVI ≥ 0,25. El umbral se fijó para explorar el flujo y requiere calibración independiente. Se conservan componentes de cuatro o más píxeles con vecindad por lados. Área proyectada = píxeles × 100 m². Cada señal se vectoriza por separado, por lo que sus polígonos pueden solaparse. La suma de superficies entre capas puede contar dos veces la misma zona.

La ejecución produjo 223 polígonos de agua y 402 de vegetación sobre 36.856 píxeles válidos comunes de 36.864. Cada polígono recibe un ID dentro de la ejecución. Un sector sin polígonos puede contener estructuras pequeñas, ocultas por vegetación o sin contraste espectral. Los candidatos sirven para organizar lectura de imágenes. La prioridad de campo necesita referencias independientes y evaluación por el equipo ambiental.

## Evidencia y contraste

La cartografía publicada por Huertas Herrera et al. combina interpretación visual y verificación y tiene sus propios límites de identificación. Es antecedente para diseñar la validación local. Los documentos PIA y su resumen aportan contexto de restauración. La persistencia de cambios complica inferir actividad actual. [Artículo de 2020](https://doi.org/10.1371/journal.pone.0232057)

Se revisó una transcripción automática local de cinco notas de voz. En los clips terminados en 44860 y 59813 aparecen la disponibilidad temporal y el uso de índices. El 129797 señala resolución y ocultamiento por vegetación. El 33204 describe otro caso de uso sobre incendios. El 119534 aporta contexto sobre cambios hídricos. La transcripción contiene términos reconocidos de forma ambigua y los topónimos son inciertos. Se conservaron las fechas, la máscara y la escala en el flujo. El comentario sobre porcentajes no tiene respaldo suficiente para usarlo en el piloto. Las notas se mantuvieron fuera del repositorio.

Para evaluar utilidad, un equipo local debería revisar una muestra estratificada de ambas señales y áreas sin cambios, con imágenes independientes y observaciones fechadas. Registrar acuerdo entre revisores, falsos positivos y omisiones. Comparar tiempo de revisión y selección de salidas con el procedimiento habitual. El antecedente SIAT chileno ya abordó monitoreo satelital. La diferencia demostrable aquí es el flujo concreto entregado con productos reproducibles e historial. La ventaja operativa comparativa queda por medir. [Proyecto GEF Castor](https://gef.mma.gob.cl/castor/)

