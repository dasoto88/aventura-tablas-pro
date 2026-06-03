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
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi import Form
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from io import BytesIO

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


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  QUEST ESCOLAR â€” SUBIR GUÃA + REPORTE PDF
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.post("/api/quest/extraer-texto")
async def quest_extraer_texto(archivo: UploadFile = File(...)):
    """
    PASO 1: Solo extrae el texto del archivo (PDF, Word, imagen, txt).
    Retorna el texto para que el usuario lo revise y edite antes de generar preguntas.
    """
    contenido = await archivo.read()
    content_type = archivo.content_type or ""
    fname = archivo.filename.lower()
    try:
        from quest_ai import extraer_texto_pdf, extraer_texto_word, extraer_texto_imagen
        if "pdf" in content_type.lower() or fname.endswith(".pdf"):
            texto = extraer_texto_pdf(contenido)
        elif fname.endswith(".docx") or fname.endswith(".doc") or "word" in content_type.lower() or "officedocument" in content_type.lower():
            texto = extraer_texto_word(contenido)
        elif any(ext in content_type.lower() for ext in ["jpeg","jpg","png","webp","image"]):
            texto = extraer_texto_imagen(contenido, content_type if content_type else "image/jpeg")
        elif "text" in content_type.lower() or fname.endswith(".txt"):
            texto = contenido.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(400, "Formato no soportado. Usa PDF, Word, JPG o PNG.")
        return {"ok": True, "texto": texto, "caracteres": len(texto)}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error al extraer texto: {e}")


@app.post("/api/quest/subir-guia")
async def quest_subir_guia(
    licencia: str = Form(...),
    titulo: str = Form(...),
    materia: str = Form(""),
    fecha_examen: str = Form(""),
    dias_estudio: int = Form(5),
    codigo_grupo: str = Form(""),
    archivo: UploadFile = File(...)
):
    """
    Recibe PDF o imagen de guia de estudio.
    Extrae texto con Gemini y genera preguntas automaticamente.
    """
    # Verificar licencia
    conn = get_db()
    try:
        usuario = conn.execute(
            "SELECT Tipo, Nombre FROM Licencias WHERE Licencia=? AND Activa='SI'",
            (licencia,)
        ).fetchone()
        if not usuario:
            raise HTTPException(status_code=403, detail="Licencia no valida o inactiva")
    finally:
        conn.close()

    # Leer el archivo
    contenido = await archivo.read()
    content_type = archivo.content_type or ""

    # Importacion lazy para no fallar si GEMINI_API_KEY no esta
    try:
        from quest_ai import extraer_texto_pdf, extraer_texto_imagen, generar_plan_estudio
    except ImportError:
        raise HTTPException(status_code=500, detail="Modulo quest_ai no encontrado")

    # Extraer texto segun tipo de archivo
    try:
        fname = archivo.filename.lower()
        if "pdf" in content_type.lower() or fname.endswith(".pdf"):
            texto = extraer_texto_pdf(contenido)
        elif fname.endswith(".docx") or fname.endswith(".doc") or "word" in content_type.lower() or "officedocument" in content_type.lower():
            texto = extraer_texto_word(contenido)
        elif any(ext in content_type.lower() for ext in ["jpeg", "jpg", "png", "webp", "image"]):
            mime = content_type if content_type else "image/jpeg"
            texto = extraer_texto_imagen(contenido, mime_type=mime)
        elif "text" in content_type.lower() or fname.endswith(".txt"):
            texto = contenido.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado. Usa PDF, Word (.docx), o la opción Pegar Texto")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Error de configuracion IA: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar archivo: {str(e)}")

    if not texto or len(texto.strip()) < 50:
        raise HTTPException(status_code=400, detail="No se pudo extraer texto suficiente del archivo")

    # Generar plan de estudio con preguntas
    try:
        plan = generar_plan_estudio(texto, dias=dias_estudio, materia=materia)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar preguntas: {str(e)}")

    # Guardar en BD
    conn = get_db()
    try:
        fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Insertar guia
        cur = conn.execute("""
            INSERT INTO quest_guias
            (licencia_subio, tipo_subidor, codigo_grupo, titulo, materia, fecha_examen,
             texto_extraido, dias_estudio, fecha_creacion, activa)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (licencia, usuario["Tipo"], codigo_grupo,
              plan.get("titulo", titulo), plan.get("materia", materia),
              fecha_examen, texto, dias_estudio, fecha))
        guia_id = cur.lastrowid

        # Insertar preguntas por dia
        total_preguntas = 0
        for dia_data in plan.get("dias", []):
            dia_num = dia_data.get("dia", 1)
            for p in dia_data.get("preguntas", []):
                conn.execute("""
                    INSERT INTO quest_preguntas
                    (guia_id, dia, tipo, pregunta, opcion_a, opcion_b, opcion_c, opcion_d,
                     respuesta_correcta, explicacion, dificultad)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    guia_id, dia_num,
                    p.get("tipo", "opcion_multiple"),
                    p.get("pregunta", ""),
                    p.get("opcion_a", ""), p.get("opcion_b", ""),
                    p.get("opcion_c", ""), p.get("opcion_d", ""),
                    p.get("respuesta_correcta", "a"),
                    p.get("explicacion", ""),
                    p.get("dificultad", 1)
                ))
                total_preguntas += 1

        conn.commit()
        return {
            "ok": True,
            "guia_id": guia_id,
            "titulo": plan.get("titulo", titulo),
            "materia": plan.get("materia", materia),
            "resumen": plan.get("resumen_general", ""),
            "dias_generados": len(plan.get("dias", [])),
            "total_preguntas": total_preguntas
        }
    finally:
        conn.close()


