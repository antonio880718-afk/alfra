@echo off
title ALFRA Sports Web App (Futbol + NBA + NFL) - Acceso Remoto
echo ===================================================
echo   ALFRA SPORTS WEB APP (FUTBOL + NBA + NFL)
echo ===================================================
echo 1. Levantando Web App Unificada en puerto 8501...
start "" python -m streamlit run sports_analyzer\app.py --server.port 8501 --server.headless true

timeout /t 3 /nobreak > nul

echo 2. Levantando tunel HTTPS Cloudflare para PC y Celular...
echo Usa el enlace https://xxxx.trycloudflare.com en cualquier navegador.
echo En ese mismo enlace puedes abrir:
echo   - Futbol: /?sport=futbol
echo   - NBA:    /?sport=nba
echo   - NFL:    /?sport=nfl
echo ===================================================
.\cloudflared.exe tunnel --url http://localhost:8501
pause
