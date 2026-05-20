"""
Aventura de Tablas Pro v2.1 — Backend con SQLite (base de datos local, sin Google Sheets)
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Aventura de Tablas API", version="2.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

EMAIL_FROM = os.getenv("EMAIL_REMITENTE", "pixelimpresorasap@gmail.com")
EMAIL_PASS = os.getenv("EMAIL_PASSWORD", "")
LINK_MP    = os.getenv("LINK_MERCADO_PAGO", "https://mpago.la/1HSsTdv")
DATOS_BBVA = os.getenv("DATOS_TRANSFERENCIA",
    "Banco: BBVA | Cuenta: 4152314169570341 | Titular: David Soto Beltran | Concepto: AventuraTablas + Nombre alumno")

DB_PATH = Path(__file__).parent / "aventura_tablas.db"

# ─── BASE DE DATOS SQLITE ─────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS Licencias (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                Licencia    TEXT UNIQUE NOT NULL,
                Activa      TEXT NOT NULL DEFAULT 'NO',
                Tipo        TEXT NOT NULL DEFAULT 'alumno',
                Nombre      TEXT DEFAULT '',
                Correo      TEXT DEFAULT '',
                Celular     TEXT DEFAULT '',
                Monedas     INTEGER DEFAULT 0,
                Inventario  TEXT DEFAULT '',
                Nivel_Max   INTEGER DEFAULT 1,
                Fecha_Vence TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS Solicitudes (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                Fecha   TEXT NOT NULL,
                Nombre  TEXT NOT NULL,
                Correo  TEXT NOT NULL,
                Celular TEXT NOT NULL,
                Escuela TEXT NOT NULL,
                Estado  TEXT DEFAULT 'Pendiente'
            );
        """)
        # Crear admin por defecto si no existe
        admin_cfg = conn.execute("SELECT value FROM config WHERE key='admin_licencia'").fetchone()
        if not admin_cfg:
            conn.execute("INSERT INTO config (key, value) VALUES ('admin_licencia', 'admindasoto88')")
            conn.execute("""
                INSERT OR IGNORE INTO Licencias (Licencia, Activa, Tipo, Nombre, Correo)
                VALUES ('admindasoto88', 'SI', 'admin', 'Admin', ?)
            """, (EMAIL_FROM,))
            conn.commit()
            print("[DB] Base de datos iniciada con admin por defecto: admindasoto88")
    finally:
        conn.close()

init_db()

def get_admin_licencia() -> str:
    conn = get_db()
    try:
        row = conn.execute("SELECT value FROM config WHERE key='admin_licencia'").fetchone()
        return row["value"] if row else "admindasoto88"
    finally:
        conn.close()

# ─── MODELOS ─────────────────────────────────────────────────
class SolicitudRegistro(BaseModel):
    nombre: str
    correo: str
    celular: str
    escuela: str

class ValidarLicencia(BaseModel):
    licencia: str

class ActualizarProgreso(BaseModel):
    licencia: str
    monedas: int
    inventario: str
    nivel_max: int
    nombre: Optional[str] = None

class CrearLicencia(BaseModel):
    codigo: str
    tipo: str
    nombre: Optional[str] = ""
    correo: Optional[str] = ""
    celular: Optional[str] = ""

class AccionLicencia(BaseModel):
    codigo: str

class CambiarAdminLicencia(BaseModel):
    licencia_actual: str
    licencia_nueva: str

class RecuperarLicencia(BaseModel):
    correo: Optional[str] = ""
    celular: Optional[str] = ""

