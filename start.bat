@echo off
echo ========================================
echo   Gestao Cases 2.0 - Iniciando Sistema
echo ========================================

echo.
echo [1/3] Verificando Docker...
docker-compose ps
if %ERRORLEVEL% NEQ 0 (
    echo Iniciando containers Docker...
    docker-compose up -d
    timeout /t 10
)

echo.
echo [2/3] Instalando dependencias do frontend...
cd frontend
call npm install

echo.
echo [3/3] Iniciando servidor de desenvolvimento...
echo.
echo ========================================
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000/docs
echo ========================================
echo.
call npm run dev
