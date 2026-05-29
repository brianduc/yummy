@echo off
REM YUMMY - Start both Frontend + Backend with a single command
REM Usage: start.bat [mode]

setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
REM Backend now uses TypeScript / Hono (backend-ts/). Legacy Python
REM backend (backend/) is kept as a fallback but no longer started.
set "BACKEND_DIR=%ROOT_DIR%backend-ts"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

REM ── Parse mode argument ──────────────────────────────────
set "MODE_ARG=%~1"
if /i "!MODE_ARG!"=="--help" goto :show_help
if /i "!MODE_ARG!"=="-h" goto :show_help
if /i "!MODE_ARG!"=="help" goto :show_help
if "!MODE_ARG!"=="" (
    set "MODE=dev"
) else if /i "!MODE_ARG!"=="dev" (
    set "MODE=dev"
) else if /i "!MODE_ARG!"=="staging" (
    set "MODE=staging"
) else if /i "!MODE_ARG!"=="prod" (
    echo ERROR: prod mode is not for local launchers. Use docker compose or your real deploy pipeline.
    pause
    exit /b 1
) else (
    echo ERROR: Unknown mode: !MODE_ARG!. Allowed: dev, staging, prod
    pause
    exit /b 1
)
goto :after_help

:show_help
echo.
echo Usage: start.bat [mode]
echo   mode: dev ^(default^) ^| staging ^| prod
echo.
echo   dev      Load .env then .env.dev. Start backend + frontend locally.
echo   staging  Load .env then .env.staging. Start backend + frontend locally.
echo   prod     REFUSED. Use docker compose or your real deploy pipeline.
echo.
echo   No mode argument is equivalent to 'dev'.
echo.
exit /b 0

:after_help

REM Auto-create .env from .env.example if missing
if not exist "%ROOT_DIR%.env" (
    if exist "%ROOT_DIR%.env.example" (
        copy "%ROOT_DIR%.env.example" "%ROOT_DIR%.env" >nul
        echo Created .env from .env.example
        echo You can configure provider credentials in the app UI or in .env.
    ) else (
        echo ERROR: Neither .env nor .env.example found.
        pause
        exit /b 1
    )
)

REM ── Auto-create .env.%MODE% ──────────────────────────────
if not exist "%ROOT_DIR%.env.!MODE!" (
    if exist "%ROOT_DIR%.env.!MODE!.example" (
        copy "%ROOT_DIR%.env.!MODE!.example" "%ROOT_DIR%.env.!MODE!" >nul
        echo Created .env.!MODE! from .env.!MODE!.example
        echo Edit .env.!MODE! if needed, then run start.bat again.
        pause
        exit /b 0
    ) else (
        echo ERROR: .env.!MODE! not found and .env.!MODE!.example missing.
        pause
        exit /b 1
    )
)

REM Parse .env - skip comment lines
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT_DIR%.env") do (
    set "_k=%%A"
    set "_v=%%B"
    if not "!_k!"=="" (
        set "!_k!=!_v!"
    )
)

REM ── Load .env.%MODE% overlay ─────────────────────────────
if exist "%ROOT_DIR%.env.!MODE!" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT_DIR%.env.!MODE!") do (
        set "_k=%%A"
        set "_v=%%B"
        if not "!_k!"=="" (
            set "!_k!=!_v!"
        )
    )
)

if "!BACKEND_PORT!"=="" set "BACKEND_PORT=8000"
if "!FRONTEND_PORT!"=="" set "FRONTEND_PORT=3000"
if "!AI_PROVIDER!"=="" set "AI_PROVIDER=gemini"

echo.
echo YUMMY - AI SDLC Platform [!MODE! mode]
echo ==================================
echo.
echo Select AI Provider:
echo.
echo   [1] Gemini       (configure credentials in the app UI)
echo   [2] OpenAI       (configure credentials in the app UI)
echo   [3] Bedrock      (configure credentials in the app UI)
echo   [4] Copilot      (configure credentials in the app UI)
echo   [5] Ollama       (optional local URL/model)
echo   [6] Keep current (!AI_PROVIDER!)
echo.
set /p "PROVIDER_CHOICE=Enter number and press Enter [default: 6]: "

if "!PROVIDER_CHOICE!"=="1" (
    set "AI_PROVIDER=gemini"
) else if "!PROVIDER_CHOICE!"=="2" (
    set "AI_PROVIDER=openai"
) else if "!PROVIDER_CHOICE!"=="3" (
    set "AI_PROVIDER=bedrock"
) else if "!PROVIDER_CHOICE!"=="4" (
    set "AI_PROVIDER=copilot"
) else if "!PROVIDER_CHOICE!"=="5" (
    set "AI_PROVIDER=ollama"
) else (
    echo Using current provider: !AI_PROVIDER!
)

