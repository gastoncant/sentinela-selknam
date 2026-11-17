@echo off
setlocal
cd /d "%~dp0primer-avance"
where node >nul 2>nul
if errorlevel 1 (
  echo Instalar Node.js 22.12 o superior desde https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro npm. Revisar la instalacion de Node.js.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias. Revisar la conexion y reintentar.
    pause
    exit /b 1
  )
)
echo Abrir la direccion Local que mostrara Vite.
echo Mantener esta ventana abierta mientras se usa la demo.
call npm run dev
if errorlevel 1 pause
