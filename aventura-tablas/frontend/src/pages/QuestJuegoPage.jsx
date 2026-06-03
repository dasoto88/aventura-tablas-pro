import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";
const VIDAS_INIT = 3;
const PREGUNTAS_PARA_BOSS = 10;
const TIEMPO_POR_PREGUNTA = 30;

// Banco de mundos — se asigna uno por día automáticamente (sin "mundo final" fijo)
const BANCO_MUNDOS = [
  { nombre:"Torre del Saber",          emoji:"🏰", color:"#8E44AD", boss:"Guardián de Piedra", bossEmoji:"🗿" },
  { nombre:"Bosque Encantado",          emoji:"🌲", color:"#27AE60", boss:"Lobo Sabio",          bossEmoji:"🐺" },
  { nombre:"Volcán del Conocimiento",   emoji:"🌋", color:"#E74C3C", boss:"Dragón Erudito",      bossEmoji:"🐉" },
  { nombre:"Castillo de las Estrellas", emoji:"⭐", color:"#F39C12", boss:"Rey Oscuro",           bossEmoji:"👑" },
  { nombre:"Caverna de Cristal",        emoji:"💎", color:"#1ABC9C", boss:"Araña Gigante",        bossEmoji:"🕷️" },
  { nombre:"Templo del Conocimiento",   emoji:"🏛️", color:"#E67E22", boss:"Espíritu Antiguo",    bossEmoji:"👻" },
  { nombre:"Dimensión Estelar",         emoji:"🌌", color:"#2980B9", boss:"Alien Sabio",          bossEmoji:"👽" },
  { nombre:"Selva Misteriosa",          emoji:"🌿", color:"#16A085", boss:"Jaguar Ancestral",     bossEmoji:"🐆" },
  { nombre:"Montaña de Hielo",          emoji:"🏔️", color:"#85C1E9", boss:"Oso Polar Guardián",  bossEmoji:"🐻‍❄️" },
  { nombre:"Ciudad del Futuro",         emoji:"🤖", color:"#8E44AD", boss:"Robot Maestro",        bossEmoji:"🤖" },
];

// Obtiene el mundo para el día indicado (cíclico si hay más días que mundos)
const getMundoDia = (dia) => BANCO_MUNDOS[(dia - 1) % BANCO_MUNDOS.length];

