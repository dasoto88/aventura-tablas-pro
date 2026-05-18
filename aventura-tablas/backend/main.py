"""
Aventura de Tablas Pro v3.0 — Backend SQLite completo
Incluye: sesiones, maestros/alumnos, reportes, emails automáticos, auto-códigos
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any, Union
import sqlite3, os, json, re, random, string, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
import urllib.request, urllib.error

load_dotenv()

app = FastAPI(title="Aventura de Tablas API", version="3.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

EMAIL_FROM   = os.getenv("EMAIL_REMITENTE", "pixelimpresorasap@gmail.com")
EMAIL_PASS   = os.getenv("EMAIL_PASSWORD", "")
RESEND_KEY   = os.getenv("RESEND_API_KEY", "")
RESEND_FROM  = os.getenv("RESEND_FROM", "Aventura de Tablas <onboarding@resend.dev>")
LINK_MP    = os.getenv("LINK_MERCADO_PAGO", "https://mpago.la/1HSsTdv")
DATOS_BBVA = os.getenv("DATOS_TRANSFERENCIA",
    "Banco: BBVA | Cuenta: 4152314169570341 | Titular: David Soto Beltran | Concepto: AventuraTablas + Nombre alumno")

DB_PATH = Path(__file__).parent / "aventura_tablas.db"

# ─── BASE DE DATOS ────────────────────────────────────────────
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
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                Licencia          TEXT UNIQUE NOT NULL,
                Activa            TEXT NOT NULL DEFAULT 'NO',
                Tipo              TEXT NOT NULL DEFAULT 'alumno',
                Nombre            TEXT DEFAULT '',
                Correo            TEXT DEFAULT '',
                Celular           TEXT DEFAULT '',
                Monedas           INTEGER DEFAULT 0,
                Inventario        TEXT DEFAULT '',
                Nivel_Max         INTEGER DEFAULT 1,
                Fecha_Vence       TEXT DEFAULT '',
                Grado             TEXT DEFAULT '',
                Maestro_Licencia  TEXT DEFAULT '',
                Mundos_Completados INTEGER DEFAULT 0,
                Fallos_Tablas     TEXT DEFAULT '{}',
                Tiempo_Total_Min  INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS Solicitudes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                Fecha       TEXT NOT NULL,
                Nombre      TEXT NOT NULL,
                Correo      TEXT NOT NULL,
                Celular     TEXT NOT NULL,
                Escuela     TEXT NOT NULL,
                Tipo        TEXT DEFAULT 'alumno',
                Grado       TEXT DEFAULT '',
                Num_Alumnos INTEGER DEFAULT 0,
                Estado      TEXT DEFAULT 'Pendiente'
            );
            CREATE TABLE IF NOT EXISTS Sesiones (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                Licencia  TEXT NOT NULL,
                Inicio    TEXT NOT NULL,
                Fin       TEXT DEFAULT '',
                Tiempo_Min INTEGER DEFAULT 0,
                Fecha     TEXT NOT NULL
            );
        """)
        # Nueva tabla para registros grupales (maestros y padres con sus alumnos/hijos)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS Solicitudes_Grupo (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                Fecha               TEXT NOT NULL,
                Tutor_Nombre        TEXT NOT NULL,
                Tutor_Correo        TEXT NOT NULL,
                Tutor_Celular       TEXT NOT NULL,
                Tutor_Escuela       TEXT DEFAULT '',
                Tutor_Tipo          TEXT NOT NULL,
                Num_Dependientes    INTEGER DEFAULT 0,
                Dependientes_Json   TEXT DEFAULT '[]',
                Costo_Total         REAL DEFAULT 0,
                Tipo_Pago           TEXT DEFAULT 'mensual',
                Estado              TEXT DEFAULT 'Pendiente',
                Tutor_Licencia      TEXT DEFAULT '',
                Notas               TEXT DEFAULT ''
            );
        """)

        # Migraciones seguras para bases de datos existentes
        for alter in [
            "ALTER TABLE Licencias ADD COLUMN Grado TEXT DEFAULT ''",
            "ALTER TABLE Licencias ADD COLUMN Maestro_Licencia TEXT DEFAULT ''",
            "ALTER TABLE Licencias ADD COLUMN Mundos_Completados INTEGER DEFAULT 0",
            "ALTER TABLE Licencias ADD COLUMN Fallos_Tablas TEXT DEFAULT '{}'",
            "ALTER TABLE Licencias ADD COLUMN Tiempo_Total_Min INTEGER DEFAULT 0",
            "ALTER TABLE Licencias ADD COLUMN Bloqueado INTEGER DEFAULT 0",
            "ALTER TABLE Licencias ADD COLUMN Tipo_Licencia TEXT DEFAULT 'mensual'",
            "ALTER TABLE Licencias ADD COLUMN Reset_Forzado INTEGER DEFAULT 0",
            "ALTER TABLE Solicitudes ADD COLUMN Tipo TEXT DEFAULT 'alumno'",
            "ALTER TABLE Solicitudes ADD COLUMN Grado TEXT DEFAULT ''",
            "ALTER TABLE Solicitudes ADD COLUMN Num_Alumnos INTEGER DEFAULT 0",
        ]:
            try: conn.execute(alter)
            except: pass

        # Admin por defecto
        if not conn.execute("SELECT value FROM config WHERE key='admin_licencia'").fetchone():
            conn.execute("INSERT INTO config (key,value) VALUES ('admin_licencia','admindasoto88')")
            conn.execute("""
                INSERT OR IGNORE INTO Licencias (Licencia,Activa,Tipo,Nombre,Correo)
                VALUES ('admindasoto88','SI','admin','Admin',?)
            """, (EMAIL_FROM,))
        conn.commit()
        print(f"[DB] Base de datos lista en {DB_PATH}")
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

# ─── MODELOS ──────────────────────────────────────────────────
class ValidarLicencia(BaseModel):
    licencia: str

class SolicitudRegistro(BaseModel):
    nombre: str
    correo: str
    celular: str
    escuela: str
    tipo: Optional[str] = "alumno"
    grado: Optional[str] = ""
    num_alumnos: Optional[int] = 0

class ActualizarProgreso(BaseModel):
    licencia: str
    monedas: int
    inventario: str
    nivel_max: int
    nombre: Optional[str] = None
    mundos_completados: Optional[int] = None
    fallos_tablas: Optional[str] = None
    tiempo_min: Optional[int] = None

class CrearLicencia(BaseModel):
    codigo: str
    tipo: str
    nombre: Optional[str] = ""
    correo: Optional[str] = ""
    celular: Optional[str] = ""
    grado: Optional[str] = ""
    maestro_licencia: Optional[str] = ""

class EditarLicencia(BaseModel):
    licencia: str
    nombre: Optional[str] = ""
    correo: Optional[str] = ""
    celular: Optional[str] = ""
    monedas: Optional[int] = 0
    nivel_max: Optional[int] = 1
    grado: Optional[str] = ""
    maestro_licencia: Optional[str] = ""

class AccionLicencia(BaseModel):
    codigo: str

class CambiarAdminLicencia(BaseModel):
    licencia_actual: str
    licencia_nueva: str

class RecuperarLicencia(BaseModel):
    correo: Optional[str] = ""
    celular: Optional[str] = ""

class IniciarSesion(BaseModel):
    licencia: str

class TerminarSesion(BaseModel):
    licencia: str
    tiempo_min: Optional[int] = 0

class GenerarCodigo(BaseModel):
    nombre: str
    tipo: str

class SolicitarCertificado(BaseModel):
    licencia: str
    nombre: Optional[str] = ""
    correo: Optional[str] = ""

class DependienteData(BaseModel):
    nombre: str
    correo: Optional[str] = ""
    grado: Optional[str] = ""

class RegistroGrupo(BaseModel):
    tutor_nombre: str
    tutor_correo: str
    tutor_celular: str
    tutor_escuela: Optional[str] = ""
    tutor_tipo: str
    dependientes: List[Any] = []

class AgregarDependientes(BaseModel):
    tutor_licencia: str
    dependientes: List[Any] = []

class ActivarGrupo(BaseModel):
    solicitud_id: int

class BloquearLicencia(BaseModel):
    codigo: str
    bloqueado: bool

class ReiniciarMundos(BaseModel):
    licencia: str
    mundos: Optional[List[Any]] = None
    reiniciar_monedas: bool = False
    reiniciar_inventario: bool = False

# ─── EMAIL ────────────────────────────────────────────────────
def _enviar_via_resend(destinatario: str, asunto: str, html: str) -> bool:
    """Envía email usando la API HTTP de Resend (nunca bloqueada por Render)."""
    if not RESEND_KEY:
        return False
    payload = json.dumps({
        "from":    RESEND_FROM,
        "to":      [destinatario],
        "subject": asunto,
        "html":    html,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_KEY}",
            "Content-Type":  "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            ok = resp.status in (200, 201)
            print(f"[Email Resend {'OK' if ok else 'FAIL'}] → {destinatario} (status {resp.status})")
            return ok
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[Email Resend Error] {e.code} {body}")
        return False
    except Exception as e:
        print(f"[Email Resend Error] {e}")
        return False

def _enviar_via_smtp(destinatario: str, asunto: str, html: str) -> bool:
    """Respaldo: Gmail SMTP con timeout corto."""
    if not EMAIL_PASS:
        return False
    msg = MIMEMultipart("alternative")
    msg["From"]    = EMAIL_FROM
    msg["To"]      = destinatario
    msg["Subject"] = asunto
    msg.attach(MIMEText(html, "html"))
    for intentar_ssl in (False, True):
        try:
            if intentar_ssl:
                import ssl
                ctx = ssl.create_default_context()
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx, timeout=8) as s:
                    s.login(EMAIL_FROM, EMAIL_PASS)
                    s.send_message(msg)
            else:
                with smtplib.SMTP("smtp.gmail.com", 587, timeout=8) as s:
                    s.ehlo(); s.starttls(); s.ehlo()
                    s.login(EMAIL_FROM, EMAIL_PASS)
                    s.send_message(msg)
            print(f"[Email SMTP OK {'SSL' if intentar_ssl else 'TLS'}] → {destinatario}")
            return True
        except Exception as e:
            print(f"[Email SMTP Error {'SSL' if intentar_ssl else 'TLS'}] {e}")
    return False

def enviar_correo(destinatario: str, asunto: str, html: str) -> bool:
    if not destinatario:
        return False
    # Resend primero (HTTPS, siempre funciona en Render)
    if RESEND_KEY:
        return _enviar_via_resend(destinatario, asunto, html)
    # Respaldo: Gmail SMTP
    if EMAIL_PASS:
        return _enviar_via_smtp(destinatario, asunto, html)
    print("[Email] Ningún método configurado (RESEND_API_KEY o EMAIL_PASSWORD)")
    return False

# ─── TEMPLATES ────────────────────────────────────────────────
def _base(contenido: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">
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
.box-green{{background:rgba(57,255,20,0.08);border:2px solid rgba(57,255,20,0.3);}}
.box-purple{{background:rgba(108,92,231,0.12);border:2px solid rgba(162,155,254,0.4);}}
.label{{font-size:11px;color:#00f5ff;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;}}
.code{{font-family:monospace;font-size:28px;font-weight:900;color:#fff;background:rgba(0,0,0,0.5);padding:14px 24px;border-radius:12px;letter-spacing:5px;display:inline-block;margin:10px 0;border:2px solid rgba(255,214,0,0.4);}}
ol li{{color:#b0b8ff;line-height:2.2;font-size:14px;}}
.bar-bg{{background:rgba(255,255,255,0.1);border-radius:6px;height:14px;margin:8px 0;}}
.bar{{background:linear-gradient(90deg,#39ff14,#00b894);border-radius:6px;height:14px;}}
.footer{{text-align:center;padding:20px;color:#3a4060;font-size:12px;}}
</style></head>
<body><div class="wrap"><div class="card">{contenido}</div>
<div class="footer">Aventura de Tablas Pro v3.0 • {EMAIL_FROM}</div>
</div></body></html>"""

