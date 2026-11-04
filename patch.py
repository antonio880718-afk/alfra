# -*- coding: utf-8 -*-
import re

with open('src/components/ui/ReciboNomina.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Comisiones
comisiones_pattern = r"\{/\* Fila: Comisi.n servicios \*/\}.*?\{fmt\(comisionProductos\)\}\<\/span\>\n                        \<\/div\>"
comisiones_replacement = """{showComisiones && (
                            <>
                                {/* Fila: Comisiones servicios */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: '600' }}>Comisiones por Servicios</span>
                                    <span style={{ fontSize: '13px', color: TURQUESA, fontWeight: '700', fontFamily: 'monospace' }}>{fmt(comisionServicios)}</span>
                                </div>

                                {/* Fila: Comisiones productos */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: '600' }}>Comisiones por Productos</span>
                                    <span style={{ fontSize: '13px', color: TURQUESA, fontWeight: '700', fontFamily: 'monospace' }}>{fmt(comisionProductos)}</span>
                                </div>
                            </>
                        )}"""

content = re.sub(comisiones_pattern, comisiones_replacement, content, flags=re.DOTALL)

# Fix Bonos
bonos_pattern = r"\{/\* Bonos \*/\}.*?\{fmt\(totalComisiones \+ Number\(bonoPuntualidad\) \+ Number\(bonoProductividad\)\)\}\<\/span\>\n                        \<\/div\>"
bonos_replacement = """{/* Bonos */}
                        {showBonos && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: '600' }}>Bono de Puntualidad</span>
                                    <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '700', fontFamily: 'monospace' }}>{fmt(bonoPuntualidad)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: '600' }}>Bono de Productividad</span>
                                    <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '700', fontFamily: 'monospace' }}>{fmt(bonoProductividad)}</span>
                                </div>
                            </>
                        )}

                        {/* Total comisiones y bonos */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1.5px solid #e5e7eb' }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600' }}>{showBonos ? 'Total Comisiones y Bonos' : 'Total Comisiones'}</span>
                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', fontFamily: 'monospace' }}>{fmt(totalComisiones + (showBonos ? Number(bonoPuntualidad) + Number(bonoProductividad) : 0))}</span>
                        </div>"""

content = re.sub(bonos_pattern, bonos_replacement, content, flags=re.DOTALL)

with open('src/components/ui/ReciboNomina.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied successfully.")