# ─── EMAIL ───────────────────────────────────────────────────
def enviar_correo(destinatario: str, asunto: str, html: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["From"]    = EMAIL_FROM
        msg["To"]      = destinatario
        msg["Subject"] = asunto
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.starttls()
            s.login(EMAIL_FROM, EMAIL_PASS)
            s.send_message(msg)
        print(f"[Email OK] → {destinatario}")
        return True
    except Exception as e:
        print(f"[Email Error] {e}")
        return False

# ─── TEMPLATES DE CORREO ─────────────────────────────────────
def _base(contenido: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>body{{margin:0;padding:0;background:#030010;font-family:'Segoe UI',Arial,sans-serif;}}
.wrap{{max-width:600px;margin:0 auto;padding:30px 16px;}}
.card{{background:linear-gradient(135deg,#1a1f4e,#0d1237);border-radius:24px;overflow:hidden;border:2px solid #00f5ff22;}}
.hero{{padding:36px;text-align:center;}}.body{{padding:32px;}}
h1{{font-family:monospace;font-size:26px;font-weight:900;margin:0 0 6px;letter-spacing:3px;}}
p{{color:#b0b8ff;line-height:1.7;margin:10px 0;font-size:15px;}}
.btn{{display:inline-block;padding:14px 32px;border-radius:14px;text-decoration:none;font-weight:bold;font-size:16px;margin:8px 4px;}}
.box{{border-radius:16px;padding:20px 24px;margin:18px 0;}}
.box-cyan{{background:rgba(0,245,255,0.08);border:2px solid rgba(0,245,255,0.3);}}
.box-gold{{background:rgba(255,214,0,0.08);border:2px solid rgba(255,214,0,0.4);}}
.box-pink{{background:rgba(255,0,110,0.08);border:2px solid rgba(255,0,110,0.3);}}
.box-purple{{background:rgba(108,92,231,0.12);border:2px solid rgba(162,155,254,0.4);}}
.label{{font-size:11px;color:#00f5ff;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;}}
.code{{font-family:monospace;font-size:28px;font-weight:900;color:#fff;background:rgba(0,0,0,0.5);padding:14px 24px;border-radius:12px;letter-spacing:5px;display:inline-block;margin:10px 0;border:2px solid rgba(255,214,0,0.4);}}
ol li{{color:#b0b8ff;line-height:2.2;font-size:14px;}}
.footer{{text-align:center;padding:20px;color:#3a4060;font-size:12px;}}
</style></head>
<body><div class="wrap"><div class="card">{contenido}</div>
<div class="footer">Aventura de Tablas Pro v2.1 • {EMAIL_FROM}</div>
</div></body></html>"""

def email_solicitud(nombre: str) -> str:
    bbva_lines = DATOS_BBVA.replace("|","<br>")
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#ff006e,#8338ec,#3a86ff);">
  <div style="font-size:64px;margin-bottom:10px;">🦁⚔️🌟</div>
  <h1 style="color:#fff;">¡SOLICITUD RECIBIDA!</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{nombre}</strong>! 👋</p>
  <p>Tu solicitud para <strong>Aventura de Tablas Pro</strong> fue recibida. Para activar tu cuenta, realiza el pago por cualquiera de las siguientes opciones:</p>
  <div class="box box-gold">
    <div class="label">💳 Mercado Pago (más rápido)</div>
    <a href="{LINK_MP}" class="btn" style="background:linear-gradient(135deg,#00b4d8,#0077b6);color:#fff;">👉 Pagar con Mercado Pago</a>
  </div>
  <div class="box box-cyan">
    <div class="label">🏦 Transferencia BBVA</div>
    <p style="margin:0;">{bbva_lines}</p>
  </div>
  <div class="box box-pink">
    <div class="label">📋 Pasos para activar tu cuenta</div>
    <ol>
      <li>Realiza el pago por cualquier método de arriba</li>
      <li>Toma foto o captura del comprobante</li>
      <li>Envíalo al correo <strong style="color:#00f5ff;">{EMAIL_FROM}</strong></li>
      <li>En menos de <strong>24 horas</strong> recibirás tu código 🎉</li>
    </ol>
  </div>
</div>""")

def email_activacion(nombre: str, licencia: str, fecha_vence: str) -> str:
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#00b894,#00cec9,#0984e3);">
  <div style="font-size:64px;margin-bottom:10px;">🎉🏆✨</div>
  <h1 style="color:#fff;">¡CUENTA ACTIVADA!</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{nombre}</strong>! 🦁</p>
  <p>Tu pago fue confirmado y tu cuenta está <strong style="color:#39ff14;">ACTIVA</strong>. ¡Ya puedes comenzar tu aventura!</p>
  <div class="box box-gold" style="text-align:center;">
    <div class="label">🔑 Tu Código de Licencia</div>
    <div class="code">{licencia}</div>
    <p style="margin:8px 0 0;color:#FFD700;">Válida hasta: <strong>{fecha_vence}</strong></p>
  </div>
  <div class="box box-cyan">
    <div class="label">🚀 Cómo ingresar al juego</div>
    <ol>
      <li>Abre el juego en tu navegador</li>
      <li>En la pestaña <strong>🎮 JUGAR</strong>, escribe tu código de licencia</li>
      <li>¡Elige tu avatar y comienza la aventura!</li>
    </ol>
  </div>
  <p style="text-align:center;font-size:22px;margin-top:20px;">¡Buena suerte, aventurero! ⚔️🌟</p>
</div>""")

def email_recuperacion(nombre: str, licencia: str) -> str:
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#6c5ce7,#a29bfe,#74b9ff);">
  <div style="font-size:64px;margin-bottom:10px;">🔑💌✨</div>
  <h1 style="color:#fff;">RECUPERACIÓN DE LICENCIA</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{nombre}</strong>! 👋</p>
  <p>Recibiste este correo porque solicitaste recuperar tu código de acceso a <strong>Aventura de Tablas Pro</strong>.</p>
  <div class="box box-purple" style="text-align:center;">
    <div class="label">🔑 Tu Código de Licencia</div>
    <div class="code">{licencia}</div>
  </div>
  <div class="box box-cyan">
    <div class="label">🚀 Cómo usarlo</div>
    <ol>
      <li>Abre el juego en tu navegador</li>
      <li>En la pestaña <strong>🎮 JUGAR</strong>, escribe el código de arriba</li>
      <li>¡Listo! Continúa tu aventura</li>
    </ol>
  </div>
  <p style="font-size:13px;color:#5060a0;text-align:center;">Si tú no solicitaste esto, simplemente ignora este correo.</p>
</div>""")

# ─── ENDPOINTS ────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "app": "Aventura de Tablas Pro v2.1", "db": "SQLite local"}

# ── Keep-Alive: evita que Render duerma el servidor ───────────
@app.get("/api/ping")
def ping():
    """El frontend lo llama cada 5 min para mantener Render despierto."""
    return {"pong": True, "ts": datetime.now().isoformat()}

@app.get("/api/health")
def health():
    """Verifica que el servidor y la BD responden correctamente."""
    try:
        conn = get_db()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        return {"status": "healthy", "db": "ok", "ts": datetime.now().isoformat()}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}

@app.get("/api/health")
def health():
    """Verifica que la BD también responde."""
    try:
        conn = get_db()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        return {"status": "healthy", "db": "ok", "ts": datetime.now().isoformat()}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}

# ── Validar licencia ──────────────────────────────────────────
@app.post("/api/validar-licencia")
def validar_licencia(data: ValidarLicencia):
    conn = get_db()
    try:
        lic = conn.execute(
            "SELECT * FROM Licencias WHERE Licencia=?", (data.licencia.strip(),)
        ).fetchone()
        if not lic:
            raise HTTPException(404, "Licencia no encontrada. Verifica que esté bien escrita.")
        if lic["Activa"] != "SI":
            raise HTTPException(403, "Licencia desactivada. Contacta al administrador.")
        return {
            "valido":    True,
            "tipo":      lic["Tipo"],
            "nombre":    lic["Nombre"] or "",
            "correo":    lic["Correo"] or "",
            "monedas":   int(lic["Monedas"] or 0),
            "inventario":lic["Inventario"] or "",
            "nivel_max": int(lic["Nivel_Max"] or 1),
            "fila":      lic["id"],
        }
    finally:
        conn.close()

# ── Registro ──────────────────────────────────────────────────
@app.post("/api/registro")
async def registro(data: SolicitudRegistro, bg: BackgroundTasks):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO Solicitudes (Fecha, Nombre, Correo, Celular, Escuela, Estado) VALUES (?,?,?,?,?,?)",
            (datetime.now().strftime("%Y-%m-%d %H:%M"), data.nombre, data.correo, data.celular, data.escuela, "Pendiente")
        )
        conn.commit()
        if data.correo and EMAIL_PASS:
            bg.add_task(enviar_correo, data.correo, "🎮 Aventura de Tablas — ¡Solicitud Recibida!", email_solicitud(data.nombre))
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ── Actualizar progreso ───────────────────────────────────────
@app.post("/api/actualizar-progreso")
def actualizar_progreso(data: ActualizarProgreso):
    conn = get_db()
    try:
        if data.nombre:
            conn.execute(
                "UPDATE Licencias SET Monedas=?, Inventario=?, Nivel_Max=?, Nombre=? WHERE Licencia=?",
                (data.monedas, data.inventario, data.nivel_max, data.nombre, data.licencia.strip())
            )
        else:
            conn.execute(
                "UPDATE Licencias SET Monedas=?, Inventario=?, Nivel_Max=? WHERE Licencia=?",
                (data.monedas, data.inventario, data.nivel_max, data.licencia.strip())
            )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ── Recuperar licencia por correo o celular ───────────────────
@app.post("/api/recuperar-licencia")
async def recuperar_licencia(data: RecuperarLicencia, bg: BackgroundTasks):
    if not data.correo and not data.celular:
        raise HTTPException(400, "Proporciona tu correo electrónico o número de celular")
    conn = get_db()
    try:
        lic = None
        if data.correo and data.correo.strip():
            lic = conn.execute(
                "SELECT * FROM Licencias WHERE LOWER(Correo)=LOWER(?) AND Tipo!='admin'",
                (data.correo.strip(),)
            ).fetchone()
        if not lic and data.celular and data.celular.strip():
            lic = conn.execute(
                "SELECT * FROM Licencias WHERE Celular=? AND Tipo!='admin'",
                (data.celular.strip(),)
            ).fetchone()
        if not lic:
            raise HTTPException(404, "No encontramos una cuenta con esos datos. Verifica tu correo o celular.")
        correo_destino = lic["Correo"] or ""
        if not correo_destino:
            raise HTTPException(400, "Esta cuenta no tiene correo registrado. Contacta al administrador.")
        if EMAIL_PASS:
            bg.add_task(
                enviar_correo, correo_destino,
                "🔑 Aventura de Tablas — Tu código de licencia",
                email_recuperacion(lic["Nombre"] or "Aventurero", lic["Licencia"])
            )
        # Enmascarar correo por seguridad
        at = correo_destino.find("@")
        correo_masked = correo_destino[:2] + "***" + correo_destino[at:]
        return {"ok": True, "correo": correo_masked}
    finally:
        conn.close()

# ── Admin — cambiar licencia/contraseña ──────────────────────
@app.post("/api/admin/cambiar-licencia")
def cambiar_licencia_admin(data: CambiarAdminLicencia):
    admin_actual = get_admin_licencia()
    if data.licencia_actual.strip() != admin_actual:
        raise HTTPException(403, "La licencia actual no es correcta")
    nueva = data.licencia_nueva.strip()
    if len(nueva) < 6:
        raise HTTPException(400, "La nueva licencia debe tener al menos 6 caracteres")
    conn = get_db()
    try:
        conn.execute("UPDATE config SET value=? WHERE key='admin_licencia'", (nueva,))
        conn.execute("UPDATE Licencias SET Licencia=? WHERE Licencia=?", (nueva, admin_actual))
        conn.commit()
        return {"ok": True}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Ese código ya está en uso por otro usuario")
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ── Admin — listar licencias ──────────────────────────────────
@app.get("/api/admin/licencias")
def listar_licencias():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM Licencias ORDER BY id DESC").fetchall()
        return {"licencias": [dict(r) for r in rows]}
    finally:
        conn.close()

# ── Admin — crear licencia ────────────────────────────────────
@app.post("/api/admin/crear-licencia")
def crear_licencia(data: CrearLicencia):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO Licencias (Licencia, Activa, Tipo, Nombre, Correo, Celular) VALUES (?,?,?,?,?,?)",
            (data.codigo.strip(), "NO", data.tipo, data.nombre or "", data.correo or "", data.celular or "")
        )
        conn.commit()
        return {"ok": True}
    except sqlite3.IntegrityError:
        raise HTTPException(409, f"Ya existe una licencia '{data.codigo}'. Elige otro código.")
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ── Admin — activar licencia ──────────────────────────────────
@app.post("/api/admin/activar-licencia")
async def activar_licencia(data: AccionLicencia, bg: BackgroundTasks):
    conn = get_db()
    try:
        lic = conn.execute("SELECT * FROM Licencias WHERE Licencia=?", (data.codigo.strip(),)).fetchone()
        if not lic:
            raise HTTPException(404, "Licencia no encontrada")
        fecha_vence = (datetime.now() + timedelta(days=30)).strftime("%d/%m/%Y")
        conn.execute(
            "UPDATE Licencias SET Activa='SI', Fecha_Vence=? WHERE Licencia=?",
            (fecha_vence, data.codigo.strip())
        )
        conn.commit()
        correo = lic["Correo"] or ""
        nombre = lic["Nombre"] or "Aventurero"
        enviado = False
        if correo and EMAIL_PASS:
            bg.add_task(enviar_correo, correo,
                "✅ Aventura de Tablas — ¡Tu cuenta está activa!",
                email_activacion(nombre, data.codigo, fecha_vence))
            enviado = True
        return {"ok": True, "correo_enviado": enviado}
    finally:
        conn.close()

# ── Admin — desactivar licencia ───────────────────────────────
@app.post("/api/admin/desactivar-licencia")
def desactivar_licencia(data: AccionLicencia):
    conn = get_db()
    try:
        conn.execute("UPDATE Licencias SET Activa='NO' WHERE Licencia=?", (data.codigo.strip(),))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

# ── Admin — eliminar licencia ─────────────────────────────────
@app.delete("/api/admin/eliminar-licencia/{codigo}")
def eliminar_licencia(codigo: str):
    conn = get_db()
    try:
        r = conn.execute("DELETE FROM Licencias WHERE Licencia=?", (codigo,))
        conn.commit()
        if r.rowcount == 0:
            raise HTTPException(404, "Licencia no encontrada")
        return {"ok": True}
    finally:
        conn.close()

# ── Admin — solicitudes ───────────────────────────────────────
@app.get("/api/admin/solicitudes")
def listar_solicitudes():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM Solicitudes ORDER BY id DESC").fetchall()
        return {"solicitudes": [dict(r) for r in rows]}
    finally:
        conn.close()