def email_solicitud(nombre: str, es_maestro: bool = False) -> str:
    bbva = DATOS_BBVA.replace("|","<br>")
    tipo_txt = "tu salón" if es_maestro else "tu hijo/a"
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#ff006e,#8338ec,#3a86ff);">
  <div style="font-size:64px;margin-bottom:10px;">🦁⚔️🌟</div>
  <h1 style="color:#fff;">¡SOLICITUD RECIBIDA!</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{nombre}</strong>! 👋</p>
  <p>Recibimos tu solicitud para <strong>Aventura de Tablas Pro</strong> para {tipo_txt}. Para activar la cuenta, realiza el pago:</p>
  <div class="box box-gold">
    <div class="label">💳 Mercado Pago</div>
    <a href="{LINK_MP}" class="btn" style="background:linear-gradient(135deg,#00b4d8,#0077b6);color:#fff;">👉 Pagar con Mercado Pago</a>
  </div>
  <div class="box box-cyan">
    <div class="label">🏦 Transferencia BBVA</div>
    <p style="margin:0;">{bbva}</p>
  </div>
  <div class="box box-pink">
    <div class="label">📋 Pasos siguientes</div>
    <ol>
      <li>Realiza el pago por cualquier método</li>
      <li>Envía el comprobante a <strong style="color:#00f5ff;">{EMAIL_FROM}</strong></li>
      <li>En menos de <strong>24 horas</strong> recibirás tu código 🎉</li>
    </ol>
  </div>
</div>""")

def email_activacion(nombre: str, licencia: str, fecha_vence: str,
                     maestro_nombre: str = "", grado: str = "") -> str:
    extra = ""
    if maestro_nombre:
        extra = f"""
  <div class="box box-purple">
    <div class="label">🎓 Información del Maestro</div>
    <p style="margin:0;"><strong style="color:#a29bfe;">{maestro_nombre}</strong></p>
    {f'<p style="margin:4px 0;color:#b0b8ff;">Grado: {grado}</p>' if grado else ""}
    <p style="margin:4px 0;color:#b0b8ff;">Tu maestro puede ver tu avance y progreso en el juego.</p>
  </div>"""
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#00b894,#00cec9,#0984e3);">
  <div style="font-size:64px;margin-bottom:10px;">🎉🏆✨</div>
  <h1 style="color:#fff;">¡CUENTA ACTIVADA!</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{nombre}</strong>! 🦁</p>
  <p>Tu cuenta está <strong style="color:#39ff14;">ACTIVA</strong>. ¡Ya puedes comenzar la aventura!</p>
  <div class="box box-gold" style="text-align:center;">
    <div class="label">🔑 Tu Código de Licencia</div>
    <div class="code">{licencia}</div>
    <p style="margin:8px 0 0;color:#FFD700;">Válida hasta: <strong>{fecha_vence}</strong></p>
  </div>
  {extra}
  <div class="box box-cyan">
    <div class="label">🚀 Cómo ingresar</div>
    <ol>
      <li>Abre el juego en tu navegador</li>
      <li>Escribe tu código de licencia en "🎮 JUGAR"</li>
      <li>¡Elige tu avatar y comienza la aventura!</li>
    </ol>
  </div>
</div>""")

def email_recuperacion(nombre: str, licencia: str) -> str:
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#6c5ce7,#a29bfe,#74b9ff);">
  <div style="font-size:64px;margin-bottom:10px;">🔑💌✨</div>
  <h1 style="color:#fff;">RECUPERACIÓN DE LICENCIA</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{nombre}</strong>! 👋</p>
  <p>Aquí está tu código de acceso a <strong>Aventura de Tablas Pro</strong>.</p>
  <div class="box box-purple" style="text-align:center;">
    <div class="label">🔑 Tu Código</div>
    <div class="code">{licencia}</div>
  </div>
  <div class="box box-cyan">
    <div class="label">🚀 Cómo usarlo</div>
    <ol>
      <li>Abre el juego en tu navegador</li>
      <li>Escribe el código en la pantalla de inicio</li>
      <li>¡Continúa tu aventura!</li>
    </ol>
  </div>
  <p style="font-size:12px;color:#5060a0;text-align:center;">Si tú no solicitaste esto, ignora este correo.</p>
