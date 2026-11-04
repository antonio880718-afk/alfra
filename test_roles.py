import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Mute warnings just in case
import warnings
warnings.filterwarnings("ignore")

cred = credentials.Certificate('functions/serviceAccountKey.json')
try:
    firebase_admin.initialize_app(cred)
except ValueError:
    pass # already initialized
db = firestore.client()

users_ref = db.collection('usuarios')
docs = users_ref.get()

print("LISTA DE USUARIOS Y ROLES:")
for doc in docs:
    data = doc.to_dict()
    email = data.get('email', '')
    role = data.get('role', '')
    token = data.get('fcmToken', 'NONE')
    token_str = token[:10] + "..." if token != 'NONE' else 'NONE'
    if role in ['Administrador', 'Master Admin'] or 'alejandra' in email.lower() or 'antonio' in email.lower():
        print(f"Email: {email} | Role: {role} | Token: {token_str}")
