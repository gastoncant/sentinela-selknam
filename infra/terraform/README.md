# Infraestructura AWS propuesta de Sentinela Selknam

Este directorio contiene Terraform para presentar la evolución de Sentinela. La demo sigue en GitHub Pages. Los archivos de CI/CD son ejemplos fuera de `.github/workflows`, de modo que los cambios en este directorio no activan una publicación AWS.

| Perfil | Recursos previstos |
| --- | --- |
| `static` (predeterminado) | S3 privado, CloudFront/OAC, SNS operativo y, si se configura el dominio, Route 53 y ACM. El cálculo permanece en el navegador. |
| `portfolio` | Lo anterior más Scheduler, SQS, Lambdas de planificación, GIS y sonda, S3 de productos, DLQ y alarmas. El canario de CodeDeploy se habilita a pedido. |
| `supabase` | Perfil de portafolio con un modo de integración que requiere un secreto de servidor y un worker compatible con Supabase. |
| `pilot` | Agrega Cognito, HTTP API, VPC Link, Cloud Map, una tarea Fargate, RDS PostGIS privado, ingesta y SNS ambiental. El perfil no crea NAT Gateway ni ALB. |
| `redundant` | Dos réplicas de API, balanceo de tareas entre zonas y RDS Multi-AZ con réplica en espera. |

## Validación sin cuenta AWS

Desde la raíz del repo, con Terraform 1.11 o posterior:

```
terraform fmt -check -recursive infra/terraform
terraform -chdir=infra/terraform/bootstrap init -backend=false
terraform -chdir=infra/terraform/bootstrap validate
terraform -chdir=infra/terraform/stack init -backend=false
terraform -chdir=infra/terraform/stack validate
terraform -chdir=infra/terraform/stack test
```

`init` descarga el proveedor, y `test` solo ejecuta planes con un proveedor simulado, usando identificadores e imágenes ficticios. Los planes verifican selección de recursos, límites, backups, rutas y opciones de entrega. Para validar límites de servicio, permisos efectivos, salud de los contenedores o facturación habrá que conectar una cuenta de pruebas y ejecutar una revisión real del plan y un ensayo en staging.

**Validación del 18/11/2026:** Terraform 1.14.9 y proveedor AWS 6.73.0. Formato y validación de ambos roots correctos, diez planes simulados aprobados y sintaxis YAML validada para el workflow de ejemplo, los dos buildspec y el AppSpec. Sin pruebas contra una cuenta AWS.

## Cómo se pondría en marcha después de la presentación

1. **Bootstrap.** Crear el bucket de estado con cifrado y versionado. Agregar ECR para los ambientes que lo requieran. Crear el proveedor GitHub OIDC una vez por cuenta o usar uno existente. Usar identidad administrativa temporal. El acceso de cada ambiente al bucket se restringe a su clave y a su archivo `.tflock`.
2. **Estados independientes.** Usar los dos archivos `examples/*backend*` como plantillas. El root `stack` usa backend local para validación por defecto. En el futuro, copiar `backend.tf.example` como `stack/backend.tf`, copiar y completar la configuración S3 fuera de Git e inicializar con esa configuración. Usar claves separadas para staging y prod con `use_lockfile = true`. Mantener el estado de bootstrap protegido y migrarlo o respaldarlo por separado.
3. **Artefactos antes del perfil.** Preparar las imágenes Linux x86-64, escanearlas, probar el contrato y subirlas a ECR. Pasar sus digests al plan. El root `bootstrap` puede crear ECR primero para evitar que el despliegue necesite una imagen en un repositorio todavía inexistente. Una URL de imagen sin digest o un perfil al que le falten imágenes se rechaza en el plan. El [Dockerfile del prototipo Django](../../prototipo-django/Dockerfile) corresponde al piloto anterior.
4. **Perfil estático o portafolio efímero.** Configurar publicación del frontend por un solo camino y probar un recorte. Habilitar `schedule_enabled` cuando existan imágenes válidas, configuración de sectores, alarmas y destinatario confirmado. Mantener el perfil `static` para una muestra de bajo costo. Mantener staging encendido solo durante el ensayo y presupuestar el tiempo, snapshots y objetos conservados.
5. **Piloto institucional.** Verificar región y cuotas, especialmente Lambda, IP públicas, direcciones ENI y RDS. Crear PostGIS y roles de base por una migración desde la VPC con acceso administrativo temporal. Conectar el frontend a Cognito mediante Authorization Code con PKCE y a la URL de la API. Probar la restauración y la autorización con dos organizaciones antes de habilitar datos reales.

`web_hostname` y `api_hostname` son opcionales. Se asume una zona Route 53 pública existente cuando se usa un dominio propio. El certificado de CloudFront se solicita en us-east-1, y el de API Gateway, en la región principal. Si la zona es de Cloudflare, usar DNS-only y gestionar por separado la validación ACM y los CNAME o registros equivalentes. Evitar dos autoridades DNS para el mismo nombre.

El plan de referencia deja API Gateway → VPC Link → Cloud Map → ECS por HTTP dentro de la VPC, con TLS de visitante a API Gateway. La tarea tiene IPv4 pública para egress HTTPS, pero solo el SG de VPC Link puede abrir conexiones al puerto 8080. La base y la ingesta quedan en subredes sin salida pública. Cualquier política que prohíba IPv4 pública en ECS o requiera TLS interno cambia el diseño y se cotiza aparte.

## Contratos de imágenes y datos

