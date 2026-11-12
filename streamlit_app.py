# -*- coding: utf-8 -*-
"""Root Streamlit Web App entrypoint (Fútbol • NBA & NCAAB • NFL & NCAAF)."""
import os
import runpy

_ROOT = os.path.dirname(os.path.abspath(__file__))
runpy.run_path(os.path.join(_ROOT, "sports_analyzer", "app.py"), run_name="__main__")
