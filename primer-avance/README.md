# Sentinela Selknam · Primer avance

Demo React + TypeScript + Leaflet con integración Supabase Auth y PostgreSQL preparada. Los productos de Sentinel-2 incluidos son reales. Las revisiones guardadas sin configurar Supabase son ensayos locales del navegador.

## Abrir

Instalar Node.js 22.12 o superior y abrir la terminal en la carpeta primer-avance.

```sh
npm ci
npm run dev
```

Entrar a la dirección Local que muestra Vite. Para distribuir como sitio estático ejecutar `npm run build` y publicar el contenido de `dist/` en Cloudflare Pages u otro hosting estático. Para probar la compilación ejecutar `npm run preview`. La carpeta docs de la raíz incluye una compilación lista. Debe servirse con HTTP. Abrir index.html por doble clic puede bloquear los módulos y las lecturas JSON.

## Recorrido de tres minutos

1. En **Elegir un recorte**, usar Zona norte, Zona central o Zona sur, o tocar un punto dentro del contorno argentino. El cuadro naranja representa 5,12 × 5,12 km.
2. Presionar **Comparar este recorte**. La aplicación busca escenas de enero–marzo de 2020 y 2026 y procesa las bandas a 10 m en un Worker. El progreso se puede cancelar. Cada consulta tiene un límite de cuatro minutos.
3. Al terminar, comparar las fechas efectivas con la cortina. El gris excluye píxeles sin observación válida en ambas fechas. Presionar **Elegir una zona para revisar** y luego **Revisar** en una zona de la lista. Si no hay zonas detectadas, elegir otro recorte o abrir el piloto preparado.
4. En la ficha, presionar **Ir al formulario de revisión**, elegir un estado, escribir el motivo y presionar **Guardar revisión**. Los recortes bajo demanda y sus revisiones se guardan en este dispositivo. Hasta seis comparaciones quedan disponibles para reabrirlas después de recargar la página, sujeto al almacenamiento del navegador.
5. En **Datos del análisis y descarga para especialistas**, descargar imágenes, GeoJSON y manifiesto del recorte activo. El manifiesto conserva escenas, metadatos STAC, hashes de bandas muestreadas, grilla, fechas, método y calidad.
6. **Abrir piloto preparado** permite ensayar el recorrido inmediatamente con el producto original de 3,69 km² y 200 componentes.

Las revisiones locales quedan en el almacenamiento del sitio (`localStorage`) del navegador y perfil en uso. Al abrir el mismo recorte y zona se muestran en **Ver la última revisión guardada**. Los recortes recientes se conservan en IndexedDB. Cambiar de navegador, perfil, dispositivo o dirección del sitio no transfiere lo guardado. Borrar los datos del sitio elimina las copias locales.

- **Descargar informe (PDF)** aparece al guardar una revisión. Incluye las dos imágenes ampliadas de la zona con el mismo contorno, sus fechas, escena, superficie, cobertura y el último estado y comentario guardados.
- **Descargar revisiones de este recorte (CSV)** aparece arriba de la comparación si hay al menos una revisión. Genera una fila por zona revisada con identificadores, métricas, fechas, estado y comentario. Usa UTF-8, punto y coma y coma decimal para Excel en español. Se puede vincular con el GeoJSON por `zona_id` y la propiedad `id` de cada geometría. El GeoJSON conserva los contornos para QGIS u otra herramienta GIS.

Las consultas nuevas necesitan Internet, CORS del catálogo y del almacenamiento satelital, Web Workers, OffscreenCanvas y Web Crypto en un navegador moderno sobre HTTPS o localhost. El archivo HTML único conserva el piloto; la apertura directa file:// continúa sin comprobar. La selección cartográfica usa un contorno IGN generalizado para orientación y no representa una cobertura previamente procesada.

La carga muestra una barra de 0 a 100 %, con etapa actual y animación de actividad. Durante el procesamiento el porcentaje es una estimación acotada por los hitos reales del Worker; no representa bytes transferidos ni un plazo. La estimación avanza suavemente dentro de cada etapa, se detiene por debajo del 100 % y termina cuando ambas imágenes están cargadas. Cancelar reinicia el indicador. Los errores no muestran una finalización exitosa. La carga del piloto y de las imágenes ya preparadas también tiene indicador; se respeta la preferencia de movimiento reducido.

La interfaz usa texto base de 18 px, botones de al menos 50 px de alto y una paleta azul, naranja y blanca inspirada en Tierra del Fuego. La tipografía Atkinson Hyperlegible Next se incluye localmente bajo su [licencia SIL OFL](src/fonts/OFL.txt).

