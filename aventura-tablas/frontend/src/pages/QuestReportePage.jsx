import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Mini gráfica de barras con CSS puro
function BarChart({ datos, colorActivo = "#FFD700" }) {
  if (!datos || datos.length === 0) return null;
  const max = Math.max(...datos.map(d => d.valor), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "8px",
                  height: "80px", padding: "0 8px" }}>
      {datos.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column",
                               alignItems: "center", gap: "4px" }}>
          <div style={{ fontSize: "0.7rem", color: "#aaa" }}>{d.valor}</div>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.valor / max) * 60}px` }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            style={{
              width: "100%", borderRadius: "4px 4px 0 0",
              background: d.completado ? colorActivo : "rgba(255,255,255,0.15)",
              minHeight: "4px",
            }}
          />
          <div style={{ fontSize: "0.65rem", color: "#aaa", textAlign: "center" }}>
            D{d.dia}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function QuestReportePage() {
  const {
    licencia, tipoUsuario, setPagina,
    questGuiaActual,
  } = useGameStore(s => ({
    licencia: s.licencia, tipoUsuario: s.tipoUsuario, setPagina: s.setPagina,
    questGuiaActual: s.questGuiaActual,
  }));

  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const guiaId = questGuiaActual?.id;
  const licenciaObjetivo = licencia;

  useEffect(() => {
    if (!guiaId) { setPagina("quest_menu"); return; }
    cargarReporte();
  }, []);

  const cargarReporte = async () => {
    try {
      const res = await axios.get(`${API}/api/quest/reporte/${licenciaObjetivo}/${guiaId}`);
      setReporte(res.data);
    } catch (e) {
      toast.error("Error al cargar reporte");
      setPagina("quest_menu");
    } finally {
      setCargando(false);
    }
  };

  const descargarPDF = async () => {
    setDescargando(true);
    try {
      const res = await axios.get(
        `${API}/api/quest/reporte/exportar/${licenciaObjetivo}/${guiaId}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_quest_${reporte?.alumno?.nombre || "alumno"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado ✅");
    } catch (e) {
      toast.error("Error al descargar PDF");
    } finally {
      setDescargando(false);
    }
  };

  if (cargando) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
                  justifyContent: "center", background: "#0D0221", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "50px", marginBottom: "12px" }}>📊</div>
        <p style={{ color: "#aaa" }}>Generando reporte...</p>
      </div>
    </div>
  );

  if (!reporte) return null;

  const { alumno, guia, resumen, por_dia, top_errores } = reporte;
  const porcentaje = resumen.total_dias > 0
    ? Math.round((resumen.dias_completados / resumen.total_dias) * 100)
    : 0;

  // Datos para gráfica
  const datosGrafica = Object.entries(por_dia || {}).map(([dia, stats]) => ({
    dia: Number(dia),
    valor: stats.puntaje,
    completado: stats.fases_completadas >= 2,
  })).sort((a, b) => a.dia - b.dia);

  const estatusBadge = porcentaje >= 80 ? { texto: "¡Excelente!", color: "#2ECC71" }
    : porcentaje >= 50 ? { texto: "Buen avance", color: "#F39C12" }
    : { texto: "Necesita apoyo", color: "#E74C3C" };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0D0221, #1A0533, #0D1B2A)",
      color: "#fff", fontFamily: "'Nunito', sans-serif", padding: "20px",
    }}>
      <div style={{ maxWidth: "650px", margin: "0 auto" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", justifyContent: "space-between",
                   alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "10px" }}
        >
          <button onClick={() => setPagina("quest_menu")}
                  style={{ background: "transparent", color: "#aaa", border: "none",
                           cursor: "pointer", fontSize: "0.9rem" }}>
            ← Volver
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px" }}>📊</div>
            <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "1rem",
                         background: "linear-gradient(90deg,#FFD700,#FF6B35)",
                         WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                         margin: 0 }}>Reporte de Progreso</h2>
          </div>
          <button
            onClick={descargarPDF} disabled={descargando}
            style={{
              background: descargando ? "#555" : "linear-gradient(135deg,#6C3483,#1A5276)",
              color: "#fff", border: "none", borderRadius: "8px",
              padding: "8px 16px", cursor: descargando ? "not-allowed" : "pointer",
              fontSize: "0.85rem", fontWeight: "bold",
            }}
          >{descargando ? "⏳" : "⬇️ PDF"}</button>
        </motion.div>

        {/* Info alumno + guía */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px", padding: "20px", marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h3 style={{ color: "#FFD700", marginBottom: "4px" }}>👤 {alumno?.nombre}</h3>
              <p style={{ color: "#aaa", fontSize: "0.9rem" }}>📚 {guia?.titulo}</p>
              <p style={{ color: "#aaa", fontSize: "0.85rem" }}>
                {guia?.materia} {guia?.fecha_examen && `• Examen: ${guia.fecha_examen}`}
              </p>
            </div>
            <div style={{
              background: `${estatusBadge.color}22`,
              border: `2px solid ${estatusBadge.color}`,
              borderRadius: "10px", padding: "8px 14px",
              color: estatusBadge.color, fontWeight: "bold", fontSize: "0.9rem",
              textAlign: "center",
            }}>
              {estatusBadge.texto}
            </div>
          </div>
        </motion.div>

        {/* Estadísticas clave */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                   gap: "10px", marginBottom: "16px" }}
        >
          {[
            { label: "Días Completados", value: `${resumen.dias_completados}/${resumen.total_dias}`, emoji: "📅", color: "#3498DB" },
            { label: "Puntaje Total",     value: resumen.total_puntaje,  emoji: "⭐", color: "#FFD700" },
            { label: "Total Errores",     value: resumen.total_errores,  emoji: "❌", color: "#E74C3C" },
          ].map((stat, i) => (
            <div key={i} style={{
              background: `${stat.color}11`, border: `1px solid ${stat.color}44`,
              borderRadius: "12px", padding: "14px 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{stat.emoji}</div>
              <div style={{ color: stat.color, fontWeight: "bold", fontSize: "1.1rem" }}>
                {stat.value}
              </div>
              <div style={{ color: "#aaa", fontSize: "0.72rem" }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Barra de progreso global */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          style={{
            background: "rgba(255,255,255,0.05)", borderRadius: "12px",
            padding: "16px", marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between",
                        color: "#aaa", fontSize: "0.85rem", marginBottom: "6px" }}>
            <span>Progreso General</span>
            <span style={{ color: porcentaje >= 80 ? "#2ECC71" : "#FFD700", fontWeight: "bold" }}>
              {porcentaje}%
            </span>
          </div>
          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: "8px",
                        height: "10px", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${porcentaje}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{
                height: "100%", borderRadius: "8px",
                background: porcentaje >= 80 ? "#2ECC71" : porcentaje >= 50 ? "#F39C12" : "#E74C3C",
              }}
            />
          </div>
        </motion.div>

        {/* Gráfica de puntaje por día */}
        {datosGrafica.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            style={{
              background: "rgba(255,255,255,0.05)", borderRadius: "12px",
              padding: "16px", marginBottom: "16px",
            }}
          >
            <h4 style={{ color: "#FFD700", marginBottom: "12px", fontSize: "0.95rem" }}>
              📈 Puntaje por Día
            </h4>
            <BarChart datos={datosGrafica} />
          </motion.div>
        )}

        {/* Top errores */}
        {top_errores && top_errores.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{
              background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.3)",
              borderRadius: "12px", padding: "16px", marginBottom: "16px",
            }}
          >
            <h4 style={{ color: "#E74C3C", marginBottom: "12px", fontSize: "0.95rem" }}>
              ⚠️ Preguntas con Más Dificultad
            </h4>
            {top_errores.slice(0, 5).map((err, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "8px 0",
                borderBottom: i < top_errores.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <div style={{ flex: 1, paddingRight: "8px" }}>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>Día {err.dia}: </span>
                  <span style={{ color: "#ddd", fontSize: "0.85rem" }}>
                    {err.pregunta?.length > 60 ? err.pregunta.substring(0,60) + "..." : err.pregunta}
                  </span>
                </div>
                <span style={{ color: "#E74C3C", fontWeight: "bold", fontSize: "0.85rem",
                               whiteSpace: "nowrap" }}>
                  {err.total_errores}x ❌
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Recomendaciones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          style={{
            background: "rgba(52,152,219,0.08)", border: "1px solid rgba(52,152,219,0.3)",
            borderRadius: "12px", padding: "16px",
          }}
        >
          <h4 style={{ color: "#3498DB", marginBottom: "10px", fontSize: "0.95rem" }}>
            💡 Recomendaciones
          </h4>
          {porcentaje >= 80 && (
            <p style={{ color: "#7DCEA0", fontSize: "0.9rem", marginBottom: "4px" }}>
              🌟 ¡Excelente trabajo! El alumno domina el material.
            </p>
          )}
          {porcentaje < 80 && porcentaje >= 50 && (
            <p style={{ color: "#F9E79F", fontSize: "0.9rem", marginBottom: "4px" }}>
              📚 Buen avance. Se recomienda completar los días pendientes.
            </p>
          )}
          {porcentaje < 50 && (
            <p style={{ color: "#F1948A", fontSize: "0.9rem", marginBottom: "4px" }}>
              ⚠️ Se recomienda dedicar más tiempo al estudio diario.
            </p>
          )}
          {resumen.total_errores > 10 && (
            <p style={{ color: "#AED6F1", fontSize: "0.9rem", marginBottom: "4px" }}>
              🔄 Repasar los temas con más errores antes del examen.
            </p>
          )}
        </motion.div>

      </div>
    </div>
  );
}
