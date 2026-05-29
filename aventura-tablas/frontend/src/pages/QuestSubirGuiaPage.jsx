import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

export default function QuestSubirGuiaPage() {
  const { licencia, tipoUsuario, setPagina } = useGameStore(s => ({
    licencia: s.licencia, tipoUsuario: s.tipoUsuario, setPagina: s.setPagina,
  }));

  const [form, setForm] = useState({
    titulo: "", materia: "", fecha_examen: "", dias_estudio: 5, codigo_grupo: "",
  });
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setArchivo(f);
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!archivo) { toast.error("Selecciona un archivo"); return; }
    if (!form.titulo) { toast.error("Ingresa un título"); return; }

    setCargando(true);
    const fd = new FormData();
    fd.append("licencia", licencia);
    fd.append("titulo", form.titulo);
    fd.append("materia", form.materia);
    fd.append("fecha_examen", form.fecha_examen);
    fd.append("dias_estudio", form.dias_estudio);
    fd.append("codigo_grupo", form.codigo_grupo);
    fd.append("archivo", archivo);

    try {
      const res = await axios.post(`${API}/quest/subir-guia`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000, // 2 min para IA
      });
      setResultado(res.data);
      toast.success("¡Guía procesada exitosamente! 🎉");
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al procesar la guía";
      toast.error(msg);
    } finally {
      setCargando(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px", color: "#fff", fontSize: "0.95rem",
    boxSizing: "border-box",
  };
  const labelStyle = { color: "#aaa", fontSize: "0.85rem", marginBottom: "4px", display: "block" };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0D0221, #1A0533, #0D1B2A)",
      color: "#fff",
      padding: "20px",
      fontFamily: "'Nunito', sans-serif",
    }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: "600px", margin: "0 auto" }}
      >
        <button onClick={() => setPagina("quest_menu")} style={{
          background: "transparent", color: "#aaa", border: "none",
          cursor: "pointer", fontSize: "0.9rem", marginBottom: "16px",
        }}>← Volver</button>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "50px" }}>📤</div>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif",
            background: "linear-gradient(90deg, #FFD700, #FF6B35)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Subir Guía de Estudio</h2>
          <p style={{ color: "#aaa", fontSize: "0.9rem" }}>
            La IA leerá tu guía y creará el juego automáticamente ✨
          </p>
        </div>

        {resultado ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: "linear-gradient(135deg, #145A32, #1A5276)",
              borderRadius: "16px",
              padding: "30px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "60px", marginBottom: "12px" }}>🎉</div>
            <h3 style={{ color: "#2ECC71", marginBottom: "8px" }}>¡Guía Lista!</h3>
            <p style={{ color: "#fff", marginBottom: "4px" }}>
              <b>{resultado.titulo}</b>
            </p>
            <p style={{ color: "#aaa", fontSize: "0.9rem", marginBottom: "16px" }}>
              {resultado.dias_generados} días de estudio • {resultado.total_preguntas} preguntas generadas
            </p>
            <p style={{ color: "#7DCEA0", fontSize: "0.85rem", marginBottom: "20px" }}>
              {resultado.resumen}
            </p>
            <button
              onClick={() => setPagina("quest_menu")}
              style={{
                background: "linear-gradient(135deg, #6C3483, #1A5276)",
                color: "#fff", border: "none", borderRadius: "10px",
                padding: "12px 28px", fontSize: "1rem",
                cursor: "pointer", fontWeight: "bold",
              }}
            >⚔️ ¡A Jugar!</button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "24px",
            display: "flex", flexDirection: "column", gap: "16px",
          }}>
            {/* Zona de archivo */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: "2px dashed " + (archivo ? "#2ECC71" : "rgba(255,215,0,0.4)"),
                borderRadius: "12px",
                padding: "24px",
                textAlign: "center",
                cursor: "pointer",
                background: archivo ? "rgba(46,204,113,0.08)" : "rgba(255,215,0,0.05)",
                transition: "all 0.2s",
              }}
            >
              <input ref={fileRef} type="file" accept=".pdf,image/*"
                     onChange={handleFile} style={{ display: "none" }} />
              {preview ? (
                <img src={preview} alt="preview" style={{ maxHeight: "120px", borderRadius: "8px" }} />
              ) : archivo ? (
                <div>
                  <div style={{ fontSize: "40px" }}>📄</div>
                  <p style={{ color: "#2ECC71" }}>{archivo.name}</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "40px", marginBottom: "8px" }}>📎</div>
                  <p style={{ color: "#FFD700", fontWeight: "bold" }}>Toca para subir PDF o foto</p>
                  <p style={{ color: "#aaa", fontSize: "0.8rem" }}>PDF, JPG, PNG — máx 10MB</p>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Título de la guía *</label>
              <input style={inputStyle} placeholder="Ej: Guía de Ciencias Naturales Unidad 3"
                     value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Materia</label>
                <input style={inputStyle} placeholder="Ciencias, Historia..."
                       value={form.materia} onChange={e => setForm({...form, materia: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Fecha del examen</label>
                <input type="date" style={inputStyle}
                       value={form.fecha_examen} onChange={e => setForm({...form, fecha_examen: e.target.value})} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Días de estudio</label>
                <select style={inputStyle}
                        value={form.dias_estudio} onChange={e => setForm({...form, dias_estudio: Number(e.target.value)})}>
                  {[3,4,5,6,7].map(d => <option key={d} value={d}>{d} días</option>)}
                </select>
              </div>
              {(tipoUsuario === 'maestro' || tipoUsuario === 'admin') && (
                <div>
                  <label style={labelStyle}>Código de grupo</label>
                  <input style={inputStyle} placeholder="Código del grupo o 'todos'"
                         value={form.codigo_grupo} onChange={e => setForm({...form, codigo_grupo: e.target.value})} />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={cargando}
              style={{
                background: cargando ? "#555" : "linear-gradient(135deg, #6C3483, #1A5276)",
                color: "#fff", border: "none", borderRadius: "10px",
                padding: "14px", fontSize: "1rem", fontWeight: "bold",
                cursor: cargando ? "not-allowed" : "pointer",
                width: "100%",
              }}
            >
              {cargando ? "⏳ La IA está procesando tu guía... (puede tardar 30-60s)" : "✨ Generar Juego con IA"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
