@echo off
title ALFRA NBA & NCAAB Web App - Puerto 8502
echo ===================================================
echo   ALFRA NBA & NCAAB WEB APP (LOCAL + REMOTO HTTPS)
echo ===================================================
start "" python -m streamlit run nba_analyzer\nba_app.py --server.port 8502 --server.headless true
timeout /t 3 /nobreak > nul
.\cloudflared.exe tunnel --url http://localhost:8502
pause