@app.get("/api/quest/reporte/exportar/{licencia_alumno}/{guia_id}")
def quest_exportar_reporte_pdf(licencia_alumno: str, guia_id: int):
    """Genera y descarga un reporte PDF del progreso del alumno."""
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

        top_errores = conn.execute("""
            SELECT qe.pregunta_id, COUNT(*) as total, qp.pregunta, qp.dia
            FROM quest_errores qe
            JOIN quest_preguntas qp ON qe.pregunta_id = qp.id
            WHERE qe.licencia_alumno=? AND qe.guia_id=?
            GROUP BY qe.pregunta_id ORDER BY total DESC LIMIT 5
        """, (licencia_alumno, guia_id)).fetchall()

    finally:
        conn.close()

    # Generar PDF con ReportLab
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            rightMargin=40, leftMargin=40,
                            topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    story = []

    titulo_style = ParagraphStyle('Titulo', parent=styles['Title'],
                                   fontSize=20, textColor=colors.HexColor('#6C3483'),
                                   spaceAfter=6)
    story.append(Paragraph("Quest Escolar: El Gran Torneo", titulo_style))
    story.append(Paragraph("Reporte de Progreso", styles['Title']))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#6C3483')))
    story.append(Spacer(1, 12))

    info_style = ParagraphStyle('Info', parent=styles['Normal'], fontSize=12, spaceAfter=4)
    story.append(Paragraph(f"<b>Alumno:</b> {alumno['Nombre']}", info_style))
    story.append(Paragraph(f"<b>Guia:</b> {guia['titulo']}", info_style))
    story.append(Paragraph(f"<b>Materia:</b> {guia['materia']}", info_style))
    story.append(Paragraph(f"<b>Fecha de examen:</b> {guia['fecha_examen'] or 'No especificada'}", info_style))
    story.append(Spacer(1, 12))

    total_puntaje = sum(p["puntaje"] for p in progreso)
    total_errores = sum(p["errores"] for p in progreso)
    dias_completados = len(set(p["dia"] for p in progreso if p["completado"]))
    puntaje_max = guia["dias_estudio"] * 3 * 100  # 3 fases x 100 pts por dia

    story.append(Paragraph("<b>Resumen General</b>", styles['Heading2']))
    resumen_data = [
        ["Metrica", "Valor"],
        ["Puntaje Total", f"{total_puntaje} / {puntaje_max}"],
        ["Dias Completados", f"{dias_completados} de {guia['dias_estudio']}"],
        ["Total de Errores", str(total_errores)],
        ["Porcentaje de Avance", f"{int(dias_completados/guia['dias_estudio']*100)}%"],
    ]
    t = Table(resumen_data, colWidths=[3*inch, 3*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C3483')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5EEF8')]),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))

    if progreso:
        story.append(Paragraph("<b>Progreso por Dia</b>", styles['Heading2']))
        dias_data = [["Dia", "Fase", "Puntaje", "Errores", "Estado"]]
        for p in progreso:
            estado = "Completado" if p["completado"] else "En progreso"
            dias_data.append([
                f"Dia {p['dia']}", p["fase"].capitalize(),
                str(p["puntaje"]), str(p["errores"]), estado
            ])
        t2 = Table(dias_data, colWidths=[0.8*inch, 1.5*inch, 1.2*inch, 1.2*inch, 2*inch])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1A5276')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#EBF5FB')]),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
        ]))
        story.append(t2)
        story.append(Spacer(1, 16))

    if top_errores:
        story.append(Paragraph("<b>Preguntas con Mas Dificultad</b>", styles['Heading2']))
        story.append(Paragraph("Estas preguntas necesitan mas practica:",
                               ParagraphStyle('sub', parent=styles['Normal'],
                                            fontSize=10, textColor=colors.grey)))
        story.append(Spacer(1, 6))
        for i, err in enumerate(top_errores, 1):
            story.append(Paragraph(
                f"<b>{i}. Dia {err['dia']}:</b> {err['pregunta']} "
                f"<font color='red'>({err['total']} errores)</font>",
                ParagraphStyle('err', parent=styles['Normal'], fontSize=10, spaceAfter=4)
            ))

    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>Recomendaciones</b>", styles['Heading2']))
    rec_style = ParagraphStyle('rec', parent=styles['Normal'], fontSize=10, spaceAfter=3)

    porcentaje = int(dias_completados/guia['dias_estudio']*100) if guia['dias_estudio'] > 0 else 0
    if porcentaje >= 80:
        story.append(Paragraph("Excelente trabajo. El alumno ha completado la mayor parte del material.", rec_style))
    elif porcentaje >= 50:
        story.append(Paragraph("Buen avance. Se recomienda continuar con los dias pendientes.", rec_style))
    else:
        story.append(Paragraph("Se recomienda dedicar mas tiempo al estudio diario.", rec_style))

    if total_errores > 10:
        story.append(Paragraph("Repasar los temas con mas errores antes del examen.", rec_style))

    if top_errores:
        materias_dia = set(err["dia"] for err in top_errores)
        for d in materias_dia:
            story.append(Paragraph(f"Reforzar contenido del Dia {d}.", rec_style))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Paragraph(
        f"Generado por Aventura de Tablas Pro - Quest Escolar | {datetime.now().strftime('%d/%m/%Y')}",
        ParagraphStyle('footer', parent=styles['Normal'], fontSize=8,
                      textColor=colors.grey, alignment=1)
    ))

    doc.build(story)
    buffer.seek(0)

    nombre_archivo = f"reporte_quest_{alumno['Nombre'].replace(' ', '_')}_{guia_id}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"}
    )


