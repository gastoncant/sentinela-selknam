# Sentinela Selknam

**Monitoreo satelital para equipos ambientales de Tierra del Fuego** · Hackathon Soberanía Tech 2026

Sentinela ayuda a decidir dónde conviene inspeccionar posibles impactos de los diques de castores en el sector argentino de la Isla Grande. Compara imágenes reales de Sentinel-2, marca cambios en la señal de agua y vegetación, y permite documentar qué observó la persona que revisó cada zona.

[**Abrir la demo pública**](https://gastoncant.github.io/sentinela-selknam/) · [Guía de uso](primer-avance/GUIA_DE_USO.md) · [Arquitectura objetivo en AWS](DEVOPS_AWS.md#flujo-del-piloto-aws)

## Probá el piloto preparado

1. En la demo, tocá **Abrir piloto preparado** para cargar un recorte costero con las imágenes ya procesadas.
2. Mové el deslizador entre **2020** y **2026**. Los contornos **celestes** marcan aumento de la señal de agua y los **naranjas**, disminución de la señal de vegetación.
3. Tocá **Elegir una zona para revisar** y abrí la **Zona de agua 60**. Compará las dos ampliaciones, tocá **Ir al formulario de revisión**, registrá tu observación y tocá **Guardar revisión**.
4. En **Descargar revisiones**, podés generar el **PDF** de la zona con imágenes y comentario, o el **CSV** con las zonas que revisaste en el recorte.

![Comparador satelital del piloto costero, con el deslizador y la ficha de la zona de agua 60](primer-avance/guia/piloto-costero-demo.jpg)

Para analizar otro sector, elegí un punto en el mapa y tocá **Comparar este recorte**. El navegador procesa un área de **5,12 × 5,12 km** en una grilla de **10 m** y muestra las fechas efectivas y la superficie que pudo comparar. Este recorrido requiere Internet para consultar Earth Search y descargar las bandas satelitales.

## Cómo interpretar el resultado

El piloto compara imágenes del **8 de febrero de 2020** y del **13 de marzo de 2026**. De los **3,69 km²** del recorte, el **95,7 %** tenía datos válidos en ambas fechas. El método produjo **200 componentes espectrales**, 69 con aumento de señal de agua y 131 con disminución de señal de vegetación. Los contornos de ambas capas pueden superponerse. [Manifiesto del piloto](docs/pilot/manifest.json) · [Método y fuentes](primer-avance/README.md#método-de-los-recortes-bajo-demanda)

La **zona de agua 60** ilustra el criterio de revisión. En sus **222.100 m²** aumentó la señal asociada al agua. En el ensayo se registró como **Falta información**, porque un cambio de nivel en la costa es una explicación posible. Para atribuir el cambio a un dique hacen falta observaciones de campo u otra evidencia independiente. [Pauta de validación](primer-avance/VALIDACION_FINAL.md)

Los recortes nuevos conservan las escenas, fechas, grilla, método y hashes de las bandas muestreadas. Además del PDF y el CSV, el panel para especialistas permite exportar **GeoJSON**, **PNG** y un **manifiesto JSON** para revisar o reproducir el análisis.

## Estado del proyecto

| Etapa | Estado |
| --- | --- |
| **Demo pública** | Publicada en GitHub Pages. El análisis se ejecuta en el navegador. Cada revisión se guarda en ese navegador y puede compartirse mediante las exportaciones. |
| **Revisión compartida** | Integración de Supabase preparada para el piloto y permisos probados con PostgreSQL embebido. Queda pendiente configurar el proyecto remoto, probar dos cuentas con permisos distintos y habilitar ejecuciones compartidas para recortes nuevos. |
| **Operación en AWS** | Arquitectura y Terraform de referencia con planes simulados. El despliegue, las alertas y los ensayos de recuperación en una cuenta de pruebas son pasos futuros. |
| **Validación ambiental** | Ensayos de cálculo y de uso documentados. El siguiente paso es contrastar los candidatos y los casos omitidos con operadores y evidencia de campo. Las cámaras trampa son una ampliación en evaluación. |

[Bitácora de verificación](primer-avance/VERIFICACION.md) · [Arquitectura y hoja de ruta](ARQUITECTURA_OBJETIVO.md) · [Propuesta de cámaras trampa](ARQUITECTURA_OBJETIVO.md#validación-de-campo-con-cámaras-trampa)

## Puesta en marcha y presupuesto

La estimación presentada para el **primer año es de USD 16.400**. Contempla la implementación por etapas, las pruebas, la validación de campo, la capacitación y los primeros doce meses de infraestructura AWS. El soporte técnico recurrente y el mantenimiento se presupuestan aparte.

El escenario redundante en AWS se estima en **USD 81–102 mensuales de infraestructura** bajo los supuestos de carga documentados. Es una referencia de planificación para esa partida, incluida en la estimación del primer año. El desglose técnico distingue el piloto del escenario redundante. [Modelo de costos y supuestos](DEVOPS_AWS.md#presupuesto-de-referencia)

## Ejecutar y verificar en local

Descargá el repositorio con **Code → Download ZIP** o clonalo con Git. Usá **Node.js 22.12 o superior** y ejecutá desde la raíz.

```sh
cd primer-avance
npm ci
npm run dev
```

Abrí la dirección que muestra Vite, normalmente `http://127.0.0.1:5173/`. En Windows también podés usar [INICIAR_DEMO.cmd](INICIAR_DEMO.cmd). La compilación publicada está en `docs/` y se sirve por HTTP.

Para verificar la compilación, el método de los recortes, las fuentes territoriales y los permisos del piloto, ejecutá en `primer-avance/`.

```sh
npm run build
node verify-crop.mjs
node verify-province.mjs
node verify-db.mjs
```

## Documentación técnica

- [Módulos y código de la aplicación](primer-avance/MODULOS.md)
- [Instalación, conexión a Supabase y método de análisis](primer-avance/README.md)
- [Terraform, CI/CD y pruebas simuladas](infra/terraform/README.md)
- [Documento del primer avance (PDF)](Sentinela_Selknam_Primer_Avance.pdf)
- [Guía del prototipo Django](README_DJANGO.md)
