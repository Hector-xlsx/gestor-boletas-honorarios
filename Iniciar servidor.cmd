@echo off
setlocal
cd /d "%~dp0" || exit /b 1
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
    echo No se encontro Google Chrome.
    pause
    exit /b 1
)
set "APP_URL=http://127.0.0.1:3000/"
set "CHROME_PROFILE=%CD%\work\chrome-local"
if not exist "%CHROME_PROFILE%\Default\Local Storage\leveldb\CURRENT" (
    echo No se encontro el perfil local con los datos cargados.
    pause
    exit /b 1
)

rem Reutiliza la instancia local si ya esta funcionando.
powershell.exe -NoProfile -Command "try { if ((Invoke-WebRequest -UseBasicParsing -Uri $env:APP_URL -TimeoutSec 3).Content -like '*Gestor de boletas*') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
    start "" "%CHROME%" --user-data-dir="%CHROME_PROFILE%" --no-first-run --new-window "%APP_URL%"
    exit /b 0
)

if not exist "node_modules\vinext\dist\cli.js" (
    echo Faltan las dependencias del proyecto. Ejecuta pnpm install.
    pause
    exit /b 1
)

rem El Explorador de Windows puede no tener Node en su PATH.
set "APP_NODE=%CD%\work\runtime\node.exe"
if not exist "%APP_NODE%" set "APP_NODE=node.exe"
"%APP_NODE%" -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>22 || (major===22 && minor>=13) ? 0 : 1)" >nul 2>&1
if errorlevel 1 (
    echo Se necesita Node.js 22.13 o posterior. Revisa el runtime local o instala Node.js.
    pause
    exit /b 1
)

rem Abre el perfil local cuando responda la aplicacion.
start "" /min powershell.exe -NoProfile -Command "for($i=0; $i -lt 60; $i++) { try { if ((Invoke-WebRequest -UseBasicParsing -Uri $env:APP_URL -TimeoutSec 2).Content -like '*Gestor de boletas*') { & $env:CHROME ('--user-data-dir='+$env:CHROME_PROFILE) --no-first-run --new-window $env:APP_URL; exit } } catch {}; Start-Sleep -Seconds 1 }"
"%APP_NODE%" "node_modules\vinext\dist\cli.js" dev --hostname 127.0.0.1 --port 3000
set "SERVER_EXIT=%ERRORLEVEL%"
if not "%SERVER_EXIT%"=="0" echo El servidor termino con error %SERVER_EXIT%.
pause
exit /b %SERVER_EXIT%
