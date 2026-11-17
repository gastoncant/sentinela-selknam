# Sentinela Selknam

Primer avance de un tablero ambiental para Tierra del Fuego. La demo actual usa React, TypeScript y Leaflet, con integración Supabase preparada para autenticación y revisión compartida.

La aplicación permite seleccionar un punto del sector argentino de la Isla Grande y comparar un recorte de 5,12 × 5,12 km con Sentinel-2 a 10 m. Busca observaciones de enero–marzo de 2020 y 2026, lee las bandas necesarias y calcula cambios de agua y vegetación en el navegador. El piloto preparado sigue disponible para una presentación inmediata. La [arquitectura objetivo](ARQUITECTURA_OBJETIVO.md) conserva la futura implementación institucional y las alertas.

## Descargar y ejecutar la demo

1. Descargar el repositorio desde **Code → Download ZIP** y descomprimirlo, o clonarlo con Git.
2. Instalar Node.js 22.12 o superior. Node.js 24 permite ejecutar la compilación verificada.
3. Abrir una terminal en la carpeta descomprimida del proyecto y ejecutar:

```sh
cd primer-avance
npm ci
npm run dev
```

Abrir la dirección **Local** que muestra Vite, normalmente http://127.0.0.1:5173/. Mantener esa terminal abierta mientras se usa la demo. Para detenerla, presionar Ctrl+C.

En Windows también se puede abrir **INICIAR_DEMO.cmd** desde la carpeta raíz. Comprueba Node.js, instala las dependencias si faltan y arranca la demo.

Para generar una nueva compilación:

```sh
cd primer-avance
npm run build
npm run preview
```

La carpeta **docs/** incluye una compilación lista para servir desde un hosting estático. La carpeta **primer-avance/dist/** se genera con el comando de compilación. El piloto usa imágenes y geometrías incluidas. Los recortes nuevos requieren conexión con Earth Search y los COG públicos de Sentinel-2. La instalación inicial necesita acceso a npm.

## Qué demuestra

- Comparación de dos observaciones reales de Sentinel-2 con cortina temporal.
- Selección de recortes en la isla y procesamiento Sentinel-2 bajo demanda, con fechas efectivas y cobertura común.
- Hasta seis recortes conservados en el dispositivo para reabrirlos sin volver a descargar sus bandas.
- Selección de polígonos en el mapa o en una lista, con filtros por agua y vegetación.
- Fichas con superficie, índices y procedencia.
- Ensayos de revisión guardados en el navegador.
- Descarga de geometrías GeoJSON.

El recorte costero tiene 69 componentes de agua y 131 de vegetación, con 95,68 % de cobertura común válida. Las capas pueden solaparse y su causa requiere evidencia independiente.

La interfaz incorpora relieve y caminos como referencia de selección, una guía visible de colores y contornos y dos ampliaciones alineadas en cada ficha. El footer solicitado muestra el logo propuesto y «Gobierno de TDF». La identidad de la demo no acredita adopción institucional. Ver [identidad y prompt del logo](primer-avance/IDENTIDAD_VISUAL.md) y [criterios para una herramienta operativa seria](CRITERIOS_DE_MADUREZ.md).

## Supabase

La demo arranca sin variables de entorno y permite ensayar el recorrido. Las revisiones de ese modo se guardan en el navegador del visitante.

Para la revisión compartida, configurar un proyecto Supabase con los scripts y pasos de [primer-avance/README.md](primer-avance/README.md#conectar-supabase-free). El cliente, las políticas RLS y la función de revisión están implementados. La cuenta Supabase remota sigue pendiente de configuración. El SQL actual cubre el piloto: los recortes nuevos conservan sus revisiones localmente hasta implementar e importar ejecuciones versionadas.

El frontend admite únicamente la URL y la clave publicable del proyecto. Las claves secretas y las credenciales de base de datos se mantienen fuera del navegador y de Git.

## Entrega

- [Documento del avance en PDF](Sentinela_Selknam_Primer_Avance.pdf)
- [Documento editable en Word](Sentinela_Selknam_Primer_Avance.docx)
- [Guía de la demo y conexión a Supabase](primer-avance/README.md)
- [Pruebas y límites del avance](primer-avance/VERIFICACION.md)
- [Demo pública en GitHub Pages](https://gastoncant.github.io/sentinela-selknam/)
- [Vista previa privada para la cuenta propietaria](https://sentinela-selknam-primer-avance.glitteringbadge.chatgpt.site)

La vista previa privada requiere acceso de su propietaria. El código y los productos de la demo pueden descargarse desde este repositorio público.

## Verificar

Desde la carpeta primer-avance:

```sh
npm ci
npm run build
node verify-db.mjs
```

El ensayo SQL usa PostgreSQL embebido para verificar los permisos y el control de versión. Los resultados deben repetirse contra un proyecto Supabase real antes de operar con usuarios.

## Otros archivos del proyecto

El prototipo Django y la propuesta AWS anteriores permanecen en la raíz. Su guía está en [README_DJANGO.md](README_DJANGO.md). El primer avance presentado se concentra en la carpeta primer-avance.
