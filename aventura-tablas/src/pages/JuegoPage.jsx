import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";
import { MUNDOS, AVATARES, TIPS_TABLAS, getPoderes } from "../utils/gameData";
import soundManager from "../utils/sounds";
import voiceManager from "../utils/voice";
import AvatarAnimado, { CaminoAvatar } from "../components/AvatarAnimado";
import { ModoOpciones, ModoEscribir, ModoDigitos, ModoCompletaTabla, getModoPreguntas } from "../components/ModosPregunta";

function generarPregunta(mundo) {
  const tabla = mundo.tabla;
  const num2 = Math.floor(Math.random() * 10) + 1;
  if (mundo.esSupremo) {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    return { num1: n1, num2: n2, respuesta: n1 * n2 };
  }
  return { num1: tabla, num2, respuesta: tabla * num2 };
}

function generarOpciones(respuesta) {
  const opts = new Set([respuesta]);
  const candidatos = [
    respuesta+1, respuesta-1, respuesta+2, respuesta-2,
    respuesta+10, respuesta-10, respuesta+11, respuesta*2,
    Math.abs(respuesta-3), respuesta+3,
  ];
  while (opts.size < 4) {
    const t = candidatos[Math.floor(Math.random() * candidatos.length)];
    if (t > 0 && t !== respuesta) opts.add(t);
  }
  return [...opts].sort(() => Math.random() - 0.5);
}

