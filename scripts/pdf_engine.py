# -*- coding: utf-8 -*-
import os
import subprocess
import time
import tempfile
import shutil

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def render_html_to_pdf(html_content, output_pdf_path):
    output_dir = os.path.dirname(os.path.abspath(output_pdf_path))
    os.makedirs(output_dir, exist_ok=True)
    
    temp_html_path = os.path.join(output_dir, f"_temp_{int(time.time()*1000)}.html")
    with open(temp_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    temp_user_dir = tempfile.mkdtemp(prefix="edge_pdf_")
    abs_pdf_path = os.path.abspath(output_pdf_path)
    
    # Remove previous file if exists to ensure freshly minted PDF
    if os.path.exists(abs_pdf_path):
        try:
            os.remove(abs_pdf_path)
        except Exception as e:
            print("Warning removing existing pdf:", e)

    cmd = [
        EDGE_PATH,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--user-data-dir={temp_user_dir}",
        "--no-pdf-header-footer",
        f"--print-to-pdf={abs_pdf_path}",
        temp_html_path
    ]
    
    res = subprocess.run(cmd, capture_output=True, timeout=45)
    if res.returncode != 0:
        print("Edge returncode:", res.returncode, "stderr:", res.stderr.decode("utf-8", errors="ignore"))
        
    attempts = 0
    while attempts < 30:
        if os.path.exists(abs_pdf_path) and os.path.getsize(abs_pdf_path) > 1000:
            break
        time.sleep(0.5)
        attempts += 1
        
    try:
        if os.path.exists(temp_html_path):
            os.remove(temp_html_path)
        shutil.rmtree(temp_user_dir, ignore_errors=True)
    except:
        pass
        
    if not os.path.exists(abs_pdf_path) or os.path.getsize(abs_pdf_path) == 0:
        raise RuntimeError(f"Error generando PDF: {output_pdf_path}")
        
    size_kb = os.path.getsize(abs_pdf_path) / 1024.0
    print(f"[OK] Generado: {os.path.basename(abs_pdf_path)} ({size_kb:.1f} KB)")
    return abs_pdf_path
