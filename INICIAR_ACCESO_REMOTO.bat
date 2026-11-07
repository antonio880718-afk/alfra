@echo off
title Lanzador Deportivo Alfra - Servidor Local y Acceso Remoto
echo ===================================================
echo   INICIANDO ANALIZADOR DEPORTIVO (LOCAL + REMOTO)
echo ===================================================
echo 1. Levantando servidor Streamlit en puerto 8501...
start "" python -m streamlit run sports_analyzer\app.py --server.port 8501 --server.headless true

timeout /t 3 /nobreak > nul

echo 2. Levantando tunel seguro global Cloudflare (HTTPS)...
echo Abre el enlace https://xxxx.trycloudflare.com que aparecera abajo en tu celular:
echo ===================================================
.\cloudflared.exe tunnel --url http://localhost:8501
pause
