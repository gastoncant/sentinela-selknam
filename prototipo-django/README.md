# Sentinela Selknam · Prototipo Django

Tablero de revisión de cambios de agua y vegetación en Tierra del Fuego. Incluye un piloto real de Sentinel-2 ya procesado. El operador alterna dos observaciones alineadas, localiza polígonos, descarga geometrías y documenta hipótesis. La organización decide si publica el producto espectral. Las revisiones y las identidades quedan en la vista privada.

## Probar en Windows

Desde la carpeta `prototipo-django/` del checkout, con Python 3.12 y PowerShell:

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
$env:LOCAL_DEMO='1'
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py import_pilot Equipo
.venv/Scripts/python manage.py operator operador Equipo
.venv/Scripts/python manage.py runserver 127.0.0.1:8000
```

Abrí http://127.0.0.1:8000 e ingresá con esa cuenta. La contraseña se elige en la terminal y se almacena con el hash de Django. Para habilitar el recorrido público en esa instalación ejecutá `manage.py import_pilot Equipo --publish` con el mismo intérprete. Para retirarlo ejecutá `manage.py unpublish ID`. Los archivos ya descargados quedan en poder del destinatario.

## Recorrido de operador

1. Abrí el análisis y comprobá fechas, cobertura común y escenas. Activá «Ver segunda fecha» con clic o con la barra espaciadora. La posición y la escala se mantienen. Activá «Cambios observados» para superponer las señales sobre cualquiera de las fechas.
2. Filtrá por agua o vegetación y, dentro de tu organización, por fichas pendientes. Cada página presenta hasta 25. Abrí una ficha, ubicá su recuadro en la imagen y consultá área, primer vértice y variación media de índices. El GeoJSON conserva el contorno completo en longitud y latitud.
3. Registrá «Compatible», «Otra causa» o «Información insuficiente», el motivo y la referencia de evidencia si existe. Cada revisión agrega autor y fecha. Ante un conflicto de versión, reabrí el análisis, leé la revisión nueva y decidí si corresponde registrar otra.
4. Un visitante accede únicamente a análisis publicados, imágenes y GeoJSON espectral. Un miembro puede consultar y revisar análisis de los grupos a los que pertenece. La publicación y la creación de usuarios requieren acceso administrativo al host. Las bajas se gestionan desactivando la cuenta Django.

## Reproducción y validación

```powershell
.venv/Scripts/python -m pip install -r requirements-gis.txt
.venv/Scripts/python process_pilot.py recalculo
Get-FileHash pilot/manifest.json,recalculo/manifest.json
.venv/Scripts/python manage.py test
.venv/Scripts/python verify_restore.py
```

El procesamiento lee ventanas HTTP de cuatro COG por escena desde sus URL públicas congeladas en `sources/`. Se ejecuta fuera del servidor web. El manifiesto conserva versiones por hash de código, metadatos y productos. Al importar se verifican los cuatro productos y se guardan con el análisis en una sola transacción. La reimportación del mismo manifiesto para la misma organización conserva las fichas existentes.

- [Método y fuentes](METODO.md)
- [Despliegue, costos y recuperación](AWS.md)
- [Auditoría y pendientes](AUDITORIA.md)
