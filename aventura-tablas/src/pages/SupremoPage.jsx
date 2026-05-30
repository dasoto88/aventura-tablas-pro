import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";
import { MUNDOS, AVATARES } from "../utils/gameData";

const MUNDO_SUPREMO = MUNDOS[10];
const TOTAL_PREGUNTAS = 20;
const TIEMPO_POR_PREGUNTA = 10;
const PREMIO_SUPREMO = 2000;

function genPregunta() {
  const n1 = Math.floor(Math.random() * 10) + 1;
  const n2 = Math.floor(Math.random() * 10) + 1;
  return { num1: n1, num2: n2, respuesta: n1 * n2 };
}

function genOpciones(respuesta) {
  const opts = new Set([respuesta]);
  while (opts.size < 4) {
    const v = Math.max(1, respuesta + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 15 + 1));
    opts.add(v);
  }
  return [...opts].sort(() => Math.random() - 0.5);
}

export default function SupremoPage() {
  const store = useGameStore();
  const avatar = AVATARES.find(a => a.id === store.avatarId) || AVATARES[0];

  const [fase, setFase] = useState("intro"); // intro | batalla | victoria | derrota
  const [pregunta, setPregunta] = useState(genPregunta());
  const [opciones, setOpciones] = useState([]);
  const [aciertos, setAciertos] = useState(0);
  const [errores, setErrores] = useState(0);
  const [bossVida, setBossVida] = useState(15);
  const [tiempoRestante, setTiempoRestante] = useState(TIEMPO_POR_PREGUNTA);
  const [seleccionado, setSeleccionado] = useState(null);
  const [bossAnim, setBossAnim] = useState("idle");
  const [historial, setHistorial] = useState([]); // {num1, num2, correcto}
  const [monedasGanadas, setMonedasGanadas] = useState(0);
  const [confetti, setConfetti] = useState(false);
  const bloqueado = useRef(false);
  const timerRef = useRef(null);
  const size = { w: window.innerWidth, h: window.innerHeight };

  useEffect(() => {
    const p = genPregunta();
    setPregunta(p);
    setOpciones(genOpciones(p.respuesta));
  }, []);

  useEffect(() => {
    if (fase !== "batalla" || seleccionado !== null) return;
    setTiempoRestante(TIEMPO_POR_PREGUNTA);
    timerRef.current = setInterval(() => {
      setTiempoRestante(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!bloqueado.current) {
            bloqueado.current = true;
            procesarError();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [pregunta, fase]);

  const nuevaPregunta = () => {
    const p = genPregunta();
    setPregunta(p);
    setOpciones(genOpciones(p.respuesta));
    setSeleccionado(null);
    bloqueado.current = false;
  };

  const procesarAcierto = (idx) => {
    clearInterval(timerRef.current);
    setSeleccionado(idx);
    setBossAnim("hurt");
    const nuevosAciertos = aciertos + 1;
    const nuevaVida = bossVida - 1;
    const monedas = 100;
    setAciertos(nuevosAciertos);
    setBossVida(nuevaVida);
    setMonedasGanadas(m => m + monedas);
    setHistorial(h => [...h, { ...pregunta, correcto: true }]);
    toast.success(`⚔️ +${monedas} 🪙`);

    if (nuevaVida <= 0 || nuevosAciertos >= TOTAL_PREGUNTAS) {
      setBossAnim("muerto");
      setTimeout(() => {
        store.monedas += PREMIO_SUPREMO + monedasGanadas;
        useGameStore.setState({ monedas: store.monedas + PREMIO_SUPREMO + monedasGanadas });
        setConfetti(true);
        setFase("victoria");
        if (!store.modoDemo) store.guardarProgreso();
      }, 1500);
      return;
    }

    setTimeout(() => {
      setBossAnim("idle");
      nuevaPregunta();
    }, 700);
  };

  const procesarError = () => {
    clearInterval(timerRef.current);
    setBossAnim("attack");
    const nuevosErrores = errores + 1;
    setErrores(nuevosErrores);
    setHistorial(h => [...h, { ...pregunta, correcto: false }]);
    useGameStore.setState({ vidas: Math.max(0, store.vidas - 1) });
    toast.error("💥 ¡El OMEGA te ataca!");

    if (nuevosErrores >= 3 || store.vidas - 1 <= 0) {
      setBossAnim("attack");
      setTimeout(() => setFase("derrota"), 1500);
      return;
    }

    setTimeout(() => {
      setBossAnim("idle");
      nuevaPregunta();
    }, 1200);
  };

  const responder = (op) => {
    if (bloqueado.current || seleccionado !== null) return;
    bloqueado.current = true;
    clearInterval(timerRef.current);
    setSeleccionado(op);
    if (op === pregunta.respuesta) procesarAcierto(op);
    else procesarError();
  };

  // ─── INTRO ────────────────────────────────────────────────
  if (fase === "intro") return (
    <div className="page" style={{
      background:"radial-gradient(ellipse at center, #2a0010 0%, #030010 70%)",
      minHeight:"100vh", justifyContent:"center", alignItems:"center", padding:16
    }}>
      <motion.div
        initial={{ opacity:0, scale:0.7 }}
        animate={{ opacity:1, scale:1 }}
        style={{ maxWidth:560, width:"100%", textAlign:"center" }}
      >
        <motion.div
          animate={{ rotate:[0,-5,5,0], scale:[1,1.05,1] }}
          transition={{ duration:3, repeat:Infinity }}
          style={{ fontSize:120, lineHeight:1, marginBottom:16, filter:"drop-shadow(0 0 40px #ff006e)" }}
        >
          😈
        </motion.div>
        <h1 style={{ fontFamily:"Orbitron,monospace", fontSize:"clamp(20px,5vw,36px)", fontWeight:900, color:"#ff006e", marginBottom:8, letterSpacing:3 }}>
          OMEGA
        </h1>
        <p style={{ fontFamily:"Orbitron,monospace", color:"#FFD700", fontSize:14, marginBottom:16, letterSpacing:2 }}>
          EL SEÑOR DE TODAS LAS TABLAS
        </p>
        <div style={{
          background:"rgba(255,0,110,0.1)", border:"2px solid rgba(255,0,110,0.3)",
          borderRadius:20, padding:24, marginBottom:24
        }}>
          <p style={{ fontFamily:"Nunito,sans-serif", fontSize:16, color:"rgba(255,255,255,0.8)", lineHeight:1.6, fontStyle:"italic", marginBottom:16 }}>
            "¡JA JA JA! ¡Llegaste al fin del universo! Solo el verdadero maestro de las tablas puede derrotarme. ¿Estás listo?"
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[
              ["😈 Vida del boss", "15 golpes"],
              ["📝 Preguntas", `${TOTAL_PREGUNTAS} preguntas`],
              ["⏱ Tiempo", `${TIEMPO_POR_PREGUNTA}s por pregunta`],
              ["💀 Vidas", "¡Solo 3 errores!"],
              ["📚 Tablas", "Del 1 al 10 mezcladas"],
              ["🪙 Premio", `${(PREMIO_SUPREMO + TOTAL_PREGUNTAS * 100).toLocaleString()} monedas`],
            ].map(([k, v]) => (
              <div key={k} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"10px 12px", textAlign:"left" }}>
                <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)" }}>{k}</div>
                <div style={{ fontFamily:"Orbitron,monospace", fontSize:13, color:"#fff", marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={() => store.setPagina("mapa")} className="btn btn-neon" style={{ flex:1, padding:14 }}>
            ← Volver
          </button>
          <motion.button
            whileHover={{ scale:1.04 }} whileTap={{ scale:0.97 }}
            onClick={() => setFase("batalla")}
            style={{
              flex:2, background:"linear-gradient(135deg, #ff006e, #c0392b)",
              border:"none", borderRadius:16, color:"#fff", padding:16,
              fontFamily:"Orbitron,monospace", fontSize:18, fontWeight:700, cursor:"pointer",
              boxShadow:"0 8px 30px rgba(255,0,110,0.5)"
            }}
          >
            ⚔️ ¡ACEPTAR DESAFÍO!
          </motion.button>
        </div>
      </motion.div>
    </div>
  );

  // ─── VICTORIA ─────────────────────────────────────────────
  if (fase === "victoria") return (
    <div className="page" style={{
      background:"radial-gradient(ellipse at center, #1a0d00 0%, #030010 60%)",
      minHeight:"100vh", justifyContent:"center", alignItems:"center", padding:16
    }}>
      {confetti && <Confetti width={size.w} height={size.h} numberOfPieces={400} recycle={false} colors={["#FFD700","#ff006e","#00f5ff","#39ff14"]} />}
      <motion.div
        initial={{ scale:0 }} animate={{ scale:1 }}
        transition={{ type:"spring", stiffness:120 }}
        style={{ maxWidth:500, width:"100%", textAlign:"center" }}
      >
        <motion.div
          animate={{ rotate:[0,-15,15,0], scale:[1,1.2,1] }}
          transition={{ duration:2, repeat:Infinity }}
          style={{ fontSize:120, filter:"drop-shadow(0 0 40px #FFD700)" }}
        >🏆</motion.div>
        <h1 style={{ fontFamily:"Orbitron,monospace", fontSize:"clamp(22px,6vw,42px)", fontWeight:900,
          background:"linear-gradient(90deg,#FFD700,#ff006e,#FFD700)", backgroundSize:"200% auto",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          animation:"marquee-bg 3s linear infinite", margin:"16px 0 8px" }}>
          ¡¡¡CAMPEÓN SUPREMO!!!
        </h1>
        <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.6)", fontSize:16, marginBottom:24 }}>
          Derrotaste a OMEGA. ¡Eres el Maestro de las Tablas!
        </p>
        <div style={{ background:"rgba(5,8,30,0.9)", border:"2px solid #FFD700", borderRadius:24, padding:24, marginBottom:24 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
            <StatBox label="Aciertos" value={`✅ ${aciertos}/${TOTAL_PREGUNTAS}`} color="#39ff14" />
            <StatBox label="Errores" value={`❌ ${errores}`} color="#ff006e" />
            <StatBox label="Monedas ganadas" value={`🪙 ${(monedasGanadas + PREMIO_SUPREMO).toLocaleString()}`} color="#FFD700" />
            <StatBox label="Total monedas" value={`🪙 ${store.monedas.toLocaleString()}`} color="#00f5ff" />
          </div>
          <motion.div animate={{y:[0,-8,0]}} transition={{duration:1.5,repeat:Infinity}}
            style={{fontSize:80, filter:`drop-shadow(0 0 20px ${avatar.color})`}}>
            {avatar.emoji}
          </motion.div>
        </div>
        {/* Resumen de errores */}
        {historial.filter(h => !h.correcto).length > 0 && (
          <div style={{ background:"rgba(255,0,110,0.08)", border:"1px solid rgba(255,0,110,0.2)", borderRadius:16, padding:16, marginBottom:20, textAlign:"left" }}>
            <p style={{ fontFamily:"Orbitron,monospace", fontSize:12, color:"#ff006e", marginBottom:10 }}>❌ REPASA ESTAS TABLAS:</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {historial.filter(h => !h.correcto).map((h, i) => (
                <span key={i} style={{ background:"rgba(255,255,255,0.07)", borderRadius:8, padding:"4px 10px", fontFamily:"Orbitron,monospace", fontSize:13, color:"#fff" }}>
                  {h.num1}×{h.num2}={h.num1*h.num2}
                </span>
              ))}
            </div>
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <button onClick={() => store.setPagina("tienda")} className="btn btn-gold btn-full" style={{ padding:14, fontSize:16 }}>
            🛒 IR A LA TIENDA — ¡Compra armas legendarias!
          </button>
          <button onClick={() => { setFase("intro"); setAciertos(0); setErrores(0); setBossVida(15); setMonedasGanadas(0); setHistorial([]); setConfetti(false); useGameStore.setState({vidas:3}); }}
            className="btn btn-neon btn-full" style={{ padding:12 }}>
            🔄 Jugar de nuevo
          </button>
          <button onClick={() => store.setPagina("mapa")} className="btn btn-sm"
            style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.4)", borderRadius:10, cursor:"pointer", padding:"10px" }}>
            🗺️ Volver al mapa
          </button>
        </div>
      </motion.div>
    </div>
  );

  // ─── DERROTA ──────────────────────────────────────────────
  if (fase === "derrota") return (
    <div className="page" style={{
      background:"radial-gradient(ellipse at center, #1a0000 0%, #030010 60%)",
      minHeight:"100vh", justifyContent:"center", alignItems:"center", padding:16
    }}>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ maxWidth:460, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:100 }}>💀</div>
        <h1 style={{ fontFamily:"Orbitron,monospace", color:"#ff006e", fontSize:28, margin:"16px 0 8px" }}>GAME OVER</h1>
        <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.5)", marginBottom:24 }}>
          OMEGA fue demasiado poderoso esta vez. ¡Practica más y vuelve!
        </p>
        <div style={{ background:"rgba(255,0,110,0.08)", border:"1px solid rgba(255,0,110,0.2)", borderRadius:16, padding:16, marginBottom:20 }}>
          <p style={{ fontFamily:"Orbitron,monospace", fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:10 }}>REPASA ESTAS TABLAS ANTES DE VOLVER:</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
            {historial.filter(h => !h.correcto).slice(0,10).map((h, i) => (
              <span key={i} style={{ background:"rgba(255,255,255,0.07)", borderRadius:8, padding:"4px 10px", fontFamily:"Orbitron,monospace", fontSize:13, color:"#fff" }}>
                {h.num1}×{h.num2}={h.num1*h.num2}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={() => { setFase("intro"); setAciertos(0); setErrores(0); setBossVida(15); setMonedasGanadas(0); setHistorial([]); useGameStore.setState({vidas:3}); }}
            className="btn btn-primary" style={{ flex:1, padding:14 }}>🔄 Intentar de nuevo</button>
          <button onClick={() => store.setPagina("mapa")} className="btn btn-neon" style={{ flex:1, padding:14 }}>🗺️ Ir al mapa</button>
        </div>
      </motion.div>
    </div>
  );

  // ─── BATALLA ──────────────────────────────────────────────
  const vidaPct = (bossVida / 15) * 100;

  return (
    <div className="page" style={{
      background:`radial-gradient(ellipse at center, #2a0010 0%, #030010 70%)`,
      minHeight:"100vh", padding:"0 0 32px"
    }}>
      {/* HUD */}
      <div className="hud" style={{ background:"rgba(0,0,0,0.9)", borderBottom:"1px solid rgba(255,0,110,0.3)" }}>
        <div className="hud-item">
          {[0,1,2].map(i => (
            <span key={i} style={{ fontSize:18, opacity: i < store.vidas ? 1 : 0.2 }}>❤️</span>
          ))}
        </div>
        <div className="hud-item">
          <span className="hud-value" style={{color:"#FFD700"}}>🪙 +{monedasGanadas.toLocaleString()}</span>
        </div>
        <div style={{marginLeft:"auto", fontFamily:"Orbitron,monospace", fontSize:11, color:"#ff006e", letterSpacing:2}}>
          👑 MUNDO SUPREMO
        </div>
      </div>

      <div style={{ maxWidth:700, margin:"0 auto", padding:"16px" }}>
        {/* Progreso batalla */}
        <div style={{ display:"flex", gap:4, justifyContent:"center", marginBottom:16, flexWrap:"wrap" }}>
          {Array.from({length:TOTAL_PREGUNTAS}, (_,i) => (
            <div key={i} style={{
              width:24, height:24, borderRadius:6, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center",
              background: i < historial.length ? (historial[i]?.correcto ? "rgba(57,255,20,0.3)" : "rgba(255,0,110,0.3)") : "rgba(255,255,255,0.06)",
              border:`1px solid ${i < historial.length ? (historial[i]?.correcto ? "rgba(57,255,20,0.5)" : "rgba(255,0,110,0.5)") : "rgba(255,255,255,0.1)"}`,
            }}>
              {i < historial.length ? (historial[i]?.correcto ? "✓" : "✗") : ""}
            </div>
          ))}
        </div>

        {/* Boss */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"Orbitron,monospace", fontSize:12, color:"#ff006e", marginBottom:6 }}>
              😈 OMEGA — SEÑOR SUPREMO
            </div>
            <div className="boss-vita-bar">
              <motion.div className="boss-vita-fill" animate={{width:`${vidaPct}%`}} transition={{duration:0.5}}
                style={{ background:"linear-gradient(90deg, #ff006e, #FFD700)" }} />
            </div>
            <div style={{ fontFamily:"Rajdhani,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>
              ❤️ {bossVida} / 15
            </div>
            <motion.div
              animate={bossAnim==="hurt" ? {x:[-20,20,-10,10,0]} : bossAnim==="attack" ? {x:[0,30,-10,0],scale:[1,1.2,1]} : bossAnim==="muerto" ? {scale:[1,1.3,0],opacity:[1,1,0]} : {y:[0,-10,0]}}
              transition={{duration:bossAnim==="idle"?2:0.5, repeat:bossAnim==="idle"?Infinity:0, ease:"easeInOut"}}
              style={{fontSize:100, lineHeight:1, textAlign:"center", filter:"drop-shadow(0 0 30px #ff006e)", marginTop:8}}
            >
              {bossAnim === "muerto" ? "💀" : "😈"}
            </motion.div>
          </div>
          <div style={{ textAlign:"center" }}>
            <motion.div animate={{y:[0,-6,0]}} transition={{duration:1.5,repeat:Infinity,ease:"easeInOut"}}
              style={{fontSize:70, filter:`drop-shadow(0 0 12px ${avatar.color})`}}>
              {avatar.emoji}
            </motion.div>
            <div style={{display:"flex",gap:3,justifyContent:"center",marginTop:4}}>
              {[0,1,2].map(i=><span key={i} style={{fontSize:14, opacity:i<store.vidas?1:0.2}}>❤️</span>)}
            </div>
          </div>
        </div>

        {/* Timer */}
        <div style={{ textAlign:"center", marginBottom:8 }}>
          <motion.div
            animate={tiempoRestante<=3?{scale:[1,1.15,1],color:["#ff006e","#fff","#ff006e"]}:{}}
            transition={{duration:0.4,repeat:Infinity}}
            style={{fontFamily:"Orbitron,monospace", fontSize:32, fontWeight:700, color:tiempoRestante<=3?"#ff006e":tiempoRestante<=6?"#FFD700":"#fff"}}
          >
            ⏱ {tiempoRestante}s
          </motion.div>
        </div>

        {/* Pregunta */}
        <AnimatePresence mode="wait">
          <motion.div key={`${pregunta.num1}-${pregunta.num2}`}
            initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
            className="question-card" style={{marginBottom:16, background:"linear-gradient(135deg,rgba(255,0,110,0.2),rgba(255,214,0,0.1))"}}>
            <div style={{fontFamily:"Orbitron,monospace", fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:8, letterSpacing:2}}>
              PREGUNTA {historial.length + 1} / {TOTAL_PREGUNTAS}
            </div>
            <div className="question-number" style={{fontSize:"clamp(44px,10vw,80px)"}}>
              {pregunta.num1} × {pregunta.num2} = ?
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Opciones */}
        <div className="opciones-grid">
          {opciones.map((op,i)=>(
            <motion.button key={`${op}-${i}`}
              className={`opcion-btn ${seleccionado===op?(op===pregunta.respuesta?"correcto":"incorrecto"):""}`}
              whileHover={!seleccionado?{scale:1.04,y:-4}:{}} whileTap={!seleccionado?{scale:0.97}:{}}
              onClick={()=>responder(op)} disabled={!!seleccionado}
              initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
            >{op}</motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"12px 8px", border:"1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:"Orbitron,monospace", fontSize:15, fontWeight:700, color }}>{value}</div>
    </div>
  );
}
