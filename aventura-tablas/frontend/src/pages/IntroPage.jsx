import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../utils/store";
import soundManager from "../utils/sounds";
import voiceManager from "../utils/voice";

const SCENES = [
  {
    id: 0,
    bg: "radial-gradient(ellipse at center, #0a001f 0%, #030010 90%)",
    emoji: "🌍",
    titulo: "En el Reino de los Números",
    texto: "Existía un mundo mágico donde los números daban vida a todo...",
    color: "#00f5ff",
    voz: "Hubo una vez... un Reino mágico y poderoso. Un lugar donde los números daban vida a todo lo que existía. Un lugar de maravillas... y de peligros.",
    vozParams: { velocidad: 0.80, tono: 1.05 },
    particulas: ["⭐","✨","💫","🌟"],
    minMs: 4500,
  },
  {
    id: 1,
    bg: "radial-gradient(ellipse at center, #200005 0%, #030010 90%)",
    emoji: "😈",
    titulo: "¡¡LOS MONSTRUOS INVADIERON!!",
    texto: "¡Terribles bestias tomaron control de CADA mundo! ¡El caos y el terror se apoderaron del reino!",
    color: "#ff006e",
    voz: "¡Pero entonces... llegaron LOS MONSTRUOS! ¡Bestias terribles y aterradoras invadieron TODOS los mundos! ¡El caos, el pánico y la oscuridad se apoderaron del reino! ¡Nadie podía detenerlos!",
    vozParams: { velocidad: 0.78, tono: 0.70 },
    particulas: ["🔥","💀","⚡","🌋"],
    bosses: ["🐗","🦈","🐉","👹","🦇","🌪️","🤖","👾","🐲","🦑"],
    minMs: 5500,
  },
  {
    id: 2,
    bg: "radial-gradient(ellipse at center, #001520 0%, #030010 90%)",
    emoji: "⚔️",
    titulo: "¡¡SE NECESITA UN HÉROE!!",
    texto: "Solo un guerrero valiente puede salvar el reino. ¡¡Y ese campeón increíble... ERES TÚ!!",
    color: "#FFD700",
    voz: "¡El reino necesita un HÉROE! ¡Un campeón valiente, poderoso e inteligente! ¡Alguien capaz de enfrentar a todos los monstruos y GANAR! ¡Y ese héroe increíble... eres TÚ! ¡TÚ puedes salvar a todos!",
    vozParams: { velocidad: 1.05, tono: 1.55 },
    particulas: ["🦁","🦊","🤖","🐲","🦖","🦄"],
    heroico: true,
    minMs: 5000,
  },
  {
    id: 3,
    bg: "radial-gradient(ellipse at center, #001a00 0%, #030010 90%)",
    emoji: "📚",
    titulo: "¡Tu ARMA SECRETA: Las Tablas!",
    texto: "Para vencer a cada monstruo debes dominar las tablas del 1 al 10. ¡Son tu superpoder!",
    color: "#39ff14",
    voz: "¿Y cuál es tu arma secreta? ¡Las TABLAS DE MULTIPLICAR! ¡Aprende del uno al diez y ningún monstruo podrá contigo! ¡Cada tabla que domines te hace más poderoso! ¡Son tu superpoder definitivo!",
    vozParams: { velocidad: 0.98, tono: 1.35 },
    nums: ["1×1","2×3","5×7","3×4","8×9","6×6","4×7","9×3"],
    minMs: 5000,
  },
  {
    id: 4,
    bg: "radial-gradient(ellipse at center, #1a0a00 0%, #030010 90%)",
    emoji: "🚀",
    titulo: "¡¡LA AVENTURA COMIENZA AHORA!!",
    texto: "¡Elige tu héroe, domina las tablas y salva el Reino de los Números!",
    color: "#ff9f00",
    voz: "¡¡YA LLEGÓ EL MOMENTO!! ¡Elige a tu héroe! ¡Aprende las tablas! ¡Y salva al reino de los monstruos! ¡La aventura más épica e increíble... comienza AHORA MISMO!",
    vozParams: { velocidad: 1.10, tono: 1.60 },
    final: true,
    minMs: 4500,
  },
];

