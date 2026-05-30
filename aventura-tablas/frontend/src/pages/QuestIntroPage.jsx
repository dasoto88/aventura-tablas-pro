import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../utils/store";
import soundManager from "../utils/sounds";
import voiceManager from "../utils/voice";

const SCENES = [
  {
    id: 0,
    bg: "radial-gradient(ellipse at center, #1a0035 0%, #030010 90%)",
    emoji: "📚",
    titulo: "El Reino del Saber",
    texto: "Existe un lugar misterioso donde el conocimiento es el poder más grande del universo...",
    color: "#9B59B6",
    voz: "Existe un lugar misterioso... el Reino del Saber. Un lugar donde el conocimiento es el arma más poderosa del universo. Quien aprende... ¡conquista todo!",
    vozParams: { velocidad: 0.80, tono: 1.05 },
    particulas: ["📚","⭐","✨","💫","📖"],
    minMs: 4500,
  },
  {
    id: 1,
    bg: "radial-gradient(ellipse at center, #1a0500 0%, #030010 90%)",
    emoji: "🐉",
    titulo: "¡¡LOS GUARDIANES DEL OLVIDO!!",
    texto: "¡Bestias terribles roban el conocimiento de los niños! ¡El Gran Maestro necesita campeones valientes!",
    color: "#E74C3C",
    voz: "¡Pero llegaron los GUARDIANES DEL OLVIDO! ¡Monstruos terribles que roban el conocimiento de los niños! ¡Dragones, lobos y reyes oscuros invaden el reino! ¡El Gran Maestro necesita campeones!",
    vozParams: { velocidad: 0.78, tono: 0.70 },
    particulas: ["🔥","💀","⚡","🌋"],
    bosses: ["🗿","🐺","🐉","👑","🧙","🌑","👹","🦇","🦑","🌪️"],
    minMs: 5500,
  },
  {
    id: 2,
    bg: "radial-gradient(ellipse at center, #001a10 0%, #030010 90%)",
    emoji: "⚔️",
    titulo: "¡¡EL GRAN TORNEO COMIENZA!!",
    texto: "¡Solo el estudiante más valiente puede ganar el torneo! ¡Aprende, lucha y demuestra tu inteligencia!",
    color: "#FFD700",
    voz: "¡El Gran Torneo del Saber ha comenzado! ¡Solo el estudiante más valiente e inteligente puede ganar! ¡Aprende los temas, derrota a los guardianes y conviértete en el Campeón del Conocimiento! ¡Y ese campeón... ERES TÚ!",
    vozParams: { velocidad: 1.05, tono: 1.55 },
    particulas: ["🏆","⭐","🥇","✨","💪"],
    heroico: true,
    minMs: 5000,
  },
  {
    id: 3,
    bg: "radial-gradient(ellipse at center, #001520 0%, #030010 90%)",
    emoji: "🧠",
    titulo: "¡Tu SÚPERPODER: Estudiar!",
    texto: "La IA leerá tu guía de estudio y creará mundos para que aprendas jugando. ¡El saber es tu arma!",
    color: "#3498DB",
    voz: "¿Y cuál es tu superpoder? ¡Tu cerebro y las ganas de aprender! La inteligencia artificial leerá tu guía de estudio y creará aventuras increíbles para que aprendas jugando. ¡Cada pregunta que respondas te hace más poderoso!",
    vozParams: { velocidad: 0.98, tono: 1.35 },
    palabras: ["Historia","Ciencias","Español","Matemáticas","Geografía","Biología","Arte","Física"],
    minMs: 5000,
  },
  {
    id: 4,
    bg: "radial-gradient(ellipse at center, #1a0a00 0%, #030010 90%)",
    emoji: "🏆",
    titulo: "¡¡EL TORNEO TE ESPERA!!",
    texto: "¡Elige tu guerrero, sube tu guía de estudio y conquista el Reino del Saber!",
    color: "#FF6B35",
    voz: "¡¡YA ES TU MOMENTO!! ¡Elige a tu guerrero! ¡Sube tu guía de estudio! ¡Y conquista el Gran Torneo del Saber! ¡La aventura más épica del conocimiento... comienza AHORA!",
    vozParams: { velocidad: 1.10, tono: 1.60 },
    final: true,
    minMs: 4500,
  },
];

export default function QuestIntroPage() {
  const { setPagina } = useGameStore();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    soundManager.iniciarMusica();
  }, []);

  useEffect(() => {
    if (sceneIdx >= SCENES.length) return;
    let cancelled = false;
    const s = SCENES[sceneIdx];
    const minMs = s.minMs || 4000;
    setProgreso(0);

    const run = async () => {
      const TICK = 40;
      const steps = minMs / TICK;
      let step = 0;
      const bar = setInterval(() => {
        step++;
        setProgreso(Math.min(99, (step / steps) * 100));
        if (step >= steps) clearInterval(bar);
      }, TICK);

      await Promise.all([
        voiceManager.hablarYEsperar(s.voz, s.vozParams || {}),
        new Promise(r => setTimeout(r, minMs)),
      ]);

      clearInterval(bar);
      if (cancelled) return;
      setProgreso(100);
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
    setPagina("quest_menu");
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

      <ParticleField emojis={scene.particulas || ["⭐","✨"]} />

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
                >{b}</motion.div>
              ))}
            </div>
          )}

          {/* Materias flotando (escena 3) */}
          {scene.palabras && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              {scene.palabras.map((p, i) => (
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
                    fontFamily: "Orbitron, monospace",
                    fontSize: "clamp(11px,2.5vw,18px)",
                    fontWeight: 900, color: scene.color, opacity: 0.45,
                  }}
                >{p}</motion.div>
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
          >{scene.titulo}</motion.h1>

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
          >{scene.texto}</motion.p>

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
                background: `linear-gradient(135deg, ${scene.color}, #FFD700)`,
                border: "none", borderRadius: 20,
                color: "#000", fontFamily: "Orbitron, monospace",
                fontSize: "clamp(16px,4vw,24px)", fontWeight: 900,
                padding: "18px 48px", cursor: "pointer",
                boxShadow: `0 8px 40px ${scene.color}88`,
                letterSpacing: 2,
              }}
            >⚔️ ¡IR AL TORNEO!</motion.button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Barra de progreso de la escena */}
      <div style={{
        position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
        width: "min(400px, 80vw)", zIndex: 20,
      }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10 }}>
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
          }}>⏩ Saltar</button>
        {sceneIdx < SCENES.length - 1 && (
          <button onClick={avanzar}
            style={{
              background: `rgba(255,215,0,0.15)`,
              border: `1px solid ${scene.color}66`,
              color: scene.color, borderRadius: 12, padding: "8px 20px",
              fontFamily: "Nunito, sans-serif", fontSize: 13, cursor: "pointer",
            }}>Siguiente ▶</button>
        )}
        <button
          onClick={() => { voiceManager.detener(); setPagina("selector_juego"); }}
          style={{
            background: "rgba(255,0,110,0.1)", border: "1px solid rgba(255,0,110,0.3)",
            color: "#ff006e", borderRadius: 12, padding: "8px 16px",
            fontFamily: "Nunito, sans-serif", fontSize: 13, cursor: "pointer",
          }}>← Cambiar juego</button>
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
        >{p.emoji}</motion.div>
      ))}
    </div>
  );
}
