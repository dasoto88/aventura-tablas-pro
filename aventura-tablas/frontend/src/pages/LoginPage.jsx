import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import axios from "axios";
import { useGameStore } from "../utils/store";
import soundManager from "../utils/sounds";

const API = process.env.REACT_APP_API_URL || "";
const TABS = ["🎮 JUGAR", "📝 REGISTRO", "🎁 DEMO", "ℹ️ INFO"];

const DATOS_BBVA = "Banco: BBVA | Cuenta: 4152314169570341 | Titular: David Soto Beltrán | Concepto: AventuraTablas + Nombre";

export default function LoginPage() {
  const [tab, setTab] = useState(0);
  const { iniciarSesion, iniciarDemo } = useGameStore();
  const [musicStarted, setMusicStarted] = useState(false);
  const [pagoEstado, setPagoEstado] = useState(null); // "ok" | "error" | "pendiente"

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pago = params.get("pago");
    if (pago) {
      setPagoEstado(pago);
      // Limpiar el parámetro de la URL sin recargar
      window.history.replaceState({}, "", window.location.pathname);
      if (pago === "ok") {
        toast.success("🎉 ¡Pago recibido! Tu licencia llegará a tu correo en segundos.");
      } else if (pago === "error") {
        toast.error("❌ El pago no se completó. Intenta de nuevo o contáctanos.");
      } else if (pago === "pendiente") {
        toast("⏳ Pago en proceso. Te avisaremos por correo cuando se confirme.", { icon: "⏳" });
      }
    }
  }, []);

  const startMusic = () => {
    if (!musicStarted) { soundManager.iniciarMusica(); setMusicStarted(true); }
  };

  return (
    <div className="page" onClick={startMusic}
      style={{ background: "radial-gradient(ellipse at center, #1a0035 0%, #030010 70%)", justifyContent: "center", alignItems: "center" }}>
      <Stars />
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ width: "100%", maxWidth: 540, padding: "0 16px", zIndex: 10 }}>

        <motion.div animate={{ filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ textAlign: "center", marginBottom: 32 }}>
          <motion.div animate={{ rotate: [0,-5,5,0], scale:[1,1.05,1] }} transition={{ duration: 3, repeat: Infinity }}
            style={{ fontSize: 72, lineHeight: 1, marginBottom: 8 }}>🦁⚔️🌟</motion.div>
          <h1 style={{
            fontFamily:"Orbitron,monospace", fontSize:"clamp(22px,6vw,38px)", fontWeight:900,
            background:"linear-gradient(90deg,#00f5ff,#ff006e,#FFD700,#00f5ff)", backgroundSize:"300% auto",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            animation:"marquee-bg 4s linear infinite", letterSpacing:3, marginBottom:6,
          }}>AVENTURA DE TABLAS</h1>
          <p style={{ fontFamily:"Rajdhani,sans-serif", color:"rgba(255,255,255,0.5)", fontSize:14, letterSpacing:4, textTransform:"uppercase" }}>
            PRO — EDICIÓN ÉPICA
          </p>
          {!musicStarted && <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.3)", fontSize:12, marginTop:8 }}>🔊 Toca aquí para activar el sonido</p>}
        </motion.div>

        <div className="card card-glow" style={{ background: "rgba(5,8,30,0.92)" }}>
          <div style={{ display:"flex", gap:2, marginBottom:24, background:"rgba(0,0,0,0.3)", borderRadius:14, padding:4 }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                flex:1, padding:"10px 2px",
                background: tab===i ? "linear-gradient(135deg,#667eea,#764ba2)" : "transparent",
                border:"none", borderRadius:10, cursor:"pointer",
                color: tab===i ? "#fff" : "rgba(255,255,255,0.45)",
                fontFamily:"Orbitron,monospace", fontSize:"clamp(8px,2vw,11px)",
                fontWeight:700, textTransform:"uppercase", transition:"all 0.3s",
              }}>{t}</button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.25 }}>
              {tab === 0 && <TabJugar iniciarSesion={iniciarSesion} />}
              {tab === 1 && <TabRegistro />}
              {tab === 2 && <TabDemo iniciarDemo={iniciarDemo} />}
              {tab === 3 && <TabInfo />}
            </motion.div>
          </AnimatePresence>
        </div>

        <p style={{ textAlign:"center", marginTop:20, color:"rgba(255,255,255,0.2)", fontFamily:"Rajdhani,sans-serif", fontSize:12 }}>
          Aventura de Tablas Pro v3.0 • Para niños de 1° a 3° grado
        </p>
      </motion.div>
    </div>
  );
}

