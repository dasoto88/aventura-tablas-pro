import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Flujo de 3 pasos:
// PASO 1 — Subir archivo o pegar texto
// PASO 2 — Revisar y editar el texto extraído
// PASO 3 — Confirmar y generar el juego

export default function QuestSubirGuiaPage() {
  const { licencia, tipoUsuario, setPagina } = useGameStore(s => ({
    licencia: s.licencia, tipoUsuario: s.tipoUsuario, setPagina: s.setPagina,
  }));

  const [paso, setPaso] = useState(1); // 1 = subir, 2 = revisar texto, 3 = listo
  const [form, setForm] = useState({
    titulo: "", materia: "", fecha_examen: "", dias_estudio: 5, codigo_grupo: "",
  });
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [modoTexto, setModoTexto] = useState(false);
  const [textoExtraido, setTextoExtraido] = useState(""); // texto editable del paso 2
  const [cargandoExtraccion, setCargandoExtraccion] = useState(false);
  const [cargandoJuego, setCargandoJuego] = useState(false);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px", color: "#fff", fontSize: "0.95rem",
    boxSizing: "border-box",
  };
  const labelStyle = { color: "#aaa", fontSize: "0.85rem", marginBottom: "4px", display: "block" };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setArchivo(f);
    if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  // PASO 1 → PASO 2: extraer texto del archivo
  const handleExtraerTexto = async () => {
    if (!modoTexto && !archivo) { toast.error("Selecciona un archivo primero"); return; }
    if (modoTexto && !textoExtraido.trim()) { toast.error("Escribe el contenido de la guía"); return; }
    if (!form.titulo) { toast.error("Ingresa un título para la guía"); return; }

    if (modoTexto) {
      // Ya tiene el texto — ir directo al paso 2
      setPaso(2);
      return;
    }

    setCargandoExtraccion(true);
    const fd = new FormData();
    fd.append("archivo", archivo);
    try {
      const res = await axios.post(`${API}/api/quest/extraer-texto`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      setTextoExtraido(res.data.texto || "");
      toast.success(`✅ Texto extraído: ${res.data.caracteres} caracteres`);
      setPaso(2);
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al leer el archivo";
      toast.error(msg);
    } finally {
      setCargandoExtraccion(false);
    }
  };

  // PASO 2 → PASO 3: generar preguntas con el texto confirmado
  const handleGenerarJuego = async () => {
    if (!textoExtraido.trim()) { toast.error("El texto no puede estar vacío"); return; }

    setCargandoJuego(true);
    const fd = new FormData();
    fd.append("licencia", licencia);
    fd.append("titulo", form.titulo);
    fd.append("materia", form.materia);
    fd.append("fecha_examen", form.fecha_examen);
    fd.append("dias_estudio", form.dias_estudio);
    fd.append("codigo_grupo", form.codigo_grupo);
    const blob = new Blob([textoExtraido], { type: "text/plain" });
    fd.append("archivo", blob, "guia.txt");

    try {
      const res = await axios.post(`${API}/api/quest/subir-guia`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setResultado(res.data);
      setPaso(3);
      toast.success("¡Juego creado! 🎉");
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al generar el juego";
      toast.error(msg);
    } finally {
      setCargandoJuego(false);
    }
  };

  const PASOS_LABELS = ["📎 Subir archivo", "✏️ Revisar texto", "🎮 ¡Listo!"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0D0221, #1A0533, #0D1B2A)",
      color: "#fff", padding: "20px",
      fontFamily: "'Nunito', sans-serif",
    }}>
      <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
        style={{ maxWidth: "640px", margin: "0 auto" }}>

        <button onClick={() => paso > 1 ? setPaso(p => p-1) : setPagina("quest_menu")}
          style={{ background:"transparent", color:"#aaa", border:"none", cursor:"pointer", fontSize:"0.9rem", marginBottom:"16px" }}>
          ← {paso > 1 ? "Atrás" : "Volver"}
        </button>

        {/* Indicador de pasos */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"24px" }}>
          {PASOS_LABELS.map((label, i) => (
            <React.Fragment key={i}>
              <div style={{
                display:"flex", alignItems:"center", gap:"6px",
                opacity: paso === i+1 ? 1 : paso > i+1 ? 0.6 : 0.3,
              }}>
                <div style={{
                  width:28, height:28, borderRadius:"50%", display:"flex",
                  alignItems:"center", justifyContent:"center", fontSize:"0.75rem", fontWeight:"bold",
                  background: paso > i+1 ? "#2ECC71" : paso === i+1 ? "linear-gradient(135deg,#FFD700,#FF6B35)" : "rgba(255,255,255,0.1)",
                  color: paso >= i+1 ? "#000" : "#aaa",
                }}>
                  {paso > i+1 ? "✓" : i+1}
                </div>
                <span style={{ fontSize:"0.78rem", color: paso === i+1 ? "#FFD700" : "#888", display: i===1?"none":"block" }}>
                  {label}
                </span>
              </div>
              {i < 2 && <div style={{ flex:1, height:2, background: paso > i+1 ? "#2ECC71" : "rgba(255,255,255,0.1)", borderRadius:1 }} />}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ═══════════════ PASO 1: SUBIR ARCHIVO ═══════════════ */}
          {paso === 1 && (
          <motion.div key="paso1" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}}>
            <div style={{ textAlign:"center", marginBottom:"20px" }}>
              <div style={{ fontSize:"48px" }}>📤</div>
              <h2 style={{ fontFamily:"'Orbitron',sans-serif", fontSize:"1.3rem",
                background:"linear-gradient(90deg,#FFD700,#FF6B35)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                Subir Guía de Estudio
              </h2>
              <p style={{ color:"#aaa", fontSize:"0.85rem" }}>
                Sube el archivo y el programa extraerá el texto para que lo revises
              </p>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

              {/* Título (obligatorio desde el paso 1) */}
              <div>
                <label style={labelStyle}>Título de la guía *</label>
                <input style={inputStyle} placeholder="Ej: Guía de Ciencias Naturales — Examen 1"
                  value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} />
              </div>

              {/* Botones modo */}
              <div style={{ display:"flex", gap:"8px" }}>
                <button type="button" onClick={() => setModoTexto(false)}
                  style={{ flex:1, padding:"10px", borderRadius:"10px", border:"none", cursor:"pointer",
                    background: !modoTexto ? "linear-gradient(135deg,#FFD700,#FF6B35)" : "rgba(255,255,255,0.08)",
                    color: !modoTexto ? "#000" : "#aaa", fontWeight:"bold", fontSize:"0.85rem" }}>
                  📎 Subir PDF / Word / Foto
                </button>
                <button type="button" onClick={() => setModoTexto(true)}
                  style={{ flex:1, padding:"10px", borderRadius:"10px", border:"none", cursor:"pointer",
                    background: modoTexto ? "linear-gradient(135deg,#00f5ff,#0080ff)" : "rgba(255,255,255,0.08)",
                    color: modoTexto ? "#000" : "#aaa", fontWeight:"bold", fontSize:"0.85rem" }}>
                  ✏️ Escribir / Pegar Texto
                </button>
              </div>

              {/* Zona archivo */}
              {!modoTexto ? (
                <div onClick={() => fileRef.current?.click()}
                  style={{ border:"2px dashed "+(archivo?"#2ECC71":"rgba(255,215,0,0.4)"),
                    borderRadius:"12px", padding:"28px", textAlign:"center", cursor:"pointer",
                    background: archivo ? "rgba(46,204,113,0.08)" : "rgba(255,215,0,0.04)" }}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,image/*,.png,.jpg,.jpeg"
                    onChange={handleFile} style={{ display:"none" }} />
                  {preview ? (
                    <img src={preview} alt="preview" style={{ maxHeight:"130px", borderRadius:"8px" }} />
                  ) : archivo ? (
                    <div>
                      <div style={{ fontSize:"40px" }}>📄</div>
                      <p style={{ color:"#2ECC71", fontWeight:"bold" }}>{archivo.name}</p>
                      <p style={{ color:"#aaa", fontSize:"0.8rem" }}>Toca para cambiar</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize:"44px", marginBottom:"8px" }}>📎</div>
                      <p style={{ color:"#FFD700", fontWeight:"bold", marginBottom:"4px" }}>
                        Toca para seleccionar archivo
                      </p>
                      <p style={{ color:"#888", fontSize:"0.8rem" }}>PDF · Word (.docx) · JPG · PNG — máx 10MB</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <textarea value={textoExtraido} onChange={e => setTextoExtraido(e.target.value)}
                    placeholder="Escribe o pega aquí el contenido de la guía: temas, definiciones, conceptos..."
                    style={{ ...inputStyle, height:"160px", resize:"vertical", lineHeight:"1.5" }} />
                  <p style={{ color:"#888", fontSize:"0.78rem", marginTop:"4px" }}>
                    💡 Puedes pegar texto de Word, PDF, WhatsApp o escribirlo directamente
                  </p>
                </div>
              )}

              {/* Datos adicionales */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                <div>
                  <label style={labelStyle}>Materia</label>
                  <input style={inputStyle} placeholder="Ciencias, Historia, Español..."
                    value={form.materia} onChange={e => setForm({...form, materia: e.target.value})} />
                </div>
                <div>
                  <label style={labelStyle}>Fecha del examen</label>
                  <input type="date" style={inputStyle}
                    value={form.fecha_examen} onChange={e => setForm({...form, fecha_examen: e.target.value})} />
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                <div>
                  <label style={labelStyle}>Días de estudio</label>
                  <select style={inputStyle} value={form.dias_estudio}
                    onChange={e => setForm({...form, dias_estudio: Number(e.target.value)})}>
                    {[1,2,3,4,5,6,7,10,14].map(d => <option key={d} value={d}>{d} día{d>1?"s":""}</option>)}
                  </select>
                </div>
                {(tipoUsuario === 'maestro' || tipoUsuario === 'admin') && (
                  <div>
                    <label style={labelStyle}>Código de grupo</label>
                    <input style={inputStyle} placeholder="Grupo o 'todos'"
                      value={form.codigo_grupo} onChange={e => setForm({...form, codigo_grupo: e.target.value})} />
                  </div>
                )}
              </div>

              <button onClick={handleExtraerTexto} disabled={cargandoExtraccion}
                style={{ background: cargandoExtraccion ? "#555" : "linear-gradient(135deg,#6C3483,#1A5276)",
                  color:"#fff", border:"none", borderRadius:"10px",
                  padding:"14px", fontSize:"1rem", fontWeight:"bold",
                  cursor: cargandoExtraccion ? "not-allowed" : "pointer", width:"100%" }}>
                {cargandoExtraccion ? "⏳ Leyendo archivo..." : modoTexto ? "Siguiente → Revisar texto ✏️" : "📖 Leer archivo → Revisar texto"}
              </button>
            </div>
          </motion.div>
          )}

          {/* ═══════════════ PASO 2: REVISAR Y EDITAR TEXTO ═══════════════ */}
          {paso === 2 && (
          <motion.div key="paso2" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}}>
            <div style={{ textAlign:"center", marginBottom:"20px" }}>
              <div style={{ fontSize:"48px" }}>✏️</div>
              <h2 style={{ fontFamily:"'Orbitron',sans-serif", fontSize:"1.2rem", color:"#00f5ff" }}>
                Revisa el texto extraído
              </h2>
              <p style={{ color:"#aaa", fontSize:"0.85rem" }}>
                Corrige errores, agrega lo que falte o quita lo innecesario
              </p>
            </div>

            {/* Stats del texto */}
            <div style={{ display:"flex", gap:"12px", marginBottom:"12px", justifyContent:"center" }}>
              {[
                { label:"Caracteres", val: textoExtraido.length },
                { label:"Palabras", val: textoExtraido.split(/\s+/).filter(Boolean).length },
                { label:"Líneas", val: textoExtraido.split("\n").length },
              ].map(s => (
                <div key={s.label} style={{ background:"rgba(255,255,255,0.06)", borderRadius:"10px",
                  padding:"8px 16px", textAlign:"center" }}>
                  <div style={{ fontFamily:"Orbitron,monospace", fontSize:"1.1rem", color:"#FFD700", fontWeight:"bold" }}>
                    {s.val.toLocaleString()}
                  </div>
                  <div style={{ color:"#888", fontSize:"0.75rem" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <textarea value={textoExtraido} onChange={e => setTextoExtraido(e.target.value)}
              placeholder="El texto del archivo aparece aquí. Edita lo que necesites..."
              style={{ ...inputStyle, height:"300px", resize:"vertical",
                lineHeight:"1.6", fontSize:"0.88rem", marginBottom:"16px",
                border:"1px solid rgba(0,245,255,0.3)" }} />

            <p style={{ color:"#888", fontSize:"0.8rem", marginBottom:"16px", textAlign:"center" }}>
              💡 Puedes editar, agregar o borrar contenido. El programa generará preguntas basándose en este texto.
            </p>

            {/* Botón confirmar */}
            <button onClick={handleGenerarJuego} disabled={cargandoJuego}
              style={{ background: cargandoJuego ? "#555" : "linear-gradient(135deg,#27AE60,#1A5276)",
                color:"#fff", border:"none", borderRadius:"12px",
                padding:"16px", fontSize:"1.1rem", fontWeight:"bold",
                cursor: cargandoJuego ? "not-allowed" : "pointer", width:"100%",
                boxShadow: cargandoJuego ? "none" : "0 4px 20px rgba(39,174,96,0.4)" }}>
              {cargandoJuego
                ? "⏳ Creando preguntas y mundos... (30-60s)"
                : "✅ ¡El texto está bien! → Crear el Juego 🎮"}
            </button>

            {cargandoJuego && (
              <p style={{ color:"#aaa", fontSize:"0.8rem", textAlign:"center", marginTop:"10px" }}>
                El programa está dividiendo el contenido en {form.dias_estudio} días y generando {form.dias_estudio * 10} preguntas automáticamente...
              </p>
            )}
          </motion.div>
          )}

          {/* ═══════════════ PASO 3: LISTO ═══════════════ */}
          {paso === 3 && resultado && (
          <motion.div key="paso3" initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}}
            style={{ background:"linear-gradient(135deg,#145A32,#1A5276)",
              borderRadius:"20px", padding:"32px", textAlign:"center" }}>
            <motion.div animate={{ rotate:[0,10,-10,0], scale:[1,1.2,1] }}
              transition={{ duration:0.6 }} style={{ fontSize:"70px", marginBottom:"12px" }}>🎉</motion.div>
            <h3 style={{ color:"#2ECC71", fontSize:"1.5rem", marginBottom:"8px", fontFamily:"Orbitron,monospace" }}>
              ¡Juego Creado!
            </h3>
            <p style={{ color:"#fff", fontSize:"1.1rem", marginBottom:"6px" }}>
              <b>{resultado.titulo}</b>
            </p>
            <div style={{ display:"flex", gap:"16px", justifyContent:"center", margin:"16px 0" }}>
              <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:"12px", padding:"12px 20px" }}>
                <div style={{ fontFamily:"Orbitron,monospace", fontSize:"1.6rem", color:"#FFD700", fontWeight:"bold" }}>
                  {resultado.dias_generados}
                </div>
                <div style={{ color:"#aaa", fontSize:"0.8rem" }}>mundos</div>
              </div>
              <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:"12px", padding:"12px 20px" }}>
                <div style={{ fontFamily:"Orbitron,monospace", fontSize:"1.6rem", color:"#00f5ff", fontWeight:"bold" }}>
                  {resultado.total_preguntas}
                </div>
                <div style={{ color:"#aaa", fontSize:"0.8rem" }}>preguntas</div>
              </div>
            </div>
            <p style={{ color:"#7DCEA0", fontSize:"0.9rem", marginBottom:"24px" }}>
              {resultado.resumen}
            </p>
            <button onClick={() => setPagina("quest_menu")}
              style={{ background:"linear-gradient(135deg,#6C3483,#1A5276)",
                color:"#fff", border:"none", borderRadius:"12px",
                padding:"14px 32px", fontSize:"1.1rem", fontWeight:"bold",
                cursor:"pointer", boxShadow:"0 4px 20px rgba(108,52,131,0.5)" }}>
              ⚔️ ¡A Jugar Ahora!
            </button>
          </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
