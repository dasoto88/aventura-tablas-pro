import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TIENDA_ITEMS, AVATARES } from "../utils/gameData";

// Obstáculos por mundo
const OBSTACULOS_MUNDO = [
  ["🌿","🍄","🐛","🌵","🕷️","🌿","🍄","🐛","🌵","🕷️"],
  ["🦈","🐙","🌊","🐚","🦑","🦈","🐙","🌊","🐚","🦑"],
  ["🔥","🌋","💎","🪨","🔥","🌋","💎","🪨","🔥","🌋"],
  ["⛄","🌨️","🏔️","❄️","🐧","⛄","🌨️","🏔️","❄️","🐧"],
  ["👻","🕯️","🦇","💀","🕸️","👻","🕯️","🦇","💀","🕸️"],
  ["☁️","🌩️","⚡","🌪️","☁️","🌩️","⚡","🌪️","☁️","🌩️"],
  ["🤖","⚙️","💾","🔧","🔌","🤖","⚙️","💾","🔧","🔌"],
  ["🌙","⭐","🪐","🚀","🛸","🌙","⭐","🪐","🚀","🛸"],
  ["🐲","🏰","⚔️","🛡️","💎","🐲","🏰","⚔️","🛡️","💎"],
  ["🌊","⚓","🏴‍☠️","💰","🦜","🌊","⚓","🏴‍☠️","💰","🦜"],
  ["👑","🌟","💫","✨","🔮","👑","🌟","💫","✨","🔮"],
];

const CASILLA_POSITIONS = Array.from({ length: 10 }, (_, i) => i);

// CSS de animaciones — inyectado una sola vez
if (typeof document !== "undefined" && !document.getElementById("avatar-walk-css")) {
  const style = document.createElement("style");
  style.id = "avatar-walk-css";
  style.textContent = `
    @keyframes avatar-walk {
      0%   { transform: translateY(0px) rotate(-4deg) scaleX(1); }
      25%  { transform: translateY(-8px) rotate(0deg) scaleX(1.05); }
      50%  { transform: translateY(0px) rotate(4deg) scaleX(1); }
      75%  { transform: translateY(-5px) rotate(0deg) scaleX(1.05); }
      100% { transform: translateY(0px) rotate(-4deg) scaleX(1); }
    }
    @keyframes avatar-idle {
      0%   { transform: translateY(0px) scale(1); }
      50%  { transform: translateY(-5px) scale(1.03); }
      100% { transform: translateY(0px) scale(1); }
    }
    @keyframes avatar-attack {
      0%   { transform: translateX(0) scaleX(1) rotate(0); }
      30%  { transform: translateX(18px) scaleX(1.1) rotate(-5deg); }
      60%  { transform: translateX(8px) scaleX(1.05) rotate(5deg); }
      100% { transform: translateX(0) scaleX(1) rotate(0); }
    }
    @keyframes avatar-hurt {
      0%   { transform: translateX(0) rotate(0); filter: brightness(1); }
      20%  { transform: translateX(-12px) rotate(-8deg); filter: brightness(2); }
      40%  { transform: translateX(8px) rotate(5deg); filter: brightness(0.5) hue-rotate(200deg); }
      60%  { transform: translateX(-6px) rotate(-4deg); filter: brightness(1.5); }
      100% { transform: translateX(0) rotate(0); filter: brightness(1); }
    }
    @keyframes avatar-celebrate {
      0%   { transform: scale(1) rotate(0); }
      25%  { transform: scale(1.2) rotate(-10deg); }
      50%  { transform: scale(1.1) rotate(10deg); }
      75%  { transform: scale(1.2) rotate(-5deg); }
      100% { transform: scale(1) rotate(0); }
    }
    @keyframes obst-bob {
      0%,100% { transform: translateY(0px) scale(1); }
      50%     { transform: translateY(-5px) scale(1.05); }
    }
    @keyframes obst-destroy {
      0%   { transform: scale(1) rotate(0); opacity: 1; }
      40%  { transform: scale(1.6) rotate(15deg); opacity: 1; }
      100% { transform: scale(0) rotate(-30deg); opacity: 0; }
    }
    @keyframes tile-glow-pulse {
      0%,100% { box-shadow: 0 0 6px currentColor; }
      50%     { box-shadow: 0 0 20px currentColor; }
    }
  `;
  document.head.appendChild(style);
}

const CSS_ANIM = {
  idle:      "avatar-idle 2s ease-in-out infinite",
  win:       "avatar-celebrate 0.6s ease-in-out 3",
  sad:       "avatar-hurt 0.5s ease-in-out",
  attack:    "avatar-attack 0.4s ease-out",
  retrocede: "avatar-hurt 0.6s ease-in-out",
  celebrate: "avatar-celebrate 1s ease-in-out infinite",
  walk:      "avatar-walk 0.4s ease-in-out infinite",
};

