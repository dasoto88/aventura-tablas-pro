import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";
import { MUNDOS, AVATARES, TIENDA_ITEMS, getPoderes } from "../utils/gameData";
import soundManager from "../utils/sounds";
import voiceManager from "../utils/voice";
import AvatarAnimado from "../components/AvatarAnimado";

function generarPreguntaBoss(mundo) {
  if (mundo.esSupremo) {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    return { num1: n1, num2: n2, respuesta: n1 * n2 };
  }
  const tabla = mundo.tabla;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1: tabla, num2, respuesta: tabla * num2 };
}

function generarOpciones(respuesta) {
  const opts = new Set([respuesta]);
  while (opts.size < 4) {
    const v = Math.max(1, respuesta + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 12 + 1));
    opts.add(v);
  }
  return [...opts].sort(() => Math.random() - 0.5);
}

const FRASES_BOSS = [
  "¡Ja ja ja! ¡Nadie me derrota!",
  "¡Responde si puedes, pequeño!",
  "¡Las tablas son mi armadura!",
  "¡Demuestra lo que sabes!",
  "¡Solo los valientes llegan aquí!",
];
const FRASES_HURT   = ["¡Ayyy! 😤","¡Eso dolió! 😠","¡Me golpeaste! 💢","¡No puede ser! 😡"];
const FRASES_ATAQUE = ["¡TOMA ESO! 💥","¡Fallaste! 😈","¡Soy invencible! 👿","¡Ja! Demasiado lento 😂"];

function getProyectilAvatar(equipado) {
  const arma = equipado?.arma ? TIENDA_ITEMS?.find(i => i.id === equipado.arma) : null;
  return arma ? arma.emoji : "⚔️";
}