// ─── TAB JUGAR ───────────────────────────────────────────────
function TabJugar({ iniciarSesion }) {
  const [licencia, setLicencia] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);

  const entrar = async () => {
    if (!licencia.trim()) { toast.error("Escribe tu licencia"); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/validar-licencia`, { licencia: licencia.trim() }, { timeout: 8000 });
      soundManager.logro();
      toast.success(`¡Bienvenido${data.nombre ? " " + data.nombre : ""}! 🎉`);
      iniciarSesion({ ...data, licencia: licencia.trim() });
    } catch (e) {
      soundManager.incorrecto();
      if (e.code === "ECONNABORTED" || e.message?.includes("timeout")) {
        toast.error("⏱ El servidor no responde. ¿Está corriendo el backend?");
      } else if (!e.response) {
        toast.error("🔌 No se puede conectar al servidor.");
      } else {
        toast.error(`❌ ${e.response?.data?.detail || "Licencia no válida"}`);
      }
    } finally { setLoading(false); }
  };

  return (
    <div>
      <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.6)", marginBottom:20, textAlign:"center", fontSize:15 }}>
        Ingresa tu código de aventurero para comenzar
      </p>
      <input className="input" placeholder="Tu código de licencia" value={licencia}
        onChange={e => setLicencia(e.target.value)}
        onKeyDown={e => e.key === "Enter" && entrar()}
        style={{ marginBottom:12, textAlign:"center", fontSize:20, letterSpacing:2 }}
      />
      <button className="btn btn-primary btn-full btn-lg" onClick={entrar} disabled={loading} style={{ marginBottom:12 }}>
        {loading ? "Verificando..." : "🚀 ¡COMENZAR AVENTURA!"}
      </button>
      <button onClick={() => setMostrarRecuperar(true)}
        style={{ width:"100%", background:"transparent", border:"none", color:"rgba(0,245,255,0.5)",
          fontFamily:"Nunito,sans-serif", fontSize:13, cursor:"pointer", textDecoration:"underline", padding:"4px 0" }}>
        🔑 ¿Olvidaste tu código de licencia?
      </button>
      <AnimatePresence>
        {mostrarRecuperar && <ModalRecuperar onClose={() => setMostrarRecuperar(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── MODAL RECUPERAR LICENCIA ────────────────────────────────
function ModalRecuperar({ onClose }) {
  const [correo, setCorreo] = useState("");
  const [celular, setCelular] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(null);

  const recuperar = async () => {
    if (!correo.trim() && !celular.trim()) { toast.error("Escribe tu correo o celular"); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/recuperar-licencia`, { correo: correo.trim(), celular: celular.trim() });
      setEnviado(data.correo);
      soundManager.logro();
    } catch (e) {
      toast.error(`❌ ${e.response?.data?.detail || "No encontramos tu cuenta"}`);
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ background:"linear-gradient(135deg,#1a1f4e,#0d1237)", border:"2px solid rgba(108,92,231,0.5)", borderRadius:24, padding:32, maxWidth:400, width:"100%", textAlign:"center" }}>
        {!enviado ? (
          <>
            <div style={{ fontSize:48, marginBottom:12 }}>🔑</div>
            <h3 style={{ fontFamily:"Orbitron,monospace", color:"#a29bfe", marginBottom:8, fontSize:16 }}>RECUPERAR LICENCIA</h3>
            <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.55)", fontSize:14, marginBottom:20 }}>
              Escribe el correo o celular con el que te registraste.
            </p>
            <input className="input" placeholder="📧 Tu correo electrónico" value={correo} onChange={e => setCorreo(e.target.value)} type="email" style={{ marginBottom:10 }} />
            <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.3)", fontSize:12, margin:"4px 0 10px" }}>— o —</p>
            <input className="input" placeholder="📱 Tu número de celular" value={celular} onChange={e => setCelular(e.target.value)} type="tel" style={{ marginBottom:20 }} />
            <button className="btn btn-primary btn-full" onClick={recuperar} disabled={loading} style={{ marginBottom:10 }}>
              {loading ? "Buscando..." : "📨 ENVIAR MI CÓDIGO"}
            </button>
            <button onClick={onClose} style={{ background:"transparent", border:"none", color:"rgba(255,255,255,0.3)", fontFamily:"Nunito,sans-serif", fontSize:13, cursor:"pointer" }}>Cancelar</button>
          </>
        ) : (
          <motion.div initial={{ scale:0 }} animate={{ scale:1 }}>
            <div style={{ fontSize:64, marginBottom:12 }}>📨</div>
            <h3 style={{ fontFamily:"Orbitron,monospace", color:"#00f5ff", marginBottom:8, fontSize:16 }}>¡CORREO ENVIADO!</h3>
            <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.6)", fontSize:14, marginBottom:20 }}>
              Enviamos tu código a <strong style={{ color:"#a29bfe" }}>{enviado}</strong>. Revisa tu bandeja.
            </p>
            <button className="btn btn-primary btn-full" onClick={onClose}>✅ Entendido</button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── TAB REGISTRO (multi-paso con tipos de usuario) ──────────
