@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo FisioHub - Servidor interno de testes
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
    echo ERRO: npm nao foi encontrado.
    echo Instale o Node.js ou verifique se ele esta no PATH.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Dependencias nao encontradas. Instalando com npm install...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ERRO: falha ao instalar dependencias.
        pause
        exit /b 1
    )
)

echo Abrindo servidor em:
echo http://127.0.0.1:4173/index.html#/home
echo.
echo Para encerrar o servidor, pressione Ctrl+C nesta janela.
echo.

call npm run dev

echo.
echo Servidor encerrado.
pause
