@echo off
title ALFRA Sports Web App (24/7 Local)
cd /d "%~dp0"
echo Iniciando ALFRA Sports Web App en http://localhost:8501 ...
start "" http://localhost:8501
python -m streamlit run sports_analyzer/app.py --server.port=8501 --server.headless=true
pause