// ─── COMPONENTE PRINCIPAL — Avatar con accesorios adheridos ────
export default function AvatarAnimado({
  avatarId,
  animacion = "idle",
  aciertos = 0,
  inventario = [],
  equipado = {},
  size = 80,
}) {
  const avatar = AVATARES.find(a => a.id === avatarId) || AVATARES[0];
  const [mensajeFlotante, setMensajeFlotante] = useState(null);
  const [particulas, setParticulas] = useState([]);
  const prevAciertos = useRef(aciertos);

  const itemCabeza    = equipado.cabeza    ? TIENDA_ITEMS.find(i => i.id === equipado.cabeza)    : null;
  const itemArma      = equipado.arma      ? TIENDA_ITEMS.find(i => i.id === equipado.arma)      : null;
  const itemAccesorio = equipado.accesorio ? TIENDA_ITEMS.find(i => i.id === equipado.accesorio) : null;

  useEffect(() => {
    if (aciertos > prevAciertos.current) {
      const msgs = ["¡Sigue así! 🔥", "¡Avanzas! ⬆️", "¡Correcto! ⚡", "¡Genial! ⭐", "¡Eso es! 🎯"];
      setMensajeFlotante(msgs[Math.floor(Math.random() * msgs.length)]);
      setParticulas(Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 100,
        y: -(30 + Math.random() * 50),
        color: ["#FFD700","#00f5ff","#ff006e","#39ff14","#ff9f00"][i % 5],
      })));
      setTimeout(() => { setMensajeFlotante(null); setParticulas([]); }, 1400);
    } else if (aciertos < prevAciertos.current) {
      setMensajeFlotante("¡Cuidado! 😰");
      setTimeout(() => setMensajeFlotante(null), 1000);
    }
    prevAciertos.current = aciertos;
  }, [aciertos]);

  const cssAnim = CSS_ANIM[animacion] || CSS_ANIM.idle;

  return (
    <div style={{ position: "relative", display: "inline-block", textAlign: "center" }}>

      {/* Mensaje flotante */}
      <AnimatePresence>
        {mensajeFlotante && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -48, scale: 1 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20,
              padding: "5px 14px", whiteSpace: "nowrap",
              fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800,
              color: "#fff", zIndex: 20, pointerEvents: "none",
              boxShadow: "0 4px 20px rgba(0,245,255,0.3)",
            }}
          >
            {mensajeFlotante}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Partículas */}
      {particulas.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: 0.2 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            position: "absolute", top: "30%", left: "50%",
            width: 10, height: 10, borderRadius: "50%",
            background: p.color, boxShadow: `0 0 6px ${p.color}`,
            pointerEvents: "none", zIndex: 15,
          }}
        />
      ))}

      {/* ── Ensamblaje del personaje estilo videojuego ── */}
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>

        {/* SOMBRERO — pegado a la cabeza con margen negativo (encima del emoji) */}
        {itemCabeza && (
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              fontSize: size * 0.52,
              lineHeight: 1,
              marginBottom: -(size * 0.2),   // overlap: el sombrero cae sobre la cabeza
              zIndex: 2,
              position: "relative",
              filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.9))",
            }}
          >
            {itemCabeza.emoji}
          </motion.div>
        )}

        {/* FILA CUERPO: escudo | avatar | arma */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>

          {/* ESCUDO / ACCESORIO — lado izquierdo a la altura del cuerpo */}
          <div style={{ width: itemAccesorio ? size * 0.44 : 0, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
            {itemAccesorio && (
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, -5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  fontSize: size * 0.48,
                  marginRight: -(size * 0.06),  // toca el borde del avatar
                  filter: "drop-shadow(0 0 8px rgba(0,245,255,0.7))",
                  zIndex: 2, position: "relative",
                }}
              >
                {itemAccesorio.emoji}
              </motion.div>
            )}
          </div>

          {/* CUERPO PRINCIPAL — avatar con su animación */}
          <div
            style={{
              fontSize: size, lineHeight: 1, display: "inline-block",
              filter: `drop-shadow(0 0 ${size * 0.22}px ${avatar.color})`,
              animation: cssAnim,
              transformOrigin: "bottom center",
              willChange: "transform",
              position: "relative", zIndex: 1,
            }}
          >
            {avatar.emoji}
          </div>

          {/* ARMA — lado derecho a la altura del cuerpo */}
          <div style={{ width: itemArma ? size * 0.48 : 0, display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
            {itemArma && (
              <motion.div
                animate={animacion === "attack"
                  ? { rotate: [-20, 50], x: [0, 18], scale: [1, 1.3] }
                  : { rotate: [0, 12, 0] }
                }
                transition={animacion === "attack"
                  ? { duration: 0.35 }
                  : { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }
                style={{
                  fontSize: size * 0.54,
                  marginLeft: -(size * 0.04),   // toca el borde del avatar
                  filter: "drop-shadow(0 0 10px rgba(255,214,0,0.9))",
                  transformOrigin: "bottom center",
                  zIndex: 2, position: "relative",
                }}
              >
                {itemArma.emoji}
              </motion.div>
            )}
          </div>
        </div>

        {/* SOMBRA */}
        <motion.div
          animate={animacion === "sad" || animacion === "retrocede"
            ? { scaleX: 0.55, opacity: 0.2 }
            : { scaleX: 1, opacity: 0.35 }
          }
          transition={{ duration: 0.35 }}
          style={{
            width: size * 0.7, height: 8, marginTop: 2,
            background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
      </div>
    </div>
  );
}

// ─── CAMINO SNAKE ESTILO MINECRAFT — 2 FILAS × 5 TILES ─────────
export function CaminoAvatar({ avatarId, aciertos, inventario, equipado, mundoId = 0 }) {
  const avatar = AVATARES.find(a => a.id === avatarId) || AVATARES[0];
  const obstaculos = OBSTACULOS_MUNDO[Math.min(mundoId, OBSTACULOS_MUNDO.length - 1)];

  // Mini accesorios en el avatar del camino
  const itemCabeza = equipado?.cabeza ? TIENDA_ITEMS.find(i => i.id === equipado.cabeza) : null;
  const itemArma   = equipado?.arma   ? TIENDA_ITEMS.find(i => i.id === equipado.arma)   : null;

  const prevAciertos = useRef(aciertos);
  const [recienCompletado, setRecienCompletado] = useState(-1);
  const [posAvatar, setPosAvatar] = useState(aciertos);
  const [saltando, setSaltando] = useState(false);

  useEffect(() => {
    if (aciertos > prevAciertos.current) {
      const sq = aciertos - 1;
      setRecienCompletado(sq);
      setSaltando(true);
      setTimeout(() => { setRecienCompletado(-1); setSaltando(false); }, 700);
      // Movimiento suave: posición intermedia → posición final
      setPosAvatar(aciertos - 0.5);
      setTimeout(() => setPosAvatar(aciertos), 380);
    }
    prevAciertos.current = aciertos;
  }, [aciertos]);

  // ── Layout snake: fila 0 = tiles 0-4 (izq→der), fila 1 = tiles 5-9 (der→izq) ──
  const TILE_W = 48;
  const TILE_H = 26;
  const OBST_ZONE = 38;  // altura para el obstáculo encima del tile
  const COLS = 5;

  // Devuelve {row, colDisplay} para posicionar en la cuadrícula visual
  // Row 0: tile 0 en col 0, tile 4 en col 4
  // Row 1: tile 5 en col 4, tile 9 en col 0 (camino invertido)
  const getPos = (idx) => {
    if (idx < COLS) return { row: 0, col: idx };
    return { row: 1, col: COLS - 1 - (idx - COLS) };
  };

  const renderTile = (i) => {
    const { row, col } = getPos(i);
    const completa = i < aciertos;
    const esActual = i === Math.floor(posAvatar);
    const obstEmoji = obstaculos[i] || "❓";
    const fueDestruida = recienCompletado === i;

    return (
      <div
        key={i}
        style={{
          gridRow: row + 1,
          gridColumn: col + 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          height: OBST_ZONE + TILE_H + 4,
          width: TILE_W,
        }}
      >
        {/* Obstáculo / Estrella / Avatar encima del tile */}
        <div style={{
          position: "absolute", top: 0,
          left: "50%", transform: "translateX(-50%)",
          height: OBST_ZONE,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          width: TILE_W + 10,
        }}>

          {/* Obstáculo destruido → explosión */}
          {fueDestruida && (
            <motion.span
              initial={{ scale: 0.8, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0, rotate: 20 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              style={{ fontSize: 22, display: "inline-block", lineHeight: 1 }}
            >
              💥
            </motion.span>
          )}

          {/* Casilla completada → estrella */}
          {!fueDestruida && completa && (
            <motion.span
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 12 }}
              style={{ fontSize: 14, lineHeight: 1 }}
            >
              ⭐
            </motion.span>
          )}

          {/* Obstáculo activo (tile pendiente sin avatar) */}
          {!fueDestruida && !completa && !esActual && (
            <motion.div
              animate={{ y: [0, -5, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 1.1 + i * 0.07, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 24, lineHeight: 1, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
            >
              {obstEmoji}
            </motion.div>
          )}

          {/* Avatar sobre la casilla actual — con sombrero y arma mini */}
          {esActual && (
            <motion.div
              animate={saltando
                ? { y: [-4, -22, -4], rotate: [0, -8, 8, 0] }
                : { y: [-4, -12, -4] }
              }
              transition={{ duration: saltando ? 0.5 : 0.9, ease: "easeInOut", repeat: saltando ? 0 : Infinity }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}
            >
              {/* Sombrero mini — encima del avatar mini */}
              {itemCabeza && (
                <div style={{
                  fontSize: 13, lineHeight: 1,
                  marginBottom: -4, zIndex: 2, position: "relative",
                  filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))",
                }}>
                  {itemCabeza.emoji}
                </div>
              )}

              {/* Avatar + arma en fila */}
              <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                <div style={{
                  fontSize: 24, lineHeight: 1,
                  filter: `drop-shadow(0 0 8px ${avatar.color})`,
                  animation: "avatar-walk 0.4s ease-in-out infinite",
                  transformOrigin: "bottom center",
                }}>
                  {avatar.emoji}
                </div>
                {itemArma && (
                  <div style={{
                    fontSize: 13, lineHeight: 1,
                    filter: "drop-shadow(0 0 5px rgba(255,214,0,0.9))",
                  }}>
                    {itemArma.emoji}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* TILE — estilo bloque Minecraft */}
        <motion.div
          animate={esActual
            ? { boxShadow: [`0 0 10px ${avatar.color}`, `0 0 24px ${avatar.color}`, `0 0 10px ${avatar.color}`] }
            : {}
          }
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{
            width: TILE_W, height: TILE_H,
            borderRadius: "4px 4px 2px 2px",
            position: "relative",
            overflow: "hidden",
            border: `2px solid ${completa ? "#66bb6a88" : esActual ? avatar.color : "rgba(255,255,255,0.1)"}`,
            // Bloque Minecraft: cara superior (hierba/color) + cara inferior (tierra)
            background: completa
              ? "linear-gradient(180deg, #56c75e 0%, #4caf50 42%, #6d4c41 42%, #5d4037 100%)"
              : esActual
              ? `linear-gradient(180deg, ${avatar.color}99 0%, ${avatar.color}66 42%, ${avatar.color}33 42%, ${avatar.color}18 100%)`
              : "linear-gradient(180deg, #37474f 0%, #2e3f47 42%, #1c2b33 42%, #12202a 100%)",
          }}
        >
          {/* Número de casilla */}
          <div style={{
            position: "absolute", top: 1, left: 2,
            fontFamily: "Orbitron, monospace",
            fontSize: 7, color: "rgba(255,255,255,0.35)", lineHeight: 1,
            fontWeight: 700,
          }}>
            {i + 1}
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div style={{ padding: "0 0 4px", userSelect: "none" }}>

      {/* Grid snake 5×2 con flecha conectora */}
      <div style={{ position: "relative" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${TILE_W}px)`,
          gridTemplateRows: `${OBST_ZONE + TILE_H + 4}px ${OBST_ZONE + TILE_H + 4}px`,
          gap: "4px 4px",
          justifyContent: "center",
          margin: "0 auto",
        }}>
          {CASILLA_POSITIONS.map(i => renderTile(i))}
        </div>

        {/* Flecha conectora derecha → baja → izquierda (entre fila 0 y fila 1) */}
        <div style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          fontSize: 13,
          color: "rgba(255,255,255,0.3)",
          lineHeight: 1,
          pointerEvents: "none",
        }}>
          <span>↓</span>
        </div>
      </div>

      {/* Indicador de progreso debajo del camino */}
      <div style={{
        textAlign: "center", fontFamily: "Nunito, sans-serif",
        fontSize: 11, marginTop: 6,
        color: aciertos >= 10 ? "#FFD700" : "rgba(255,255,255,0.45)",
        fontWeight: aciertos >= 10 ? 800 : 400,
        letterSpacing: aciertos >= 10 ? 1 : 0,
      }}>
        {aciertos === 0 && "¡Responde correctamente para avanzar y destruir obstáculos! ⚔️"}
        {aciertos > 0 && aciertos < 10 && `⭐ ${aciertos}/10 — ¡${10 - aciertos} obstáculos más para el BOSS! 💪`}
        {aciertos >= 10 && "⚔️ ¡¡¡EL BOSS TE ESPERA!!! ¡PREPÁRATE! 👑"}
      </div>
    </div>
  );
}