</div>""")

def email_progreso(nombre: str, correo: str, mundos: int, fallos_json: str,
                   es_final: bool = False, maestro_nombre: str = "") -> bool:
    try:
        fallos: dict = json.loads(fallos_json or "{}")
    except:
        fallos = {}

    tablas_malas = sorted(fallos.items(), key=lambda x: -int(x[1] or 0))
    tablas_dificiles = [(t, c) for t, c in tablas_malas if int(c) >= 3]

    tablas_html = ""
    if tablas_dificiles:
        filas = "".join(
            f"<tr><td style='padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#b0b8ff;'>"
            f"Tabla del {t}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#ff006e;font-weight:700;'>"
            f"{c} errores</td></tr>"
            for t, c in tablas_dificiles
        )
        tablas_html = f"""
  <div class="box box-pink">
    <div class="label">⚠️ Tablas que necesitan más práctica</div>
    <table style="width:100%;border-collapse:collapse;">{filas}</table>
    <p style="font-size:13px;color:#b0b8ff;margin-top:12px;">💡 Recomendamos practicar estas tablas en casa con ejercicios adicionales.</p>
  </div>"""
    else:
        tablas_html = """<div class="box box-green">
    <div class="label">✅ Sin tablas problemáticas</div>
    <p style="margin:0;color:#b0b8ff;">¡Excelente rendimiento! El alumno domina todas las tablas practicadas.</p>
  </div>"""

    pct = round((mundos / 10) * 100)
    titulo = "🏆 ¡REPORTE FINAL!" if es_final else f"📊 REPORTE DE AVANCE — {mundos} Mundos"
    maestro_txt = f"<p>Copia enviada al maestro <strong style='color:#a29bfe;'>{maestro_nombre}</strong>.</p>" if maestro_nombre else ""

    html = _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#0984e3,#00b894,#6c5ce7);">
  <div style="font-size:64px;margin-bottom:10px;">{"🏆👑✨" if es_final else "📊⭐🎮"}</div>
  <h1 style="color:#fff;">{titulo}</h1>
</div>
<div class="body">
  <p>¡Hola! Aquí está el {"reporte final" if es_final else "reporte de avance"} de <strong style="color:#00f5ff;">{nombre}</strong>.</p>
  {maestro_txt}
  <div class="box box-gold">
    <div class="label">🌍 Progreso</div>
    <p style="margin:0;font-size:22px;font-weight:700;color:#FFD700;">{mundos} / 10 mundos completados ({pct}%)</p>
    <div class="bar-bg"><div class="bar" style="width:{pct}%;"></div></div>
  </div>
  {tablas_html}
  {"<div class='box box-green'><div class='label'>🎉 Logro final</div><p style='margin:0;font-size:16px;color:#39ff14;font-weight:700;'>¡Aventurero completó todos los mundos! Domina las tablas del 1 al 10. 🦁⚔️</p></div>" if es_final else ""}
</div>""")
    return enviar_correo(correo, f"{'🏆 Reporte Final' if es_final else f'📊 Reporte de Avance ({mundos} mundos)'} — {nombre}", html)

# ─── HELPERS ──────────────────────────────────────────────────
def _generar_codigo(nombre: str, tipo: str) -> str:
    partes = re.sub(r"[^a-zA-ZáéíóúÁÉÍÓÚñÑ]", " ", nombre).split()
    slug = partes[0][:4].upper() if partes else "USR"
    for a, b in [("Á","A"),("É","E"),("Í","I"),("Ó","O"),("Ú","U"),("Ñ","N"),
                  ("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ñ","n")]:
        slug = slug.replace(a, b)
    rand = "".join(random.choices(string.digits, k=4))
    return f"{slug}{rand}"

# ─── ENDPOINTS ────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "app": "Aventura de Tablas Pro v3.0", "db": "SQLite local"}

@app.get("/api/debug-email")
def debug_email():
    """Prueba de email — muestra configuración y resultado."""
    config = {
        "RESEND_API_KEY":  "configurado ✓" if RESEND_KEY  else "❌ NO configurado",
        "EMAIL_PASSWORD":  "configurado ✓" if EMAIL_PASS  else "❌ NO configurado",
        "EMAIL_REMITENTE": EMAIL_FROM,
        "RESEND_FROM":     RESEND_FROM,
    }
    if not RESEND_KEY and not EMAIL_PASS:
        return {"error": "Ningún método de email configurado", **config}
    resultado = enviar_correo(
        EMAIL_FROM,
        "🧪 Prueba — Aventura de Tablas",
        "<h1 style='color:#00f5ff'>¡Email funcionando!</h1><p>Si recibes esto, el sistema de correos está activo.</p>"
    )
    return {"enviado": resultado, **config}

@app.get("/api/debug-solicitudes")
def debug_solicitudes():
    """Ver últimas solicitudes guardadas en la DB."""
    conn = get_db()
    try:
        rows = conn.execute("SELECT id, Fecha, Nombre, Correo, Tipo, Estado FROM Solicitudes ORDER BY id DESC LIMIT 10").fetchall()
        rows_g = conn.execute("SELECT id, Fecha, Tutor_Nombre, Tutor_Correo, Tutor_Tipo, Estado FROM Solicitudes_Grupo ORDER BY id DESC LIMIT 10").fetchall()
        return {
            "solicitudes_individuales": [dict(r) for r in rows],
            "solicitudes_grupo": [dict(r) for r in rows_g],
            "total_individuales": conn.execute("SELECT COUNT(*) as n FROM Solicitudes").fetchone()["n"],
            "total_grupo": conn.execute("SELECT COUNT(*) as n FROM Solicitudes_Grupo").fetchone()["n"],
        }
    finally:
        conn.close()

@app.get("/api/test")
def test_conexion():
    """Endpoint para verificar que el backend está corriendo."""
    conn = get_db()
    try:
        total = conn.execute("SELECT COUNT(*) as n FROM Licencias").fetchone()["n"]
        admin = get_admin_licencia()
        return {"status": "ok", "total_licencias": total, "admin": admin[:3] + "***"}
    finally:
        conn.close()

# ── Validar licencia ──────────────────────────────────────────
@app.post("/api/validar-licencia")
def validar_licencia(data: ValidarLicencia):
    codigo = data.licencia.strip()

    # ── Bypass directo para el admin ──────────────────────────
    admin_actual = get_admin_licencia()
    if codigo == admin_actual:
        conn = get_db()
        try:
            # Asegurar que el admin exista en la tabla
            lic = conn.execute("SELECT * FROM Licencias WHERE Licencia=?", (codigo,)).fetchone()
            if not lic:
                conn.execute(
                    "INSERT OR IGNORE INTO Licencias (Licencia,Activa,Tipo,Nombre,Correo) VALUES (?,?,?,?,?)",
                    (codigo, "SI", "admin", "Admin", EMAIL_FROM)
                )
                conn.commit()
            return {
                "valido": True, "tipo": "admin",
                "nombre": (lic["Nombre"] if lic else None) or "Admin",
                "correo": (lic["Correo"] if lic else None) or EMAIL_FROM,
                "monedas": 0, "inventario": "", "nivel_max": 11,
                "fila": 0, "grado": "", "maestro_licencia": "", "maestro_nombre": "",
            }
        finally:
            conn.close()

    conn = get_db()
    try:
        lic = conn.execute(
            "SELECT * FROM Licencias WHERE Licencia=?", (codigo,)
        ).fetchone()
        if not lic:
            raise HTTPException(404, "Licencia no encontrada. Verifica que esté bien escrita.")
        if lic["Activa"] != "SI":
            raise HTTPException(403, "Licencia desactivada. Contacta al administrador.")
        try:
            if lic["Bloqueado"] and int(lic["Bloqueado"]) == 1:
                raise HTTPException(403, "Licencia bloqueada. Contacta al administrador.")
        except (IndexError, KeyError):
            pass

        maestro_nombre = ""
        try:
            if lic["Maestro_Licencia"]:
                mae = conn.execute(
                    "SELECT Nombre FROM Licencias WHERE Licencia=?", (lic["Maestro_Licencia"],)
                ).fetchone()
                if mae:
                    maestro_nombre = mae["Nombre"] or ""
        except Exception:
            pass

        def safe(row, key, default=""):
            try:
                return row[key] if row[key] is not None else default
            except Exception:
                return default

        return {
            "valido":          True,
            "tipo":            safe(lic, "Tipo", "alumno"),
            "nombre":          safe(lic, "Nombre"),
            "correo":          safe(lic, "Correo"),
            "monedas":         int(lic["Monedas"] or 0),
            "inventario":      safe(lic, "Inventario"),
            "nivel_max":       int(lic["Nivel_Max"] or 1),
            "fila":            lic["id"],
            "grado":           safe(lic, "Grado"),
            "maestro_licencia":safe(lic, "Maestro_Licencia"),
            "maestro_nombre":  maestro_nombre,
        }
    finally:
        conn.close()