export default function BossPage() {
  const store = useGameStore();
  const mundo = MUNDOS[store.mundoActual];
  const avatar = AVATARES.find(a => a.id === store.avatarId) || AVATARES[0];

  // Poderes activos
  const poderes = getPoderes(store.inventario, store.equipado, store.avatarId);
  const tiempoBase = Math.max(5, 9 + poderes.bonusTiempo);
  const danoPorGolpe = poderes.danoDoble ? 2 : 1;
  const inmortal = poderes.inmortalSupremo && mundo.esSupremo;
  // Escudo: absorbe primer error en el boss
  const [escudoActivo, setEscudoActivo] = useState(poderes.escudo);
  const [escudoUsado, setEscudoUsado] = useState(false);

  const [pregunta, setPregunta] = useState(() => generarPreguntaBoss(mundo));
  const [opciones, setOpciones] = useState([]);
  const [bossVida, setBossVida] = useState(mundo.bossVida);
  const [bossVidaMax] = useState(mundo.bossVida);
  const [bossAnimacion, setBossAnimacion] = useState("idle");
  const [seleccionado, setSeleccionado] = useState(null);
  const [tiempoRestante, setTiempoRestante] = useState(tiempoBase);
  const [dialogoBoss, setDialogoBoss] = useState(true);
  const [mostrarRespuesta, setMostrarRespuesta] = useState(false);
  const [fraseBoss, setFraseBoss] = useState(FRASES_BOSS[Math.floor(Math.random() * FRASES_BOSS.length)]);
  const [avatarAnim, setAvatarAnim] = useState("idle");
  const [proyectil, setProyectil] = useState(null);

  const bloqueado = useRef(false);
  const timerRef  = useRef(null);

  // Voz villano al aparecer
  useEffect(() => {
    if (dialogoBoss) {
      const fraseCompleta = `${mundo.bossNombre}... ${fraseBoss}`;
      setTimeout(() => voiceManager.hablarVillano(fraseCompleta, store.mundoActual), 800);
    }
    // eslint-disable-next-line
  }, []);

  // Música de batalla
  useEffect(() => {
    if (!dialogoBoss) soundManager.iniciarMusicaBoss();
    return () => {
      soundManager.detenerMusicaBoss();
      soundManager.iniciarMusica();
    };
  }, [dialogoBoss]);

  const mostrarProyectil = (emoji, dir, color = "#FFD700") => {
    const id = Date.now();
    setProyectil({ id, emoji, dir, color });
    setTimeout(() => setProyectil(null), 650);
  };

  useEffect(() => {
    const p = generarPreguntaBoss(mundo);
    setPregunta(p);
    setOpciones(generarOpciones(p.respuesta));
  }, [mundo]);

  useEffect(() => {
    if (dialogoBoss || mostrarRespuesta || bossAnimacion === "muerto") return;
    setTiempoRestante(tiempoBase);
    timerRef.current = setInterval(() => {
      setTiempoRestante(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!bloqueado.current) { bloqueado.current = true; handleIncorrecto(); }
          return 0;
        }
        if (t <= 4) soundManager.tickPeligro();
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [pregunta, dialogoBoss, mostrarRespuesta]);

  const nuevaPregunta = () => {
    const p = generarPreguntaBoss(mundo);
    setPregunta(p);
    setOpciones(generarOpciones(p.respuesta));
    setSeleccionado(null);
    setMostrarRespuesta(false);
    bloqueado.current = false;
  };

  const handleCorrecto = () => {
    clearInterval(timerRef.current);
    setSeleccionado("correcto");
    setAvatarAnim("attack");

    const proyectilEmoji = getProyectilAvatar(store.equipado);
    mostrarProyectil(proyectilEmoji, "toLeft", "#FFD700");

    setTimeout(() => {
      setBossAnimacion("hurt");
      setFraseBoss(FRASES_HURT[Math.floor(Math.random() * FRASES_HURT.length)]);
      const nuevaVida = Math.max(0, bossVida - danoPorGolpe);
      setBossVida(nuevaVida);
      soundManager.ataqueBoss();

      if (danoPorGolpe > 1) toast.success(`⚔️ ¡GOLPE DOBLE! -${danoPorGolpe} ❤️ al boss`);
      else toast.success("⚔️ ¡Golpe directo!");

      if (nuevaVida <= 0) {
        setBossAnimacion("muerto");
        setAvatarAnim("celebrate");
        soundManager.detenerMusicaBoss();
        soundManager.bossDerrotado();
        setTimeout(() => {
          store.completarMundo();
          store.setPagina("mundo_completo");
        }, 2500);
        return;
      }
      setTimeout(() => { setBossAnimacion("idle"); setAvatarAnim("idle"); nuevaPregunta(); }, 900);
    }, 400);
  };

  const handleIncorrecto = () => {
    clearInterval(timerRef.current);
    setSeleccionado("incorrecto");

    // Inmortal en mundo supremo
    if (inmortal) {
      toast("🌟 ¡OMEGA BLADE! Eres inmortal en el Mundo Supremo", { icon: "🌟", duration: 1800 });
      setTimeout(() => { setBossAnimacion("idle"); setAvatarAnim("idle"); nuevaPregunta(); }, 1000);
      return;
    }

    // Escudo absorbe primer error en boss
    if (escudoActivo && !escudoUsado) {
      setEscudoUsado(true);
      setEscudoActivo(false);
      setBossAnimacion("attack");
      mostrarProyectil(mundo.bossEmoji, "toRight", mundo.color);
      toast("🛡️ ¡Escudo absorbió el ataque del boss!", { icon: "🛡️", duration: 1800 });
      setTimeout(() => { setBossAnimacion("idle"); setAvatarAnim("idle"); nuevaPregunta(); }, 1200);
      return;
    }

    setBossAnimacion("attack");
    mostrarProyectil(mundo.bossEmoji, "toRight", mundo.color);

    setTimeout(() => {
      setAvatarAnim("sad");
      setFraseBoss(FRASES_ATAQUE[Math.floor(Math.random() * FRASES_ATAQUE.length)]);
      soundManager.bossAtaca();
      const nuevasVidas = store.vidas - 1;
      toast.error(`💥 ¡${mundo.bossNombre} te ataca!`);

      if (nuevasVidas <= 0) {
        soundManager.detenerMusicaBoss();
        soundManager.gameOver();
        setTimeout(() => { store.atacarBoss(false); store.setPagina("juego"); }, 2500);
        return;
      }
      useGameStore.setState({ vidas: nuevasVidas });
      setMostrarRespuesta(true);
      setTimeout(() => { setBossAnimacion("idle"); setAvatarAnim("idle"); nuevaPregunta(); }, 2500);
    }, 400);
  };

  const responder = (op) => {
    if (bloqueado.current || seleccionado) return;
    bloqueado.current = true;
    clearInterval(timerRef.current);
    setSeleccionado(op);
    if (op === pregunta.respuesta) handleCorrecto();
    else handleIncorrecto();
  };

  const vidaPct = (bossVida / bossVidaMax) * 100;

  return (
    <div className="page" style={{ background:`radial-gradient(ellipse at center, ${mundo.colorOscuro} 0%, #030010 70%)`, minHeight:"100vh", padding:"0 0 32px" }}>
      <div className="hud" style={{ background:"rgba(0,0,0,0.85)" }}>
        <div className="hud-item">
          {Array.from({ length: Math.max(3, store.vidas) }, (_, i) => (
            <motion.span key={i} animate={i<store.vidas?{scale:[1,1.1,1]}:{}} transition={{duration:1.5,repeat:Infinity,delay:i*0.3}}
              className={`vida ${i<store.vidas?"activa":"perdida"}`}>❤️</motion.span>
          ))}
          {escudoActivo && !escudoUsado && <span style={{ fontSize: 14, marginLeft: 3 }}>🛡️</span>}
          {inmortal && <span style={{ fontSize: 14, marginLeft: 3 }}>🌟</span>}
        </div>
        <div className="hud-item"><span>🪙</span><span className="hud-value" style={{color:"#FFD700"}}>{store.monedas.toLocaleString()}</span></div>
        {danoPorGolpe > 1 && (
          <div className="hud-item" style={{ color: "#ff006e", fontFamily: "Orbitron, monospace", fontSize: 11 }}>
            ⚔️ ×2 daño
          </div>
        )}
        <div style={{marginLeft:"auto", fontFamily:"Orbitron,monospace", fontSize:12, color:mundo.color, letterSpacing:2}}>
          ⚔️ BATALLA BOSS — {mundo.esSupremo ? "Tablas 1-10" : `Tabla del ${mundo.tabla}`}
        </div>
      </div>

      <div style={{ padding:"16px", maxWidth:700, margin:"0 auto" }}>

        {/* Diálogo entrada boss */}
        <AnimatePresence>
          {dialogoBoss && (
            <motion.div initial={{opacity:0,scale:0.7}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.7}}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
              <div style={{ background:`linear-gradient(135deg,${mundo.colorOscuro},#030010)`, border:`3px solid ${mundo.color}`, borderRadius:28, padding:40, textAlign:"center", maxWidth:460, width:"100%" }}>
                <motion.div animate={{scale:[1,1.12,1],rotate:[0,-6,6,0]}} transition={{duration:1.8,repeat:Infinity}}
                  style={{fontSize:100,lineHeight:1,marginBottom:16,filter:`drop-shadow(0 0 35px ${mundo.color})`}}>
                  {mundo.bossEmoji}
                </motion.div>
                <h2 style={{fontFamily:"Orbitron,monospace",color:mundo.color,fontSize:22,marginBottom:8}}>{mundo.bossNombre}</h2>
                <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:14,padding:"14px 20px",marginBottom:16,fontFamily:"Nunito,sans-serif",fontSize:16,color:"rgba(255,255,255,0.8)",fontStyle:"italic"}}>
                  "{fraseBoss}"
                </div>
                {/* Poderes activos en boss */}
                {(danoPorGolpe > 1 || inmortal || (escudoActivo && !escudoUsado)) && (
                  <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginBottom:14 }}>
                    {danoPorGolpe > 1 && <span style={{ background:"rgba(255,0,110,0.2)", border:"1px solid #ff006e55", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#ff006e" }}>⚔️ Doble daño</span>}
                    {inmortal && <span style={{ background:"rgba(255,214,0,0.2)", border:"1px solid #FFD70055", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#FFD700" }}>🌟 Inmortal</span>}
                    {escudoActivo && !escudoUsado && <span style={{ background:"rgba(0,245,255,0.2)", border:"1px solid #00f5ff55", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#00f5ff" }}>🛡️ Escudo</span>}
                  </div>
                )}
                <div style={{background:"rgba(0,245,255,0.1)",border:"1px solid rgba(0,245,255,0.3)",borderRadius:12,padding:"10px 16px",marginBottom:20,fontFamily:"Nunito,sans-serif",fontSize:14,color:"#00f5ff"}}>
                  📚 {mundo.esSupremo ? "¡Todas las tablas del 1 al 10!" : `Este boss usa la Tabla del ${mundo.tabla}`} ¡Prepárate!
                </div>
                <motion.button whileHover={{scale:1.06}} whileTap={{scale:0.96}} onClick={() => { setDialogoBoss(false); soundManager.ataqueBoss(); }}
                  style={{background:`linear-gradient(135deg,${mundo.color},${mundo.colorOscuro})`,border:"none",borderRadius:16,color:"#fff",padding:"16px 40px",fontFamily:"Orbitron,monospace",fontSize:18,fontWeight:700,cursor:"pointer",boxShadow:`0 8px 30px ${mundo.color}66`}}>
                  ⚔️ ¡A LUCHAR!
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arena de batalla */}
        <div style={{ position: "relative" }}>
          <div style={{display:"flex",alignItems:"flex-end",gap:12,marginBottom:8}}>

            {/* Boss */}
            <div style={{flex:1}}>
              <div style={{fontFamily:"Orbitron,monospace",fontSize:12,color:mundo.color,marginBottom:4}}>
                {mundo.bossEmoji} {mundo.bossNombre}
              </div>
              <div className="boss-vita-bar">
                <motion.div className="boss-vita-fill" animate={{width:`${vidaPct}%`}} transition={{duration:0.5}}
                  style={{background:vidaPct>50?"linear-gradient(90deg,#ff006e,#ff4757)":vidaPct>25?"linear-gradient(90deg,#ff8c00,#ff006e)":"linear-gradient(90deg,#FFD700,#ff8c00)"}}/>
              </div>
              <div style={{fontFamily:"Rajdhani,sans-serif",fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:2}}>❤️ {bossVida}/{bossVidaMax}</div>

              <AnimatePresence mode="wait">
                <motion.div key={fraseBoss} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} exit={{opacity:0}}
                  style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"5px 10px",marginTop:6,fontFamily:"Nunito,sans-serif",fontSize:12,color:"rgba(255,255,255,0.6)",fontStyle:"italic"}}>
                  "{fraseBoss}"
                </motion.div>
              </AnimatePresence>

              <motion.div
                animate={
                  bossAnimacion==="hurt"
                    ? {x:[-20,20,-15,15,0],scale:[1,0.88,1],filter:[`drop-shadow(0 0 30px ${mundo.color})`,`drop-shadow(0 0 50px #ff006e)`,`drop-shadow(0 0 30px ${mundo.color})`]}
                  : bossAnimacion==="attack"
                    ? {x:[0,35,0],scale:[1,1.18,1],filter:[`drop-shadow(0 0 30px ${mundo.color})`,`drop-shadow(0 0 60px #ff4500)`,`drop-shadow(0 0 30px ${mundo.color})`]}
                  : bossAnimacion==="muerto"
                    ? {scale:[1,1.3,0],rotate:[0,25,-25,0],opacity:[1,1,0]}
                    : {y:[0,-10,0],filter:[`drop-shadow(0 0 20px ${mundo.color})`,`drop-shadow(0 0 40px ${mundo.color})`,`drop-shadow(0 0 20px ${mundo.color})`]}
                }
                transition={{duration:bossAnimacion==="idle"?2:0.45,repeat:bossAnimacion==="idle"?Infinity:0,ease:"easeInOut"}}
                style={{fontSize:90,lineHeight:1,textAlign:"center",marginTop:6}}>
                {bossAnimacion==="muerto"?"💀":mundo.bossEmoji}
              </motion.div>
            </div>

            {/* Proyectil */}
            <div style={{ width: 60, position: "relative", height: 100, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
              <AnimatePresence>
                {proyectil && (
                  <motion.div
                    key={proyectil.id}
                    initial={{ x: proyectil.dir === "toLeft" ? 30 : -30, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                    animate={{ x: proyectil.dir === "toLeft" ? -120 : 120, y: [-5,5,-3,0], opacity: [1,1,0.8,0], scale: [1,1.3,1,0.5], rotate: proyectil.dir === "toLeft" ? [-20,20,-10] : [20,-20,10] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: "easeIn" }}
                    style={{ position: "absolute", fontSize: 34, filter: `drop-shadow(0 0 12px ${proyectil.color})`, pointerEvents: "none", zIndex: 20 }}
                  >
                    {proyectil.emoji}
                  </motion.div>
                )}
              </AnimatePresence>
              {!proyectil && (
                <motion.div
                  animate={{ scale: [1,1.15,1], opacity: [0.4,0.8,0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ fontFamily: "Orbitron,monospace", fontSize: 13, color: mundo.color, fontWeight: 900 }}
                >VS</motion.div>
              )}
            </div>

            {/* Avatar */}
            <div style={{textAlign:"center", flexShrink: 0}}>
              <div style={{fontFamily:"Nunito,sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>{store.nombre}</div>
              <AvatarAnimado avatarId={store.avatarId} animacion={avatarAnim} aciertos={0} inventario={store.inventario} equipado={store.equipado} size={70} />
              <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:4}}>
                {Array.from({ length: Math.max(3, store.vidas) }, (_, i) => (
                  <motion.span key={i}
                    animate={i < store.vidas ? { scale: [1,1.2,1] } : {}}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                    style={{fontSize:14, opacity: i < store.vidas ? 1 : 0.15}}>❤️</motion.span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Timer */}
        {!dialogoBoss && (
          <div style={{textAlign:"center",marginBottom:12}}>
            <motion.div animate={tiempoRestante<=5?{scale:[1,1.12,1]}:{}} transition={{duration:0.5,repeat:Infinity}}
              style={{fontFamily:"Orbitron,monospace",fontSize:26,fontWeight:700,color:tiempoRestante<=5?"#ff006e":tiempoRestante<=10?"#FFD700":"#fff"}}>
              ⏱ {tiempoRestante}s
            </motion.div>
          </div>
        )}

        {/* Pregunta */}
        <AnimatePresence mode="wait">
          <motion.div key={`${pregunta.num1}-${pregunta.num2}`}
            initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}
            className="question-card" style={{marginBottom:20,background:`linear-gradient(135deg,${mundo.color}22,rgba(255,0,110,0.15))`}}>
            {mostrarRespuesta && (
              <div style={{fontFamily:"Nunito,sans-serif",fontSize:14,color:"#FFD700",marginBottom:8}}>
                La respuesta era: <strong style={{color:"#00f5ff",fontSize:18}}>{pregunta.respuesta}</strong>
              </div>
            )}
            <div className="question-number" style={{fontSize:"clamp(48px,10vw,80px)"}}>
              {pregunta.num1} × {pregunta.num2} = ?
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Opciones */}
        <div className="opciones-grid">
          {opciones.map((op,i)=>(
            <motion.button key={`${op}-${i}`}
              className={`opcion-btn ${seleccionado===op?(op===pregunta.respuesta?"correcto":"incorrecto"):seleccionado&&op===pregunta.respuesta?"correcto":""}`}
              whileHover={!seleccionado?{scale:1.04,y:-4}:{}} whileTap={!seleccionado?{scale:0.97}:{}}
              onClick={()=>responder(op)} disabled={!!seleccionado}
              initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}>
              {op}
            </motion.button>
          ))}
        </div>

        <div style={{textAlign:"center",marginTop:20}}>
          <button onClick={()=>{
            soundManager.detenerMusicaBoss();
            soundManager.iniciarMusica();
            toast("Escapaste del boss.",{icon:"🏃"});
            store.setPagina("juego");
          }}
            style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.35)",padding:"8px 20px",borderRadius:12,fontFamily:"Nunito,sans-serif",fontSize:12,cursor:"pointer"}}>
            🏃 Huir (pierdes el progreso del mundo)
          </button>
        </div>
      </div>
    </div>
  );
}
