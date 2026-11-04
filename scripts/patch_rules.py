# -*- coding: utf-8 -*-
import sys

with open('firestore.rules', 'r', encoding='utf-8') as f:
    text = f.read()

old_rules_helpers = """    function getRole() {
      return exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) 
        ? get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role 
        : 'Paciente';
    }
    
    function hasRole(role) {
      return isMasterAdmin() || (isSignedIn() && getRole() == role);
    }
    
    function isStaff() {
      return isMasterAdmin() || (isSignedIn() && (getRole() in ['Administrador', 'Recepcionista', 'Especialista', 'Doctor', 'Limpieza']));
    }"""

new_rules_helpers = """    function isUserActive() {
      return !exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) || (
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.activo != false &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.bloqueado != true &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.eliminado != true &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role != 'Inactivo'
      );
    }

    function getRole() {
      return exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) 
        ? get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role 
        : 'Paciente';
    }
    
    function hasRole(role) {
      return isMasterAdmin() || (isSignedIn() && isUserActive() && getRole() == role);
    }
    
    function isStaff() {
      return isMasterAdmin() || (isSignedIn() && isUserActive() && (getRole() in ['Administrador', 'Recepcionista', 'Especialista', 'Doctor', 'Limpieza']));
    }"""

if old_rules_helpers in text:
    text = text.replace(old_rules_helpers, new_rules_helpers, 1)
    with open('firestore.rules', 'w', encoding='utf-8') as f:
        f.write(text)
    print("firestore.rules actualizado con exito.")
else:
    print("Error: old_rules_helpers no coincide en firestore.rules.")
    sys.exit(1)
