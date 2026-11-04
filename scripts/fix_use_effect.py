# -*- coding: utf-8 -*-
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_line = "import React, { useState } from 'react';"
new_line = "import React, { useState, useEffect } from 'react';"

if old_line in text:
    text = text.replace(old_line, new_line, 1)
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("useEffect importado correctamente en App.jsx.")
else:
    print("Error: old_line no encontrada.")
