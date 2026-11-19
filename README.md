# Sentinela Selknam

**Monitoreo satelital en la Isla Grande de Tierra del Fuego** · Hackathon Soberanía Tech 2026

Sentinela compara imágenes reales de Sentinel-2 para señalar cambios de agua y vegetación en el sector argentino de la Isla Grande. Los equipos ambientales pueden revisar cada zona, documentar lo observado y decidir dónde conviene inspeccionar.

[**Abrir la demo pública**](https://gastoncant.github.io/sentinela-selknam/) · [Guía de uso](primer-avance/GUIA_DE_USO.md) · [Diagrama AWS](documentacion/DEVOPS_AWS.md#flujo-del-piloto-aws)

## Probá el piloto preparado

1. Tocá **Abrir piloto preparado** y mové el deslizador entre **2020** y **2026**.
2. Tocá **Elegir una zona para revisar** y abrí la **Zona de agua 60**. Compará las ampliaciones y tocá **Ir al formulario de revisión**.
3. Registrá tu observación, tocá **Guardar revisión** y abrí **Descargar revisiones** para obtener el PDF de la zona o el CSV del recorte.

El piloto tiene **95,7 % de superficie comparable** y **200 componentes espectrales** para revisar. Para atribuir un cambio a un dique se necesita evidencia independiente. [Método y validación](primer-avance/VALIDACION_FINAL.md)

<details>
<summary>Ver la captura y cómo interpretar el piloto</summary>

![Comparador del piloto costero con el deslizador y la ficha de la zona de agua 60](primer-avance/guia/piloto-costero-demo.jpg)

Se comparan el **8 de febrero de 2020** y el **13 de marzo de 2026** sobre **3,69 km²**. Los contornos celestes señalan aumento de la señal de agua (69 componentes) y los naranjas, disminución de la señal de vegetación (131). Ambas capas pueden superponerse. En la zona de agua 60 aumentó la señal en **222.100 m²**. En el ensayo se registró como **Falta información**, porque un cambio de nivel en la costa es una explicación posible. [Manifiesto del piloto](docs/pilot/manifest.json)

Para analizar otro sector, elegí un punto en el mapa y tocá **Comparar este recorte**. El navegador consulta Earth Search y procesa **5,12 × 5,12 km** en una grilla de **10 m**. Podés exportar las geometrías, las imágenes y el manifiesto con escenas, fechas, grilla, método y hashes de las bandas muestreadas. [Método de análisis](primer-avance/README.md#método-de-los-recortes-bajo-demanda)

</details>

## Estado y presupuesto

La demo está publicada en GitHub Pages y guarda las revisiones en el navegador. Supabase está preparado para las revisiones compartidas del piloto y queda pendiente conectar el proyecto remoto. AWS es la arquitectura objetivo. El Terraform se verificó con planes simulados y el despliegue sigue como siguiente etapa. [Pruebas de la demo](primer-avance/VERIFICACION.md) · [Hoja de ruta](documentacion/ARQUITECTURA_OBJETIVO.md)

La estimación del primer año es de **USD 16.400**. Incluye implementación por etapas, pruebas, validación de campo, capacitación y doce meses de infraestructura AWS. La infraestructura redundante se estima en **USD 81–102 por mes** y ya forma parte de ese presupuesto. Soporte y mantenimiento se cotizan aparte. [Modelo de costos](documentacion/DEVOPS_AWS.md#presupuesto-de-referencia)

## Dónde está cada cosa

| Carpeta | Contenido |
| --- | --- |
| [primer-avance/](primer-avance/) | Código de la demo, guía de uso y pruebas. |
| [docs/](docs/) | Sitio publicado en GitHub Pages y documento del primer avance. |
| [documentacion/](documentacion/) | Arquitectura objetivo, presupuesto, criterios de validación y archivos de entrega. |
| [infra/terraform/](infra/terraform/) | Infraestructura AWS de referencia y ejemplos de CI/CD. |
| [prototipo-django/](prototipo-django/) | Prototipo anterior, con su Dockerfile, datos y pruebas. |

<details>
<summary>Ejecutar y verificar en local</summary>

Descargá el repositorio con **Code → Download ZIP** o clonalo con Git. Usá **Node.js 22.12 o superior** y ejecutá desde la raíz.

```sh
cd primer-avance
npm ci
npm run dev
```

Abrí la dirección que muestra Vite, normalmente `http://127.0.0.1:5173/`. En Windows también podés abrir [INICIAR_DEMO.cmd](INICIAR_DEMO.cmd) desde la raíz. Para verificar la compilación, el método, la cartografía y los permisos del piloto, ejecutá en `primer-avance/`.

```sh
npm run build
node verify-crop.mjs
node verify-province.mjs
node verify-db.mjs
```

</details>
