import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../utils/store";
import { MUNDOS, AVATARES } from "../utils/gameData";

const MAX_REPLAYS = 2;

export default function MapaPage() {
  const { nivelMax, irAMundo, nombre, avatarId, monedas,
          modoDemo, replayCount, todosCompletados, cerrarSesion,
          sincronizarConServidor } = useGameStore();
  const [hoveredMundo, setHoveredMundo] = useState(null);
  const [mostrarAvance, setMostrarAvance] = useState(false);
  const avatar = AVATARES.find(a => a.id === avatarId) || AVATARES[0];
  const mundosDisponibles = modoDemo ? 1 : nivelMax;

  // Detectar si el admin reinició datos mientras el alumno estaba en sesión
  useEffect(() => {
    sincronizarConServidor();
  }, [sincronizarConServidor]);

  // Avatar se muestra en la frontera: siguiente mundo por conquistar
  const mundoFrontera = Math.min(nivelMax - 1, MUNDOS.length - 1);

  return (
    <div className="page" style={{
      background: "radial-gradient(ellipse at top, #0d002b 0%, #030010 70%)",
      padding: 0, minHeight: "100vh",
    }}>
      {/* HUD */}
      <div className="hud">
        <div className="hud-item">
          <span style={{ fontSize: 24 }}>{avatar.emoji}</span>
          <span className="hud-value" style={{ fontFamily: "Nunito, sans-serif", fontSize: 14 }}>{nombre}</span>
        </div>
        <div className="hud-item">
          <span>🪙</span>
          <span className="hud-value" style={{ color: "#FFD700" }}>{monedas.toLocaleString()}</span>
        </div>
        <div className="hud-item">
          <span style={{ fontSize: 14, fontFamily: "Rajdhani, sans-serif", color: "rgba(255,255,255,0.5)" }}>
            Mundos: {Math.min(mundosDisponibles, MUNDOS.length)}/{MUNDOS.length}
          </span>
        </div>
        {todosCompletados && (
          <span style={{ color: "#FFD700", fontFamily: "Orbitron, monospace", fontSize: 11 }}>
            👑 CAMPEÓN
          </span>
        )}
        {modoDemo && !todosCompletados && (
          <span style={{ color: "#FFD700", fontFamily: "Orbitron, monospace", fontSize: 11 }}>
            🎮 DEMO
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={() => setMostrarAvance(true)}
            style={{ background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.35)", color: "#00f5ff", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>
            📊 Avance
          </button>
          <button
            onClick={() => useGameStore.setState({ pagina: "tienda" })}
            style={{ background: "rgba(255,214,0,0.12)", border: "1px solid rgba(255,214,0,0.35)", color: "#FFD700", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>
            🛒 Tienda
          </button>
          <button
            onClick={() => useGameStore.setState({ pagina: "selector_juego" })}
            style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)", color: "#FFD700", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>
            ⚔️ Quest
          </button>
          <button
            onClick={() => cerrarSesion()}
            style={{ background: "rgba(255,0,110,0.12)", border: "1px solid rgba(255,0,110,0.35)", color: "#ff006e", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>
            🚪 Salir
          </button>
        </div>
      </div>

      {/* Modal Ver Avance */}
      <AnimatePresence>
        {mostrarAvance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMostrarAvance(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 30 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "linear-gradient(135deg,#0d002b,#030010)", border: "1px solid rgba(0,245,255,0.3)", borderRadius: 20, padding: "24px 20px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ fontFamily: "Orbitron, monospace", color: "#00f5ff", fontSize: 16, margin: 0 }}>📊 Mi Avance</h2>
                <button onClick={() => setMostrarAvance(false)}
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>

              {/* Resumen */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
                {[
                  { label: "Mundos", value: `${Math.max(0, nivelMax - 1)}/${MUNDOS.length}`, color: "#00f5ff" },
                  { label: "Monedas", value: monedas.toLocaleString(), color: "#FFD700" },
                  { label: "Progreso", value: `${Math.round(((nivelMax - 1) / MUNDOS.length) * 100)}%`, color: "#39ff14" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Orbitron, monospace", fontSize: 18, color: s.color, fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Barra global */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 10, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(((nivelMax - 1) / MUNDOS.length) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{ height: 10, background: "linear-gradient(90deg,#667eea,#00f5ff)", borderRadius: 6 }}
                  />
                </div>
              </div>

              {/* Lista de mundos */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {MUNDOS.map((mundo, i) => {
                  const completado = i < nivelMax - 1;
                  const desbloqueado = i < nivelMax;
                  const esActualM = i === nivelMax - 1;
                  const replays = replayCount?.[String(i)] || 0;
                  return (
                    <div key={mundo.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: completado ? "rgba(57,255,20,0.06)" : esActualM ? "rgba(0,245,255,0.06)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${completado ? "rgba(57,255,20,0.2)" : esActualM ? "rgba(0,245,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 10, padding: "8px 12px",
                    }}>
                      <span style={{ fontSize: 20 }}>{mundo.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: desbloqueado ? "#fff" : "rgba(255,255,255,0.3)", fontWeight: 700 }}>
                          {mundo.nombre}
                        </div>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: mundo.color }}>Tabla del {mundo.tabla}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {completado && <div style={{ fontSize: 18 }}>✅</div>}
                        {esActualM && <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#00f5ff" }}>← Aquí</div>}
                        {!desbloqueado && <div style={{ fontSize: 18 }}>🔒</div>}
                        {completado && replays > 0 && (
                          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: "#ff9900" }}>🔁 ×{replays}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {todosCompletados && (
                <div style={{ marginTop: 14, textAlign: "center", padding: "12px", background: "rgba(255,214,0,0.1)", border: "1px solid rgba(255,214,0,0.3)", borderRadius: 12 }}>
                  <div style={{ fontSize: 28 }}>👑</div>
                  <div style={{ fontFamily: "Orbitron, monospace", fontSize: 13, color: "#FFD700", marginTop: 4 }}>¡CAMPEÓN SUPREMO!</div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Título */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", padding: "24px 16px 16px" }}
      >
        <h1 style={{
          fontFamily: "Orbitron, monospace",
          fontSize: "clamp(20px, 5vw, 36px)",
          fontWeight: 900,
          background: "linear-gradient(90deg, #FFD700, #ff006e, #00f5ff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          🗺️ MAPA DE AVENTURAS
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Nunito, sans-serif", fontSize: 14, marginTop: 6 }}>
          {todosCompletados
            ? "🏆 ¡Completaste todos los mundos! ¡Puedes repetirlos sin límite!"
            : "Elige un mundo para comenzar o continuar tu aventura"}
        </p>
      </motion.div>

      {/* Grid de mundos */}
      <div style={{ padding: "0 16px 32px", maxWidth: 900, margin: "0 auto", position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", position: "relative", zIndex: 1 }}>
          {MUNDOS.map((mundo, i) => {
            const desbloqueado  = i < mundosDisponibles;
            const completado    = i < mundosDisponibles - 1;
            const esActual      = i === mundoFrontera;
            const esSupremo     = mundo.esSupremo;
            const replays       = replayCount?.[String(i)] || 0;
            // Soft-lock: completado + agotó replays + todavía no terminó todo
            const softLocked    = completado && !todosCompletados && replays >= MAX_REPLAYS;

            if (esSupremo) {
              return (
                <motion.div
                  key={mundo.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, type: "spring" }}
                  style={{ gridColumn: "1 / -1" }}
                >
                  <MundoCardSupremo
                    mundo={mundo}
                    desbloqueado={desbloqueado}
                    completado={completado}
                    esActual={esActual}
                    onClic={() => desbloqueado && irAMundo(i)}
                  />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={mundo.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 150 }}
              >
                <MundoCard
                  mundo={mundo}
                  desbloqueado={desbloqueado}
                  completado={completado}
                  esActual={esActual}
                  softLocked={softLocked}
                  replays={replays}
                  todosCompletados={todosCompletados}
                  hovered={hoveredMundo === i}
                  onHover={() => setHoveredMundo(i)}
                  onLeave={() => setHoveredMundo(null)}
                  onClic={() => {
                    if (!desbloqueado || softLocked) return;
                    irAMundo(i);
                  }}
                  avatarEmoji={esActual ? avatar.emoji : null}
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div style={{
        display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap",
        padding: "16px 16px 32px",
        fontFamily: "Nunito, sans-serif", fontSize: 13,
        color: "rgba(255,255,255,0.45)",
      }}>
        <span>✅ Completado</span>
        <span style={{ color: "#00f5ff" }}>🎯 Disponible</span>
        <span style={{ opacity: 0.4 }}>🔒 Bloqueado</span>
        <span style={{ color: "#FFD700" }}>👑 Supremo</span>
        <span style={{ color: "#ff9900" }}>🔁 Repeticiones ({MAX_REPLAYS} máx.)</span>
      </div>
    </div>
  );
}

// ─── MUNDO CARD ────────────────────────────────────────────────
function MundoCard({ mundo, desbloqueado, completado, esActual, softLocked,
                     replays, todosCompletados, hovered, onHover, onLeave, onClic, avatarEmoji }) {
  const clicable = desbloqueado && !softLocked;

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClic}
      style={{
        background: desbloqueado
          ? `linear-gradient(135deg, ${mundo.colorOscuro}cc, ${mundo.color}33)`
          : "rgba(20,20,40,0.5)",
        border: `2px solid ${esActual ? mundo.color : completado ? "#39ff14" : desbloqueado ? `${mundo.color}66` : "rgba(255,255,255,0.1)"}`,
        borderRadius: 16,
        boxShadow: esActual ? `0 0 25px ${mundo.color}66` : "none",
        minHeight: 140,
        position: "relative",
        overflow: "hidden",
        cursor: clicable ? "pointer" : "default",
        opacity: softLocked ? 0.7 : 1,
        transition: "all 0.2s",
      }}
    >
      {/* Overlay cuando soft-locked (agotó replays) */}
      {softLocked && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          borderRadius: "inherit", zIndex: 5, gap: 4,
        }}>
          <div style={{ fontSize: 28 }}>🔐</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#ff9900", textAlign: "center", padding: "0 8px" }}>
            Máx. replays ({MAX_REPLAYS}) alcanzado
          </div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "0 8px" }}>
            Completa todos los mundos para desbloquear
          </div>
        </div>
      )}

      {/* Lock overlay (no desbloqueado) */}
      {!desbloqueado && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", background: "rgba(0,0,0,0.5)", borderRadius: "inherit", zIndex: 5,
        }}>
          <div style={{ fontSize: 36 }}>🔒</div>
        </div>
      )}

      {/* Avatar flotante en mundo actual */}
      {avatarEmoji && (
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
            fontSize: 28, zIndex: 10, filter: `drop-shadow(0 0 8px ${mundo.color})`,
          }}
        >
          {avatarEmoji}
        </motion.div>
      )}

      {/* Número */}
      <div style={{
        position: "absolute", top: 8, left: 10,
        fontFamily: "Orbitron, monospace", fontSize: 11, color: "rgba(255,255,255,0.35)",
      }}>
        #{mundo.id + 1}
      </div>

      {/* Completado */}
      {completado && (
        <div style={{ position: "absolute", top: 8, right: 10, fontSize: 16 }}>✅</div>
      )}

      {/* Indicador de replays */}
      {completado && desbloqueado && (
        <div style={{
          position: "absolute", bottom: 6, right: 8, zIndex: 4,
          fontFamily: "Nunito, sans-serif", fontSize: 10,
          color: replays >= MAX_REPLAYS && !todosCompletados ? "#ff9900" : "rgba(255,255,255,0.35)",
        }}>
          {todosCompletados ? "∞ replays" : `🔁 ${replays}/${MAX_REPLAYS}`}
        </div>
      )}

      <div style={{ textAlign: "center", paddingTop: avatarEmoji ? 16 : 8, paddingBottom: 20 }}>
        <motion.div
          animate={desbloqueado && hovered && !softLocked ? { rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.5 }}
          style={{ fontSize: 40, marginBottom: 8 }}
        >
          {mundo.emoji}
        </motion.div>
        <div style={{
          fontFamily: "Orbitron, monospace", fontSize: 12, fontWeight: 700,
          color: desbloqueado ? "#fff" : "rgba(255,255,255,0.4)", marginBottom: 4,
        }}>
          {mundo.nombre}
        </div>
        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: mundo.color }}>
          Tabla del {mundo.tabla}
        </div>
        {desbloqueado && (
          <div style={{ marginTop: 6, fontFamily: "Nunito, sans-serif", fontSize: 10, color: "#FFD700" }}>
            🪙 {mundo.premio} de premio
            {completado && replays > 0 && !todosCompletados && (
              <span style={{ color: "rgba(255,150,0,0.7)", marginLeft: 4 }}>
                ({replays === 1 ? "50%" : "25%"} en replay)
              </span>
            )}
          </div>
        )}
        {desbloqueado && !completado && (
          <div style={{ marginTop: 6, fontSize: 14 }}>
            {mundo.bossEmoji} <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{mundo.bossNombre}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MUNDO SUPREMO ────────────────────────────────────────────
function MundoCardSupremo({ mundo, desbloqueado, completado, esActual, onClic }) {
  return (
    <motion.div
      animate={desbloqueado ? { boxShadow: ["0 0 20px rgba(255,214,0,0.3)", "0 0 60px rgba(255,214,0,0.7)", "0 0 20px rgba(255,214,0,0.3)"] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
      onClick={onClic}
      style={{
        background: desbloqueado
          ? "linear-gradient(135deg, #3d0020 0%, #7b0034 40%, #FFD700 100%)"
          : "rgba(20,20,40,0.5)",
        border: `3px solid ${desbloqueado ? "#FFD700" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 24, padding: 32, textAlign: "center",
        cursor: desbloqueado ? "pointer" : "default",
        position: "relative", overflow: "hidden",
        filter: desbloqueado ? "none" : "grayscale(0.8) opacity(0.5)",
      }}
    >
      {!desbloqueado && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", borderRadius: "inherit", zIndex: 5, gap: 8 }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Nunito, sans-serif", fontSize: 13 }}>Completa los 10 mundos para desbloquear</p>
        </div>
      )}

      {desbloqueado && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", inset: -50, background: "conic-gradient(from 0deg, transparent 70%, rgba(255,214,0,0.15) 80%, transparent 90%)", pointerEvents: "none" }}
        />
      )}

      <div style={{ position: "relative", zIndex: 1 }}>
        <motion.div
          animate={desbloqueado ? { scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] } : {}}
          transition={{ duration: 3, repeat: Infinity }}
          style={{ fontSize: 72, marginBottom: 12 }}
        >
          {mundo.emoji}
        </motion.div>
        <h2 style={{ fontFamily: "Orbitron, monospace", fontSize: 22, fontWeight: 900, color: "#FFD700", marginBottom: 8, letterSpacing: 3 }}>
          {mundo.nombre}
        </h2>
        <p style={{ fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.7)", fontSize: 15, marginBottom: 12 }}>
          {mundo.descripcion}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>{mundo.bossEmoji}</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#ff006e" }}>{mundo.bossNombre}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 22, color: "#FFD700" }}>🪙 {mundo.premio.toLocaleString()}</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Monedas de premio</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
