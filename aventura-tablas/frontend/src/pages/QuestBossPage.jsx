import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

const MUNDOS_QUEST = [
  { nombre:"Torre del Saber",          bossNombre:"Guardián de Piedra", bossEmoji:"🗿", color:"#8E44AD", vidaMax:3 },
  { nombre:"Bosque Encantado",          bossNombre:"Lobo Sabio",         bossEmoji:"🐺", color:"#27AE60", vidaMax:4 },
  { nombre:"Volcán del Conocimiento",   bossNombre:"Dragón Erudito",     bossEmoji:"🐉", color:"#E74C3C", vidaMax:5 },
  { nombre:"Castillo de las Estrellas", bossNombre:"Rey Oscuro",          bossEmoji:"👑", color:"#F39C12", vidaMax:5 },
  { nombre:"Gran Torneo Final",         bossNombre:"El Gran Maestro",    bossEmoji:"🧙", color:"#3498DB", vidaMax:6 },
];

export default function QuestBossPage() {
  const {
    licencia, setPagina,
    questGuiaActual, questDiaActual, setQuestFaseActual,
  } = useGameStore(s => ({
    licencia: s.licencia, setPagina: s.setPagina,
    questGuiaActual: s.questGuiaActual, questDiaActual: s.questDiaActual,
    setQuestFaseActual: s.setQuestFaseActual,
  }));

  const mundo = MUNDOS_QUEST[(questDiaActual - 1) % MUNDOS_QUEST.length] || MUNDOS_QUEST[0];
  const guiaId = questGuiaActual?.id;

  const [preguntas, setPreguntas] = useState([]);
  const [preguntaIdx, setPreguntaIdx] = useState(0);
  const [vidaBoss, setVidaBoss] = useState(mundo.vidaMax);
  const [vidaJugador, setVidaJugador] = useState(3);
  const [respuestaDada, setRespuestaDada] = useState(null);
  const [fase, setFase] = useState("entrada");   // entrada|batalla|victoria|derrota
  const [feedback, setFeedback] = useState(null);
  const [modoInput, setModoInput] = useState("");
  const [monedas, setMonedas] = useState(0);

  const bloqueado = useRef(false);

  useEffect(() => {
    if (!guiaId) { setPagina("quest_menu"); return; }
    cargarPreguntas();
  }, []);

  const cargarPreguntas = async () => {
    try {
      const res = await axios.get(`${API}/quest/guia/${guiaId}/dia/${questDiaActual}`);
      // Usar las preguntas más difíciles (dificultad 2-3)
      const todas = res.data.preguntas || [];
      const dificiles = todas.filter(p => p.dificultad >= 2);
      const usarPreguntas = dificiles.length >= 3 ? dificiles : todas;
      setPreguntas(usarPreguntas.sort(() => Math.random() - 0.5));
      // Pequeño delay para la animación de entrada
      setTimeout(() => setFase("batalla"), 2500);
    } catch (e) {
      setPreguntas([]);
      setTimeout(() => setFase("batalla"), 2500);
    }
  };

  const responder = async (respuesta) => {
    if (bloqueado.current || fase !== "batalla") return;
    bloqueado.current = true;
    setRespuestaDada(respuesta);

    const p = preguntas[preguntaIdx % preguntas.length];
    if (!p) { bloqueado.current = false; return; }

    const correcta = respuesta !== null && (
      respuesta === p.respuesta_correcta ||
      respuesta?.toLowerCase()?.trim() === p.respuesta_correcta?.toLowerCase()?.trim()
    );

    if (correcta) {
      const nuevaVida = vidaBoss - 1;
      setVidaBoss(nuevaVida);
      setMonedas(m => m + 20);
      setFeedback("correcto");
      toast.success(`⚔️ ¡Golpe al ${mundo.bossNombre}!`, { duration: 900 });

      if (nuevaVida <= 0) {
        setTimeout(async () => {
          bloqueado.current = false;
          await guardarProgreso(true);
          setFase("victoria");
        }, 1200);
        return;
      }
    } else {
      const nuevaVidaJ = vidaJugador - 1;
      setVidaJugador(nuevaVidaJ);
      setFeedback("incorrecto");

      if (p.id) {
        try {
          await axios.post(`${API}/quest/error`, {
            licencia_alumno: licencia, guia_id: guiaId,
            pregunta_id: p.id, respuesta_dada: respuesta || "tiempo",
          });
        } catch(e) {}
      }

      if (nuevaVidaJ <= 0) {
        setTimeout(async () => {
          bloqueado.current = false;
          await guardarProgreso(false);
          setFase("derrota");
        }, 1200);
        return;
      }
    }

    setTimeout(() => {
      setFeedback(null);
      setRespuestaDada(null);
      setModoInput("");
      bloqueado.current = false;
      setPreguntaIdx(i => (i + 1) % Math.max(preguntas.length, 1));
    }, 1500);
  };

  const guardarProgreso = async (gano) => {
    try {
      await axios.post(`${API}/quest/progreso`, {
        licencia_alumno: licencia, guia_id: guiaId, dia: questDiaActual,
        fase: "boss", completado: gano ? 1 : 0,
        puntaje: gano ? 100 + monedas : monedas,
        errores: mundo.vidaMax - vidaBoss, tiempo_segundos: 0,
      });
    } catch(e) {}
  };

  const preguntaActual = preguntas.length > 0
    ? preguntas[preguntaIdx % preguntas.length]
    : null;

  const bgStyle = {
    minHeight: "100vh",
    background: `radial-gradient(ellipse at center, ${mundo.color}33 0%, #0D0221 70%)`,
    color: "#fff",
    fontFamily: "'Nunito', sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "20px",
  };

  // ENTRADA
  if (fase === "entrada") return (
    <div style={bgStyle}>
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        style={{ fontSize: "120px", marginBottom: "16px" }}
      >{mundo.bossEmoji}</motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          fontFamily: "'Orbitron', sans-serif",
          color: mundo.color,
          fontSize: "clamp(1.2rem, 4vw, 2rem)",
          textAlign: "center",
        }}
      >¡{mundo.bossNombre} aparece!</motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        style={{ color: "#aaa", marginTop: "8px" }}
      >Prepárate para el combate...</motion.p>
    </div>
  );

  // VICTORIA
  if (fase === "victoria") return (
    <div style={bgStyle}>
      <motion.div
        animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
        transition={{ repeat: 2, duration: 0.5 }}
        style={{ fontSize: "100px", marginBottom: "16px" }}
      >🏆</motion.div>
      <motion.h2
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        style={{ fontFamily: "'Orbitron', sans-serif", color: "#FFD700",
                 fontSize: "clamp(1.4rem, 4vw, 2.2rem)", textAlign: "center" }}
      >¡{mundo.bossNombre} Derrotado!</motion.h2>
      <p style={{ color: "#2ECC71", margin: "8px 0 4px" }}>
        🪙 +{100 + monedas} monedas ganadas
      </p>
      <p style={{ color: "#aaa", fontSize: "0.9rem", marginBottom: "24px" }}>
        ¡Día {questDiaActual} completado! 🎉
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => {
            setQuestFaseActual("estudio");
            // Si hay más días, ir al siguiente
            setPagina("quest_menu");
          }}
          style={{
            background: "linear-gradient(135deg, #FFD700, #E67E22)",
            color: "#000", border: "none", borderRadius: "12px",
            padding: "14px 28px", fontSize: "1.1rem", fontWeight: "bold",
            cursor: "pointer",
          }}
        >🗺️ Siguiente Día →</motion.button>
        <button
          onClick={() => setPagina("quest_menu")}
          style={{
            background: "rgba(255,255,255,0.1)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px",
            padding: "14px 24px", fontSize: "1rem", cursor: "pointer",
          }}
        >📋 Ver Progreso</button>
      </div>
    </div>
  );

  // DERROTA
  if (fase === "derrota") return (
    <div style={bgStyle}>
      <div style={{ fontSize: "80px", marginBottom: "16px" }}>💀</div>
      <h2 style={{ fontFamily: "'Orbitron', sans-serif", color: "#E74C3C", textAlign: "center" }}>
        El {mundo.bossNombre} ganó...
      </h2>
      <p style={{ color: "#aaa", margin: "8px 0 24px" }}>¡Repasa y vuelve más fuerte!</p>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={() => { setVidaBoss(mundo.vidaMax); setVidaJugador(3);
                           setPreguntaIdx(0); setMonedas(0); setFase("batalla");
                           bloqueado.current = false; setRespuestaDada(null); setFeedback(null); }}
          style={{ background: "linear-gradient(135deg,#E74C3C,#C0392B)", color: "#fff",
                   border: "none", borderRadius: "10px", padding: "12px 24px", cursor: "pointer" }}
        >🔄 Reintentar</button>
        <button
          onClick={() => setPagina("quest_estudio")}
          style={{ background: "rgba(255,255,255,0.1)", color: "#fff",
                   border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px",
                   padding: "12px 24px", cursor: "pointer" }}
        >📚 Repasar</button>
      </div>
    </div>
  );

  // BATALLA
  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at top, ${mundo.color}44 0%, #0D0221 60%)`,
      color: "#fff", fontFamily: "'Nunito', sans-serif", padding: "16px",
    }}>
      {/* HUD Boss */}
      <div style={{ maxWidth: "520px", margin: "0 auto" }}>

        {/* Vida del Boss */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between",
                        color: "#aaa", fontSize: "0.85rem", marginBottom: "4px" }}>
            <span>{mundo.bossEmoji} {mundo.bossNombre}</span>
            <span>❤️ {vidaBoss}/{mundo.vidaMax}</span>
          </div>
          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: "8px",
                        height: "12px", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${(vidaBoss / mundo.vidaMax) * 100}%` }}
              transition={{ duration: 0.4 }}
              style={{ height: "100%", background: mundo.color, borderRadius: "8px" }}
            />
          </div>
        </div>

        {/* Boss animado */}
        <motion.div
          animate={feedback === "correcto"
            ? { x: [0, 20, -20, 10, 0], filter: ["none", "brightness(2)", "none"] }
            : feedback === "incorrecto"
            ? { x: [0, -5, 5, -5, 0] }
            : { y: [0, -8, 0] }}
          transition={{ duration: feedback ? 0.4 : 2, repeat: feedback ? 0 : Infinity }}
          style={{ fontSize: "80px", textAlign: "center", margin: "12px 0" }}
        >{mundo.bossEmoji}</motion.div>

        {/* Vidas del jugador */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "16px" }}>
          {[...Array(3)].map((_, i) => (
            <span key={i} style={{ fontSize: "1.4rem", opacity: i < vidaJugador ? 1 : 0.2 }}>❤️</span>
          ))}
        </div>

        {/* Pregunta */}
        {preguntaActual && (
          <>
            <AnimatePresence mode="wait">
              <motion.div key={preguntaIdx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `2px solid ${mundo.color}66`,
                  borderRadius: "14px", padding: "18px",
                  textAlign: "center", marginBottom: "14px",
                }}
              >
                <p style={{ fontSize: "1.05rem", fontWeight: "bold", lineHeight: 1.5 }}>
                  {preguntaActual.pregunta}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Opciones */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {["a","b","c","d"].map(c => {
                const texto = preguntaActual[`opcion_${c}`];
                if (!texto) return null;
                const esCorrecta = c === preguntaActual.respuesta_correcta
                  || texto === preguntaActual.respuesta_correcta;
                let bg = "rgba(255,255,255,0.07)";
                let border = `${mundo.color}44`;
                if (respuestaDada !== null) {
                  if (esCorrecta) { bg = "rgba(46,204,113,0.2)"; border = "#2ECC71"; }
                  else if (respuestaDada === c) { bg = "rgba(231,76,60,0.2)"; border = "#E74C3C"; }
                }
                return (
                  <motion.button key={c}
                    whileHover={respuestaDada === null ? { scale: 1.04 } : {}}
                    whileTap={respuestaDada === null ? { scale: 0.96 } : {}}
                    onClick={() => responder(c)}
                    disabled={respuestaDada !== null}
                    style={{
                      background: bg, border: `2px solid ${border}`,
                      borderRadius: "10px", padding: "12px 10px",
                      color: "#fff", cursor: respuestaDada !== null ? "default" : "pointer",
                      fontSize: "0.9rem", textAlign: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    <b style={{ color: mundo.color }}>{c.toUpperCase()}.</b> {texto}
                  </motion.button>
                );
              })}
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    textAlign: "center", marginTop: "12px", padding: "10px",
                    borderRadius: "8px",
                    background: feedback === "correcto" ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
                    color: feedback === "correcto" ? "#2ECC71" : "#E74C3C",
                    fontWeight: "bold",
                  }}
                >
                  {feedback === "correcto" ? "⚔️ ¡Golpe!" : `💥 Fallo! Era: ${preguntaActual.respuesta_correcta}`}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {preguntas.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <p style={{ color: "#aaa" }}>No hay preguntas disponibles</p>
            <button onClick={() => setPagina("quest_menu")}
                    style={{ background: "#6C3483", color: "#fff", border: "none",
                             borderRadius: "8px", padding: "10px 20px", cursor: "pointer", marginTop: "12px" }}>
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