REM Save provider choice back to .env
call :update_env "AI_PROVIDER" "!AI_PROVIDER!"

echo.
echo Provider set to: !AI_PROVIDER!
echo Configure credentials later in the app UI if needed.
echo ==================================

REM Backend (TypeScript / Hono)
echo.
echo [Backend] Setting up Node.js / pnpm...
cd /d "%BACKEND_DIR%"

where node >nul 2>&1
if errorlevel 1 (
    echo [Backend] ERROR: Node.js not found. Install Node 20+ from https://nodejs.org
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [Backend] pnpm not found. Installing via npm...
    call npm install -g pnpm
    if errorlevel 1 (
        echo [Backend] ERROR: Failed to install pnpm.
        pause
        exit /b 1
    )
)

if not exist "node_modules" (
    echo [Backend] Installing dependencies ^(first run^)...
    call pnpm install --silent
    if errorlevel 1 (
        echo [Backend] ERROR: pnpm install failed.
        pause
        exit /b 1
    )
)
echo [Backend] Dependencies OK

REM Apply DB migrations (idempotent)
call pnpm db:migrate >nul 2>&1

echo [Backend] Starting at http://localhost:!BACKEND_PORT! ...
start "YUMMY Backend" cmd /c "cd /d "!BACKEND_DIR!" && set PORT=!BACKEND_PORT! && set AI_PROVIDER=!AI_PROVIDER! && set GEMINI_API_KEY=!GEMINI_API_KEY! && set GEMINI_MODEL=!GEMINI_MODEL! && set OPENAI_API_KEY=!OPENAI_API_KEY! && set OPENAI_MODEL=!OPENAI_MODEL! && set AWS_ACCESS_KEY_ID=!AWS_ACCESS_KEY_ID! && set AWS_SECRET_ACCESS_KEY=!AWS_SECRET_ACCESS_KEY! && set AWS_REGION=!AWS_REGION! && set BEDROCK_MODEL=!BEDROCK_MODEL! && set COPILOT_GITHUB_TOKEN=!COPILOT_GITHUB_TOKEN! && set COPILOT_MODEL=!COPILOT_MODEL! && set OLLAMA_BASE_URL=!OLLAMA_BASE_URL! && set OLLAMA_MODEL=!OLLAMA_MODEL! && pnpm dev"

timeout /t 3 /nobreak >nul

REM Frontend
echo.
echo [Frontend] Setting up Node.js...
cd /d "%FRONTEND_DIR%"

if "!NEXT_PUBLIC_API_URL!"=="" set "NEXT_PUBLIC_API_URL=http://localhost:!BACKEND_PORT!"
(echo NEXT_PUBLIC_API_URL=!NEXT_PUBLIC_API_URL!) > "%FRONTEND_DIR%\.env.local"

if not exist "node_modules" (
    echo [Frontend] Installing npm packages ^(first run^)...
    npm install --silent
)

echo [Frontend] Dependencies OK
echo [Frontend] Starting at http://localhost:!FRONTEND_PORT! ...
start "YUMMY Frontend" cmd /c "cd /d "!FRONTEND_DIR!" && npm run dev -- --port !FRONTEND_PORT!"

REM Done
echo.
echo ==================================
echo YUMMY is running!  [Provider: !AI_PROVIDER!]
echo.
echo   App:     http://localhost:!FRONTEND_PORT!
echo   API:     http://localhost:!BACKEND_PORT!
echo   Swagger: http://localhost:!BACKEND_PORT!/docs
echo ==================================
echo.
echo Close the 2 terminal windows to stop.
pause
exit /b 0

REM Update or append a key=value in .env
:update_env
set "_key=%~1"
set "_val=%~2"
set "_envfile=%ROOT_DIR%.env"
set "_tmpfile=%ROOT_DIR%.env.tmp"
set "_found=0"
if exist "!_tmpfile!" del "!_tmpfile!"
for /f "usebackq eol=# delims=" %%L in ("!_envfile!") do (
    set "_line=%%L"
    echo !_line! | findstr /b "!_key!=" >nul 2>&1
    if !errorlevel!==0 (
        echo !_key!=!_val!>>"!_tmpfile!"
        set "_found=1"
    ) else (
        echo !_line!>>"!_tmpfile!"
    )
)
if "!_found!"=="0" echo !_key!=!_val!>>"!_tmpfile!"
move /y "!_tmpfile!" "!_envfile!" >nul
exit /b 0
