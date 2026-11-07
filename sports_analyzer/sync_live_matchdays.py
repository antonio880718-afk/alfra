# -*- coding: utf-8 -*-
"""
SINCRONIZADOR DINÁMICO DE JORNADAS Y ACTAS OFICIALES
Verifica los 32 datasets locales en 'sports_analyzer/data/' y calcula la acumulación
partido a partido tanto de la temporada 2025/2026 como de la 2026/2027 en curso.
Permite auditar el crecimiento de la muestra (N) y actualizar las medias móviles.
"""

import os
import glob
import pandas as pd
from typing import Dict, Any

def audit_cumulative_datasets() -> Dict[str, Any]:
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    csv_files = glob.glob(os.path.join(data_dir, "*.csv"))
    
    report = {
        "total_datasets": len(csv_files),
        "seasons_detected": set(),
        "total_matches_accumulated": 0,
        "leagues_summary": {}
    }
    
    for f in csv_files:
        basename = os.path.basename(f)
        parts = basename.replace(".csv", "").split("_")
        if len(parts) == 2:
            season, league = parts[0], parts[1]
            report["seasons_detected"].add(season)
            try:
                df = pd.read_csv(f, encoding="latin1")
                n_matches = len(df)
                report["total_matches_accumulated"] += n_matches
                
                if league not in report["leagues_summary"]:
                    report["leagues_summary"][league] = {"2526": 0, "2627": 0, "total": 0}
                if season in report["leagues_summary"][league]:
                    report["leagues_summary"][league][season] = n_matches
                report["leagues_summary"][league]["total"] += n_matches
            except Exception:
                pass
                
    report["seasons_detected"] = list(report["seasons_detected"])
    return report

if __name__ == "__main__":
    rep = audit_cumulative_datasets()
    print("===============================================================")
    print(" REPORTE OFICIAL DE INGESTA ACUMULATIVA DE PARTIDOS JUGADOS")
    print("===============================================================")
    print(f" Datasets oficiales en disco: {rep['total_datasets']}")
    print(f" Temporadas activas: {rep['seasons_detected']}")
    print(f" Partidos totales acumulados: {rep['total_matches_accumulated']:,}")
    print("---------------------------------------------------------------")
    print(f"{'Liga':<8} | {'25/26 (Previa)':<15} | {'26/27 (En Curso)':<18} | {'Total Acumulado':<15}")
    print("---------------------------------------------------------------")
    for lg, counts in sorted(rep["leagues_summary"].items()):
        print(f"{lg:<8} | {counts.get('2526', 0):<15} | {counts.get('2627', 0):<18} | {counts.get('total', 0):<15}")
    print("===============================================================")
