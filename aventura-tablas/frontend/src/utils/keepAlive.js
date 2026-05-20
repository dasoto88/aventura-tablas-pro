/**
 * KEEP-ALIVE — Aventura de Tablas Pro
 *
 * Mantiene el servidor de Render despierto enviando un ping
 * invisible cada 5 minutos. El usuario nunca lo ve ni lo siente.
 *
 * Render free tier duerme tras 15 min de inactividad.
 * Con pings cada 5 min → el servidor NUNCA duerme.
 */

const API = process.env.REACT_APP_API_URL || "";
const INTERVALO_MS = 5 * 60 * 1000;  // 5 minutos
const PING_URL     = `${API}/api/ping`;

let _timer    = null;
let _iniciado = false;

// ── Ping silencioso ───────────────────────────────────────────
async function _ping() {
  try {
    await fetch(PING_URL, {
      method: "GET",
      cache:  "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (_) {
    // Falla silenciosa — el usuario nunca ve nada
  }
}

// ── Ping de despertar con timeout de 30s ─────────────────────
export async function wakeUpServer() {
  try {
    const res = await fetch(PING_URL, {
      method: "GET",
      cache:  "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// ── Iniciar keep-alive (llamar 1 sola vez al arrancar la app) ─
export function iniciarKeepAlive() {
  if (_iniciado) return;
  _iniciado = true;

  // Ping inmediato al cargar
  _ping();

  // Luego cada 5 minutos
  _timer = setInterval(_ping, INTERVALO_MS);

  // Ping extra cuando el usuario vuelve a la pestaña
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") _ping();
  });
}