export default function QuestJuegoPage() {
  const {
    licencia, nombre, setPagina,
    questGuiaActual, questDiaActual, setQuestFaseActual,
  } = useGameStore(s => ({
    licencia: s.licencia, nombre: s.nombre, setPagina: s.setPagina,
    questGuiaActual: s.questGuiaActual, questDiaActual: s.questDiaActual,
    setQuestFaseActual: s.setQuestFaseActual,
  }));

  const [preguntas, setPreguntas] = useState([]);
  const [preguntaIdx, setPreguntaIdx] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [errores, setErrores] = useState(0);
  const [vidas, setVidas] = useState(VIDAS_INIT);
  const [monedas, setMonedas] = useState(0);
  const [tiempo, setTiempo] = useState(TIEMPO_POR_PREGUNTA);
  const [respuestaDada, setRespuestaDada] = useState(null);
  const [modoInput, setModoInput] = useState("");           // para modo escribir
  const [gameOver, setGameOver] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [racha, setRacha] = useState(0);
  const [feedback, setFeedback] = useState(null);          // "correcto"|"incorrecto"

  const timerRef = useRef(null);
  const bloqueado = useRef(false);

  const guiaId = questGuiaActual?.id;
  const mundoData = MUNDOS_QUEST[(questDiaActual - 1) % MUNDOS_QUEST.length] || MUNDOS_QUEST[0];

  useEffect(() => {
    if (!guiaId) { setPagina("quest_menu"); return; }
    cargarPreguntas();
  }, []);

  const cargarPreguntas = async () => {
    try {
      const res = await axios.get(`${API}/api/quest/guia/${guiaId}/dia/${questDiaActual}`);
      // Barajar preguntas
      const todas = [...(res.data.preguntas || [])];
      todas.sort(() => Math.random() - 0.5);
      setPreguntas(todas);
    } catch (e) {
      toast.error("Error al cargar preguntas");
    } finally {
      setCargando(false);
    }
  };

  // Timer
  useEffect(() => {
    if (cargando || gameOver || respuestaDada !== null || preguntas.length === 0) return;
    timerRef.current = setInterval(() => {
      setTiempo(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!bloqueado.current) responder(null); // tiempo agotado
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cargando, preguntaIdx, gameOver, respuestaDada]);

  const getModo = (idx) => {
    // Alterna modos: 0=opciones, 1=verdadero_falso, 2=escribir, 0,1,2,...
    const modos = ["opciones", "verdadero_falso", "escribir"];
    return modos[idx % modos.length];
  };

  const responder = useCallback(async (respuesta) => {
    if (bloqueado.current) return;
    bloqueado.current = true;
    clearInterval(timerRef.current);
    setRespuestaDada(respuesta);

    const p = preguntas[preguntaIdx];
    if (!p) return;

    const correcta = respuesta !== null && (
      respuesta === p.respuesta_correcta ||
      respuesta?.toLowerCase()?.trim() === p.respuesta_correcta?.toLowerCase()?.trim()
    );

    if (correcta) {
      const bonusRacha = racha >= 3 ? 5 : 0;
      const monedasGanadas = 10 + bonusRacha;
      setMonedas(m => m + monedasGanadas);
      setAciertos(a => a + 1);
      setRacha(r => r + 1);
      setFeedback("correcto");
      if (racha + 1 >= 5) toast.success("🔥 ¡Racha de " + (racha+1) + "!", { duration:1000 });
    } else {
      setVidas(v => v - 1);
      setErrores(e => e + 1);
      setRacha(0);
      setFeedback("incorrecto");

      // Guardar error en BD
      if (p.id) {
        try {
          await axios.post(`${API}/api/quest/error`, {
            licencia_alumno: licencia,
            guia_id: guiaId,
            pregunta_id: p.id,
            respuesta_dada: respuesta || "tiempo_agotado",
          });
        } catch(e) {}
      }
    }

    setTimeout(() => {
      setFeedback(null);
      setRespuestaDada(null);
      setModoInput("");
      bloqueado.current = false;

      // Usar refs para leer el estado actualizado (evita stale closure)
      const nuevasVidas = correcta ? vidas : vidas - 1;
      const nuevosAciertos = correcta ? aciertos + 1 : aciertos;
      const nuevosErrores = correcta ? errores : errores + 1;

      if (!correcta && nuevasVidas <= 0) {
        // Game over
        guardarProgreso(nuevosAciertos, nuevosErrores, false);
        setGameOver(true);
        return;
      }

      if (nuevosAciertos >= PREGUNTAS_PARA_BOSS) {
        // ¡Ir al boss!
        guardarProgreso(nuevosAciertos, errores, true);
        setQuestFaseActual("boss");
        setPagina("quest_boss");
        return;
      }

      if (preguntaIdx + 1 >= preguntas.length) {
        // Se acabaron las preguntas, repetir (barajar de nuevo)
        setPreguntas(prev => [...prev].sort(() => Math.random() - 0.5));
        setPreguntaIdx(0);
      } else {
        setPreguntaIdx(i => i + 1);
      }
      setTiempo(TIEMPO_POR_PREGUNTA);
    }, 1500);
  }, [preguntas, preguntaIdx, vidas, aciertos, errores, racha]);

  const guardarProgreso = async (puntaje, errTotales, completado) => {
    try {
      await axios.post(`${API}/api/quest/progreso`, {
        licencia_alumno: licencia,
        guia_id: guiaId,
        dia: questDiaActual,
        fase: "juego",
        completado: completado ? 1 : 0,
        puntaje: puntaje * 10,
        errores: errTotales,
        tiempo_segundos: 0,
      });
    } catch(e) {}
  };

  if (cargando) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
                  background:"linear-gradient(135deg,#0D0221,#1A0533)" }}>
      <div style={{ textAlign:"center", color:"#fff" }}>
        <div style={{ fontSize:"60px" }}>⚔️</div>
        <p style={{ color:"#aaa" }}>Preparando el torneo...</p>
      </div>
    </div>
  );

  if (preguntas.length === 0) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
                  background:"#0D0221", color:"#fff", flexDirection:"column", gap:"16px" }}>
      <div style={{ fontSize:"60px" }}>😅</div>
      <p>No hay preguntas para este día</p>
      <button onClick={() => setPagina("quest_menu")}
              style={{ background:"#6C3483", color:"#fff", border:"none",
                       borderRadius:"8px", padding:"10px 20px", cursor:"pointer" }}>
        Volver al Menú
      </button>
    </div>
  );

  const preguntaActual = preguntas[preguntaIdx % preguntas.length];
  const modo = getModo(preguntaIdx);
  const tiempoPorc = (tiempo / TIEMPO_POR_PREGUNTA) * 100;

  return (
    <div style={{
      minHeight:"100vh",
      background:`linear-gradient(135deg, ${mundoData.color}22 0%, #0D0221 50%, #1A0533 100%)`,
      color:"#fff", fontFamily:"'Nunito', sans-serif",
    }}>

      {/* HUD Superior */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"12px 16px",
        background:"rgba(0,0,0,0.6)",
        backdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(255,255,255,0.1)",
        position:"sticky", top:0, zIndex:10,
      }}>
        <div style={{ display:"flex", gap:"12px", alignItems:"center" }}>
          {[...Array(VIDAS_INIT)].map((_, i) => (
            <span key={i} style={{ fontSize:"1.3rem", opacity: i < vidas ? 1 : 0.25 }}>❤️</span>
          ))}
        </div>

        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"'Orbitron', sans-serif", fontSize:"0.75rem", color:"#aaa" }}>
            {mundoData.emoji} {mundoData.nombre}
          </div>
          <div style={{ color:"#FFD700", fontSize:"0.8rem", fontWeight:"bold" }}>
            {aciertos}/{PREGUNTAS_PARA_BOSS} para Boss
          </div>
        </div>

        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          <span style={{ color:"#FFD700", fontWeight:"bold" }}>🪙 {monedas}</span>
          {racha >= 3 && (
            <motion.span
              animate={{ scale:[1,1.2,1] }} transition={{ repeat:Infinity, duration:0.8 }}
              style={{ fontSize:"0.8rem", color:"#FF6B35" }}>🔥 {racha}</motion.span>
          )}
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height:"4px", background:"rgba(255,255,255,0.1)" }}>
        <div style={{
          height:"100%", width:`${tiempoPorc}%`,
          background: tiempo <= 10 ? "#E74C3C" : tiempo <= 20 ? "#F39C12" : "#2ECC71",
          transition:"width 1s linear, background 0.3s",
        }} />
      </div>

      {/* Área principal */}
      <div style={{ padding:"20px", maxWidth:"550px", margin:"0 auto" }}>

        {/* Game Over */}
        {gameOver && (
          <motion.div
            initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
            style={{ textAlign:"center", padding:"30px" }}
          >
            <div style={{ fontSize:"80px", marginBottom:"16px" }}>💀</div>
            <h2 style={{ color:"#E74C3C", fontFamily:"'Orbitron', sans-serif" }}>¡Oh no!</h2>
            <p style={{ color:"#aaa", marginBottom:"8px" }}>Se te acabaron las vidas</p>
            <p style={{ color:"#ddd" }}>Llegaste a <b style={{color:"#FFD700"}}>{aciertos}</b> respuestas correctas</p>
            <div style={{ display:"flex", gap:"12px", justifyContent:"center", marginTop:"24px" }}>
              <button
                onClick={() => { setAciertos(0); setErrores(0); setVidas(VIDAS_INIT); setMonedas(0);
                                  setPreguntaIdx(0); setGameOver(false); setTiempo(TIEMPO_POR_PREGUNTA); }}
                style={{ background:"linear-gradient(135deg,#E74C3C,#C0392B)", color:"#fff",
                         border:"none", borderRadius:"10px", padding:"12px 24px", cursor:"pointer" }}
              >🔄 Intentar de Nuevo</button>
              <button
                onClick={() => setPagina("quest_estudio")}
                style={{ background:"rgba(255,255,255,0.1)", color:"#fff",
                         border:"1px solid rgba(255,255,255,0.2)", borderRadius:"10px",
                         padding:"12px 24px", cursor:"pointer" }}
              >📚 Repasar</button>
            </div>
          </motion.div>
        )}

        {/* Pregunta activa */}
        {!gameOver && (
          <AnimatePresence mode="wait">
            <motion.div key={`p-${preguntaIdx}`}
              initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}
              transition={{ duration:0.25 }}
            >
              {/* Número de pregunta */}
              <div style={{ display:"flex", justifyContent:"space-between",
                            color:"#aaa", fontSize:"0.85rem", marginBottom:"12px" }}>
                <span>Pregunta {aciertos + 1}</span>
                <span>⏱ {tiempo}s</span>
              </div>

              {/* Tarjeta de pregunta */}
              <motion.div
                animate={feedback === "correcto" ? { borderColor:"#2ECC71", boxShadow:"0 0 20px rgba(46,204,113,0.4)" }
                        : feedback === "incorrecto" ? { borderColor:"#E74C3C", boxShadow:"0 0 20px rgba(231,76,60,0.4)" }
                        : {}}
                style={{
                  background:"rgba(255,255,255,0.05)",
                  border:`2px solid ${feedback === "correcto" ? "#2ECC71" : feedback === "incorrecto" ? "#E74C3C" : "rgba(255,215,0,0.3)"}`,
                  borderRadius:"16px", padding:"20px 20px 16px",
                  marginBottom:"20px",
                }}
              >
                <p style={{ fontSize:"1.1rem", color:"#fff", fontWeight:"bold", lineHeight:1.6, textAlign:"center" }}>
                  {preguntaActual?.pregunta}
                </p>
              </motion.div>

              {/* Opciones según modo */}
              {(modo === "opciones" || modo === "verdadero_falso") && (
                <div style={{ display:"grid",
                              gridTemplateColumns: modo === "verdadero_falso" ? "1fr 1fr" : "1fr 1fr",
                              gap:"10px" }}>
                  {(modo === "verdadero_falso"
                    ? [{ clave:"a", texto:"Verdadero ✅" }, { clave:"b", texto:"Falso ❌" }]
                    : ["a","b","c","d"].map(c => ({ clave:c, texto:preguntaActual?.[`opcion_${c}`] }))
                  ).filter(op => op.texto).map(op => {
                    const esCorrecta = op.clave === preguntaActual?.respuesta_correcta
                      || op.texto === preguntaActual?.respuesta_correcta
                      || (modo === "verdadero_falso" && op.texto.startsWith(preguntaActual?.respuesta_correcta?.charAt(0)));
                    let bg = "rgba(255,255,255,0.08)";
                    let border = "rgba(255,255,255,0.15)";
                    if (respuestaDada !== null) {
                      if (esCorrecta) { bg = "rgba(46,204,113,0.25)"; border = "#2ECC71"; }
                      else if (respuestaDada === op.clave) { bg = "rgba(231,76,60,0.25)"; border = "#E74C3C"; }
                    }
                    return (
                      <motion.button key={op.clave}
                        whileHover={respuestaDada===null ? {scale:1.03, y:-2} : {}}
                        whileTap={respuestaDada===null ? {scale:0.97} : {}}
                        onClick={() => responder(op.clave)}
                        disabled={respuestaDada !== null}
                        style={{
                          background:bg, border:`2px solid ${border}`,
                          borderRadius:"12px", padding:"14px 12px",
                          color:"#fff", fontSize:"0.95rem", cursor: respuestaDada!==null?"default":"pointer",
                          textAlign:"center", fontFamily:"'Nunito', sans-serif",
                          transition:"all 0.2s",
                        }}
                      >
                        <span style={{ color:"#FFD700", fontWeight:"bold", marginRight:"6px" }}>
                          {op.clave.toUpperCase()}.
                        </span>
                        {op.texto}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {modo === "escribir" && (
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  <input
                    value={modoInput}
                    onChange={e => setModoInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && modoInput && responder(modoInput)}
                    placeholder="Escribe tu respuesta aquí..."
                    disabled={respuestaDada !== null}
                    style={{
                      padding:"14px 16px",
                      background:"rgba(255,255,255,0.08)",
                      border:"2px solid rgba(255,215,0,0.3)",
                      borderRadius:"12px", color:"#fff",
                      fontSize:"1rem", fontFamily:"'Nunito', sans-serif",
                    }}
                  />
                  <button
                    onClick={() => modoInput && responder(modoInput)}
                    disabled={!modoInput || respuestaDada !== null}
                    style={{
                      background:"linear-gradient(135deg,#6C3483,#1A5276)",
                      color:"#fff", border:"none", borderRadius:"10px",
                      padding:"12px", fontSize:"1rem", fontWeight:"bold",
                      cursor:modoInput?"pointer":"not-allowed", opacity:modoInput?1:0.5,
                    }}
                  >✅ Responder</button>
                </div>
              )}

              {/* Feedback de respuesta */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                    style={{
                      textAlign:"center", marginTop:"12px", padding:"10px",
                      borderRadius:"10px",
                      background: feedback === "correcto" ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
                      color: feedback === "correcto" ? "#2ECC71" : "#E74C3C",
                      fontWeight:"bold",
                    }}
                  >
                    {feedback === "correcto" ? "✅ ¡Correcto!" : `❌ La respuesta era: ${preguntaActual?.respuesta_correcta}`}
                    {feedback === "correcto" && preguntaActual?.explicacion && (
                      <p style={{ color:"#aaa", fontWeight:"normal", fontSize:"0.85rem", marginTop:"4px" }}>
                        {preguntaActual.explicacion}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
