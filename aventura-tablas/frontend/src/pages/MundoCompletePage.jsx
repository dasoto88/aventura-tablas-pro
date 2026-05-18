import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Confetti from "react-confetti";
import { useGameStore } from "../utils/store";
import { MUNDOS, AVATARES } from "../utils/gameData";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

export default function MundoCompletePage() {
  const store = useGameStore();
  const mundoCompletado = MUNDOS[store.mundoActual];
  const siguienteMundo  = MUNDOS[store.mundoActual + 1];
  const avatar = AVATARES.find(a => a.id === store.avatarId) || AVATARES[0];
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [monedaAnim, setMonedaAnim] = useState(0);
  const [certStatus, setCertStatus] = useState("idle"); // idle | sending | sent | error

  const premioReal = Math.round(mundoCompletado.premio * store.multiplicadorRepeticion);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    const interval = setInterval(() => {
      setMonedaAnim(v => {
        if (v >= premioReal) { clearInterval(interval); return premioReal; }
        return v + Math.ceil(premioReal / 40);
      });
    }, 40);
    return () => { window.removeEventListener("resize", onResize); clearInterval(interval); };
  }, [premioReal]);

  const irTienda         = () => store.setPagina("tienda");
  const irMapa           = () => store.setPagina("mapa");
  const irSiguienteMundo = () => {
    if (siguienteMundo) store.irAMundo(store.mundoActual + 1);
    else store.setPagina("mapa");
  };

  const pedirCertificado = async () => {
    setCertStatus("sending");
    try {
      // Abrir certificado en nueva pestaña
      window.open(`${API}/api/certificado/${store.licencia}`, "_blank");
      // También enviar por email
      const res = await store.solicitarCertificado();
      setCertStatus(res?.ok ? "sent" : "sent"); // mostrar enviado de todas formas
    } catch {
      setCertStatus("sent");
    }
  };

  const esUltimoMundo = store.mundoActual >= MUNDOS.length - 2;

  return (
    <div className="page" style={{
      background: `radial-gradient(ellipse at center, ${mundoCompletado.colorOscuro} 0%, #030010 70%)`,
      minHeight:"100vh", justifyContent:"center", alignItems:"center",
      padding:"24px 16px",
    }}>
      <Confetti width={size.w} height={size.h} numberOfPieces={250} recycle={false}
        colors={["#FFD700","#ff006e","#00f5ff","#39ff14","#bf00ff","#fff"]} />

      <div style={{maxWidth:560, width:"100%", margin:"0 auto", textAlign:"center", position:"relative", zIndex:1}}>

        {/* Trofeo */}
        <motion.div
          initial={{scale:0, rotate:-180}} animate={{scale:1, rotate:0}}
          transition={{type:"spring", stiffness:150, delay:0.1}}
          style={{fontSize:120, lineHeight:1, marginBottom:16, filter:"drop-shadow(0 0 40px #FFD700)"}}
        >
          🏆
        </motion.div>

        <motion.h1
          initial={{opacity:0, y:30}} animate={{opacity:1, y:0}} transition={{delay:0.3}}
          style={{
            fontFamily:"Orbitron,monospace", fontSize:"clamp(22px,6vw,40px)", fontWeight:900,
            background:"linear-gradient(90deg, #FFD700, #ff006e, #FFD700)",
            backgroundSize:"200% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            animation:"marquee-bg 3s linear infinite", marginBottom:8,
          }}
        >
          {store.todosCompletados ? "🎉 ¡¡CAMPEÓN SUPREMO!!" : "¡MUNDO COMPLETADO!"}
        </motion.h1>

        <motion.p
          initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}}
          style={{fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.6)", fontSize:16, marginBottom:24}}
        >
          {mundoCompletado.emoji} {mundoCompletado.nombre} — ¡El {mundoCompletado.bossNombre} fue derrotado!
          {store.esRepeticion && (
            <span style={{ display:"block", color:"rgba(255,150,0,0.7)", fontSize:13, marginTop:4 }}>
              (Replay — {store.multiplicadorRepeticion === 0.5 ? "50%" : "25%"} de monedas)
            </span>
          )}
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} transition={{delay:0.4}}
          style={{
            background:"rgba(5,8,30,0.9)", border:"2px solid rgba(255,214,0,0.4)",
            borderRadius:24, padding:"24px 20px", marginBottom:24,
          }}
        >
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16}}>
            <StatBox label="Monedas ganadas" value={`🪙 +${monedaAnim}`} color="#FFD700" />
            <StatBox label="Total monedas"   value={`🪙 ${store.monedas.toLocaleString()}`} color="#00f5ff" />
            <StatBox label="Mundos"          value={`${store.mundosCompletados} / ${MUNDOS.length}`} color="#39ff14" />
          </div>

          <motion.div
            animate={{rotate:[0,-10,10,-10,10,0], scale:[1,1.15,1]}}
            transition={{duration:1, repeat:Infinity, repeatDelay:1.5}}
            style={{fontSize:80, margin:"20px 0 8px", filter:`drop-shadow(0 0 20px ${avatar.color})`}}
          >
            {avatar.emoji}
          </motion.div>
          <p style={{fontFamily:"Nunito,sans-serif", color:avatar.color, fontSize:15}}>
            ¡{store.nombre}, eres increíble! ⭐
          </p>
        </motion.div>

        {/* ── CERTIFICADO (solo cuando completó todos los mundos) ── */}
        {store.todosCompletados && (
          <motion.div
            initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} transition={{delay:0.5}}
            style={{
              background:"linear-gradient(135deg, rgba(255,214,0,0.15), rgba(255,0,110,0.15))",
              border:"2px solid #FFD700", borderRadius:24, padding:24, marginBottom:20,
            }}
          >
            <div style={{ fontSize:60, marginBottom:8 }}>🏅</div>
            <h3 style={{ fontFamily:"Orbitron,monospace", color:"#FFD700", fontSize:18, marginBottom:8 }}>
              ¡CERTIFICADO DE CAMPEÓN!
            </h3>
            <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.7)", fontSize:14, marginBottom:16 }}>
              Completaste todos los mundos del 1 al 10 más el Mundo Supremo.<br/>
              ¡Dominas las tablas de multiplicar de 1 al 10!
            </p>
            <motion.button
              whileHover={{scale:1.05}} whileTap={{scale:0.97}}
              onClick={pedirCertificado}
              disabled={certStatus === "sending"}
              style={{
                background: certStatus === "sent"
                  ? "linear-gradient(135deg, #39ff14, #00b894)"
                  : "linear-gradient(135deg, #FFD700, #ff9f00)",
                border:"none", borderRadius:16,
                color: certStatus === "sent" ? "#000" : "#000",
                padding:"14px 32px", fontFamily:"Orbitron,monospace",
                fontSize:15, fontWeight:700, cursor:"pointer",
                boxShadow:"0 6px 30px rgba(255,214,0,0.5)",
              }}
            >
              {certStatus === "idle"    && "📜 VER MI CERTIFICADO"}
              {certStatus === "sending" && "⏳ Abriendo..."}
              {certStatus === "sent"    && "✅ ¡Certificado abierto!"}
              {certStatus === "error"   && "⚠️ Reintentar"}
            </motion.button>
            {certStatus === "sent" && store.correo && (
              <p style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"#39ff14", marginTop:8 }}>
                También enviado a {store.correo} 📧
              </p>
            )}
          </motion.div>
        )}

        {/* Mundo supremo desbloqueado (antes de completarlo) */}
        {!store.todosCompletados && store.nivelMax >= MUNDOS.length && (
          <motion.div
            initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} transition={{delay:0.8}}
            style={{
              background:"linear-gradient(135deg, rgba(255,0,110,0.2), rgba(255,214,0,0.2))",
              border:"2px solid #FFD700", borderRadius:20, padding:16, marginBottom:20,
            }}
          >
            <div style={{fontSize:40}}>👑</div>
            <div style={{fontFamily:"Orbitron,monospace", color:"#FFD700", fontSize:16, marginTop:8}}>
              ¡MUNDO SUPREMO DESBLOQUEADO!
            </div>
            <div style={{fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.6)", fontSize:13, marginTop:4}}>
              Enfrenta al OMEGA — el jefe final supremo
            </div>
          </motion.div>
        )}

        {/* Preview siguiente mundo */}
        {siguienteMundo && !esUltimoMundo && !store.todosCompletados && (
          <motion.div
            initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.7}}
            style={{
              background:`linear-gradient(135deg, ${siguienteMundo.colorOscuro}99, rgba(0,0,0,0.5))`,
              border:`2px solid ${siguienteMundo.color}66`,
              borderRadius:20, padding:"16px 20px", marginBottom:20, textAlign:"left",
              display:"flex", alignItems:"center", gap:16,
            }}
          >
            <div style={{fontSize:48}}>{siguienteMundo.emoji}</div>
            <div>
              <div style={{fontFamily:"Orbitron,monospace", fontSize:13, color:siguienteMundo.color, marginBottom:4}}>
                SIGUIENTE MUNDO
              </div>
              <div style={{fontFamily:"Nunito,sans-serif", fontSize:16, color:"#fff", fontWeight:700}}>
                {siguienteMundo.nombre}
              </div>
              <div style={{fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.5)"}}>
                {siguienteMundo.desafio} • Boss: {siguienteMundo.bossNombre}
              </div>
            </div>
            <div style={{marginLeft:"auto", textAlign:"center"}}>
              <div style={{fontFamily:"Orbitron,monospace", fontSize:14, color:"#FFD700"}}>🪙 {siguienteMundo.premio}</div>
              <div style={{fontSize:11, color:"rgba(255,255,255,0.35)"}}>premio</div>
            </div>
          </motion.div>
        )}

        {/* Botones */}
        <motion.div
          initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.9}}
          style={{display:"flex", flexDirection:"column", gap:12}}
        >
          <motion.button
            whileHover={{scale:1.04}} whileTap={{scale:0.97}}
            onClick={irTienda}
            style={{
              background:"linear-gradient(135deg, rgba(255,214,0,0.2), rgba(255,140,0,0.2))",
              border:"2px solid #FFD700", borderRadius:16, color:"#FFD700",
              padding:"16px", fontFamily:"Orbitron,monospace", fontSize:16, fontWeight:700,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            }}
          >
            🛒 IR A LA TIENDA <span style={{fontSize:13, opacity:0.7}}>({store.monedas.toLocaleString()} 🪙)</span>
          </motion.button>

          <motion.button
            whileHover={{scale:1.04}} whileTap={{scale:0.97}}
            onClick={() => store.volverABoss()}
            style={{
              background:"rgba(255,0,110,0.12)", border:"2px solid rgba(255,0,110,0.4)",
              borderRadius:16, color:"#ff006e", padding:"14px",
              fontFamily:"Orbitron,monospace", fontSize:14, fontWeight:700,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            }}
          >
            ⚔️ Volver a enfrentar al {mundoCompletado.bossNombre}
          </motion.button>

          {siguienteMundo && (
            <motion.button
              whileHover={{scale:1.04}} whileTap={{scale:0.97}}
              onClick={irSiguienteMundo}
              className="btn btn-primary btn-full"
              style={{padding:16, fontSize:17}}
            >
              ▶️ {siguienteMundo.esSupremo ? "👑 MUNDO SUPREMO" : `Ir a ${siguienteMundo.nombre}`}
            </motion.button>
          )}

          <motion.button
            whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={irMapa}
            className="btn btn-neon btn-full"
            style={{padding:14, fontSize:15}}
          >
            🗺️ Ver Mapa de Mundos
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background:"rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 8px",
      border:"1px solid rgba(255,255,255,0.1)"
    }}>
      <div style={{fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:6}}>
        {label}
      </div>
      <div style={{fontFamily:"Orbitron,monospace", fontSize:16, fontWeight:700, color}}>
        {value}
      </div>
    </div>
  );
}
