@echo off
title ALFRA NFL & NCAAF Web App - Puerto 8503
echo ===================================================
echo   ALFRA NFL & NCAAF WEB APP (LOCAL + REMOTO HTTPS)
echo ===================================================
start "" python -m streamlit run nfl_analyzer\nfl_app.py --server.port 8503 --server.headless true
timeout /t 3 /nobreak > nul
.\cloudflared.exe tunnel --url http://localhost:8503
pause