export default function JuegoPage() {
  const store = useGameStore();
  const mundo = MUNDOS[store.mundoActual];
  const avatar = AVATARES.find(a => a.id === store.avatarId) || AVATARES[0];

  // Poderes activos de accesorios equipados
  const poderes = getPoderes(store.inventario, store.equipado, store.avatarId);
  const tiempoBase = mundo.tiempo_limite
    ? Math.max(5, mundo.tiempo_limite + poderes.bonusTiempo)
    : null;

  const [pregunta, setPregunta] = useState(() => generarPregunta(mundo));
  const [opciones, setOpciones] = useState([]);
  const [mostrarTip, setMostrarTip] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [seleccionado, setSeleccionado] = useState(null);
  const [tiempoRestante, setTiempoRestante] = useState(tiempoBase);
  const [modoExplicacion, setModoExplicacion] = useState(false);
  const [ultimaPregunta, setUltimaPregunta] = useState(null);
  // Escudo: absorbe 1 error (por mundo)
  const [escudoActivo, setEscudoActivo] = useState(poderes.escudo);
  const [escudoUsado, setEscudoUsado] = useState(false);

  const timerRef = useRef(null);
  const bloqueado = useRef(false);
  const modoActual = getModoPreguntas(store.aciertos, store.mundoActual);

  useEffect(() => {
    const p = generarPregunta(mundo);
    setPregunta(p);
    setOpciones(generarOpciones(p.respuesta));
  }, [mundo]);

  // Timer
  useEffect(() => {
    if (!tiempoBase || modoExplicacion || store.boss.activo) return;
    setTiempoRestante(tiempoBase);
    timerRef.current = setInterval(() => {
      setTiempoRestante(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!bloqueado.current) {
            bloqueado.current = true;
            soundManager.incorrecto();
            setUltimaPregunta(pregunta);
            setModoExplicacion(true);
            // Escudo absorbe el tiempo agotado también
            if (escudoActivo && !escudoUsado) {
              setEscudoUsado(true);
              setEscudoActivo(false);
              toast("🛡️ ¡Escudo absorbió el tiempo agotado!", { icon: "🛡️" });
              setTimeout(() => { bloqueado.current = false; setModoExplicacion(false); nuevaPregunta(); }, 1500);
            } else {
              store.respuestaIncorrecta(poderes.guardaMonedas);
              toast.error("⏰ ¡Se acabó el tiempo!");
              setTimeout(() => { bloqueado.current = false; setModoExplicacion(false); nuevaPregunta(); }, 2800);
            }
          }
          return 0;
        }
        if (t <= 4) soundManager.tickPeligro();
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [pregunta.num1, pregunta.num2, modoExplicacion]);

  const nuevaPregunta = useCallback(() => {
    const p = generarPregunta(mundo);
    setPregunta(p);
    setOpciones(generarOpciones(p.respuesta));
    setSeleccionado(null);
    setMostrarTip(false);
    setTiempoRestante(tiempoBase);
  }, [mundo, tiempoBase]);

  useEffect(() => {
    if (store.boss.activo) store.setPagina("boss");
  }, [store.boss.activo, store]);

  const responder = (respuestaUsuario) => {
    if (bloqueado.current || seleccionado !== null) return;
    bloqueado.current = true;
    clearInterval(timerRef.current);
    setSeleccionado(respuestaUsuario);

    const correcto = respuestaUsuario === pregunta.respuesta;

    if (correcto) {
      // Calcular monedas con todos los poderes
      const base = mundo.monedas_por_acierto + (store.rachaActual >= 2 ? 5 : 0);
      const monedasGanadas = Math.round((base + poderes.bonusMonedas) * poderes.multiplicadorMonedas);
      store.respuestaCorrecta(monedasGanadas);
      soundManager.correcto();

      const racha = store.rachaActual + 1;
      if (racha === 3)       { soundManager.racha3(); toast.success("🔥 ¡3 SEGUIDAS! Bonus +5 🪙"); }
      else if (racha === 5)  { soundManager.racha5(); toast.success("⭐ ¡5 PERFECTAS! ¡Increíble!"); }
      else if (racha >= 10)  toast.success("👑 ¡¡MODO DIOS!!");
      else toast.success(`✅ ¡Correcto! +${monedasGanadas} 🪙`);

      setTimeout(() => {
        bloqueado.current = false;
        if (store.aciertos + 1 < 10) nuevaPregunta();
      }, 800);
    } else {
      setUltimaPregunta(pregunta);
      soundManager.incorrecto();

      // Escudo absorbe el primer error
      if (escudoActivo && !escudoUsado) {
        setEscudoUsado(true);
        setEscudoActivo(false);
        toast("🛡️ ¡ESCUDO ACTIVADO! Error absorbido", { icon: "🛡️", duration: 1800 });
        setTimeout(() => {
          bloqueado.current = false;
          setSeleccionado(null);
          nuevaPregunta();
        }, 1200);
      } else {
        store.respuestaIncorrecta(poderes.guardaMonedas);
        toast.error("❌ ¡Respuesta incorrecta!");
        setTimeout(() => setModoExplicacion(true), 400);
      }
    }
  };

  const cerrarExplicacion = () => {
    bloqueado.current = false;
    setModoExplicacion(false);
    nuevaPregunta();
  };

  const irAEstudiar = () => {
    voiceManager.detener();
    store.setPagina("estudio_tabla");
  };

  const tips = TIPS_TABLAS[mundo.tabla] || TIPS_TABLAS[1];

  return (
    <div className="page" style={{ background: mundo.bg, minHeight: "100vh" }}>
      {store.modoDemo && <DemoBanner inicio={store.demoInicio} />}
      <HUD store={store} mundo={mundo} avatar={avatar} tiempoRestante={tiempoRestante}
           tiempoBase={tiempoBase} escudoActivo={escudoActivo && !escudoUsado} poderes={poderes} />

      <div style={{ padding: "8px 16px 24px", maxWidth: 700, margin: "0 auto" }}>
        {/* Indicador de replay */}
        {store.esRepeticion && (
          <div style={{
            background: "rgba(255,150,0,0.15)", border: "1px solid rgba(255,150,0,0.4)",
            borderRadius: 10, padding: "6px 14px", marginBottom: 8, textAlign: "center",
            fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#ff9900",
          }}>
            🔁 Modo repetición — Ganas {store.multiplicadorRepeticion === 0.5 ? "50%" : "25%"} de monedas
          </div>
        )}

        {/* Poderes activos */}
        <PoderesActivos poderes={poderes} escudoActivo={escudoActivo && !escudoUsado} />

        <CaminoAvatar avatarId={store.avatarId} aciertos={store.aciertos}
          inventario={store.inventario} equipado={store.equipado} mundoId={store.mundoActual} />

        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 16px" }}>
          <AvatarAnimado
            avatarId={store.avatarId} animacion={store.animacion}
            aciertos={store.aciertos} inventario={store.inventario}
            equipado={store.equipado} size={90}
          />
        </div>

        <AnimatePresence mode="wait">
          {!modoExplicacion ? (
            <motion.div key={`p-${pregunta.num1}-${pregunta.num2}-${modoActual}`}
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <div className="question-card" style={{ marginBottom: 20 }}>
                {store.rachaActual >= 3 && (
                  <motion.div animate={{ scale: [1,1.05,1] }} transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ fontFamily:"Orbitron,monospace", fontSize:13, color:"#FFD700", marginBottom:8, letterSpacing:2 }}>
                    🔥 RACHA ×{store.rachaActual}
                  </motion.div>
                )}
                {(modoActual === "opciones" || modoActual === "escribir") && (
                  <div className="question-number">{pregunta.num1} × {pregunta.num2} = ?</div>
                )}
              </div>

              {modoActual === "opciones" && (
                <ModoOpciones pregunta={pregunta} opciones={opciones} onResponder={responder} seleccionado={seleccionado} />
              )}
              {modoActual === "escribir" && (
                <ModoEscribir pregunta={pregunta} onResponder={responder} />
              )}
              {modoActual === "digitos" && (
                <ModoDigitos pregunta={pregunta} onResponder={responder} />
              )}
              {modoActual === "completa" && (
                <ModoCompletaTabla pregunta={pregunta} onResponder={(v) => {
                  if (v === pregunta.respuesta) responder(pregunta.respuesta);
                  else responder(-1);
                }} />
              )}

              {(modoActual === "digitos" || modoActual === "completa") && (
                <div style={{ textAlign:"center", fontFamily:"Orbitron,monospace", fontSize:28, color:"rgba(255,255,255,0.5)", margin:"12px 0" }}>
                  {pregunta.num1} × {pregunta.num2} = ?
                </div>
              )}

              <div style={{ marginTop: 16, textAlign: "center" }}>
                <button onClick={() => { setMostrarTip(!mostrarTip); setTipIndex(Math.floor(Math.random() * tips.length)); }}
                  style={{ background:"transparent", border:"1px solid rgba(255,214,0,0.3)", color:"rgba(255,214,0,0.7)", padding:"6px 16px", borderRadius:20, cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:12 }}>
                  💡 {mostrarTip ? "Ocultar truco" : "¿Necesitas un truco?"}
                </button>
                <AnimatePresence>
                  {mostrarTip && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                      className="tip-box" style={{ marginTop:12 }}>💡 {tips[tipIndex]}</motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"center" }}>
                <button className="btn btn-neon btn-sm" onClick={() => store.setPagina("mapa")}>🗺️ Mapa</button>
                <button onClick={() => store.setPagina("tienda")}
                  style={{ background:"rgba(255,214,0,0.15)", border:"1px solid rgba(255,214,0,0.4)", color:"#FFD700", borderRadius:10, fontFamily:"Orbitron,monospace", fontSize:12, cursor:"pointer", padding:"8px 16px" }}>
                  🛒 Tienda
                </button>
                <button onClick={() => { if (!store.modoDemo) store.guardarProgreso(); store.cerrarSesion(); }}
                  style={{ background:"rgba(255,0,110,0.15)", border:"1px solid rgba(255,0,110,0.3)", color:"#ff006e", borderRadius:10, fontFamily:"Orbitron,monospace", fontSize:12, cursor:"pointer", padding:"8px 16px" }}>
                  🚪 Salir
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="exp" initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}>
              <ExplicacionError pregunta={ultimaPregunta || pregunta} tips={tips} vidas={store.vidas}
                onContinuar={cerrarExplicacion} onEstudiar={irAEstudiar} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── PODERES ACTIVOS (chip bar) ────────────────────────────────
function PoderesActivos({ poderes, escudoActivo }) {
  const chips = [];
  if (poderes.bonusTiempo > 0)   chips.push(`⏱️ +${poderes.bonusTiempo}s`);
  if (poderes.bonusMonedas > 0)  chips.push(`🪙 +${poderes.bonusMonedas}`);
  if (poderes.multiplicadorMonedas > 1.01) chips.push(`💰 ×${poderes.multiplicadorMonedas.toFixed(1)}`);
  if (escudoActivo)              chips.push("🛡️ Escudo");
  if (poderes.vidasExtra > 0)    chips.push(`❤️ +${poderes.vidasExtra} vidas`);
  if (poderes.danoDoble)         chips.push("⚔️ ×2 daño");
  if (poderes.inmortalSupremo)   chips.push("🌟 Inmortal");
  if (poderes.guardaMonedas)     chips.push("🎒 Guarda 🪙");

  if (chips.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
      {chips.map((c, i) => (
        <span key={i} style={{
          background: "rgba(255,214,0,0.12)", border: "1px solid rgba(255,214,0,0.35)",
          borderRadius: 20, padding: "3px 10px",
          fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#FFD700",
        }}>{c}</span>
      ))}
    </div>
  );
}

// ─── HUD ──────────────────────────────────────────────────────
function HUD({ store, mundo, avatar, tiempoRestante, tiempoBase, escudoActivo }) {
  return (
    <div className="hud" style={{ background: "rgba(0,0,0,0.7)", flexWrap: "wrap" }}>
      <div className="hud-item" style={{ borderColor:`${avatar.color}44` }}>
        <span style={{ fontSize:20 }}>{avatar.emoji}</span>
        <div className="hud-label">{store.nombre}</div>
      </div>
      <div className="hud-item">
        {[0,1,2,3,4].slice(0, Math.max(3, store.vidas)).map(i => (
          <motion.span key={i} animate={i < store.vidas ? {scale:[1,1.1,1]} : {}}
            transition={{duration:1.5,repeat:Infinity,delay:i*0.3}}
            className={`vida ${i < store.vidas ? "activa" : "perdida"}`}>❤️</motion.span>
        ))}
        {escudoActivo && <span title="Escudo activo" style={{ fontSize: 14, marginLeft: 2 }}>🛡️</span>}
      </div>
      <div className="hud-item">
        <span>🪙</span>
        <span className="hud-value" style={{ color:"#FFD700" }}>{store.monedas.toLocaleString()}</span>
      </div>
      <div className="hud-item" style={{ borderColor:`${mundo.color}44` }}>
        <span>{mundo.emoji}</span>
        <span className="hud-value" style={{ color:mundo.color, fontSize:13 }}>{mundo.nombre}</span>
      </div>
      {tiempoBase && tiempoRestante !== null && (
        <div className="hud-item" style={{ borderColor: tiempoRestante <= 5 ? "#ff006e" : "rgba(255,255,255,0.1)" }}>
          <motion.span animate={tiempoRestante<=5?{scale:[1,1.2,1]}:{}} transition={{duration:0.5,repeat:Infinity}}
            style={{ color:tiempoRestante<=5?"#ff006e":tiempoRestante<=10?"#FFD700":"#fff", fontFamily:"Orbitron,monospace", fontSize:16, fontWeight:700 }}>
            ⏱ {tiempoRestante}s
          </motion.span>
        </div>
      )}
      <div className="hud-item" style={{ marginLeft:"auto" }}>
        <span className="hud-label">Avance:</span>
        <span className="hud-value">{store.aciertos}/10</span>
      </div>
    </div>
  );
}

// ─── DEMO BANNER ──────────────────────────────────────────────
function DemoBanner({ inicio }) {
  const [restante, setRestante] = useState(180);
  useEffect(() => {
    const t = setInterval(() => { setRestante(Math.max(0, Math.floor(180 - (Date.now()-inicio)/1000))); }, 1000);
    return () => clearInterval(t);
  }, [inicio]);
  const mins = Math.floor(restante/60), secs = restante%60;
  return <div className="demo-banner">🎮 DEMO: {mins}:{secs.toString().padStart(2,"0")} restantes — ¡Regístrate para jugar completo!</div>;
}

// ─── EXPLICACIÓN ERROR ────────────────────────────────────────
function ExplicacionError({ pregunta, tips, vidas, onContinuar, onEstudiar }) {
  const respuesta = pregunta ? pregunta.num1 * pregunta.num2 : 0;
  const maxFilas = Math.min(pregunta?.num1 || 1, 5);
  const maxCols = Math.min(pregunta?.num2 || 1, 5);
  const gameOver = vidas <= 0;

  return (
    <motion.div className="card" initial={{ scale:0.85 }} animate={{ scale:1 }}
      style={{ background:"rgba(5,8,30,0.97)", border:`2px solid ${gameOver?"rgba(255,0,110,0.5)":"rgba(255,214,0,0.5)"}`, textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:8 }}>{gameOver?"💀":"😅"}</div>
      <h3 style={{ fontFamily:"Orbitron,monospace", color: gameOver?"#ff006e":"#FFD700", marginBottom:8, fontSize:16 }}>
        {gameOver?"¡Se acabaron las vidas!":"¡Aprendamos juntos!"}
      </h3>
      {pregunta && (
        <>
          <div style={{ background:"rgba(0,245,255,0.1)", border:"2px solid rgba(0,245,255,0.3)", borderRadius:16, padding:20, margin:"16px 0" }}>
            <div style={{ fontFamily:"Orbitron,monospace", fontSize:32, color:"#fff", marginBottom:8 }}>
              {pregunta.num1} × {pregunta.num2} = <span style={{ color:"#00f5ff" }}>{respuesta}</span>
            </div>
            <div style={{ margin:"12px auto", width:"fit-content" }}>
              {Array.from({length:maxFilas},(_,r)=>(
                <div key={r} style={{ display:"flex", gap:4, marginBottom:4, justifyContent:"center" }}>
                  {Array.from({length:maxCols},(_,c)=>(
                    <motion.div key={c} initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:(r*maxCols+c)*0.03 }}
                      style={{ width:16, height:16, borderRadius:"50%", background:`hsl(${r*36},70%,60%)`, boxShadow:`0 0 6px hsl(${r*36},70%,60%)` }}/>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="tip-box">💡 {tips[0]}</div>
          <div style={{ marginTop:16 }}>
            <p style={{ color:"rgba(255,255,255,0.5)", fontFamily:"Nunito,sans-serif", fontSize:13, marginBottom:8 }}>Tabla del {pregunta.num1}:</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:4 }}>
              {Array.from({length:10},(_,k)=>(
                <div key={k} style={{ background:k+1===pregunta.num2?"rgba(0,245,255,0.2)":"rgba(255,255,255,0.05)", border:`1px solid ${k+1===pregunta.num2?"rgba(0,245,255,0.5)":"rgba(255,255,255,0.1)"}`, borderRadius:6, padding:"4px 0", fontFamily:"Orbitron,monospace", fontSize:11, color:k+1===pregunta.num2?"#00f5ff":"rgba(255,255,255,0.5)" }}>
                  {pregunta.num1}×{k+1}={pregunta.num1*(k+1)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {gameOver ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:20 }}>
          <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.97 }} onClick={onEstudiar}
            style={{ background:"linear-gradient(135deg,rgba(0,245,255,0.2),rgba(0,245,255,0.05))", border:"2px solid rgba(0,245,255,0.5)", borderRadius:14, color:"#00f5ff", padding:"14px 20px", fontFamily:"Orbitron,monospace", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            📚 Estudiar la Tabla del {pregunta?.num1} con Voz
          </motion.button>
          <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }} onClick={onContinuar}
            style={{ background:"rgba(255,0,110,0.15)", border:"2px solid rgba(255,0,110,0.4)", borderRadius:14, color:"#ff006e", padding:"12px 20px", fontFamily:"Orbitron,monospace", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            🔄 Intentar de Nuevo
          </motion.button>
        </div>
      ) : (
        <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.97 }} onClick={onContinuar}
          className="btn btn-primary btn-full" style={{ marginTop:20 }}>
          ✅ ¡Ya entendí! Continuar
        </motion.button>
      )}
    </motion.div>
  );
}