function calcularCosto(tipo, numDep) {
  if (tipo === "alumno") return { total: 99, tipoPago: "mensual", metodo: "ambos", desc: "$99 MXN / mes" };
  if (tipo === "padre") {
    const t = 99 * (1 + numDep);
    return { total: t, tipoPago: "mensual", metodo: "transferencia", desc: `$${t} MXN/mes ($99 tú + $99 × ${numDep} hijo${numDep !== 1 ? "s" : ""})` };
  }
  // maestro
  if (numDep < 10) {
    const t = 99 * (1 + numDep);
    return { total: t, tipoPago: "mensual", metodo: numDep > 0 ? "transferencia" : "ambos", desc: `$${t} MXN/mes ($99 tú + $99 × ${numDep} alumno${numDep !== 1 ? "s" : ""})` };
  }
  if (numDep <= 15)  return { total: 1000, tipoPago: "unico", metodo: "transferencia", desc: "$1,000 MXN pago único — 5 meses (10-15 alumnos)" };
  if (numDep <= 20)  return { total: 1500, tipoPago: "unico", metodo: "transferencia", desc: "$1,500 MXN pago único — 5 meses (16-20 alumnos)" };
  if (numDep <= 30)  return { total: 2000, tipoPago: "unico", metodo: "transferencia", desc: "$2,000 MXN pago único — 5 meses (21-30 alumnos)" };
  if (numDep <= 40)  return { total: 3000, tipoPago: "unico", metodo: "transferencia", desc: "$3,000 MXN pago único — 5 meses (31-40 alumnos)" };
  return { total: 4000, tipoPago: "unico", metodo: "transferencia", desc: "$4,000 MXN pago único — 5 meses (41-50 alumnos)" };
}