| Imagen | Contrato requerido |
| --- | --- |
| `planner` | Leer `configuration/sectors.json` de S3, registrar intención bajo `planned/`, enviar a SQS y reconciliar intenciones sin confirmación. La sonda de trabajos vencidos puede correr en el mismo ciclo programado. Publicar `PlannedWithoutManifest` mayores a la ventana acordada sin etiquetas de alta cardinalidad. |
| `gis` | Leer lotes SQS de un mensaje. Generar `run_id` a partir de organización, grilla/sector, ventanas, método y versión de insumos. Escribir productos bajo `runs/{run_id}/`; cerrar con `manifest.json`, escritura condicional, checksums y resultados reproducibles. Ante un fallo, devolver `batchItemFailures` y publicar `GISFailed`. El modo Supabase también entrega el resultado a su backend, con credencial del secreto y un contrato idempotente, incluso si S3 ya tiene el manifiesto. |
| `ingest` | Usar S3 y PostgreSQL, incluyendo cada evento del lote de notificación. Leer la versión del objeto si viene en el evento, validar tamaño, esquema, prefijo e identidad del manifiesto. En una transacción, guardar la ejecución idempotente y el outbox. Usar TLS con validación de certificado en RDS y autenticación IAM para `sentinela_ingest`. |
| `api` | FastAPI en puerto 8080, comando `python` disponible para health check y sistema de archivos raíz de solo lectura. Exponer `GET /healthz` sin datos privados. Validar token de acceso Cognito, scope `sentinela/api` y pertenencia. Emitir trabajos y procesar el outbox con control de concurrencia por transacción y reintentos. Usar autenticación IAM para `sentinela_api`. |
| `probe` | Hacer una consulta HTTPS con timeout a la URL declarada, emitir `ProbeFailed` como 0 o 1 cada cinco minutos y comprobar status esperado. |
| `notify` | Consumir desde SQS, obtener el secreto del canal en tiempo de ejecución y persistir deduplicación por evento, canal y destinatario bajo `deliveries/{canal}/`. Registrar entrega dudosa sin reenviar ciegamente. No incluir tokens, coordenadas privadas ni datos de operadores en logs. |

En RDS, `CREATE EXTENSION postgis`, roles y tablas son migraciones de aplicación. Crear `sentinela_api` y `sentinela_ingest` con `rds_iam` y permisos diferenciados. La API verifica membresía y establece contexto con `set_config(..., true)` dentro de cada transacción. Aplicar RLS por organización, con rol sin `BYPASSRLS` y sin propiedad de tablas. Ensayar acceso cruzado y reutilización de conexiones. Adaptar las políticas de Supabase que usaban `auth.uid()` y `auth.jwt()`. La aplicación debe cargar la CA de RDS y generar el token localmente al abrir cada conexión; la Lambda de ingesta no requiere llamar a Secrets Manager ni SNS.

## CI/CD y operación

- **GitHub Actions + OIDC.** Camino recomendado. El ejemplo publica solo el frontend. Requiere environments `staging` y `prod` restringidos a la rama autorizada y aprobación en prod. El rol provisto solo escribe el bucket web e invalida CloudFront. Para el release de servicios, definir roles separados de plan, apply y publicación con el alcance de cada proyecto. Validar IaC desde PR sin secretos, con un check requerido presente en todos los PR, y fijar las acciones por SHA. Los workflows actuales de la demo y Django se mantienen.
- **CodePipeline + CodeBuild.** Variante probada en el plan para compilar y publicar el frontend desde GitHub, usando una conexión existente autorizada sobre el repo, artefactos S3 y aprobación manual en prod. La alternativa no asume el rol GitHub de publicación. Para promoción entre dos ambientes, reutilizar el mismo artefacto por SHA con permisos cruzados, validaciones y retención; el ejemplo define un pipeline por ambiente.
- **ECS.** Rolling con circuit breaker. Terraform registra la definición inicial, y el release futuro registra una revisión por digest y actualiza el servicio. `ignore_changes` en el servicio preserva la revisión activa; coordinar los cambios de configuración en la task definition con ese release. Los roles de despliegue de servicios se definen al integrar las imágenes y migraciones.
- **Lambda GIS.** Alias `live` publicado, destino del event source mapping. Terraform conserva el alias durante cambios posteriores. La promoción futura publica una versión y actualiza el alias, directamente o vía CodeDeploy con el AppSpec de ejemplo. Si el tráfico normal es escaso, ejecutar pruebas suficientes para observar la candidata y el rollback. Las fallas parciales SQS necesitan la métrica `GISFailed` además de `Errors`.
- **Observabilidad.** CloudWatch es el camino inicial. Grafana administrado y AMP son opcionales y vienen apagados. La asignación de usuarios de Identity Center, la configuración de fuentes de datos y un colector Alloy que escriba a AMP con SigV4 y `aps:RemoteWrite` acotado se incorporan cuando se necesiten métricas propias. Loki queda como laboratorio efímero: almacenar objetos en S3, enviar logs seleccionados desde Alloy y medir costo y volumen antes de sumarlo a producción.
- **Recuperación.** Probar un mensaje fallido → DLQ → alarma → SNS, un rollback ECS o del alias, restaurar RDS con PITR de siete días y recuperar una versión S3. Registrar fecha, commit, versión del método, RPO y RTO observados. El entorno demo solo tiene evidencia de restauración SQLite.

Para la presentación, mostrar primero el diagrama y después el plan simulado de `static`, `pilot` y `redundant`. Los resultados de despliegue, alertas entregadas, recuperación y costos medidos quedan como criterios de aceptación futuros.

Una frase para acompañar el diagrama: «La demo ya permite comparar recortes en el navegador. El siguiente paso es compartir revisiones. Si la institución necesita operar en su propia cuenta AWS, proponemos una arquitectura que procesa por demanda y deja la base aislada, con costo y recuperación medibles».
