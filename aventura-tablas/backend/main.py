"""
Aventura de Tablas Pro v2.1 — Backend con SQLite
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import os
import threading
import time
import requests as _req
import smtplib
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def _self_ping():
    url = os.environ.get("RENDER_EXTERNAL_URL", "")
    if not url:
        return
    while True:
        time.sleep(60)
        try:
            _req.get(f"{url}/api/ping", timeout=10)
        except Exception:
            pass

threading.Thread(target=_self_ping, daemon=True).start()

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
            CREATE TABLE IF NOT EXISTS quest_guias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                licencia_subio TEXT NOT NULL,
                tipo_subidor TEXT NOT NULL,
                codigo_grupo TEXT DEFAULT '',
                titulo TEXT NOT NULL,
                materia TEXT DEFAULT '',
                fecha_examen TEXT DEFAULT '',
                texto_extraido TEXT NOT NULL,
                dias_estudio INTEGER DEFAULT 5,
                fecha_creacion TEXT NOT NULL,
                activa INTEGER DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS quest_preguntas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guia_id INTEGER NOT NULL,
                dia INTEGER NOT NULL,
                tipo TEXT NOT NULL,
                pregunta TEXT NOT NULL,
                opcion_a TEXT DEFAULT '',
                opcion_b TEXT DEFAULT '',
                opcion_c TEXT DEFAULT '',
                opcion_d TEXT DEFAULT '',
                respuesta_correcta TEXT NOT NULL,
                explicacion TEXT DEFAULT '',
                dificultad INTEGER DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS quest_progreso (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                licencia_alumno TEXT NOT NULL,
                guia_id INTEGER NOT NULL,
                dia INTEGER NOT NULL,
                fase TEXT NOT NULL,
                completado INTEGER DEFAULT 0,
                puntaje INTEGER DEFAULT 0,
                errores INTEGER DEFAULT 0,
                tiempo_segundos INTEGER DEFAULT 0,
                fecha TEXT NOT NULL,
                UNIQUE(licencia_alumno, guia_id, dia, fase)
            );
            CREATE TABLE IF NOT EXISTS quest_errores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                licencia_alumno TEXT NOT NULL,
                guia_id INTEGER NOT NULL,
                pregunta_id INTEGER NOT NULL,
                respuesta_dada TEXT NOT NULL,
                fecha TEXT NOT NULL
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

class LicenciaImport(BaseModel):
    licencia: str
    activa: Optional[str] = "SI"
    tipo: Optional[str] = "alumno"
    nombre: Optional[str] = ""
    correo: Optional[str] = ""
    celular: Optional[str] = ""
    monedas: Optional[int] = 0
    inventario: Optional[str] = ""
    nivel_max: Optional[int] = 1

class ImportarLicencias(BaseModel):
    licencias: List[LicenciaImport]

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
        total = conn.execute("SELECT COUNT(*) FROM Licencias").fetchone()[0]
        conn.close()
        return {"status": "healthy", "db": "ok", "licencias": total,
                "ts": datetime.now().isoformat()}
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

# ── Admin — importar licencias en masa (desde Google Sheets / CSV) ──
@app.post("/api/admin/importar-licencias")
def importar_licencias(data: ImportarLicencias):
    """
    Importa múltiples licencias de una vez.
    Úsalo para migrar datos desde Google Sheets.
    Las licencias ya existentes se ACTUALIZAN, las nuevas se CREAN.
    """
    conn = get_db()
    try:
        creadas    = 0
        actualizadas = 0
        errores    = []

        for lic in data.licencias:
            try:
                existente = conn.execute(
                    "SELECT id FROM Licencias WHERE Licencia=?",
                    (lic.licencia.strip(),)
                ).fetchone()

                if existente:
                    conn.execute("""
                        UPDATE Licencias
                        SET Activa=?, Tipo=?, Nombre=?, Correo=?, Celular=?,
                            Monedas=?, Inventario=?, Nivel_Max=?
                        WHERE Licencia=?
                    """, (
                        lic.activa, lic.tipo, lic.nombre or "",
                        lic.correo or "", lic.celular or "",
                        lic.monedas or 0, lic.inventario or "",
                        lic.nivel_max or 1,
                        lic.licencia.strip()
                    ))
                    actualizadas += 1
                else:
                    conn.execute("""
                        INSERT INTO Licencias
                            (Licencia, Activa, Tipo, Nombre, Correo, Celular,
                             Monedas, Inventario, Nivel_Max)
                        VALUES (?,?,?,?,?,?,?,?,?)
                    """, (
                        lic.licencia.strip(), lic.activa, lic.tipo,
                        lic.nombre or "", lic.correo or "", lic.celular or "",
                        lic.monedas or 0, lic.inventario or "",
                        lic.nivel_max or 1
                    ))
                    creadas += 1
            except Exception as e:
                errores.append(f"{lic.licencia}: {str(e)}")

        conn.commit()
        return {
            "ok": True,
            "creadas": creadas,
            "actualizadas": actualizadas,
            "errores": errores,
        }
    finally:
        conn.close()

# ── Admin — backup de la base de datos por correo ─────────────
def _hacer_backup_email(destinatario: str) -> dict:
    """Envía la base de datos SQLite como adjunto al correo admin."""
    try:
        if not EMAIL_PASS:
            return {"ok": False, "error": "EMAIL_PASSWORD no configurado en .env"}

        if not DB_PATH.exists():
            return {"ok": False, "error": "Base de datos no encontrada"}

        # Leer y codificar DB
        db_bytes = DB_PATH.read_bytes()
        ts       = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_adjunto = f"aventura_tablas_backup_{ts}.db"

        # Generar reporte HTML del contenido
        conn = get_db()
        try:
            licencias  = conn.execute("SELECT * FROM Licencias ORDER BY id").fetchall()
            solicitudes = conn.execute("SELECT * FROM Solicitudes ORDER BY id DESC LIMIT 20").fetchall()
        finally:
            conn.close()

        filas_lic = ""
        for r in licencias:
            filas_lic += f"""<tr>
                <td style="padding:6px;border:1px solid #1a3550;color:#00D4FF;">{r['Licencia']}</td>
                <td style="padding:6px;border:1px solid #1a3550;color:{'#00FF88' if r['Activa']=='SI' else '#FF3355'};">{r['Activa']}</td>
                <td style="padding:6px;border:1px solid #1a3550;color:#D0E8F8;">{r['Tipo']}</td>
                <td style="padding:6px;border:1px solid #1a3550;color:#D0E8F8;">{r['Nombre'] or ''}</td>
                <td style="padding:6px;border:1px solid #1a3550;color:#D0E8F8;">{r['Correo'] or ''}</td>
                <td style="padding:6px;border:1px solid #1a3550;color:#FFB300;">{r['Monedas'] or 0}</td>
                <td style="padding:6px;border:1px solid #1a3550;color:#D0E8F8;">{r['Nivel_Max'] or 1}</td>
            </tr>"""

        html_body = f"""
        <html><body style="background:#050A0F;font-family:Arial,sans-serif;color:#D0E8F8;padding:20px;">
        <div style="max-width:800px;margin:0 auto;">
          <div style="background:#0F1E2E;border-radius:12px;padding:20px;border:1px solid #00D4FF33;">
            <h1 style="color:#00D4FF;margin:0;">📊 Backup Aventura de Tablas Pro</h1>
            <p style="color:#4A6070;">Generado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>
          </div>

          <div style="background:#0A1520;border-radius:12px;padding:20px;margin-top:16px;border:1px solid #1A3550;">
            <h2 style="color:#00FF88;">👥 Licencias ({len(licencias)} total)</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#0F1E2E;">
                  <th style="padding:8px;border:1px solid #1a3550;color:#00D4FF;text-align:left;">Licencia</th>
                  <th style="padding:8px;border:1px solid #1a3550;color:#00D4FF;">Activa</th>
                  <th style="padding:8px;border:1px solid #1a3550;color:#00D4FF;">Tipo</th>
                  <th style="padding:8px;border:1px solid #1a3550;color:#00D4FF;text-align:left;">Nombre</th>
                  <th style="padding:8px;border:1px solid #1a3550;color:#00D4FF;text-align:left;">Correo</th>
                  <th style="padding:8px;border:1px solid #1a3550;color:#00D4FF;">Monedas</th>
                  <th style="padding:8px;border:1px solid #1a3550;color:#00D4FF;">Nivel</th>
                </tr>
              </thead>
              <tbody>{filas_lic}</tbody>
            </table>
          </div>

          <div style="background:#0A1520;border-radius:12px;padding:16px;margin-top:16px;border:1px solid #1A3550;">
            <p style="color:#4A6070;font-size:12px;margin:0;">
              ⚠️ El archivo <strong>.db</strong> adjunto es la base de datos completa.<br>
              Guárdala como respaldo. Para restaurarla, reemplaza el archivo
              <code>aventura_tablas.db</code> en el servidor.
            </p>
          </div>
        </div>
        </body></html>
        """

        # Crear mensaje con adjunto
        msg = MIMEMultipart("mixed")
        msg["From"]    = EMAIL_FROM
        msg["To"]      = destinatario
        msg["Subject"] = f"🗄️ Backup AventuraTablas — {datetime.now().strftime('%d/%m/%Y %H:%M')}"

        msg.attach(MIMEText(html_body, "html"))

        # Adjunto .db
        part = MIMEBase("application", "octet-stream")
        part.set_payload(db_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition",
                        f'attachment; filename="{nombre_adjunto}"')
        msg.attach(part)

        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.starttls()
            s.login(EMAIL_FROM, EMAIL_PASS)
            s.send_message(msg)

        print(f"[Backup OK] Enviado a {destinatario} — {len(db_bytes)/1024:.1f} KB")
        return {"ok": True, "bytes": len(db_bytes), "archivo": nombre_adjunto}

    except Exception as e:
        print(f"[Backup Error] {e}")
        return {"ok": False, "error": str(e)}


@app.post("/api/admin/backup-email")
@app.get("/api/admin/backup-ahora")
async def backup_email(bg: BackgroundTasks):
    """
    Envía la base de datos completa al correo del administrador.
    Incluye tabla HTML con todas las licencias + archivo .db adjunto.
    """
    if not EMAIL_PASS:
        raise HTTPException(500,
            "EMAIL_PASSWORD no está configurado. "
            "Agrega la variable en Render > Environment.")
    bg.add_task(_hacer_backup_email, EMAIL_FROM)
    return {
        "ok": True,
        "mensaje": f"Backup en proceso — llegará a {EMAIL_FROM} en unos segundos"
    }

# ── Admin — exportar/descargar base de datos ──────────────────
from fastapi.responses import FileResponse, Response

@app.get("/api/admin/exportar-db")
def exportar_db():
    """Descarga el archivo .db de la base de datos directamente."""
    if not DB_PATH.exists():
        raise HTTPException(404, "Base de datos no encontrada")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"aventura_tablas_backup_{ts}.db"
    return FileResponse(
        path=str(DB_PATH),
        media_type="application/octet-stream",
        filename=nombre
    )

# ── Admin — restaurar base de datos desde archivo ─────────────
from fastapi import UploadFile, File
import shutil

@app.post("/api/admin/importar-db")
async def importar_db(archivo: UploadFile = File(...)):
    """
    Restaura la base de datos desde un archivo .db subido.
    CUIDADO: reemplaza TODOS los datos existentes.
    """
    if not archivo.filename.endswith(".db"):
        raise HTTPException(400, "Solo se aceptan archivos .db")

    # Hacer backup antes de restaurar
    backup_path = DB_PATH.parent / f"aventura_tablas_PREVIO_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    if DB_PATH.exists():
        shutil.copy2(str(DB_PATH), str(backup_path))

    try:
        contenido = await archivo.read()
        DB_PATH.write_bytes(contenido)
        # Verificar que la DB es válida
        conn = get_db()
        conn.execute("SELECT COUNT(*) FROM Licencias").fetchone()
        conn.close()
        return {
            "ok": True,
            "mensaje": f"Base de datos restaurada correctamente ({len(contenido)//1024} KB)",
            "backup_previo": backup_path.name
        }
    except Exception as e:
        # Revertir si algo salió mal
        if backup_path.exists():
            shutil.copy2(str(backup_path), str(DB_PATH))
        raise HTTPException(500, f"Error al restaurar: {str(e)}")


# ═══════════════════════════════════════════════════════════
#  QUEST ESCOLAR — ENDPOINTS BASE
# ═══════════════════════════════════════════════════════════

class QuestProgresoBody(BaseModel):
    licencia_alumno: str
    guia_id: int
    dia: int
    fase: str          # estudio|juego|boss
    completado: int = 0
    puntaje: int = 0
    errores: int = 0
    tiempo_segundos: int = 0

class QuestErrorBody(BaseModel):
    licencia_alumno: str
    guia_id: int
    pregunta_id: int
    respuesta_dada: str

@app.get("/api/quest/mis-guias/{licencia}")
def quest_mis_guias(licencia: str):
    """Retorna guías asignadas al alumno (propias + de su maestro/grupo)."""
    conn = get_db()
    try:
        # Obtener info del alumno
        alumno = conn.execute(
            "SELECT Tipo, Nombre FROM Licencias WHERE Licencia=?", (licencia,)
        ).fetchone()
        if not alumno:
            raise HTTPException(status_code=404, detail="Licencia no encontrada")

        guias = []

        # 1) Guías propias (subidas por el alumno o por su padre)
        rows = conn.execute(
            "SELECT * FROM quest_guias WHERE licencia_subio=? AND activa=1 ORDER BY fecha_creacion DESC",
            (licencia,)
        ).fetchall()
        guias.extend([dict(r) for r in rows])

        # 2) Guías de maestros que tienen al alumno en su grupo
        maestros = conn.execute(
            "SELECT Licencia FROM Licencias WHERE Tipo='maestro'"
        ).fetchall()
        for m in maestros:
            rows2 = conn.execute(
                """SELECT g.* FROM quest_guias g
                   WHERE g.licencia_subio=? AND g.activa=1
                   AND (g.codigo_grupo=? OR g.codigo_grupo='todos')
                   ORDER BY g.fecha_creacion DESC""",
                (m["Licencia"], licencia)
            ).fetchall()
            guias.extend([dict(r) for r in rows2])

        # Eliminar duplicados por id
        seen = set()
        unique = []
        for g in guias:
            if g["id"] not in seen:
                seen.add(g["id"])
                prog = conn.execute(
                    "SELECT dia, fase, completado, puntaje FROM quest_progreso WHERE licencia_alumno=? AND guia_id=?",
                    (licencia, g["id"])
                ).fetchall()
                g["progreso"] = [dict(p) for p in prog]
                unique.append(g)

        return {"guias": unique}
    finally:
        conn.close()

@app.get("/api/quest/guia/{guia_id}/dia/{dia}")
def quest_preguntas_dia(guia_id: int, dia: int):
    """Retorna las preguntas del día N de una guía."""
    conn = get_db()
    try:
        guia = conn.execute("SELECT * FROM quest_guias WHERE id=?", (guia_id,)).fetchone()
        if not guia:
            raise HTTPException(status_code=404, detail="Guía no encontrada")
        preguntas = conn.execute(
            "SELECT * FROM quest_preguntas WHERE guia_id=? AND dia=? ORDER BY id",
            (guia_id, dia)
        ).fetchall()
        return {
            "guia": dict(guia),
            "dia": dia,
            "preguntas": [dict(p) for p in preguntas]
        }
    finally:
        conn.close()

@app.post("/api/quest/progreso")
def quest_guardar_progreso(body: QuestProgresoBody):
    """Guarda o actualiza el progreso del alumno."""
    conn = get_db()
    try:
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("""
            INSERT INTO quest_progreso (licencia_alumno, guia_id, dia, fase, completado, puntaje, errores, tiempo_segundos, fecha)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(licencia_alumno, guia_id, dia, fase)
            DO UPDATE SET completado=excluded.completado, puntaje=excluded.puntaje,
                          errores=excluded.errores, tiempo_segundos=excluded.tiempo_segundos, fecha=excluded.fecha
        """, (body.licencia_alumno, body.guia_id, body.dia, body.fase,
              body.completado, body.puntaje, body.errores, body.tiempo_segundos, fecha))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

@app.post("/api/quest/error")
def quest_guardar_error(body: QuestErrorBody):
    """Registra un error específico de un alumno en una pregunta."""
    conn = get_db()
    try:
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            "INSERT INTO quest_errores (licencia_alumno, guia_id, pregunta_id, respuesta_dada, fecha) VALUES (?,?,?,?,?)",
            (body.licencia_alumno, body.guia_id, body.pregunta_id, body.respuesta_dada, fecha)
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

@app.get("/api/quest/reporte/{licencia_alumno}/{guia_id}")
def quest_reporte(licencia_alumno: str, guia_id: int):
    """Reporte completo de un alumno en una guía."""
    conn = get_db()
    try:
        alumno = conn.execute(
            "SELECT Nombre, Correo FROM Licencias WHERE Licencia=?", (licencia_alumno,)
        ).fetchone()
        guia = conn.execute("SELECT * FROM quest_guias WHERE id=?", (guia_id,)).fetchone()
        if not alumno or not guia:
            raise HTTPException(status_code=404, detail="No encontrado")

        progreso = conn.execute(
            "SELECT * FROM quest_progreso WHERE licencia_alumno=? AND guia_id=? ORDER BY dia, fase",
            (licencia_alumno, guia_id)
        ).fetchall()

        errores_count = conn.execute("""
            SELECT qe.pregunta_id, COUNT(*) as total_errores, qp.pregunta, qp.respuesta_correcta, qp.dia
            FROM quest_errores qe
            JOIN quest_preguntas qp ON qe.pregunta_id = qp.id
            WHERE qe.licencia_alumno=? AND qe.guia_id=?
            GROUP BY qe.pregunta_id
            ORDER BY total_errores DESC
            LIMIT 10
        """, (licencia_alumno, guia_id)).fetchall()

        dias_stats = {}
        for p in progreso:
            d = p["dia"]
            if d not in dias_stats:
                dias_stats[d] = {"puntaje": 0, "errores": 0, "tiempo": 0, "fases_completadas": 0}
            dias_stats[d]["puntaje"] += p["puntaje"]
            dias_stats[d]["errores"] += p["errores"]
            dias_stats[d]["tiempo"] += p["tiempo_segundos"]
            if p["completado"]:
                dias_stats[d]["fases_completadas"] += 1

        total_puntaje = sum(p["puntaje"] for p in progreso)
        total_errores = sum(p["errores"] for p in progreso)
        dias_completados = sum(1 for d, s in dias_stats.items() if s["fases_completadas"] >= 2)

        return {
            "alumno": {"nombre": alumno["Nombre"], "licencia": licencia_alumno},
            "guia": dict(guia),
            "resumen": {
                "total_puntaje": total_puntaje,
                "total_errores": total_errores,
                "dias_completados": dias_completados,
                "total_dias": guia["dias_estudio"]
            },
            "por_dia": dias_stats,
            "top_errores": [dict(e) for e in errores_count],
            "progreso_detalle": [dict(p) for p in progreso]
        }
    finally:
        conn.close()

@app.get("/api/quest/dashboard/{licencia_maestro}")
def quest_dashboard_maestro(licencia_maestro: str):
    """Dashboard del maestro: progreso de todos sus alumnos."""
    conn = get_db()
    try:
        maestro = conn.execute(
            "SELECT Nombre, Tipo FROM Licencias WHERE Licencia=? AND Tipo IN ('maestro','padre','admin')",
            (licencia_maestro,)
        ).fetchone()
        if not maestro:
            raise HTTPException(status_code=403, detail="No autorizado")

        guias = conn.execute(
            "SELECT * FROM quest_guias WHERE licencia_subio=? AND activa=1 ORDER BY fecha_creacion DESC",
            (licencia_maestro,)
        ).fetchall()

        resultado = []
        for guia in guias:
            g = dict(guia)
            alumnos_prog = conn.execute("""
                SELECT l.Nombre, l.Licencia,
                       SUM(qp.puntaje) as puntaje_total,
                       SUM(qp.errores) as errores_total,
                       COUNT(CASE WHEN qp.completado=1 THEN 1 END) as fases_completadas
                FROM quest_progreso qp
                JOIN Licencias l ON qp.licencia_alumno = l.Licencia
                WHERE qp.guia_id=?
                GROUP BY qp.licencia_alumno
                ORDER BY puntaje_total DESC
            """, (guia["id"],)).fetchall()
            g["alumnos"] = [dict(a) for a in alumnos_prog]
            resultado.append(g)

        return {"maestro": maestro["Nombre"], "guias": resultado}
    finally:
        conn.close()