@app.get("/api/quest/validar-ia")
def quest_validar_ia():
    """Verifica que Gemini este configurado y funcione."""
    try:
        from quest_ai import validar_configuracion
        return validar_configuracion()
    except ImportError:
        return {"ok": False, "error": "Modulo quest_ai no encontrado"}


@app.get("/api/quest/resumen-dia/{guia_id}/{dia}")
def quest_resumen_dia(guia_id: int, dia: int):
    """Retorna resumen del contenido del dia para la fase de estudio."""
    conn = get_db()
    try:
        guia = conn.execute("SELECT texto_extraido, titulo, materia FROM quest_guias WHERE id=?",
                            (guia_id,)).fetchone()
        if not guia:
            raise HTTPException(status_code=404, detail="Guia no encontrada")

        preguntas_dia = conn.execute(
            "SELECT COUNT(*) as total FROM quest_preguntas WHERE guia_id=? AND dia=?",
            (guia_id, dia)
        ).fetchone()

        # Generar resumen con Gemini (opcional, puede fallar si no hay API key)
        resumen_ia = None
        try:
            from quest_ai import generar_resumen_dia
            texto_total = guia["texto_extraido"]
            partes = len(texto_total) // 5
            inicio = (dia - 1) * partes
            fin = dia * partes
            texto_dia = texto_total[inicio:fin] if texto_total else ""
            if texto_dia:
                resumen_ia = generar_resumen_dia(texto_dia)
        except Exception:
            pass  # Si falla Gemini, seguimos sin resumen IA

        return {
            "guia_id": guia_id,
            "dia": dia,
            "titulo": guia["titulo"],
            "materia": guia["materia"],
            "total_preguntas": preguntas_dia["total"] if preguntas_dia else 0,
            "resumen_ia": resumen_ia
        }
    finally:
        conn.close()
