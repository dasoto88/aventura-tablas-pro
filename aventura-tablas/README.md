# 🦁 Aventura de Tablas Pro v2.0

Juego educativo para niños de primero a tercero de primaria.
Aprende las tablas de multiplicar del 1 al 10 jugando.

---

## 📁 ESTRUCTURA DEL PROYECTO

```
aventura-tablas/
├── backend/                  ← API FastAPI (Python)
│   ├── main.py               ← Servidor principal
│   ├── requirements.txt      ← Dependencias Python
│   ├── .env                  ← Configuración (correo, sheets, etc.)
│   └── credenciales.json     ← 🔑 TÚ LO AGREGAS (Google Service Account)
│
└── frontend/                 ← Juego React
    ├── package.json
    ├── .env                  ← URL del API
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.jsx
        ├── App.css
        ├── utils/
        │   ├── gameData.js   ← Mundos, avatares, tienda
        │   └── store.js      ← Estado global (Zustand)
        └── pages/
            ├── LoginPage.jsx
            ├── AvatarPage.jsx
            ├── MapaPage.jsx
            ├── JuegoPage.jsx
            ├── BossPage.jsx
            ├── MundoCompletePage.jsx
            ├── TiendaPage.jsx
            ├── AdminPage.jsx
            └── SupremoPage.jsx
```

---

## ⚡ INICIO RÁPIDO CON CLAUDE CODE

Si tienes Claude Code instalado, abre una terminal en la carpeta raíz y ejecuta:

```bash
# 1. Instalar todo
claude "Instala las dependencias del backend y frontend del proyecto"

# 2. Arrancar ambos servidores
claude "Arranca el backend FastAPI en puerto 8000 y el frontend React en puerto 3000"
```

---

## 🖥️ INSTALACIÓN MANUAL PASO A PASO

### Requisitos previos
- Python 3.10 o superior
- Node.js 18 o superior
- npm 9 o superior

### 1. Backend (Python / FastAPI)

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar (Windows):
venv\Scripts\activate

# Activar (Mac/Linux):
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Verificar que el .env tiene tus datos reales
```

### 2. Frontend (React)

```bash
cd frontend
npm install
```

---

## 🔑 CONFIGURAR GOOGLE SHEETS

### Paso A — Google Cloud Console
1. Ve a https://console.cloud.google.com
2. Crea proyecto nuevo: "AventuraTablas"
3. Activa estas APIs:
   - Google Sheets API
   - Google Drive API
4. Crea una Cuenta de Servicio → descarga el JSON
5. Renómbralo `credenciales.json` y ponlo en `backend/`

### Paso B — Crear el Google Sheet
1. Ve a https://sheets.google.com
2. Crea una hoja nueva con nombre exacto: **AventuraTablas**

**Pestaña "Licencias"** — fila 1:
```
Licencia | Activa | Tipo | Nombre | Correo | Monedas | Inventario | Nivel_Max
```

Fila 2 (tu licencia admin):
```
admindasoto88 | SI | admin | David | tu@correo.com | 0 |  | 1
```

**Pestaña "Solicitudes"** — fila 1:
```
Fecha | Nombre | Correo | Celular | Escuela | Estado
```

### Paso C — Compartir el Sheet
1. Abre `credenciales.json` y copia el campo `client_email`
2. En el Google Sheet → Compartir → pega ese correo → Editor

---

## 🚀 EJECUTAR EL PROYECTO

### Terminal 1 — Backend:
```bash
cd backend
venv\Scripts\activate    # Windows
# source venv/bin/activate  # Mac/Linux
uvicorn main:app --reload --port 8000
```
Verás: `Uvicorn running on http://127.0.0.1:8000`

### Terminal 2 — Frontend:
```bash
cd frontend
npm start
```
Se abre en: http://localhost:3000

---

## 🧪 PROBAR SIN GOOGLE SHEETS

Puedes probar el juego sin configurar nada:

1. Abre el frontend: `http://localhost:3000`
2. Ve a la pestaña **🎁 DEMO**
3. Haz clic en **¡JUGAR DEMO AHORA!**
4. Elige tu avatar y ¡a jugar!

La demo dura 3 minutos y no necesita backend.

---

## 🎮 CÓMO PROBAR CON CLAUDE CODE

### Instalar Claude Code (si no lo tienes):
```bash
npm install -g @anthropic-ai/claude-code
```

### Comandos útiles con Claude Code:

```bash
# Desde la carpeta aventura-tablas/

# Instalar todo de un solo comando:
claude "instala dependencias del backend con pip y del frontend con npm"

# Arrancar el backend:
claude "arranca uvicorn main:app --reload en la carpeta backend"

# Ver si hay errores en el código:
claude "revisa todos los archivos del proyecto y dime si hay errores"

# Agregar una nueva función:
claude "agrega un sistema de logros al juego: primer acierto, primera racha de 5, primer boss derrotado"

# Modificar algo:
claude "cambia el tiempo límite del mundo 3 de 25 a 30 segundos"
```

---

## 📤 DESPLIEGUE EN PRODUCCIÓN

### Backend → Render.com
1. Crea cuenta en render.com
2. New → Web Service → conecta tu repo de GitHub
3. Configuración:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Agrega variables de entorno (todo lo del .env)
5. Agrega `credenciales.json` como Secret File

### Frontend → Vercel o Netlify
1. Conecta el repo de GitHub
2. Framework: Create React App
3. Root Directory: `frontend`
4. Variable de entorno: `REACT_APP_API_URL=https://tu-api.render.com`

---

## 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

| Problema | Solución |
|---|---|
| `ModuleNotFoundError` | Activa el entorno virtual y corre `pip install -r requirements.txt` |
| `npm start` falla | Borra `node_modules` y corre `npm install` de nuevo |
| Error 503 en login | Revisa que el backend esté corriendo en el puerto 8000 |
| Error de Google Sheets | Verifica que `credenciales.json` esté en `backend/` y el Sheet sea compartido |
| CORS error | El backend ya tiene CORS configurado; verifica que el .env del frontend tenga la URL correcta |

---

## 📞 SOPORTE
- Correo: pixelimpresorasap@gmail.com
- El panel admin usa la licencia: `admindasoto88`