# ── Registro público ──────────────────────────────────────────
@app.post("/api/registro")
async def registro(data: SolicitudRegistro, bg: BackgroundTasks):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO Solicitudes (Fecha,Nombre,Correo,Celular,Escuela,Tipo,Grado,Num_Alumnos,Estado) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (datetime.now().strftime("%Y-%m-%d %H:%M"), data.nombre, data.correo,
             data.celular, data.escuela, data.tipo or "alumno",
             data.grado or "", data.num_alumnos or 0, "Pendiente")
        )
        conn.commit()
        if data.correo and EMAIL_PASS:
            bg.add_task(
                enviar_correo, data.correo,
                "🎮 Aventura de Tablas — ¡Solicitud Recibida!",
                email_solicitud(data.nombre, data.tipo == "maestro")
            )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ── Actualizar progreso ───────────────────────────────────────
@app.post("/api/actualizar-progreso")
async def actualizar_progreso(data: ActualizarProgreso, bg: BackgroundTasks):
    conn = get_db()
    try:
        lic = conn.execute("SELECT * FROM Licencias WHERE Licencia=?", (data.licencia.strip(),)).fetchone()
        if not lic:
            raise HTTPException(404, "Licencia no encontrada")

        prev_mundos = int(lic["Mundos_Completados"] or 0)
        new_mundos  = data.mundos_completados if data.mundos_completados is not None else prev_mundos

        conn.execute("""
            UPDATE Licencias
            SET Monedas=?, Inventario=?, Nivel_Max=?,
                Nombre=CASE WHEN ? IS NOT NULL THEN ? ELSE Nombre END,
                Mundos_Completados=?,
                Fallos_Tablas=CASE WHEN ? IS NOT NULL THEN ? ELSE Fallos_Tablas END,
                Tiempo_Total_Min=Tiempo_Total_Min + ?
            WHERE Licencia=?
        """, (
            data.monedas, data.inventario, data.nivel_max,
            data.nombre, data.nombre,
            new_mundos,
            data.fallos_tablas, data.fallos_tablas,
            data.tiempo_min or 0,
            data.licencia.strip()
        ))
        conn.commit()

        # Email cada 3 mundos (cuando cruza múltiplo de 3)
        correo = lic["Correo"] or ""
        nombre = data.nombre or lic["Nombre"] or "Aventurero"
        fallos = data.fallos_tablas or lic["Fallos_Tablas"] or "{}"

        if (correo and EMAIL_PASS and new_mundos > prev_mundos and
                new_mundos > 0 and new_mundos % 3 == 0 and new_mundos < 10):
            # Buscar nombre del maestro
            maestro_nombre = ""
            if lic["Maestro_Licencia"]:
                mae = conn.execute("SELECT Nombre FROM Licencias WHERE Licencia=?",
                                   (lic["Maestro_Licencia"],)).fetchone()
                if mae:
                    maestro_nombre = mae["Nombre"] or ""
            bg.add_task(email_progreso, nombre, correo, new_mundos, fallos, False, maestro_nombre)

            # Enviar copia al maestro si existe
            if lic["Maestro_Licencia"]:
                mae_row = conn.execute("SELECT * FROM Licencias WHERE Licencia=?",
                                       (lic["Maestro_Licencia"],)).fetchone()
                if mae_row and mae_row["Correo"] and EMAIL_PASS:
                    bg.add_task(email_progreso, nombre, mae_row["Correo"], new_mundos, fallos, False, "")

        # Reporte final al completar todos los mundos
        if correo and EMAIL_PASS and new_mundos >= 10 and prev_mundos < 10:
            maestro_nombre = ""
            if lic["Maestro_Licencia"]:
                mae = conn.execute("SELECT Nombre FROM Licencias WHERE Licencia=?",
                                   (lic["Maestro_Licencia"],)).fetchone()
                if mae: maestro_nombre = mae["Nombre"] or ""
            bg.add_task(email_progreso, nombre, correo, 10, fallos, True, maestro_nombre)

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ── Sesión: iniciar ───────────────────────────────────────────
@app.post("/api/sesion/iniciar")
def sesion_iniciar(data: IniciarSesion):
    conn = get_db()
    try:
        now = datetime.now()
        conn.execute(
            "INSERT INTO Sesiones (Licencia,Inicio,Fecha) VALUES (?,?,?)",
            (data.licencia.strip(), now.isoformat(), now.strftime("%Y-%m-%d"))
        )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()

# ── Sesión: terminar ──────────────────────────────────────────
@app.post("/api/sesion/terminar")
def sesion_terminar(data: TerminarSesion):
    conn = get_db()
    try:
        now = datetime.now()
        # Actualizar última sesión sin fin
        sesion = conn.execute(
            "SELECT id FROM Sesiones WHERE Licencia=? AND Fin='' ORDER BY id DESC LIMIT 1",
            (data.licencia.strip(),)
        ).fetchone()
        if sesion:
            conn.execute(
                "UPDATE Sesiones SET Fin=?, Tiempo_Min=? WHERE id=?",
                (now.isoformat(), data.tiempo_min or 0, sesion["id"])
            )
        # Acumular tiempo en Licencias
        conn.execute(
            "UPDATE Licencias SET Tiempo_Total_Min=Tiempo_Total_Min+? WHERE Licencia=?",
            (data.tiempo_min or 0, data.licencia.strip())
        )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()

# ── Recuperar licencia ────────────────────────────────────────
@app.post("/api/recuperar-licencia")
async def recuperar_licencia(data: RecuperarLicencia, bg: BackgroundTasks):
    if not data.correo and not data.celular:
        raise HTTPException(400, "Proporciona tu correo o celular")
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
            raise HTTPException(404, "No encontramos una cuenta con esos datos.")
        correo_dest = lic["Correo"] or ""
        if not correo_dest:
            raise HTTPException(400, "Esta cuenta no tiene correo registrado. Contacta al administrador.")
        if EMAIL_PASS:
            bg.add_task(
                enviar_correo, correo_dest,
                "🔑 Aventura de Tablas — Tu código de licencia",
                email_recuperacion(lic["Nombre"] or "Aventurero", lic["Licencia"])
            )
        at = correo_dest.find("@")
        correo_masked = correo_dest[:2] + "***" + correo_dest[at:]
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
        raise HTTPException(409, "Ese código ya está en uso")
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

# ── Admin — reportes de alumnos ───────────────────────────────
@app.get("/api/admin/reportes")
def admin_reportes():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT l.*, m.Nombre as Maestro_Nombre
            FROM Licencias l
            LEFT JOIN Licencias m ON l.Maestro_Licencia = m.Licencia
            WHERE l.Tipo = 'alumno'
            ORDER BY l.Mundos_Completados DESC, l.Tiempo_Total_Min DESC
        """).fetchall()
        return {"reportes": [dict(r) for r in rows]}
    finally:
        conn.close()

# ── Admin — generar código automático ────────────────────────
@app.post("/api/admin/generar-codigo")
def generar_codigo(data: GenerarCodigo):
    conn = get_db()
    try:
        for _ in range(10):
            codigo = _generar_codigo(data.nombre, data.tipo)
            existe = conn.execute("SELECT id FROM Licencias WHERE Licencia=?", (codigo,)).fetchone()
            if not existe:
                return {"codigo": codigo}
        raise HTTPException(500, "No se pudo generar un código único")
    finally:
        conn.close()

# ── Admin — crear licencia ────────────────────────────────────
@app.post("/api/admin/crear-licencia")
def crear_licencia(data: CrearLicencia):
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO Licencias
            (Licencia,Activa,Tipo,Nombre,Correo,Celular,Grado,Maestro_Licencia)
            VALUES (?,?,?,?,?,?,?,?)
        """, (data.codigo.strip(), "NO", data.tipo,
              data.nombre or "", data.correo or "", data.celular or "",
              data.grado or "", data.maestro_licencia or ""))
        conn.commit()
        return {"ok": True}
    except sqlite3.IntegrityError:
        raise HTTPException(409, f"Ya existe la licencia '{data.codigo}'.")
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ── Admin — editar licencia ───────────────────────────────────
@app.post("/api/admin/editar-licencia")
def editar_licencia(data: EditarLicencia):
    conn = get_db()
    try:
        conn.execute("""
            UPDATE Licencias
            SET Nombre=?, Correo=?, Celular=?, Monedas=?, Nivel_Max=?,
                Grado=?, Maestro_Licencia=?
            WHERE Licencia=?
        """, (data.nombre or "", data.correo or "", data.celular or "",
              data.monedas or 0, data.nivel_max or 1,
              data.grado or "", data.maestro_licencia or "",
              data.licencia.strip()))
        conn.commit()
        return {"ok": True}
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
        fecha_vence = (datetime.now() + timedelta(days=365)).strftime("%d/%m/%Y")
        conn.execute(
            "UPDATE Licencias SET Activa='SI', Fecha_Vence=? WHERE Licencia=?",
            (fecha_vence, data.codigo.strip())
        )
        conn.commit()
        correo = lic["Correo"] or ""
        nombre = lic["Nombre"] or "Aventurero"
        enviado = False

        if correo and EMAIL_PASS:
            # Buscar maestro si tiene
            maestro_nombre, grado_maestro = "", ""
            if lic["Maestro_Licencia"]:
                mae = conn.execute(
                    "SELECT Nombre, Grado FROM Licencias WHERE Licencia=?",
                    (lic["Maestro_Licencia"],)
                ).fetchone()
                if mae:
                    maestro_nombre = mae["Nombre"] or ""
                    grado_maestro  = mae["Grado"] or lic["Grado"] or ""

            bg.add_task(
                enviar_correo, correo,
                "✅ Aventura de Tablas — ¡Tu cuenta está activa!",
                email_activacion(nombre, data.codigo, fecha_vence, maestro_nombre, grado_maestro)
            )
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

