import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../utils/store";
import { MUNDOS } from "../utils/gameData";
import voiceManager from "../utils/voice";
import soundManager from "../utils/sounds";

export default function EstudioTablaPage() {
  const store = useGameStore();
  const mundo = MUNDOS[store.mundoActual];
  const tabla = mundo?.tabla || 1;

  const [leyendo, setLeyendo] = useState(false);
  const [hechoActual, setHechoActual] = useState(null); // índice 1-10 que se está leyendo
  const [terminado, setTerminado] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const stoppedRef = useRef(false);

  useEffect(() => {
    // Saludo al entrar
    voiceManager.hablar(`¡Bienvenido al ${mundo?.nombre}! Vamos a practicar la tabla del ${tabla}.`);
    return () => voiceManager.detener();
  }, []);

  const leerTabla = async () => {
    stoppedRef.current = false;
    setLeyendo(true);
    setTerminado(false);
    setHechoActual(null);
    soundManager.logro();

    await voiceManager.leerTabla(tabla, {
      onHecho: (i) => setHechoActual(i),
      onTerminado: () => {
        if (!stoppedRef.current) {
          setTerminado(true);
          setHechoActual(null);
          soundManager.mundoCompleto();
        }
        setLeyendo(false);
      },
    });
  };

  const detenerLectura = () => {
    stoppedRef.current = true;
    voiceManager.detener();
    setLeyendo(false);
    setHechoActual(null);
  };

  const pronunciarHecho = (n2) => {
    voiceManager.pronunciarHecho(tabla, n2);
    soundManager.correcto();
    setHechoActual(n2);
    setTimeout(() => setHechoActual(null), 1500);
  };

  const continuar = () => {
    voiceManager.detener();
    store.irAJuego();
  };

  const color = mundo?.color || "#00f5ff";
  const colorOscuro = mundo?.colorOscuro || "#001a2e";

  return (
    <div className="page" style={{
      background: `radial-gradient(ellipse at top, ${colorOscuro} 0%, #030010 80%)`,
      minHeight: "100vh", padding: "0 0 32px",
    }}>
      {/* HUD */}
      <div className="hud" style={{ background: "rgba(0,0,0,0.85)" }}>
        <div style={{ fontFamily:"Orbitron,monospace", fontSize:14, color }}>
          {mundo?.emoji} {mundo?.nombre}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={() => setVoiceOn(v => !v)}
            style={{ background:"transparent", border:`1px solid ${color}44`, color, borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:13, fontFamily:"Nunito,sans-serif" }}>
            {voiceOn ? "🔊 Voz ON" : "🔇 Voz OFF"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"16px" }}>

        {/* Título */}
        <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:60, marginBottom:8, filter:`drop-shadow(0 0 20px ${color})` }}>📚</div>
          <h2 style={{
            fontFamily:"Orbitron,monospace", fontSize:"clamp(20px,5vw,32px)", fontWeight:900,
            color, textShadow:`0 0 20px ${color}66`, marginBottom:8,
          }}>
            Tabla del {tabla}
          </h2>
          <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.55)", fontSize:15 }}>
            Toca cada operación para escucharla, o presiona "Leer toda la tabla"
          </p>
        </motion.div>

        {/* Tabla visual — 10 hechos */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:24 }}>
          {Array.from({length:10}, (_,i) => {
            const n2 = i + 1;
            const res = tabla * n2;
            const esActivo = hechoActual === n2;
            return (
              <motion.button
                key={n2}
                onClick={() => pronunciarHecho(n2)}
                whileHover={{ scale:1.04 }}
                whileTap={{ scale:0.97 }}
                animate={esActivo
                  ? { scale:[1,1.06,1], boxShadow:[`0 0 10px ${color}`,`0 0 30px ${color}`,`0 0 10px ${color}`] }
                  : { scale:1 }
                }
                transition={esActivo ? { duration:0.5, repeat:Infinity } : {}}
                style={{
                  background: esActivo
                    ? `linear-gradient(135deg, ${color}44, ${color}22)`
                    : "rgba(255,255,255,0.05)",
                  border: `2px solid ${esActivo ? color : "rgba(255,255,255,0.1)"}`,
                  borderRadius:16, padding:"14px 10px",
                  cursor:"pointer", textAlign:"center",
                  transition:"background 0.3s, border-color 0.3s",
                }}
              >
                <div style={{
                  fontFamily:"Orbitron,monospace",
                  fontSize:"clamp(14px,3vw,20px)",
                  fontWeight:900,
                  color: esActivo ? color : "rgba(255,255,255,0.85)",
                }}>
                  {tabla} × {n2} = <span style={{ color: esActivo ? "#fff" : color }}>{res}</span>
                </div>
                {esActivo && (
                  <motion.div
                    initial={{opacity:0}} animate={{opacity:1}}
                    style={{fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:4}}>
                    🔊 Escuchando...
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Botón leer tabla */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
          {!leyendo ? (
            <motion.button
              whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={leerTabla}
              style={{
                background:`linear-gradient(135deg, ${color}33, ${color}11)`,
                border:`2px solid ${color}66`,
                borderRadius:16, color, padding:"16px",
                fontFamily:"Orbitron,monospace", fontSize:16, fontWeight:700,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              }}
            >
              🔊 LEER TODA LA TABLA CON VOZ
            </motion.button>
          ) : (
            <motion.button
              initial={{opacity:0}} animate={{opacity:1}}
              whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={detenerLectura}
              style={{
                background:"rgba(255,0,110,0.15)", border:"2px solid rgba(255,0,110,0.4)",
                borderRadius:16, color:"#ff006e", padding:"16px",
                fontFamily:"Orbitron,monospace", fontSize:16, fontWeight:700, cursor:"pointer",
              }}
            >
              ⏹ Detener lectura
            </motion.button>
          )}

          {/* Estado de lectura */}
          <AnimatePresence>
            {leyendo && hechoActual && (
              <motion.div
                initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} exit={{opacity:0}}
                style={{
                  background:`linear-gradient(135deg, ${color}22, transparent)`,
                  border:`1px solid ${color}44`,
                  borderRadius:14, padding:"12px 20px", textAlign:"center",
                }}
              >
                <div style={{fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:4}}>
                  Leyendo...
                </div>
                <div style={{fontFamily:"Orbitron,monospace", fontSize:"clamp(22px,5vw,34px)", fontWeight:900, color}}>
                  {tabla} × {hechoActual} = {tabla * hechoActual}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {terminado && (
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
              style={{background:"rgba(57,255,20,0.1)",border:"2px solid rgba(57,255,20,0.4)",borderRadius:14,padding:12,textAlign:"center",fontFamily:"Nunito,sans-serif",fontSize:15,color:"#39ff14"}}>
              ✅ ¡Terminaste de escuchar la tabla del {tabla}! ¡Ahora a practicarla!
            </motion.div>
          )}
        </div>

        {/* Separador */}
        <div style={{borderTop:"1px solid rgba(255,255,255,0.08)", marginBottom:20}} />

        {/* Botones de acción */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <motion.button
            whileHover={{scale:1.04}} whileTap={{scale:0.97}}
            onClick={continuar}
            className="btn btn-primary btn-full"
            style={{ padding:"18px", fontSize:"clamp(14px,3vw,18px)" }}
          >
            ⚔️ ¡YA ME LA SÉ! — COMENZAR AVENTURA
          </motion.button>

          <motion.button
            whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={() => store.setPagina("mapa")}
            style={{
              background:"transparent", border:"1px solid rgba(255,255,255,0.2)",
              color:"rgba(255,255,255,0.4)", borderRadius:12, padding:"12px",
              fontFamily:"Nunito,sans-serif", fontSize:14, cursor:"pointer",
            }}
          >
            🗺️ Volver al mapa de mundos
          </motion.button>
        </div>

        {/* Tips */}
        <div style={{
          marginTop:20, padding:"14px 18px",
          background:"rgba(255,214,0,0.06)", border:"1px solid rgba(255,214,0,0.2)",
          borderRadius:14, fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)",
        }}>
          💡 <strong style={{color:"#FFD700"}}>Tip:</strong> Toca cada operación para escucharla individualmente. ¡Repite en voz alta para memorizar mejor!
        </div>
      </div>
    </div>
  );
}
