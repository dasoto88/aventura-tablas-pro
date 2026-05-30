import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

// Personaje narrador (avatar del día)
const NARRADORES = [
  { emoji: "🧙", nombre: "Mago Erudito", color: "#9B59B6" },
  { emoji: "🦊", nombre: "Zorro Sabio", color: "#E67E22" },
  { emoji: "🦉", nombre: "Búho Maestro", color: "#2980B9" },
  { emoji: "🐉", nombre: "Dragón Estudioso", color: "#27AE60" },
  { emoji: "⭐", nombre: "Estrella Guía", color: "#F1C40F" },
];

export default function QuestEstudioPage() {
  const {
    licencia, nombre, setPagina,
    questGuiaActual, questDiaActual, setQuestFaseActual,
  } = useGameStore(s => ({
    licencia: s.licencia, nombre: s.nombre, setPagina: s.setPagina,
    questGuiaActual: s.questGuiaActual, questDiaActual: s.questDiaActual,
    setQuestFaseActual: s.setQuestFaseActual,
  }));

  const [datosDia, setDatosDia] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [etapa, setEtapa] = useState("intro");       // intro | flashcards | calentamiento | listo
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flashcardVuelta, setFlashcardVuelta] = useState(false);
  const [preguntasCal, setPreguntasCal] = useState([]);
  const [preguntaCalIdx, setPreguntaCalIdx] = useState(0);
  const [respuestaCalDada, setRespuestaCalDada] = useState(null);
  const [aciertoCal, setAciertoCal] = useState(0);

  const narrador = NARRADORES[(questDiaActual - 1) % NARRADORES.length];
  const guiaId = questGuiaActual?.id;

  useEffect(() => {
    if (!guiaId) { setPagina("quest_menu"); return; }
    cargarDia();
  }, []);

  const cargarDia = async () => {
    try {
      const res = await axios.get(`${API}/quest/guia/${guiaId}/dia/${questDiaActual}`);
      setDatosDia(res.data);
      // Tomar 3 preguntas fáciles para calentamiento
      const preg = (res.data.preguntas || []).slice(0, 3);
      setPreguntasCal(preg);
    } catch (e) {
      toast.error("Error al cargar el contenido del día");
    } finally {
      setCargando(false);
    }
  };

  const guardarProgresoEstudio = async () => {
    try {
      await axios.post(`${API}/quest/progreso`, {
        licencia_alumno: licencia,
        guia_id: guiaId,
        dia: questDiaActual,
        fase: "estudio",
        completado: 1,
        puntaje: aciertoCal * 10,
        errores: 3 - aciertoCal,
        tiempo_segundos: 0,
      });
    } catch (e) { /* silencioso */ }
  };

  const responderCalentamiento = async (opcion) => {
    if (respuestaCalDada !== null) return;
    const p = preguntasCal[preguntaCalIdx];
    const correcto = opcion === p.respuesta_correcta;
    setRespuestaCalDada(opcion);
    if (correcto) {
      setAciertoCal(a => a + 1);
      toast.success("¡Correcto! 🌟", { duration: 1200 });
    } else {
      toast.error(`Incorrecto. Era: ${p.respuesta_correcta}`, { duration: 1800 });
      // Guardar error
      try {
        await axios.post(`${API}/quest/error`, {
          licencia_alumno: licencia,
          guia_id: guiaId,
          pregunta_id: p.id,
          respuesta_dada: opcion,
        });
      } catch(e) {}
    }

    setTimeout(() => {
      setRespuestaCalDada(null);
      if (preguntaCalIdx + 1 >= preguntasCal.length) {
        guardarProgresoEstudio();
        setEtapa("listo");
      } else {
        setPreguntaCalIdx(i => i + 1);
      }
    }, 1800);
  };

  if (cargando || !datosDia) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
                    background:"linear-gradient(135deg, #0D0221, #1A0533)" }}>
        <div style={{ textAlign:"center", color:"#fff" }}>
          <div style={{ fontSize:"60px", marginBottom:"16px" }}>📚</div>
          <p style={{ color:"#aaa" }}>Preparando tu lección...</p>
        </div>
      </div>
    );
  }

  const bgGradient = "linear-gradient(135deg, #0D0221 0%, #1A0533 50%, #0D1B2A 100%)";

  return (
    <div style={{ minHeight:"100vh", background:bgGradient, color:"#fff",
                  padding:"20px", fontFamily:"'Nunito', sans-serif" }}>

      {/* Barra de progreso del día */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    marginBottom:"20px", maxWidth:"600px", margin:"0 auto 20px" }}>
        <button onClick={() => setPagina("quest_menu")}
                style={{ background:"transparent", color:"#aaa", border:"none", cursor:"pointer" }}>
          ← Menú
        </button>
        <div style={{ display:"flex", gap:"6px" }}>
          {["intro","flashcards","calentamiento"].map((e,i) => (
            <div key={e} style={{
              width:"32px", height:"6px", borderRadius:"3px",
              background: ["intro","flashcards","calentamiento"].indexOf(etapa) >= i
                ? "#FFD700" : "rgba(255,255,255,0.2)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
        <span style={{ color:"#aaa", fontSize:"0.85rem" }}>Día {questDiaActual}</span>
      </div>

      <AnimatePresence mode="wait">

        {/* INTRO */}
        {etapa === "intro" && (
          <motion.div key="intro"
            initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-30 }}
            style={{ maxWidth:"500px", margin:"0 auto", textAlign:"center", padding:"20px" }}
          >
            <motion.div
              animate={{ y: [0,-10,0] }} transition={{ repeat:Infinity, duration:2 }}
              style={{ fontSize:"80px", marginBottom:"16px" }}
            >{narrador.emoji}</motion.div>

            <h2 style={{ fontFamily:"'Orbitron', sans-serif", fontSize:"1.4rem",
                         color:narrador.color, marginBottom:"8px" }}>
              {narrador.nombre} dice:
            </h2>

            <div style={{
              background:`linear-gradient(135deg, ${narrador.color}22, ${narrador.color}11)`,
              border:`2px solid ${narrador.color}44`,
              borderRadius:"16px", padding:"20px", marginBottom:"20px",
            }}>
              <h3 style={{ color:"#FFD700", marginBottom:"8px" }}>
                📚 Día {questDiaActual}: {questGuiaActual?.titulo}
              </h3>
              <p style={{ color:"#ddd", lineHeight:1.6 }}>
                ¡Hola <b style={{color:"#FFD700"}}>{nombre}</b>! Hoy vamos a aprender sobre{" "}
                <b style={{color:narrador.color}}>{datosDia.guia?.titulo || "este tema"}</b>.
              </p>
              <p style={{ color:"#aaa", fontSize:"0.9rem", marginTop:"8px" }}>
                Primero voy a explicarte todo 📖 y luego ¡a jugar! ⚔️
              </p>
            </div>

            <motion.button
              whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              onClick={() => setEtapa("flashcards")}
              style={{
                background:`linear-gradient(135deg, ${narrador.color}, #1A5276)`,
                color:"#fff", border:"none", borderRadius:"12px",
                padding:"14px 32px", fontSize:"1.1rem", fontWeight:"bold",
                cursor:"pointer", boxShadow:`0 0 20px ${narrador.color}44`,
              }}
            >¡Empezar a Aprender! →</motion.button>
          </motion.div>
        )}

        {/* FLASHCARDS — Tarjetas de conceptos */}
        {etapa === "flashcards" && (
          <motion.div key="flashcards"
            initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}
            style={{ maxWidth:"550px", margin:"0 auto" }}
          >
            <h3 style={{ textAlign:"center", color:"#FFD700", marginBottom:"16px" }}>
              💡 Conceptos Clave — Toca la tarjeta para girarla
            </h3>

            {/* Tarjeta flip */}
            {datosDia.preguntas && datosDia.preguntas[flashcardIdx] && (
              <motion.div
                key={flashcardIdx}
                initial={{ rotateY:90, opacity:0 }}
                animate={{ rotateY:0, opacity:1 }}
                transition={{ duration:0.4 }}
                onClick={() => setFlashcardVuelta(v => !v)}
                style={{
                  background: flashcardVuelta
                    ? "linear-gradient(135deg, #145A32, #1A5276)"
                    : "linear-gradient(135deg, #4A235A, #1B2631)",
                  border: `2px solid ${flashcardVuelta ? "#2ECC71" : "#8E44AD"}`,
                  borderRadius:"20px", padding:"40px 30px",
                  textAlign:"center", cursor:"pointer", minHeight:"180px",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  marginBottom:"16px",
                  boxShadow: flashcardVuelta
                    ? "0 0 30px rgba(46,204,113,0.3)"
                    : "0 0 30px rgba(142,68,173,0.3)",
                }}
              >
                {!flashcardVuelta ? (
                  <>
                    <div style={{ fontSize:"2rem", marginBottom:"12px" }}>❓</div>
                    <p style={{ fontSize:"1.15rem", color:"#FFD700", fontWeight:"bold", lineHeight:1.5 }}>
                      {datosDia.preguntas[flashcardIdx].pregunta}
                    </p>
                    <p style={{ color:"#aaa", fontSize:"0.8rem", marginTop:"12px" }}>Toca para ver la respuesta</p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:"2rem", marginBottom:"12px" }}>✅</div>
                    <p style={{ fontSize:"1.1rem", color:"#2ECC71", fontWeight:"bold", marginBottom:"8px" }}>
                      {datosDia.preguntas[flashcardIdx].respuesta_correcta}
                    </p>
                    <p style={{ color:"#aaa", fontSize:"0.85rem", lineHeight:1.5 }}>
                      {datosDia.preguntas[flashcardIdx].explicacion}
                    </p>
                  </>
                )}
              </motion.div>
            )}

            {/* Navegación flashcards */}
            <div style={{ display:"flex", gap:"10px", justifyContent:"center", alignItems:"center" }}>
              <button
                onClick={() => { setFlashcardIdx(i => Math.max(0, i-1)); setFlashcardVuelta(false); }}
                disabled={flashcardIdx === 0}
                style={{ background:"rgba(255,255,255,0.1)", color:"#fff", border:"none",
                         borderRadius:"8px", padding:"8px 16px", cursor:"pointer", opacity: flashcardIdx===0?0.4:1 }}
              >◀ Anterior</button>

              <span style={{ color:"#aaa", fontSize:"0.9rem" }}>
                {flashcardIdx+1} / {Math.min(5, datosDia.preguntas?.length||0)}
              </span>

              {flashcardIdx < Math.min(4, (datosDia.preguntas?.length||1)-1) ? (
                <button
                  onClick={() => { setFlashcardIdx(i => i+1); setFlashcardVuelta(false); }}
                  style={{ background:"linear-gradient(135deg,#6C3483,#1A5276)", color:"#fff",
                           border:"none", borderRadius:"8px", padding:"8px 16px", cursor:"pointer" }}
                >Siguiente ▶</button>
              ) : (
                <button
                  onClick={() => setEtapa("calentamiento")}
                  style={{ background:"linear-gradient(135deg,#E67E22,#C0392B)", color:"#fff",
                           border:"none", borderRadius:"10px", padding:"10px 20px",
                           cursor:"pointer", fontWeight:"bold" }}
                >¡Practicar! 🔥</button>
              )}
            </div>
          </motion.div>
        )}

        {/* CALENTAMIENTO — 3 preguntas rápidas */}
        {etapa === "calentamiento" && preguntasCal.length > 0 && preguntaCalIdx < preguntasCal.length && (
          <motion.div key={`cal-${preguntaCalIdx}`}
            initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
            style={{ maxWidth:"500px", margin:"0 auto", textAlign:"center" }}
          >
            <h3 style={{ color:"#FFD700", marginBottom:"4px" }}>🔥 Calentamiento</h3>
            <p style={{ color:"#aaa", marginBottom:"20px", fontSize:"0.9rem" }}>
              Pregunta {preguntaCalIdx+1} de {preguntasCal.length}
            </p>

            <div style={{
              background:"rgba(255,255,255,0.05)", border:"2px solid rgba(255,215,0,0.3)",
              borderRadius:"16px", padding:"24px", marginBottom:"20px",
            }}>
              <p style={{ fontSize:"1.15rem", color:"#fff", fontWeight:"bold", lineHeight:1.5 }}>
                {preguntasCal[preguntaCalIdx]?.pregunta}
              </p>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              {["opcion_a","opcion_b","opcion_c","opcion_d"].map((op, i) => {
                const p = preguntasCal[preguntaCalIdx];
                const texto = p?.[op];
                if (!texto) return null;
                const clave = ["a","b","c","d"][i];
                const esCorrecta = clave === p.respuesta_correcta || texto === p.respuesta_correcta;
                let bgColor = "rgba(255,255,255,0.08)";
                let borderColor = "rgba(255,255,255,0.15)";
                if (respuestaCalDada !== null) {
                  if (esCorrecta) { bgColor = "rgba(46,204,113,0.25)"; borderColor = "#2ECC71"; }
                  else if (respuestaCalDada === clave) { bgColor = "rgba(231,76,60,0.25)"; borderColor = "#E74C3C"; }
                }
                return (
                  <motion.button key={op}
                    whileHover={respuestaCalDada===null ? {scale:1.03} : {}}
                    whileTap={respuestaCalDada===null ? {scale:0.97} : {}}
                    onClick={() => responderCalentamiento(clave)}
                    disabled={respuestaCalDada !== null}
                    style={{
                      background:bgColor, border:`2px solid ${borderColor}`,
                      borderRadius:"10px", padding:"12px", color:"#fff",
                      fontSize:"0.95rem", cursor:respuestaCalDada!==null?"default":"pointer",
                      textAlign:"center", transition:"all 0.2s",
                    }}
                  >{texto}</motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* LISTO — A jugar */}
        {etapa === "listo" && (
          <motion.div key="listo"
            initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
            style={{ maxWidth:"500px", margin:"0 auto", textAlign:"center", padding:"30px" }}
          >
            <motion.div
              animate={{ rotate:[0,10,-10,0], scale:[1,1.1,1] }}
              transition={{ repeat:2, duration:0.5 }}
              style={{ fontSize:"80px", marginBottom:"16px" }}
            >⚔️</motion.div>
            <h2 style={{
              fontFamily:"'Orbitron', sans-serif",
              background:"linear-gradient(90deg,#FFD700,#FF6B35)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              fontSize:"1.8rem", marginBottom:"8px",
            }}>¡Ya estás listo!</h2>
            <p style={{ color:"#aaa", marginBottom:"8px" }}>
              Calentamiento: {aciertoCal}/{preguntasCal.length} correctas 🎯
            </p>
            <p style={{ color:"#ddd", marginBottom:"24px" }}>
              Ahora empieza el verdadero desafío.{" "}
              <b style={{color:"#FFD700"}}>¡Demuestra lo que aprendiste!</b>
            </p>
            <motion.button
              whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              onClick={() => { setQuestFaseActual("juego"); setPagina("quest_juego"); }}
              style={{
                background:"linear-gradient(135deg, #E74C3C, #C0392B)",
                color:"#fff", border:"none", borderRadius:"14px",
                padding:"16px 40px", fontSize:"1.2rem", fontWeight:"bold",
                cursor:"pointer", boxShadow:"0 0 30px rgba(231,76,60,0.5)",
              }}
            >⚔️ ¡Ir al Torneo!</motion.button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