function TabRegistro() {
  const [paso, setPaso] = useState(1);  // 1=tipo, 2=datos, 3=deps, 4=resumen, 5=enviado
  const [tipo, setTipo] = useState("alumno");
  const [form, setForm] = useState({ nombre:"", correo:"", celular:"", escuela:"", grado:"" });
  const [deps, setDeps] = useState([{ nombre:"", correo:"", grado:"" }]);
  const [loading, setLoading] = useState(false);
  const [costoInfo, setCostoInfo] = useState(null);

  const esTutor = tipo === "maestro" || tipo === "padre";
  const depTxt  = tipo === "maestro" ? "alumnos" : "hijos";
  const numDeps = deps.filter(d => d.nombre.trim()).length;

  const addDep = () => setDeps(p => [...p, { nombre:"", correo:"", grado:"" }]);
  const removeDep = (i) => setDeps(p => p.filter((_, idx) => idx !== i));
  const updateDep = (i, f, v) => setDeps(p => p.map((d, idx) => idx === i ? { ...d, [f]: v } : d));

  const irPaso2 = () => {
    setPaso(2);
  };

  const irPaso3 = () => {
    if (!form.nombre || !form.correo || !form.celular) { toast.error("Llena nombre, correo y celular"); return; }
    if (!esTutor) { irPaso4(); return; }
    setPaso(3);
  };

  const irPaso4 = () => {
    const validos = esTutor ? deps.filter(d => d.nombre.trim()) : [];
    if (esTutor && validos.length === 0) { toast.error(`Agrega al menos un ${tipo === "maestro" ? "alumno" : "hijo"}`); return; }
    setCostoInfo(calcularCosto(tipo, validos.length));
    setPaso(4);
  };

  const enviar = async () => {
    setLoading(true);
    try {
      let respData;
      if (!esTutor) {
        const { data } = await axios.post(`${API}/api/registro`, {
          nombre: form.nombre, correo: form.correo, celular: form.celular,
          escuela: form.escuela || "", grado: form.grado || "", tipo: "alumno",
        }, { timeout: 12000 });
        respData = data;
      } else {
        const validos = deps.filter(d => d.nombre.trim());
        const { data } = await axios.post(`${API}/api/registro/grupo`, {
          tutor_nombre: form.nombre, tutor_correo: form.correo,
          tutor_celular: form.celular, tutor_escuela: form.escuela || "",
          tutor_tipo: tipo, dependientes: validos,
        }, { timeout: 12000 });
        respData = data;
      }
      soundManager.mundoCompleto();
      if (respData.init_point) {
        toast.success("¡Solicitud registrada! Redirigiendo a Mercado Pago... 💳");
        setTimeout(() => { window.location.href = respData.init_point; }, 1200);
      } else {
        toast.success("¡Solicitud enviada! Revisa tu correo 📧");
        setPaso(5);
      }
    } catch (e) {
      if (!e.response) toast.error("🔌 No se puede conectar al servidor.");
      else toast.error(e.response?.data?.detail || "Error al enviar. Intenta de nuevo.");
    } finally { setLoading(false); }
  };

  if (paso === 5) return (
    <motion.div initial={{ scale:0 }} animate={{ scale:1 }} style={{ textAlign:"center", padding:20 }}>
      <div style={{ fontSize:64 }}>📨</div>
      <h3 style={{ color:"#00f5ff", fontFamily:"Orbitron,monospace", margin:"16px 0 8px" }}>¡Solicitud recibida!</h3>
      <p style={{ color:"rgba(255,255,255,0.6)", fontFamily:"Nunito,sans-serif", lineHeight:1.6 }}>
        Revisa tu correo <strong style={{ color:"#a29bfe" }}>{form.correo}</strong>.<br/>
        Te enviamos los datos para completar tu pago.
      </p>
      {costoInfo && (
        <div style={{ margin:"16px 0", background:"rgba(255,214,0,0.1)", border:"1px solid rgba(255,214,0,0.3)", borderRadius:14, padding:"14px" }}>
          <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"#FFD700", fontWeight:700 }}>{costoInfo.desc}</div>
          {costoInfo.tipoPago === "unico" && <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:4 }}>Licencia ilimitada por 5 meses</div>}
        </div>
      )}
    </motion.div>
  );

  return (
    <div>
      {/* Indicador de pasos */}
      <div style={{ display:"flex", gap:6, marginBottom:20, justifyContent:"center" }}>
        {(esTutor ? [1,2,3,4] : [1,2,4]).map((p, i) => (
          <div key={i} style={{ width:28, height:6, borderRadius:3, background: paso >= p ? "linear-gradient(90deg,#667eea,#a29bfe)" : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>

      {/* PASO 1: elegir tipo */}
      {paso === 1 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.6)", marginBottom:16, textAlign:"center", fontSize:14 }}>
            ¿Qué tipo de cuenta quieres crear?
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
            {[
              { val:"alumno",  icon:"🧒", title:"Alumno Individual",    sub:"$99 MXN / mes — acceso completo al juego" },
              { val:"maestro", icon:"🎓", title:"Maestro",              sub:"Registra tu grupo de alumnos — precios especiales" },
              { val:"padre",   icon:"👨‍👩‍👧", title:"Padre de Familia",    sub:"Registra a tus hijos y monitorea su avance" },
            ].map(opt => (
              <button key={opt.val} onClick={() => setTipo(opt.val)}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderRadius:16, cursor:"pointer", textAlign:"left", transition:"all 0.2s",
                  background: tipo === opt.val ? "linear-gradient(135deg,rgba(102,126,234,0.3),rgba(118,75,162,0.3))" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${tipo === opt.val ? "rgba(102,126,234,0.6)" : "rgba(255,255,255,0.08)"}` }}>
                <span style={{ fontSize:36, flexShrink:0 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontFamily:"Orbitron,monospace", fontSize:13, color:"#fff", fontWeight:700, marginBottom:3 }}>{opt.title}</div>
                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.5)" }}>{opt.sub}</div>
                </div>
                {tipo === opt.val && <span style={{ marginLeft:"auto", color:"#667eea", fontSize:20 }}>✓</span>}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-full" onClick={irPaso2}>Continuar →</button>
        </motion.div>
      )}

      {/* PASO 2: datos personales */}
      {paso === 2 && (
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}>
          <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.5)", marginBottom:16, fontSize:13 }}>
            {tipo === "alumno" ? "🧒 Datos del alumno" : tipo === "maestro" ? "🎓 Datos del maestro" : "👨‍👩‍👧 Tus datos personales"}
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
            {[
              { key:"nombre",  label:"Nombre completo *",      type:"text"  },
              { key:"correo",  label:"Correo electrónico *",   type:"email" },
              { key:"celular", label:"Número de celular *",    type:"tel"   },
              { key:"escuela", label:`${tipo === "alumno" ? "Escuela" : tipo === "maestro" ? "Institución / Escuela" : ""}`, type:"text", skip: tipo === "padre" ? false : false },
            ].filter(f => f.label).map(f => (
              <input key={f.key} className="input" placeholder={f.label}
                value={form[f.key]} onChange={e => setForm(p => ({...p,[f.key]:e.target.value}))}
                type={f.type} />
            ))}
            {tipo === "alumno" && (
              <select className="input" style={{ cursor:"pointer" }} value={form.grado} onChange={e => setForm(p => ({...p, grado:e.target.value}))}>
                <option value="">— Grado escolar (opcional) —</option>
                {["1° Primaria","2° Primaria","3° Primaria","4° Primaria","5° Primaria","6° Primaria","1° Secundaria","2° Secundaria","3° Secundaria"].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
          </div>
          {!esTutor && (
            <div className="tip-box" style={{ marginBottom:14 }}>
              💳 Costo: <strong>$99 MXN / 30 días</strong> — Te enviamos los datos de pago por correo
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setPaso(1)} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"rgba(255,255,255,0.5)", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:14, padding:"12px" }}>← Atrás</button>
            <button className="btn btn-primary" style={{ flex:2, padding:12 }} onClick={irPaso3}>
              {esTutor ? `Agregar ${depTxt} →` : "Ver resumen →"}
            </button>
          </div>
        </motion.div>
      )}

      {/* PASO 3: agregar alumnos/hijos (solo maestro/padre) */}
      {paso === 3 && esTutor && (
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}>
          <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.5)", fontSize:13, marginBottom:12 }}>
            {tipo === "maestro" ? "🎓 Registra a tus alumnos" : "👨‍👩‍👧 Registra a tus hijos"}
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:280, overflowY:"auto", marginBottom:10 }}>
            {deps.map((d, i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.4)" }}>
                    {tipo === "maestro" ? "Alumno" : "Hijo/a"} #{i+1}
                  </span>
                  {deps.length > 1 && <button onClick={() => removeDep(i)} style={{ background:"transparent", border:"none", color:"#ff006e", cursor:"pointer", fontSize:15 }}>✕</button>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  <input className="input" style={{ fontSize:12 }} placeholder="Nombre *" value={d.nombre} onChange={e => updateDep(i,"nombre",e.target.value)} />
                  <input className="input" style={{ fontSize:12 }} placeholder="Correo (opcional)" value={d.correo} onChange={e => updateDep(i,"correo",e.target.value)} type="email" />
                  <input className="input" style={{ fontSize:12, gridColumn:"1/-1" }} placeholder="Grado escolar" value={d.grado} onChange={e => updateDep(i,"grado",e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          {deps.length < 50 && (
            <button onClick={addDep} style={{ width:"100%", background:"rgba(102,126,234,0.1)", border:"1px dashed rgba(102,126,234,0.4)", borderRadius:12, color:"#a29bfe", padding:"9px", fontFamily:"Nunito,sans-serif", fontSize:13, cursor:"pointer", marginBottom:10 }}>
              + Agregar {tipo === "maestro" ? "alumno" : "hijo/a"}
            </button>
          )}
          <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.35)", textAlign:"center", marginBottom:12 }}>
            {numDeps} {depTxt} agregados
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setPaso(2)} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"rgba(255,255,255,0.5)", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:14, padding:"12px" }}>← Atrás</button>
            <button className="btn btn-primary" style={{ flex:2, padding:12 }} onClick={irPaso4}>Ver costo →</button>
          </div>
        </motion.div>
      )}

      {/* PASO 4: resumen y costo */}
      {paso === 4 && costoInfo && (
        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}>
          <div style={{ background:"linear-gradient(135deg,rgba(255,214,0,0.12),rgba(255,140,0,0.08))", border:"2px solid rgba(255,214,0,0.4)", borderRadius:18, padding:"18px", marginBottom:14, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:6 }}>💰</div>
            <div style={{ fontFamily:"Orbitron,monospace", fontSize:22, color:"#FFD700", fontWeight:700, marginBottom:4 }}>
              ${costoInfo.total.toLocaleString()} MXN
            </div>
            <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.6)" }}>{costoInfo.desc}</div>
            {costoInfo.tipoPago === "unico" && (
              <div style={{ marginTop:8, fontFamily:"Nunito,sans-serif", fontSize:12, color:"#39ff14" }}>
                ✅ Pago único — Licencia ilimitada por 5 meses
              </div>
            )}
            {costoInfo.tipoPago === "mensual" && (
              <div style={{ marginTop:8, fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                📅 Pago mensual (se renueva cada 30 días)
              </div>
            )}
          </div>

          {/* Datos de pago */}
          {costoInfo.metodo === "transferencia" && (
            <div style={{ background:"rgba(0,245,255,0.06)", border:"1px solid rgba(0,245,255,0.25)", borderRadius:14, padding:"14px", marginBottom:14 }}>
              <div style={{ fontFamily:"Orbitron,monospace", fontSize:11, color:"#00f5ff", marginBottom:8 }}>🏦 PAGO POR TRANSFERENCIA</div>
              <p style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:2, margin:0 }}>
                {DATOS_BBVA.split("|").map((line, i) => <span key={i}>{line.trim()}<br/></span>)}
              </p>
              <p style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,214,0,0.7)", marginTop:6, marginBottom:0 }}>
                ⚠️ El pago de múltiples usuarios es solo por transferencia bancaria.
              </p>
            </div>
          )}

          {costoInfo.metodo === "ambos" && (
            <div className="tip-box" style={{ marginBottom:14, fontSize:12 }}>
              💳 Puedes pagar con <strong>Mercado Pago</strong> o <strong>transferencia BBVA</strong>. Te enviamos los detalles por correo.
            </div>
          )}

          {/* Resumen */}
          <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>📋 RESUMEN</div>
            <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.7)" }}>
              <div>👤 {form.nombre} — {tipo}</div>
              <div>📧 {form.correo}</div>
              {esTutor && <div>👥 {deps.filter(d => d.nombre.trim()).length} {depTxt}: {deps.filter(d => d.nombre.trim()).map(d => d.nombre).join(", ")}</div>}
            </div>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setPaso(esTutor ? 3 : 2)} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"rgba(255,255,255,0.5)", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:14, padding:"12px" }}>← Atrás</button>
            <button className="btn btn-primary" style={{ flex:2, padding:12 }} onClick={enviar} disabled={loading}>
              {loading ? "⏳ Procesando..." : "💳 REGISTRAR Y PAGAR"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── TAB DEMO ────────────────────────────────────────────────
function TabDemo({ iniciarDemo }) {
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:64, marginBottom:16 }}>⏰</div>
      <h3 style={{ fontFamily:"Orbitron,monospace", color:"#FFD700", marginBottom:12, fontSize:18 }}>Demo Gratuita — 3 minutos</h3>
      <p style={{ color:"rgba(255,255,255,0.6)", fontFamily:"Nunito,sans-serif", fontSize:15, lineHeight:1.6, marginBottom:24 }}>
        Prueba el primer mundo sin registrarte. ¡Si te gusta, activa tu cuenta completa!
      </p>
      {["🌍 Bosque Mágico disponible","⚔️ Elige tu avatar","🪙 Gana monedas de prueba","🐗 Lucha contra el boss del bosque"].map(item => (
        <div key={item} style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"10px 16px", color:"rgba(255,255,255,0.75)", fontFamily:"Nunito,sans-serif", textAlign:"left", fontSize:14, marginBottom:6 }}>
          {item}
        </div>
      ))}
      <button className="btn btn-gold btn-full" style={{ marginTop:16 }} onClick={iniciarDemo}>🎁 ¡JUGAR DEMO AHORA!</button>
    </div>
  );
}

// ─── TAB INFO ────────────────────────────────────────────────
function TabInfo() {
  const [seccionAbierta, setSeccionAbierta] = useState(null);

  const secciones = [
    {
      id: "objetivo",
      icon: "🎯",
      titulo: "¿Qué es Aventura de Tablas?",
      contenido: (
        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.8 }}>
          <p>Es un juego educativo épico donde los niños aprenden las <strong style={{ color:"#00f5ff" }}>tablas de multiplicar del 1 al 10</strong> conquistando mundos, derrotando bosses y ganando monedas.</p>
          <p>Cada mundo corresponde a una tabla. Al completar los 10 mundos y derrotar al <strong style={{ color:"#FFD700" }}>OMEGA supremo</strong>, el alumno recibe un certificado de excelencia.</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
            {["🌍 10 Mundos","⚔️ 11 Bosses","🪙 Monedas","🛒 Tienda","🏆 Certificado","📊 Reportes"].map(t => (
              <span key={t} style={{ background:"rgba(0,245,255,0.1)", border:"1px solid rgba(0,245,255,0.3)", borderRadius:20, padding:"3px 10px", fontSize:12, color:"#00f5ff" }}>{t}</span>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "alumno",
      icon: "🧒",
      titulo: "Alumno Individual — $99/mes",
      contenido: (
        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.8 }}>
          <div style={{ background:"rgba(57,255,20,0.08)", border:"1px solid rgba(57,255,20,0.3)", borderRadius:14, padding:"12px 16px", marginBottom:12 }}>
            <div style={{ color:"#39ff14", fontWeight:700, fontSize:16 }}>$99 MXN / mes</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>Acceso individual, pago mensual</div>
          </div>
          <ul style={{ paddingLeft:20, margin:0 }}>
            <li>Acceso completo a los 10 mundos + Mundo Supremo</li>
            <li>Tienda con accesorios y poderes especiales</li>
            <li>Certificado al completar todos los mundos</li>
            <li>Progreso guardado en la nube</li>
            <li>Reportes de avance por correo</li>
          </ul>
        </div>
      )
    },
    {
      id: "maestro",
      icon: "🎓",
      titulo: "Maestro — Precios por grupo",
      contenido: (
        <div>
          <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:12 }}>
            El maestro tiene su propio panel para monitorear el avance de cada alumno: tiempo de conexión, mundos completados, tablas difíciles y más.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[
              { rango:"1-9 alumnos",    precio:"$99 × (1 + alumnos) / mes", tipo:"mensual", color:"#00f5ff" },
              { rango:"10-15 alumnos",  precio:"$1,000 — pago único",       tipo:"5 meses", color:"#39ff14" },
              { rango:"16-20 alumnos",  precio:"$1,500 — pago único",       tipo:"5 meses", color:"#39ff14" },
              { rango:"21-30 alumnos",  precio:"$2,000 — pago único",       tipo:"5 meses", color:"#FFD700" },
              { rango:"31-40 alumnos",  precio:"$3,000 — pago único",       tipo:"5 meses", color:"#FFD700" },
              { rango:"41-50 alumnos",  precio:"$4,000 — pago único",       tipo:"5 meses", color:"#ff006e" },
            ].map(r => (
              <div key={r.rango} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"8px 14px" }}>
                <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.7)" }}>{r.rango}</div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"Orbitron,monospace", fontSize:12, color:r.color, fontWeight:700 }}>{r.precio}</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>{r.tipo}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,214,0,0.7)" }}>
            💡 Los pagos de 10+ alumnos son <strong>un solo pago con licencia ilimitada por 5 meses</strong>. Puedes agregar más alumnos después por $99 cada uno.
          </div>
          <div style={{ marginTop:8, fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)" }}>
            ⚠️ Todos los pagos de grupos se realizan <strong>únicamente por transferencia bancaria</strong>.
          </div>
        </div>
      )
    },
    {
      id: "padre",
      icon: "👨‍👩‍👧",
      titulo: "Padre de Familia — $99 / mes / persona",
      contenido: (
        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.8 }}>
          <div style={{ background:"rgba(162,155,254,0.08)", border:"1px solid rgba(162,155,254,0.3)", borderRadius:14, padding:"12px 16px", marginBottom:12 }}>
            <div style={{ color:"#a29bfe", fontWeight:700, fontSize:16 }}>$99 MXN / mes por persona</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>Tu suscripción + $99 por cada hijo</div>
          </div>
          <ul style={{ paddingLeft:20, margin:0 }}>
            <li>Panel de padre con seguimiento en tiempo real</li>
            <li>Ve cuándo entró, cuánto tiempo estudió y cómo va</li>
            <li>Detecta en qué tablas tiene más dificultad</li>
            <li>Historial de sesiones por fecha</li>
            <li>El padre también puede jugar el juego</li>
            <li>Agrega más hijos en cualquier momento</li>
          </ul>
          <div style={{ marginTop:10, fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,214,0,0.7)" }}>
            Ejemplo: padre + 3 hijos = <strong style={{ color:"#FFD700" }}>$396 MXN/mes</strong> ($99 × 4 personas)
          </div>
        </div>
      )
    },
    {
      id: "como",
      icon: "🚀",
      titulo: "¿Cómo funciona el proceso?",
      contenido: (
        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.8 }}>
          <ol style={{ paddingLeft:20, margin:0 }}>
            <li>Regístrate en la pestaña <strong style={{ color:"#00f5ff" }}>REGISTRO</strong></li>
            <li>Elige tu tipo de cuenta y llena los datos</li>
            <li>El sistema te muestra el costo y datos de pago</li>
            <li>Realiza la transferencia y envía el comprobante a <strong style={{ color:"#00f5ff" }}>pixelimpresorasap@gmail.com</strong></li>
            <li>En menos de <strong>24 horas</strong> recibes tus códigos por correo</li>
            <li>Ingresa con tu código en la pestaña <strong style={{ color:"#00f5ff" }}>JUGAR</strong></li>
          </ol>
          <div style={{ marginTop:12, background:"rgba(57,255,20,0.08)", border:"1px solid rgba(57,255,20,0.2)", borderRadius:12, padding:"10px 14px", fontSize:12 }}>
            🎁 ¿Quieres probar primero? Usa la demo gratuita de 3 minutos sin registrarte.
          </div>
        </div>
      )
    },
  ];

  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:16 }}>
        <div style={{ fontSize:40, marginBottom:6 }}>ℹ️</div>
        <h3 style={{ fontFamily:"Orbitron,monospace", color:"#00f5ff", fontSize:15, marginBottom:4 }}>INFORMACIÓN DEL SISTEMA</h3>
        <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.4)", fontSize:12 }}>Todo lo que necesitas saber</p>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {secciones.map(s => (
          <div key={s.id} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, overflow:"hidden" }}>
            <button onClick={() => setSeccionAbierta(seccionAbierta === s.id ? null : s.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}>
              <span style={{ fontSize:24, flexShrink:0 }}>{s.icon}</span>
              <span style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"#fff", fontWeight:700, flex:1 }}>{s.titulo}</span>
              <span style={{ color:"rgba(255,255,255,0.4)", fontSize:14 }}>{seccionAbierta === s.id ? "▲" : "▼"}</span>
            </button>
            <AnimatePresence>
              {seccionAbierta === s.id && (
                <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
                  style={{ overflow:"hidden", borderTop:"1px solid rgba(255,255,255,0.06)", padding:"14px 16px" }}>
                  {s.contenido}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ESTRELLAS DE FONDO ───────────────────────────────────────
function Stars() {
  const stars = Array.from({ length:80 }, (_, i) => ({
    id:i, x:Math.random()*100, y:Math.random()*100,
    size:Math.random()*3+1, delay:Math.random()*3, dur:Math.random()*2+2
  }));
  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none" }}>
      {stars.map(s => (
        <motion.div key={s.id}
          style={{ position:"absolute", left:`${s.x}%`, top:`${s.y}%`, width:s.size, height:s.size, borderRadius:"50%", background:"#fff" }}
          animate={{ opacity:[0.1,0.9,0.1] }}
          transition={{ duration:s.dur, delay:s.delay, repeat:Infinity, ease:"easeInOut" }}
        />
      ))}
    </div>
  );
}
