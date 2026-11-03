@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo primero desde https://nodejs.org/
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Se creo .env. Ahora escribe tu contrasena privada y una clave SESSION_SECRET larga.
  notepad .env
  echo Guarda y cierra el Bloc de notas para continuar.
  pause
)
if not exist node_modules (
  echo Instalando componentes necesarios. Se requiere internet la primera vez...
  npm install
  if errorlevel 1 (
    echo No se pudieron instalar las dependencias. Revisa tu conexion a internet.
    pause
    exit /b 1
  )
)
echo BLACKS iniciando. Cuando aparezca la direccion, abre http://localhost:3000
npm start
pause
