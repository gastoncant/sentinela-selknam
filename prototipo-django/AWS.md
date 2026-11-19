# Operación en AWS

Esta guía corresponde al prototipo histórico de Lightsail. Para la arquitectura administrada con Terraform, CI/CD, observabilidad y el presupuesto del piloto actual, consultá [Arquitectura DevOps en AWS](../documentacion/DEVOPS_AWS.md).

## Perfil implementado

Una instancia Lightsail aloja Caddy, Gunicorn, Django y una base SQLite persistente. El procesamiento geográfico corre por lotes en una máquina de análisis. La web sirve productos de tamaño acotado, precalculados. Una sola instancia y un solo proceso Gunicorn con cuatro hilos permiten validar el recorrido sin montar un clúster. Un fallo del host implica indisponibilidad. La cuenta, región y dominio de destino siguen sin verificar.

La propuesta previa contemplaba React, FastAPI, PostGIS y eventualmente Supabase. El perfil institucional del contexto contemplaba ECS, RDS/PostGIS, S3, Cognito y SQS. Ninguno de esos servicios administrados forma parte de esta plantilla. Se eligió Django para sesiones, CSRF y revisión transaccional, y CloudFormation para provisionar Lightsail. El GeoJSON y los metadatos STAC permiten migrar productos. Si hace falta operar a escala provincial, medir primero volumen, concurrencia, retención y consultas espaciales.

## Provisionamiento

Desde la carpeta `prototipo-django/`, en una estación con AWS CLI autenticada, verificá la identidad y elegí región, zona, blueprint de Ubuntu 24.04, bundle Linux con IPv4, clave SSH registrada en Lightsail y la IPv4 administrativa con máscara /32. Los identificadores de planes son regionales. El siguiente ejemplo usa variables de shell POSIX previamente definidas.

```sh
aws sts get-caller-identity
aws lightsail get-bundles --region "$REGION" --query 'bundles[?isActive].[bundleId,ramSizeInGb,price]'
aws lightsail get-blueprints --region "$REGION" --query 'blueprints[?isActive].[blueprintId,name]'
aws cloudformation deploy --region "$REGION" --stack-name sentinela-piloto \
  --template-file infra/lightsail.yaml --parameter-overrides Zone="$ZONE" Bundle="$BUNDLE" \
  Blueprint="$BLUEPRINT" KeyName="$KEYNAME" AdminCIDR="$ADMIN_CIDR"
aws cloudformation describe-stacks --region "$REGION" --stack-name sentinela-piloto --query 'Stacks[0].Outputs'
```

Creá un registro DNS A del dominio a la IPv4 devuelta. Transferí el código del ZIP o del checkout por SSH al host, en una carpeta accesible únicamente a los administradores. Instalá Docker y Compose v2 en Ubuntu y ejecutá desde la carpeta `prototipo-django/` del checkout:

```sh
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 openssl
sudo systemctl enable --now docker
umask 077
# Ejecutar solo en la instalación inicial. Sustituir por el dominio que resuelve a la IP.
printf 'APP_HOST=%s\nAPP_SECRET=%s\n' "$DOMINIO" "$(openssl rand -hex 48)" > .env
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose logs --tail 30 app
sudo docker compose exec app python manage.py import_pilot Equipo
sudo docker compose exec app python manage.py operator operador Equipo
```

Verificá HTTPS desde fuera del host, la ausencia de análisis públicos al inicio, el ingreso del operador y una revisión. Activá publicación si corresponde desde la consola con `import_pilot Equipo --publish`. El proxy termina TLS y la aplicación confía en su cabecera de protocolo. El puerto 8000 queda interno en Compose. La apertura de SSH se limita a la IPv4 administrativa. Al cambiar de dirección hay que actualizar la plantilla. Restringí los permisos de mantenimiento y mantené claves y archivo .env fuera de Git. Las sesiones duran hasta ocho horas. Los formularios usan protección CSRF. El límite de ingreso es de diez POST cada cinco minutos por dirección en un proceso; las redes compartidas comparten el cupo. No hay endpoint de análisis remoto ni registro abierto.

## Respaldo y recuperación

El volumen de la base contiene productos originales importados, geometrías, grupos, usuarios, sesiones y revisiones. Guardá el código y el secreto de la instalación por separado con acceso restringido. Para respaldar la base en caliente, desde el host:

```sh
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo docker compose exec -T app python manage.py backup "/tmp/$stamp.sqlite3"
sudo docker compose cp "app:/tmp/$stamp.sqlite3" "./$stamp.sqlite3"
chmod 600 "./$stamp.sqlite3"
```

Transferí esa copia a almacenamiento cifrado fuera de la instancia, con acceso mínimo y retención definida por el responsable. Eliminá la copia temporal del contenedor al verificar el respaldo externo. La plantilla pide snapshots automáticos. El ensayo local restaura una copia en una segunda base, abre la aplicación contra ella y verifica sus datos y permisos. Para recuperar en Lightsail, aprovisioná un host aislado, recuperá la misma versión de la aplicación, restaurá el archivo como /state/pilot.sqlite3 en un volumen nuevo con propietario UID 10001 y arrancá el servicio. Repetí los controles de acceso, productos e historial antes de cambiar DNS. Un simulacro desde un snapshot real sigue pendiente.

Configurá alarmas de estado de la instancia, uso de CPU/disco y una sonda HTTPS externa con destinatario real. Los objetivos iniciales de 24 h de pérdida máxima y una jornada de recuperación requieren respaldos periódicos y medición. Al retirar el stack, la instancia retenida sigue facturando hasta que el administrador la elimine. Revisá también IP y snapshots.

## Presupuesto de planificación en USD

La referencia pública para Linux con IPv4 y 8 GB es USD 44/mes. Añadir snapshots, dominio, respaldo externo, tráfico excedente e impuestos según región y uso. La provisión heredada de USD 60–100/mes para el perfil económico es un supuesto de planificación. No se contrató infraestructura. [Tarifas oficiales de Lightsail](https://aws.amazon.com/lightsail/pricing/)

El presupuesto previo suma USD 4.000 de desarrollo GIS, 3.600 de teledetección, 1.000 de QA, 400 de capacitación y 1.200 de validación de campo. Otras 40 h de infraestructura a USD 25/h elevan la base a USD 11.200. Con contingencia del 20 %, la implementación estimada es USD 13.440. Doce meses de soporte a USD 300/mes e infraestructura económica dan USD 17.760–18.240 el primer año. Los importes son estimaciones del proyecto completo, sin cotizaciones de campo ni registro de horas facturadas. El escenario ECS/RDS heredado (USD 160–250/mes) requiere redimensionamiento y cotización independiente.