export default function IntroPage() {
  const { setPagina } = useGameStore();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    soundManager.iniciarMusica();
  }, []);

  // Cada escena espera a que el audio termine antes de avanzar — sin pausas
  useEffect(() => {
    if (sceneIdx >= SCENES.length) return;
    let cancelled = false;
    const s = SCENES[sceneIdx];
    const minMs = s.minMs || 4000;

    setProgreso(0);

    const run = async () => {
      // Barra de progreso basada en el tiempo mínimo
      const TICK = 40;
      const steps = minMs / TICK;
      let step = 0;
      const bar = setInterval(() => {
        step++;
        setProgreso(Math.min(99, (step / steps) * 100));
        if (step >= steps) clearInterval(bar);
      }, TICK);

      // Audio y tiempo mínimo en paralelo — avanza cuando ambos terminan
      await Promise.all([
        voiceManager.hablarYEsperar(s.voz, s.vozParams || {}),
        new Promise(r => setTimeout(r, minMs)),
      ]);

      clearInterval(bar);
      if (cancelled) return;
      setProgreso(100);
      // Pequeña pausa de corte limpio antes de cambiar escena
      await new Promise(r => setTimeout(r, 180));
      if (!cancelled && sceneIdx < SCENES.length - 1) {
        setSceneIdx(i => i + 1);
      }
    };

    run();

    return () => {
      cancelled = true;
      voiceManager.detener();
    };
  }, [sceneIdx]);

  const saltar = () => {
    voiceManager.detener();
    setPagina("seleccion_avatar");
  };

  const avanzar = () => {
    voiceManager.detener();
    setTimeout(() => {
      if (sceneIdx < SCENES.length - 1) setSceneIdx(i => i + 1);
      else saltar();
    }, 60);
  };

  const scene = SCENES[sceneIdx];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: scene.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", transition: "background 1s",
    }}>

      {/* Partículas de fondo */}
      <ParticleField emojis={scene.particulas || ["⭐","✨"]} />

      {/* Escena */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 1.02 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            textAlign: "center", padding: "0 24px",
            maxWidth: 700, width: "100%", zIndex: 10,
          }}
        >
          {/* Emoji principal */}
          <motion.div
            animate={{
              scale: [1, 1.08, 1],
              rotate: scene.heroico ? [0, -5, 5, 0] : [0, 0, 0],
              filter: [
                `drop-shadow(0 0 20px ${scene.color})`,
                `drop-shadow(0 0 60px ${scene.color})`,
                `drop-shadow(0 0 20px ${scene.color})`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: "clamp(80px,15vw,130px)", lineHeight: 1, marginBottom: 24 }}
          >
            {scene.emoji}
          </motion.div>

          {/* Bosses volando (escena 1) */}
          {scene.bosses && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              {scene.bosses.map((b, i) => (
                <motion.div key={i}
                  initial={{ x: -100, y: Math.random() * 80 + 10 + "%" }}
                  animate={{ x: "110vw" }}
                  transition={{ duration: 3 + i * 0.4, delay: i * 0.3, ease: "linear", repeat: Infinity }}
                  style={{ position: "absolute", fontSize: 36, opacity: 0.7 }}
                >
                  {b}
                </motion.div>
              ))}
            </div>
          )}

          {/* Números flotando (escena 3) */}
          {scene.nums && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              {scene.nums.map((n, i) => (
                <motion.div key={i}
                  animate={{
                    y: [Math.random() * 80 + "%", Math.random() * 60 + "%"],
                    x: [Math.random() * 80 + "%", Math.random() * 80 + "%"],
                    rotate: [0, 360],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute",
                    fontFamily: "Orbitron, monospace", fontSize: "clamp(14px,3vw,22px)",
                    fontWeight: 900, color: scene.color, opacity: 0.5,
                  }}
                >
                  {n}
                </motion.div>
              ))}
            </div>
          )}

          {/* Título */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              fontFamily: "Orbitron, monospace",
              fontSize: "clamp(20px,5vw,38px)",
              fontWeight: 900,
              color: scene.color,
              textShadow: `0 0 30px ${scene.color}99`,
              marginBottom: 16,
              letterSpacing: 2,
            }}
          >
            {scene.titulo}
          </motion.h1>

          {/* Texto */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{
              fontFamily: "Nunito, sans-serif",
              fontSize: "clamp(15px,3vw,22px)",
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.6,
              marginBottom: 40,
              maxWidth: 560,
              margin: "0 auto 40px",
            }}
          >
            {scene.texto}
          </motion.p>

          {/* Botón final */}
          {scene.final && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.95 }}
              onClick={saltar}
              style={{
                background: `linear-gradient(135deg, ${scene.color}, #ff9f00)`,
                border: "none", borderRadius: 20,
                color: "#000", fontFamily: "Orbitron, monospace",
                fontSize: "clamp(16px,4vw,24px)", fontWeight: 900,
                padding: "18px 48px", cursor: "pointer",
                boxShadow: `0 8px 40px ${scene.color}88`,
                letterSpacing: 2,
              }}
            >
              🦁 ¡ELEGIR MI HÉROE!
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Barra de progreso de la escena */}
      <div style={{
        position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
        width: "min(400px, 80vw)", zIndex: 20,
      }}>
        <div style={{
          display: "flex", gap: 6, justifyContent: "center", marginBottom: 10,
        }}>
          {SCENES.map((s, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: i <= sceneIdx ? scene.color : "rgba(255,255,255,0.2)",
              transition: "background 0.4s",
              boxShadow: i === sceneIdx ? `0 0 8px ${scene.color}` : "none",
            }} />
          ))}
        </div>
        <div style={{
          width: "100%", height: 3, background: "rgba(255,255,255,0.1)",
          borderRadius: 2, overflow: "hidden",
        }}>
          <motion.div
            animate={{ width: `${progreso}%` }}
            style={{ height: "100%", background: scene.color, borderRadius: 2 }}
          />
        </div>
      </div>

      {/* Controles */}
      <div style={{
        position: "fixed", bottom: 24,
        display: "flex", gap: 12, zIndex: 20,
      }}>
        <button onClick={saltar}
          style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.5)", borderRadius: 12, padding: "8px 20px",
            fontFamily: "Nunito, sans-serif", fontSize: 13, cursor: "pointer",
          }}>
          ⏩ Saltar
        </button>
        {sceneIdx < SCENES.length - 1 && (
          <button onClick={avanzar}
            style={{
              background: `rgba(${scene.color === "#00f5ff" ? "0,245,255" : scene.color === "#ff006e" ? "255,0,110" : "255,214,0"},0.15)`,
              border: `1px solid ${scene.color}66`,
              color: scene.color, borderRadius: 12, padding: "8px 20px",
              fontFamily: "Nunito, sans-serif", fontSize: 13, cursor: "pointer",
            }}>
            Siguiente ▶
          </button>
        )}
      </div>
    </div>
  );
}

function ParticleField({ emojis }) {
  const particles = React.useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 18 + 10,
      dur: Math.random() * 4 + 3,
      delay: Math.random() * 4,
    })), [emojis]
  );
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map(p => (
        <motion.div key={p.id}
          style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, fontSize: p.size, opacity: 0.15 }}
          animate={{ opacity: [0.05, 0.25, 0.05], y: [0, -20, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}