El selector incorpora OpenTopoMap (relieve, SRTM y ríos) y OpenStreetMap (caminos y lugares), con atribuciones visibles. Las teselas se solicitan para la vista del navegador; no se ofrece descarga masiva ni mapas offline. Son cartografía de referencia, con fechas distintas de las observaciones Sentinel-2. Si el servicio falla, los accesos por zona y el piloto siguen disponibles. Proveedores: [OpenTopoMap](https://github.com/der-stefan/OpenTopoMap) y [política de teselas OSM](https://operations.osmfoundation.org/policies/tiles/).

La guía «Qué estás viendo» distingue señal de agua, señal de vegetación, color infrarrojo y píxeles excluidos. Al abrir una ficha, las dos ampliaciones se extraen del mismo rectángulo de los PNG originales, sobre su grilla y con el mismo contorno. No se inventan imágenes, valores de índice por fecha ni una confirmación de diques. El orden por superficie es una ayuda de lectura; no establece prioridad ambiental. Para el paso a operación, consultar [criterios de madurez](../CRITERIOS_DE_MADUREZ.md).

La lista ofrece una alternativa textual al mapa. Las escenas se comparan con máscara común y grilla UTM 19 Sur. Las capas pueden solaparse. Las señales requieren revisión y evidencia para atribuir una causa. Los umbrales son exploratorios.

## Conectar Supabase Free

1. Crear un proyecto gratuito y ejecutar en SQL Editor `supabase/001_pilot.sql`, luego `supabase/002_seed.sql`.
2. Deshabilitar el registro abierto de Auth. Crear el operador desde el panel de usuarios e incorporarlo al equipo con la consulta de abajo, sustituyendo el UUID del usuario. Nunca usar la clave secreta o service_role en la web.
3. Copiar `.env.example` a `.env`. Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con la URL y la clave publicable del proyecto. Compilar otra vez.
4. Ingresar con correo y contraseña del usuario creado. La ficha guarda a través de una función SQL que comprueba membresía y versión. El autor proviene de la sesión autenticada.
5. Probar dos cuentas de organizaciones diferentes antes de habilitar operadores reales.

```sql
insert into public.memberships(org_id,user_id)
values('00000000-0000-4000-8000-000000000001','UUID_DEL_USUARIO');
```

El seed publica únicamente las geometrías y propiedades espectrales del piloto. El historial de revisión y sus motivos quedan protegidos por RLS. Los clientes carecen de permisos para modificar candidatos, membresías y publicaciones. La consola administradora de Supabase controla esos campos. Este esquema corresponde a un único análisis congelado. La siguiente iteración necesita ejecuciones versionadas para importar más períodos sin colisiones.

## Costos y estado de verificación

Supabase Free publica 500 MB de base, 1 GB de archivos y pausa proyectos tras una semana sin actividad. El proyecto pequeño puede entrar en las cuotas, sujeto al uso y las condiciones del proveedor. El piloto se calculó con Python local. Los recortes nuevos se procesan en el navegador con datos públicos, sin crear recursos AWS en la cuenta del usuario. El proveedor público no ofrece garantía de disponibilidad. El trabajo técnico, la conectividad y la validación tienen costos de recursos y horas. Consultar precios y límites antes de adoptar el servicio.

La integración está implementada en código. La cuenta Supabase y sus credenciales no se configuraron durante esta entrega. El modo sin conexión a Supabase permite presentar el flujo con almacenamiento local. Consultar `VERIFICACION.md` para las pruebas ejecutadas.

[Supabase Free](https://supabase.com/pricing) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/)

## Alcance insular y alertas

La [arquitectura objetivo](../ARQUITECTURA_OBJETIVO.md) describe datos y permisos, ejecuciones versionadas, procesamiento por sectores, bandeja de seguimiento, outbox, SNS, colas, adaptadores y fases de aceptación. Los envíos externos requieren implementar y configurar esos servicios y sus destinatarios.

El contorno insular procede del WFS de IGN, capa provincia, código 94. Se selecciona el mayor polígono conectado dentro del encuadre de la Isla Grande y se generaliza a 0,004 grados. Los rótulos proceden de Georef. `public/province/manifest.json` conserva las fuentes y hashes del selector. No se usa MODIS para los recortes.

## Método de los recortes bajo demanda

El catálogo se consulta por el punto seleccionado y las dos ventanas enero–marzo. Se ordena por nubosidad global y se examinan hasta cuatro de las primeras ocho escenas por temporada; se usa la primera con al menos 97 % de SCL válida, o la mejor de las examinadas. No se garantiza que sea la pareja óptima ni la misma fecha en toda la isla. La comparación muestra las fechas elegidas.

Se leen ventanas COG de green, red, nir y SCL. Se aplican escala, offset y nodata de los metadatos, se transforma al centro de cada celda de una grilla UTM 19 Sur a 10 m y se remuestrea por vecino próximo (SCL nativa de 20 m). Los cálculos usan float64. Se conservan SCL 4, 5 y 6, índices finitos y denominadores positivos; la comparación usa la intersección de las dos máscaras. NDWI creciente y NDVI decreciente necesitan una diferencia de 0,25 y componentes de cuatro vecinos con al menos cuatro celdas. Las geometrías conservan los límites y huecos de las celdas. El área se calcula en la grilla proyectada y las dos señales pueden solaparse.

La identidad del resultado combina escenas, grilla, versión y hash del código del procesador. Las revisiones usan esa identidad para evitar mezclar áreas o ejecuciones. El SQL Supabase existente solo importa los candidatos del piloto; los recortes nuevos usan revisión local aunque se configure Supabase. Publicar y compartir estos resultados requiere la migración de ejecuciones documentada en la arquitectura.

La superficie del recorte es rectangular y puede incluir costa o terrenos junto al límite. No representa una cuenca ni una máscara jurídica exacta. Las diferencias de fecha, luz, sombra, nieve, hidrología y clasificación SCL afectan las señales. Se necesita validación independiente para atribuirlas a castores y para evaluar omisiones. Dos observaciones no miden una tasa continua de avance ni la construcción de diques individuales.

Fuentes técnicas: [Earth Search](https://github.com/element84/earth-search), [GeoTIFF.js](https://geotiffjs.github.io/geotiff.js/). Verificación: `node verify-crop.mjs`, `node verify-province.mjs`, `node verify-db.mjs`, `npm run build`.
