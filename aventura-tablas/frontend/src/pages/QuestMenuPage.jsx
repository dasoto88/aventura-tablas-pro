import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

export default function QuestMenuPage() {
  const { licencia, nombre, tipoUsuario, setPagina,
          setQuestGuias, setQuestGuiaActual, setQuestDiaActual } = useGameStore(s => ({
    licencia: s.licencia, nombre: s.nombre, tipoUsuario: s.tipoUsuario,
    setPagina: s.setPagina, setQuestGuias: s.setQuestGuias,
    setQuestGuiaActual: s.setQuestGuiaActual, setQuestDiaActual: s.setQuestDiaActual,
  }));

  const [guias, setGuias] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarGuias();
  }, []);

  const cargarGuias = async () => {
    try {
      const res = await axios.get(`${API}/quest/mis-guias/${licencia}`);
      setGuias(res.data.guias || []);
      setQuestGuias(res.data.guias || []);
    } catch (e) {
      toast.error("Error al cargar guías");
    } finally {
      setCargando(false);
    }
  };

  const iniciarGuia = (guia) => {
    setQuestGuiaActual(guia);
    // Encontrar el primer día no completado
    const diasCompletados = new Set(
      (guia.progreso || []).filter(p => p.completado && p.fase === 'boss').map(p => p.dia)
    );
    let diaInicio = 1;
    for (let d = 1; d <= guia.dias_estudio; d++) {
      if (!diasCompletados.has(d)) { diaInicio = d; break; }
    }
    setQuestDiaActual(diaInicio);
    setPagina("quest_estudio");
  };

  const calcularProgreso = (guia) => {
    if (!guia.progreso || guia.progreso.length === 0) return 0;
    const diasCompletos = new Set(
      guia.progreso.filter(p => p.completado && p.fase === 'boss').map(p => p.dia)
    ).size;
    return Math.round((diasCompletos / guia.dias_estudio) * 100);
  };

  const puedeSubir = tipoUsuario === 'maestro' || tipoUsuario === 'padre' || tipoUsuario === 'alumno' || tipoUsuario === 'admin';

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0D0221 0%, #1A0533 50%, #0D1B2A 100%)",
      color: "#fff",
      padding: "20px",
      fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", marginBottom: "30px" }}
      >
        <div style={{ fontSize: "60px", marginBottom: "8px" }}>⚔️</div>
        <h1 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
          background: "linear-gradient(90deg, #FFD700, #FF6B35)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "4px",
        }}>Quest Escolar</h1>
        <p style={{ color: "#aaa", fontSize: "1rem" }}>El Gran Torneo del Saber ⚡</p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px" }}>
          <button
            onClick={() => setPagina("mapa")}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >← Volver al Mapa</button>

          {puedeSubir && (
            <button
              onClick={() => setPagina("quest_subir")}
              style={{
                background: "linear-gradient(135deg, #6C3483, #1A5276)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 20px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "bold",
              }}
            >📤 Subir Guía de Estudio</button>
          )}
        </div>
      </motion.div>

      {/* Lista de guías */}
      {cargando ? (
        <div style={{ textAlign: "center", color: "#aaa", fontSize: "1.2rem", marginTop: "40px" }}>
          ⏳ Cargando tus misiones...
        </div>
      ) : guias.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: "center",
            padding: "40px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "16px",
            border: "2px dashed rgba(255,215,0,0.3)",
            maxWidth: "500px",
            margin: "0 auto",
          }}
        >
          <div style={{ fontSize: "60px", marginBottom: "16px" }}>📚</div>
          <h3 style={{ color: "#FFD700", marginBottom: "8px" }}>¡No hay guías aún!</h3>
          <p style={{ color: "#aaa" }}>
            {puedeSubir
              ? "Sube una guía de estudio para comenzar tu aventura 🚀"
              : "Pídele a tu maestro o papá que suba una guía de estudio."}
          </p>
        </motion.div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
          maxWidth: "900px",
          margin: "0 auto",
        }}>
          {guias.map((guia, i) => {
            const progreso = calcularProgreso(guia);
            const colores = ["#6C3483","#1A5276","#145A32","#7B241C","#784212"];
            const color = colores[i % colores.length];
            return (
              <motion.div
                key={guia.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.03, y: -4 }}
                onClick={() => iniciarGuia(guia)}
                style={{
                  background: `linear-gradient(135deg, ${color}88, ${color}44)`,
                  border: `2px solid ${color}`,
                  borderRadius: "16px",
                  padding: "20px",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>
                  {guia.materia?.toLowerCase().includes("ciencias") ? "🔬" :
                   guia.materia?.toLowerCase().includes("historia") ? "📜" :
                   guia.materia?.toLowerCase().includes("español") ? "📝" :
                   guia.materia?.toLowerCase().includes("matemáticas") ? "🔢" : "📚"}
                </div>
                <h3 style={{ color: "#FFD700", marginBottom: "4px", fontSize: "1rem" }}>
                  {guia.titulo}
                </h3>
                <p style={{ color: "#ccc", fontSize: "0.85rem", marginBottom: "12px" }}>
                  {guia.materia} • {guia.dias_estudio} días
                  {guia.fecha_examen && ` • Examen: ${guia.fecha_examen}`}
                </p>

                {/* Barra de progreso */}
                <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: "8px", height: "8px", overflow: "hidden" }}>
                  <div style={{
                    width: `${progreso}%`,
                    height: "100%",
                    background: progreso === 100 ? "#2ECC71" : "#FFD700",
                    borderRadius: "8px",
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <p style={{ color: "#aaa", fontSize: "0.75rem", marginTop: "4px" }}>
                  {progreso === 100 ? "✅ ¡Completada!" : `${progreso}% completado`}
                </p>

                <div style={{
                  position: "absolute", top: "12px", right: "12px",
                  background: progreso === 100 ? "#2ECC71" : "#FFD700",
                  color: "#000",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}>
                  {progreso === 100 ? "COMPLETA" : "JUGAR →"}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