# ── Reporte individual por licencia ──────────────────────────
@app.get("/api/reporte/{licencia}")
def reporte_alumno(licencia: str):
    conn = get_db()
    try:
        lic = conn.execute("""
            SELECT l.*, m.Nombre as Maestro_Nombre
            FROM Licencias l
            LEFT JOIN Licencias m ON l.Maestro_Licencia = m.Licencia
            WHERE l.Licencia=?
        """, (licencia,)).fetchone()
        if not lic:
            raise HTTPException(404, "Licencia no encontrada")
        sesiones = conn.execute(
            "SELECT * FROM Sesiones WHERE Licencia=? ORDER BY id DESC LIMIT 20",
            (licencia,)
        ).fetchall()
        return {
            "alumno": dict(lic),
            "sesiones": [dict(s) for s in sesiones],
        }
    finally:
        conn.close()

# ── Maestro — ver sus alumnos ─────────────────────────────────
@app.get("/api/maestro/alumnos/{licencia}")
def maestro_alumnos(licencia: str):
    conn = get_db()
    try:
        mae = conn.execute("SELECT * FROM Licencias WHERE Licencia=? AND Tipo='maestro'", (licencia,)).fetchone()
        if not mae:
            raise HTTPException(403, "Licencia de maestro no válida")
        alumnos = conn.execute(
            "SELECT * FROM Licencias WHERE Maestro_Licencia=? AND Tipo='alumno' ORDER BY Nombre",
            (licencia,)
        ).fetchall()
        return {"alumnos": [dict(a) for a in alumnos], "maestro": dict(mae)}
    finally:
        conn.close()

