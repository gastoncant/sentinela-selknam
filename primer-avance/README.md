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

1. Observar ambas fechas y mover la cortina temporal sobre las mismas coordenadas.
2. Activar y desactivar los candidatos. Hacer clic en un polígono o elegirlo desde la lista.
3. Filtrar agua o vegetación, abrir una ficha y explicar los índices y la superficie del polígono.
4. Escribir un motivo y guardar un ensayo local. Recargar para comprobar persistencia en ese navegador.
5. Abrir trazabilidad y descargar el GeoJSON.

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

Supabase Free publica 500 MB de base, 1 GB de archivos y pausa proyectos tras una semana sin actividad. El proyecto pequeño puede entrar en las cuotas, sujeto al uso y las condiciones del proveedor. El procesamiento se ejecutó con Python local, por lo que el sitio sirve resultados precalculados. El trabajo técnico, la conectividad y la validación tienen costos de recursos y horas. Consultar precios y límites antes de adoptar el servicio.

La integración está implementada en código. La cuenta Supabase y sus credenciales no se configuraron durante esta entrega. El modo sin conexión a Supabase permite presentar el flujo con almacenamiento local. Consultar `VERIFICACION.md` para las pruebas ejecutadas.

[Supabase Free](https://supabase.com/pricing) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/)