# ── Certificado HTML (imprimible como PDF desde el navegador) ──
@app.get("/api/certificado/{licencia}", response_class=None)
def ver_certificado(licencia: str):
    from fastapi.responses import HTMLResponse
    conn = get_db()
    try:
        lic = conn.execute("SELECT * FROM Licencias WHERE Licencia=?", (licencia,)).fetchone()
        nombre = (lic["Nombre"] if lic else None) or "Aventurero"
    finally:
        conn.close()

    fecha = datetime.now().strftime("%d de %B de %Y").replace(
        "January","enero").replace("February","febrero").replace("March","marzo")\
        .replace("April","abril").replace("May","mayo").replace("June","junio")\
        .replace("July","julio").replace("August","agosto").replace("September","septiembre")\
        .replace("October","octubre").replace("November","noviembre").replace("December","diciembre")

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Certificado — {nombre}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Nunito:wght@400;700;800&display=swap');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{
    background: linear-gradient(135deg, #030010 0%, #1a0035 50%, #030010 100%);
    min-height: 100vh; display:flex; align-items:center; justify-content:center;
    font-family: 'Nunito', sans-serif; padding: 24px;
  }}
  .cert {{
    max-width: 800px; width:100%; padding: 48px 56px; text-align:center;
    background: linear-gradient(135deg, #0d0030 0%, #1a004a 50%, #0a001f 100%);
    border: 4px solid #FFD700; border-radius: 32px;
    box-shadow: 0 0 60px rgba(255,214,0,0.4), inset 0 0 60px rgba(255,214,0,0.05);
    position: relative; overflow: hidden;
  }}
  .corner {{ position:absolute; font-size:48px; opacity:0.3; }}
  .corner.tl {{ top:16px; left:16px; }}
  .corner.tr {{ top:16px; right:16px; }}
  .corner.bl {{ bottom:16px; left:16px; }}
  .corner.br {{ bottom:16px; right:16px; }}
  .badge {{ font-size:90px; margin-bottom:16px; filter:drop-shadow(0 0 20px #FFD700); }}
  .title {{
    font-family:'Orbitron',monospace; font-size:clamp(18px,4vw,32px); font-weight:900;
    color:#FFD700; letter-spacing:4px; margin-bottom:8px;
    text-shadow: 0 0 20px rgba(255,214,0,0.6);
  }}
  .sub {{ font-size:14px; color:rgba(255,255,255,0.4); letter-spacing:6px; margin-bottom:32px; }}
  .divider {{ width:60%; height:2px; background:linear-gradient(90deg,transparent,#FFD700,transparent); margin:0 auto 32px; }}
  .certifica {{ font-size:16px; color:rgba(255,255,255,0.6); margin-bottom:12px; }}
  .nombre {{
    font-family:'Orbitron',monospace; font-size:clamp(24px,5vw,42px); font-weight:900;
    color:#fff; margin:16px 0; text-shadow:0 0 30px rgba(0,245,255,0.5);
  }}
  .logro {{
    background:rgba(255,214,0,0.1); border:2px solid rgba(255,214,0,0.4);
    border-radius:20px; padding:20px 32px; margin:24px auto; max-width:580px;
    font-size:16px; color:rgba(255,255,255,0.85); line-height:1.7;
  }}
  .tablas {{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin:20px 0; }}
  .tabla {{
    background:rgba(57,255,20,0.1); border:1px solid rgba(57,255,20,0.4);
    border-radius:12px; padding:6px 14px;
    font-family:'Orbitron',monospace; font-size:13px; color:#39ff14;
  }}
  .fecha {{ font-size:14px; color:rgba(255,255,255,0.4); margin-top:28px; }}
  .firma {{ margin-top:32px; }}
  .firma-linea {{ width:220px; height:1px; background:rgba(255,255,255,0.3); margin:0 auto 6px; }}
  .firma-nombre {{ font-family:'Orbitron',monospace; font-size:12px; color:rgba(255,255,255,0.5); letter-spacing:2px; }}
  .emoji-row {{ font-size:32px; margin:16px 0; }}
  @media print {{
    body {{ background:#fff !important; }}
    .cert {{ border-color:#b8860b !important; box-shadow:none !important; background:#fff !important; }}
    .title {{ color:#8B6914 !important; }}
    .nombre {{ color:#222 !important; }}
    .logro {{ background:#fff8e1 !important; border-color:#b8860b !important; }}
  }}
</style>
</head>
<body>
<div class="cert">
  <span class="corner tl">🌟</span>
  <span class="corner tr">🌟</span>
  <span class="corner bl">🌟</span>
  <span class="corner br">🌟</span>

  <div class="badge">🏆</div>
  <div class="title">CERTIFICADO DE EXCELENCIA</div>
  <div class="sub">AVENTURA DE TABLAS PRO</div>
  <div class="divider"></div>

  <div class="certifica">Este certificado acredita con orgullo que</div>
  <div class="nombre">{nombre}</div>
  <div class="certifica">ha completado con éxito el programa completo de tablas de multiplicar</div>

  <div class="logro">
    🎯 Ha conquistado los <strong>10 Mundos</strong> del Reino de los Números<br>
    ⚔️ Ha derrotado a todos los bosses, incluyendo a <strong>OMEGA</strong><br>
    📚 Domina las <strong>tablas de multiplicar del 1 al 10</strong><br>
    🦁 ¡Es un verdadero <strong>Campeón de las Tablas</strong>!
  </div>

  <div class="tablas">
    {"".join(f'<span class="tabla">×{i}</span>' for i in range(1,11))}
  </div>

  <div class="emoji-row">🦁 ⚔️ 👑 ✨ 🌟 ⭐ 🏅</div>

  <div class="fecha">Otorgado el {fecha}</div>

  <div class="firma">
    <div class="firma-linea"></div>
    <div class="firma-nombre">AVENTURA DE TABLAS PRO</div>
  </div>
</div>
<div style="text-align:center; margin-top:20px;">
  <button onclick="window.print()" style="background:#FFD700; border:none; border-radius:12px; padding:12px 32px; font-family:sans-serif; font-size:16px; font-weight:bold; cursor:pointer; color:#000;">
    🖨️ Imprimir / Guardar como PDF
  </button>
</div>
</body>
</html>"""
    return HTMLResponse(content=html)

# ── Enviar certificado por email ───────────────────────────────
@app.post("/api/certificado/enviar")
async def enviar_certificado(data: SolicitarCertificado, bg: BackgroundTasks):
    conn = get_db()
    try:
        lic = conn.execute("SELECT * FROM Licencias WHERE Licencia=?", (data.licencia.strip(),)).fetchone()
        nombre = data.nombre or (lic["Nombre"] if lic else "Aventurero") or "Aventurero"
        correo = data.correo or (lic["Correo"] if lic else "") or ""
    finally:
        conn.close()

    if correo and EMAIL_PASS:
        fecha = datetime.now().strftime("%d/%m/%Y")
        html_email = _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#FFD700,#ff9f00,#ff006e);">
  <div style="font-size:64px;margin-bottom:10px;">🏆👑✨</div>
  <h1 style="color:#fff;">¡CERTIFICADO DE CAMPEÓN!</h1>
</div>
<div class="body">
  <p>¡Felicidades <strong style="color:#FFD700;">{nombre}</strong>! 🎉</p>
  <p>Has completado el programa completo de <strong>Aventura de Tablas Pro</strong>.</p>
  <div class="box box-gold" style="text-align:center;">
    <div class="label">🏅 TUS LOGROS</div>
    <p style="margin:8px 0;font-size:16px;color:#fff;">
      ✅ 10 Mundos completados<br>
      ⚔️ Todos los bosses derrotados<br>
      👑 OMEGA — El Señor de las Tablas vencido<br>
      📚 Tablas del 1 al 10 dominadas
    </p>
  </div>
  <div class="box box-green">
    <div class="label">📜 Tu Certificado</div>
    <p style="margin:0;">Para ver e imprimir tu certificado, haz clic en el botón de abajo.</p>
  </div>
  <div style="text-align:center;margin-top:20px;">
    <p style="color:#b0b8ff;font-size:13px;">Expedido el {fecha}</p>
    <p style="color:#b0b8ff;font-size:13px;">¡Sigue aprendiendo y siendo un campeón! 🌟</p>
  </div>
</div>""")
        bg.add_task(enviar_correo, correo, f"🏆 ¡Certificado de Campeón! — {nombre}", html_email)

    return {"ok": True}

# ─── HELPERS PARA GRUPOS ──────────────────────────────────────
def _calcular_costo(tutor_tipo: str, num_dep: int):
    """Devuelve (costo_total, tipo_pago, descripcion)"""
    if tutor_tipo == "maestro":
        if num_dep < 10:
            total = 99 * (1 + num_dep)
            return total, "mensual", f"${total} MXN/mes (tu suscripción + {num_dep} alumno{'s' if num_dep != 1 else ''})"
        elif num_dep <= 15:
            return 1000, "unico", "$1,000 MXN pago único — 10 a 15 alumnos (licencia ilimitada 5 meses)"
        elif num_dep <= 20:
            return 1500, "unico", "$1,500 MXN pago único — 16 a 20 alumnos (licencia ilimitada 5 meses)"
        elif num_dep <= 30:
            return 2000, "unico", "$2,000 MXN pago único — 21 a 30 alumnos (licencia ilimitada 5 meses)"
        elif num_dep <= 40:
            return 3000, "unico", "$3,000 MXN pago único — 31 a 40 alumnos (licencia ilimitada 5 meses)"
        else:
            return 4000, "unico", "$4,000 MXN pago único — 41 a 50 alumnos (licencia ilimitada 5 meses)"
    else:  # padre
        total = 99 * (1 + num_dep)
        hijos_txt = f"{num_dep} hijo{'s' if num_dep != 1 else ''}"
        return total, "mensual", f"${total} MXN/mes ($99 tu suscripción + $99 × {hijos_txt})"

def email_registro_grupo(tutor_nombre: str, tutor_tipo: str, dependientes: list,
                         costo_desc: str, tipo_pago: str, costo_total: float) -> str:
    bbva = DATOS_BBVA.replace("|","<br>")
    tipo_txt = "maestro(a)" if tutor_tipo == "maestro" else "padre/madre de familia"
    dep_txt  = "alumnos" if tutor_tipo == "maestro" else "hijos"
    filas = "".join(
        f"<tr><td style='padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#b0b8ff;'>{i+1}. {d.get('nombre','')}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.45);font-size:12px;'>"
        f"{d.get('correo','') or '—'}</td></tr>"
        for i, d in enumerate(dependientes)
    )
    pago_tipo_txt = "✅ Pago único (5 meses de vigencia)" if tipo_pago == "unico" else "📅 Pago mensual (30 días)"
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#6c5ce7,#a29bfe,#0984e3);">
  <div style="font-size:64px;margin-bottom:10px;">🎓📝✨</div>
  <h1 style="color:#fff;">¡SOLICITUD DE GRUPO RECIBIDA!</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{tutor_nombre}</strong>! 👋</p>
  <p>Recibimos tu solicitud de registro como <strong>{tipo_txt}</strong> con {len(dependientes)} {dep_txt}.</p>

  <div class="box box-gold">
    <div class="label">💰 Resumen de Pago</div>
    <p style="margin:6px 0;font-size:18px;color:#FFD700;font-weight:700;">{costo_desc}</p>
    <p style="margin:4px 0;color:#b0b8ff;">{pago_tipo_txt}</p>
  </div>

  <div class="box box-cyan">
    <div class="label">👥 {dep_txt.capitalize()} registrados ({len(dependientes)})</div>
    <table style="width:100%;border-collapse:collapse;">{filas}</table>
  </div>

  <div class="box box-pink">
    <div class="label">🏦 Datos para Transferencia BBVA</div>
    <p style="margin:0;line-height:2;">{bbva}</p>
    <p style="margin:8px 0 0;color:#FFD700;font-size:13px;">Concepto: AventuraTablas + tu nombre completo</p>
  </div>

  <div class="box box-purple">
    <div class="label">📋 Pasos siguientes</div>
    <ol>
      <li>Realiza la transferencia por <strong style="color:#FFD700;">${costo_total:,.0f} MXN</strong></li>
      <li>Envía el comprobante a <strong style="color:#00f5ff;">{EMAIL_FROM}</strong></li>
      <li>En menos de <strong>24 horas</strong> recibirás los códigos para ti y tus {dep_txt} 🎉</li>
    </ol>
  </div>
</div>""")

def email_activacion_grupo(tutor_nombre: str, tutor_tipo: str, tutor_licencia: str,
                           tutor_vence: str, dependientes_activados: list, tipo_pago: str) -> str:
    dep_txt = "alumnos" if tutor_tipo == "maestro" else "hijos"
    vigencia = "5 meses" if tipo_pago == "unico" else "30 días"
    filas = "".join(
        f"<tr>"
        f"<td style='padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#b0b8ff;'>{d['nombre']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-family:monospace;color:#FFD700;letter-spacing:2px;font-size:13px;'>{d['licencia']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#39ff14;font-size:12px;'>{d['vence']}</td>"
        f"</tr>"
        for d in dependientes_activados
    )
    return _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#00b894,#00cec9,#0984e3);">
  <div style="font-size:64px;margin-bottom:10px;">🎉🎓✅</div>
  <h1 style="color:#fff;">¡GRUPO ACTIVADO!</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{tutor_nombre}</strong>! 🎉</p>
  <p>Tu cuenta y la de tus {dep_txt} están <strong style="color:#39ff14;">ACTIVAS</strong>.</p>

  <div class="box box-gold" style="text-align:center;">
    <div class="label">🔑 Tu Código Personal</div>
    <div class="code">{tutor_licencia}</div>
    <p style="margin:6px 0 0;color:#FFD700;">Válida hasta: <strong>{tutor_vence}</strong> ({vigencia})</p>
  </div>

  <div class="box box-cyan">
    <div class="label">👥 Códigos de tus {dep_txt} ({len(dependientes_activados)})</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <th style="padding:6px 12px;text-align:left;color:rgba(255,255,255,0.4);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.1);">Nombre</th>
        <th style="padding:6px 12px;text-align:left;color:rgba(255,255,255,0.4);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.1);">Código</th>
        <th style="padding:6px 12px;text-align:left;color:rgba(255,255,255,0.4);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.1);">Válida hasta</th>
      </tr>
      {filas}
    </table>
  </div>

  <div class="box box-purple">
    <div class="label">🚀 Cómo ingresar</div>
    <ol>
      <li>Abre el juego en el navegador</li>
      <li>Cada persona escribe su propio código en "🎮 JUGAR"</li>
      <li>¡Elige avatar y comienza la aventura!</li>
    </ol>
  </div>
</div>""")

# ─── REGISTRO DE GRUPO (MAESTRO O PADRE CON DEPENDIENTES) ────
@app.post("/api/registro/grupo")
async def registro_grupo(data: RegistroGrupo, bg: BackgroundTasks):
    if not data.tutor_nombre or not data.tutor_correo or not data.tutor_celular:
        raise HTTPException(400, "Nombre, correo y celular son obligatorios")
    if data.tutor_tipo not in ("maestro", "padre"):
        raise HTTPException(400, "Tipo debe ser 'maestro' o 'padre'")
    if len(data.dependientes) == 0:
        raise HTTPException(400, "Debes agregar al menos un alumno/hijo")
    if len(data.dependientes) > 50:
        raise HTTPException(400, "Máximo 50 dependientes por registro")

    costo, tipo_pago, costo_desc = _calcular_costo(data.tutor_tipo, len(data.dependientes))
    deps_json = json.dumps(data.dependientes, ensure_ascii=False)

    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO Solicitudes_Grupo
               (Fecha,Tutor_Nombre,Tutor_Correo,Tutor_Celular,Tutor_Escuela,Tutor_Tipo,
                Num_Dependientes,Dependientes_Json,Costo_Total,Tipo_Pago,Estado)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (datetime.now().strftime("%Y-%m-%d %H:%M"),
             data.tutor_nombre, data.tutor_correo, data.tutor_celular,
             data.tutor_escuela or "", data.tutor_tipo,
             len(data.dependientes), deps_json, costo, tipo_pago, "Pendiente")
        )
        conn.commit()
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

    if data.tutor_correo and EMAIL_PASS:
        bg.add_task(
            enviar_correo, data.tutor_correo,
            "🎓 Aventura de Tablas — Solicitud de grupo recibida",
            email_registro_grupo(data.tutor_nombre, data.tutor_tipo,
                                 data.dependientes, costo_desc, tipo_pago, costo)
        )
    return {"ok": True, "costo": costo, "tipo_pago": tipo_pago, "descripcion": costo_desc}

# ─── AGREGAR DEPENDIENTES A TUTOR EXISTENTE ──────────────────
@app.post("/api/tutor/agregar-dependientes")
async def agregar_dependientes(data: AgregarDependientes, bg: BackgroundTasks):
    if not data.dependientes:
        raise HTTPException(400, "No se enviaron dependientes")
    conn = get_db()
    try:
        lic = conn.execute(
            "SELECT * FROM Licencias WHERE Licencia=? AND Tipo IN ('maestro','padre') AND Activa='SI'",
            (data.tutor_licencia.strip(),)
        ).fetchone()
        if not lic:
            raise HTTPException(403, "Licencia de tutor no válida o no activa")

        tutor_tipo = lic["Tipo"]
        num_nuevos = len(data.dependientes)
        costo_adicional = 99 * num_nuevos
        dep_txt = "alumnos" if tutor_tipo == "maestro" else "hijos"

        conn.execute(
            """INSERT INTO Solicitudes_Grupo
               (Fecha,Tutor_Nombre,Tutor_Correo,Tutor_Celular,Tutor_Tipo,
                Num_Dependientes,Dependientes_Json,Costo_Total,Tipo_Pago,Estado,Tutor_Licencia,Notas)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (datetime.now().strftime("%Y-%m-%d %H:%M"),
             lic["Nombre"], lic["Correo"], lic["Celular"], tutor_tipo,
             num_nuevos, json.dumps(data.dependientes, ensure_ascii=False),
             costo_adicional, "mensual", "Pendiente_Ampliacion",
             data.tutor_licencia.strip(),
             f"Ampliación: {num_nuevos} {dep_txt} adicionales")
        )
        conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

    bbva = DATOS_BBVA.replace("|","<br>")
    if lic["Correo"] and EMAIL_PASS:
        nombres_nuevos = ", ".join(d.get("nombre","?") for d in data.dependientes)
        html = _base(f"""
<div class="hero" style="background:linear-gradient(135deg,#0984e3,#6c5ce7);">
  <div style="font-size:64px;margin-bottom:10px;">➕🎓📋</div>
  <h1 style="color:#fff;">SOLICITUD DE AMPLIACIÓN</h1>
</div>
<div class="body">
  <p>¡Hola <strong style="color:#00f5ff;">{lic["Nombre"]}</strong>!</p>
  <p>Recibimos tu solicitud para agregar <strong>{num_nuevos} {dep_txt}</strong> adicionales: <em>{nombres_nuevos}</em></p>
  <div class="box box-gold">
    <div class="label">💰 Costo adicional</div>
    <p style="margin:0;font-size:18px;color:#FFD700;font-weight:700;">${costo_adicional} MXN/mes (${99} × {num_nuevos})</p>
  </div>
  <div class="box box-cyan">
    <div class="label">🏦 Transferencia BBVA</div>
    <p style="margin:0;line-height:2;">{bbva}</p>
  </div>
  <ol>
    <li>Transfiere <strong style="color:#FFD700;">${costo_adicional} MXN</strong></li>
    <li>Envía comprobante a <strong style="color:#00f5ff;">{EMAIL_FROM}</strong></li>
    <li>Recibirás los nuevos códigos en menos de 24 horas</li>
  </ol>
</div>""")
        bg.add_task(enviar_correo, lic["Correo"],
                    "➕ Aventura de Tablas — Ampliación de grupo", html)

    return {"ok": True, "costo_adicional": costo_adicional}

# ─── DASHBOARD TUTOR (MAESTRO O PADRE) ───────────────────────
@app.get("/api/dashboard/tutor/{licencia}")
def dashboard_tutor(licencia: str):
    conn = get_db()
    try:
        lic = conn.execute(
            "SELECT * FROM Licencias WHERE Licencia=? AND Tipo IN ('maestro','padre')",
            (licencia.strip(),)
        ).fetchone()
        if not lic:
            raise HTTPException(403, "Licencia de tutor no válida")

        alumnos = conn.execute(
            """SELECT l.*,
               (SELECT MAX(Inicio) FROM Sesiones WHERE Licencia=l.Licencia) as Ultima_Sesion,
               (SELECT COUNT(*) FROM Sesiones WHERE Licencia=l.Licencia) as Num_Sesiones
               FROM Licencias l
               WHERE l.Maestro_Licencia=? ORDER BY l.Nombre""",
            (licencia.strip(),)
        ).fetchall()

        resultado = []
        for a in alumnos:
            sesiones = conn.execute(
                "SELECT * FROM Sesiones WHERE Licencia=? ORDER BY id DESC LIMIT 10",
                (a["Licencia"],)
            ).fetchall()
            try:
                fallos = json.loads(a["Fallos_Tablas"] or "{}")
            except:
                fallos = {}
            resultado.append({
                **dict(a),
                "sesiones_recientes": [dict(s) for s in sesiones],
                "fallos_obj": fallos,
                "pct_progreso": round(((a["Mundos_Completados"] or 0) / 10) * 100),
            })

        return {"tutor": dict(lic), "alumnos": resultado}
    finally:
        conn.close()

# ─── ADMIN — SOLICITUDES DE GRUPO ────────────────────────────
@app.get("/api/admin/solicitudes-grupo")
def listar_solicitudes_grupo():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM Solicitudes_Grupo ORDER BY id DESC").fetchall()
        return {"solicitudes": [dict(r) for r in rows]}
    finally:
        conn.close()

# ─── ADMIN — ACTIVAR GRUPO COMPLETO ──────────────────────────
@app.post("/api/admin/activar-grupo")
async def activar_grupo(data: ActivarGrupo, bg: BackgroundTasks):
    conn = get_db()
    try:
        sol = conn.execute(
            "SELECT * FROM Solicitudes_Grupo WHERE id=?", (data.solicitud_id,)
        ).fetchone()
        if not sol:
            raise HTTPException(404, "Solicitud no encontrada")

        tutor_tipo = sol["Tutor_Tipo"]
        tipo_pago  = sol["Tipo_Pago"]
        es_amp     = sol["Estado"] == "Pendiente_Ampliacion"

        dias      = 150 if tipo_pago == "unico" else 30
        tipo_lic  = "ilimitada" if tipo_pago == "unico" else "mensual"
        fecha_vence = (datetime.now() + timedelta(days=dias)).strftime("%d/%m/%Y")
        deps = json.loads(sol["Dependientes_Json"] or "[]")

        if not es_amp:
            tutor_lic = sol["Tutor_Licencia"]
            if not tutor_lic:
                for _ in range(10):
                    tutor_lic = _generar_codigo(sol["Tutor_Nombre"], tutor_tipo)
                    if not conn.execute("SELECT id FROM Licencias WHERE Licencia=?", (tutor_lic,)).fetchone():
                        break
            conn.execute(
                """INSERT OR IGNORE INTO Licencias
                   (Licencia,Activa,Tipo,Nombre,Correo,Celular,Grado,Fecha_Vence,Tipo_Licencia)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (tutor_lic, "SI", tutor_tipo, sol["Tutor_Nombre"],
                 sol["Tutor_Correo"], sol["Tutor_Celular"],
                 sol["Tutor_Escuela"], fecha_vence, tipo_lic)
            )
            conn.execute(
                "UPDATE Solicitudes_Grupo SET Tutor_Licencia=?, Estado='Activo' WHERE id=?",
                (tutor_lic, data.solicitud_id)
            )
        else:
            tutor_lic = sol["Tutor_Licencia"]
            conn.execute(
                "UPDATE Solicitudes_Grupo SET Estado='Activo' WHERE id=?", (data.solicitud_id,)
            )

        dependientes_activados = []
        for dep in deps:
            dep_nombre = dep.get("nombre", "")
            dep_correo = dep.get("correo", "")
            dep_grado  = dep.get("grado", "")
            dep_lic = ""
            for _ in range(10):
                dep_lic = _generar_codigo(dep_nombre, "alumno")
                if not conn.execute("SELECT id FROM Licencias WHERE Licencia=?", (dep_lic,)).fetchone():
                    break
            conn.execute(
                """INSERT OR IGNORE INTO Licencias
                   (Licencia,Activa,Tipo,Nombre,Correo,Grado,Maestro_Licencia,Fecha_Vence,Tipo_Licencia)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (dep_lic, "SI", "alumno", dep_nombre, dep_correo,
                 dep_grado, tutor_lic, fecha_vence, tipo_lic)
            )
            dependientes_activados.append({
                "nombre": dep_nombre, "licencia": dep_lic, "vence": fecha_vence
            })
            if dep_correo and EMAIL_PASS:
                bg.add_task(
                    enviar_correo, dep_correo,
                    "✅ Aventura de Tablas — ¡Tu cuenta está activa!",
                    email_activacion(dep_nombre, dep_lic, fecha_vence, sol["Tutor_Nombre"], dep_grado)
                )

        conn.commit()

        if sol["Tutor_Correo"] and EMAIL_PASS:
            bg.add_task(
                enviar_correo, sol["Tutor_Correo"],
                "✅ Aventura de Tablas — ¡Grupo activado!",
                email_activacion_grupo(sol["Tutor_Nombre"], tutor_tipo, tutor_lic,
                                       fecha_vence, dependientes_activados, tipo_pago)
            )

        return {"ok": True, "tutor_licencia": tutor_lic, "dependientes": dependientes_activados}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ─── ADMIN — BLOQUEAR / DESBLOQUEAR LICENCIA ─────────────────
@app.post("/api/admin/bloquear-licencia")
def bloquear_licencia_endpoint(data: BloquearLicencia):
    conn = get_db()
    try:
        bloqueado_val = 1 if data.bloqueado else 0
        activa_val    = "NO" if data.bloqueado else "SI"
        conn.execute(
            "UPDATE Licencias SET Bloqueado=?, Activa=? WHERE Licencia=?",
            (bloqueado_val, activa_val, data.codigo.strip())
        )
        lic = conn.execute(
            "SELECT Tipo FROM Licencias WHERE Licencia=?", (data.codigo.strip(),)
        ).fetchone()
        if lic and lic["Tipo"] in ("maestro", "padre"):
            conn.execute(
                "UPDATE Licencias SET Bloqueado=?, Activa=? WHERE Maestro_Licencia=?",
                (bloqueado_val, activa_val, data.codigo.strip())
            )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ─── ADMIN — REINICIAR MUNDOS / MONEDAS / INVENTARIO ─────────
@app.post("/api/admin/reiniciar-mundos")
def reiniciar_mundos_endpoint(data: ReiniciarMundos):
    conn = get_db()
    try:
        lic = conn.execute(
            "SELECT Nivel_Max, Mundos_Completados FROM Licencias WHERE Licencia=?",
            (data.licencia.strip(),)
        ).fetchone()
        if not lic:
            raise HTTPException(404, "Licencia no encontrada")

        updates = {"Reset_Forzado": 1}  # siempre marcar para que el frontend se sincronice

        # Mundos
        if data.mundos is None:
            # Reinicio total de mundos
            updates["Nivel_Max"] = 1
            updates["Mundos_Completados"] = 0
            updates["Fallos_Tablas"] = "{}"
        elif isinstance(data.mundos, list) and len(data.mundos) > 0:
            min_mundo = min(int(m) for m in data.mundos)
            updates["Nivel_Max"] = min_mundo + 1
            updates["Mundos_Completados"] = min_mundo
        # Si mundos es lista vacía: no reiniciar mundos, solo lo demás

        if data.reiniciar_monedas:
            updates["Monedas"] = 0
        if data.reiniciar_inventario:
            updates["Inventario"] = ""

        set_clause = ", ".join(f"{k}=?" for k in updates)
        vals = list(updates.values()) + [data.licencia.strip()]
        conn.execute(f"UPDATE Licencias SET {set_clause} WHERE Licencia=?", vals)
        conn.commit()
        return {
            "ok": True,
            "nuevo_nivel": updates.get("Nivel_Max", lic["Nivel_Max"]),
            "nuevos_mundos": updates.get("Mundos_Completados", lic["Mundos_Completados"]),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

# ─── SINCRONIZACIÓN FORZADA (frontend la llama al entrar al mapa) ─
@app.get("/api/sincronizar/{licencia}")
def sincronizar_estado(licencia: str):
    conn = get_db()
    try:
        lic = conn.execute(
            "SELECT Nivel_Max, Mundos_Completados, Monedas, Inventario, Fallos_Tablas, Reset_Forzado FROM Licencias WHERE Licencia=?",
            (licencia.strip(),)
        ).fetchone()
        if not lic:
            return {"forzar": False}

        forzar = bool(lic["Reset_Forzado"] and int(lic["Reset_Forzado"]) == 1)
        if forzar:
            # Consumir el flag — ya no se volverá a forzar
            conn.execute("UPDATE Licencias SET Reset_Forzado=0 WHERE Licencia=?", (licencia.strip(),))
            conn.commit()

        return {
            "forzar":            forzar,
            "nivel_max":         int(lic["Nivel_Max"] or 1),
            "mundos_completados":int(lic["Mundos_Completados"] or 0),
            "monedas":           int(lic["Monedas"] or 0),
            "inventario":        lic["Inventario"] or "",
            "fallos_tablas":     lic["Fallos_Tablas"] or "{}",
        }
    finally:
        conn.close()

# ─── ADMIN — ESTADÍSTICAS GLOBALES ───────────────────────────
@app.get("/api/admin/estadisticas")
def admin_estadisticas():
    conn = get_db()
    try:
        total    = conn.execute("SELECT COUNT(*) as n FROM Licencias WHERE Tipo!='admin'").fetchone()["n"]
        activas  = conn.execute("SELECT COUNT(*) as n FROM Licencias WHERE Activa='SI' AND Tipo!='admin'").fetchone()["n"]
        maestros = conn.execute("SELECT COUNT(*) as n FROM Licencias WHERE Tipo='maestro'").fetchone()["n"]
        padres   = conn.execute("SELECT COUNT(*) as n FROM Licencias WHERE Tipo='padre'").fetchone()["n"]
        alumnos  = conn.execute("SELECT COUNT(*) as n FROM Licencias WHERE Tipo='alumno'").fetchone()["n"]
        pend_grupo = conn.execute("SELECT COUNT(*) as n FROM Solicitudes_Grupo WHERE Estado='Pendiente'").fetchone()["n"]
        return {
            "total": total, "activas": activas, "maestros": maestros,
            "padres": padres, "alumnos": alumnos, "pendientes_grupo": pend_grupo
        }
    finally:
        conn.close()
