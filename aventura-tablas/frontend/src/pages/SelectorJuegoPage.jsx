import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../utils/store";

// Pantalla de selección: Aventura con las Tablas vs Quest Escolar
export default function SelectorJuegoPage() {
  const { setPagina, nombre, tipoUsuario } = useGameStore(s => ({
    setPagina: s.setPagina,
    nombre: s.nombre,
    tipoUsuario: s.tipoUsuario,
  }));

  const [hover, setHover] = useState(null);
  const [seleccionando, setSeleccionando] = useState(null);

  const elegir = (opcion) => {
    setSeleccionando(opcion);
    setTimeout(() => {
      if (opcion === "tablas") {
        // Si es primera vez → intro, si ya jugó → mapa
        const yaVioIntro = localStorage.getItem("aventura-vio-intro");
        setPagina(yaVioIntro ? "mapa" : "intro");
      } else {
        setPagina("quest_intro");
      }
    }, 600);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at center, #0a001f 0%, #030010 90%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Nunito', sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* Partículas de fondo */}
      {["⭐","✨","🌟","💫","⚔️","📚","🏆","🎮"].map((e, i) => (
        <motion.div key={i}
          style={{
            position: "absolute",
            left: `${(i * 13 + 5) % 100}%`,
            top: `${(i * 17 + 10) % 100}%`,
            fontSize: Math.random() * 16 + 12,
            opacity: 0.08,
            pointerEvents: "none",
          }}
          animate={{ y: [0, -20, 0], opacity: [0.05, 0.15, 0.05] }}
          transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
        >{e}</motion.div>
      ))}

      {/* Saludo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: "center", marginBottom: "32px", zIndex: 10 }}
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: "clamp(50px, 12vw, 80px)", marginBottom: "8px" }}
        >🎮</motion.div>
        <h1 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: "clamp(1rem, 4vw, 1.6rem)",
          color: "rgba(255,255,255,0.5)",
          fontWeight: 400,
          marginBottom: "6px",
        }}>¡Hola, <span style={{ color: "#FFD700", fontWeight: 700 }}>{nombre}</span>!</h1>
        <h2 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: "clamp(1.2rem, 5vw, 2rem)",
          background: "linear-gradient(90deg, #00f5ff, #FFD700, #ff006e)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: 900,
          letterSpacing: 2,
        }}>¿A qué quieres jugar?</h2>
      </motion.div>

      {/* Tarjetas de selección */}
      <div style={{
        display: "flex",
        gap: "20px",
        flexWrap: "wrap",
        justifyContent: "center",
        zIndex: 10,
        maxWidth: "800px",
        width: "100%",
      }}>

        {/* AVENTURA CON LAS TABLAS */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
          onHoverStart={() => setHover("tablas")}
          onHoverEnd={() => setHover(null)}
          whileHover={{ scale: 1.04, y: -8 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => elegir("tablas")}
          style={{
            flex: "1 1 280px",
            maxWidth: "340px",
            background: hover === "tablas"
              ? "linear-gradient(135deg, #001a4d, #0a003a)"
              : "linear-gradient(135deg, #080028, #030015)",
            border: `3px solid ${hover === "tablas" ? "#00f5ff" : "rgba(0,245,255,0.25)"}`,
            borderRadius: "24px",
            padding: "32px 24px",
            cursor: "pointer",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: hover === "tablas"
              ? "0 0 40px rgba(0,245,255,0.3)"
              : "0 0 15px rgba(0,245,255,0.1)",
            transition: "border 0.2s, box-shadow 0.2s, background 0.2s",
          }}
        >
          {/* Brillo superior */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, transparent, #00f5ff, transparent)",
            opacity: hover === "tablas" ? 1 : 0.4,
          }} />

          <motion.div
            animate={seleccionando === "tablas"
              ? { scale: [1, 1.4, 0], rotate: 360 }
              : { scale: [1, 1.06, 1], rotate: 0 }
            }
            transition={seleccionando === "tablas"
              ? { duration: 0.5 }
              : { duration: 2.5, repeat: Infinity }
            }
            style={{ fontSize: "clamp(60px, 12vw, 90px)", marginBottom: "16px" }}
          >🗺️</motion.div>

          <h3 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: "clamp(1rem, 3vw, 1.3rem)",
            color: "#00f5ff",
            fontWeight: 900,
            marginBottom: "8px",
            textShadow: "0 0 20px rgba(0,245,255,0.5)",
            letterSpacing: 1,
          }}>Aventura con<br />las Tablas</h3>

          <p style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "clamp(0.8rem, 2vw, 0.95rem)",
            lineHeight: 1.5,
            marginBottom: "20px",
          }}>
            Aprende las tablas del 1 al 10<br />
            🗺️ 11 mundos · 👹 Boss battles<br />
            🛒 Tienda · 🏆 Mundo Supremo
          </p>

          <motion.div
            animate={{ opacity: hover === "tablas" ? 1 : 0.6 }}
            style={{
              background: "linear-gradient(135deg, #00f5ff, #0080ff)",
              color: "#000",
              borderRadius: "14px",
              padding: "12px 24px",
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(0.8rem, 2vw, 1rem)",
              letterSpacing: 1,
            }}
          >⚡ ¡JUGAR AHORA!</motion.div>
        </motion.div>

        {/* QUEST ESCOLAR */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.35, type: "spring" }}
          onHoverStart={() => setHover("quest")}
          onHoverEnd={() => setHover(null)}
          whileHover={{ scale: 1.04, y: -8 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => elegir("quest")}
          style={{
            flex: "1 1 280px",
            maxWidth: "340px",
            background: hover === "quest"
              ? "linear-gradient(135deg, #2d0a4d, #1a0035)"
              : "linear-gradient(135deg, #180025, #0a0015)",
            border: `3px solid ${hover === "quest" ? "#FFD700" : "rgba(255,215,0,0.3)"}`,
            borderRadius: "24px",
            padding: "32px 24px",
            cursor: "pointer",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: hover === "quest"
              ? "0 0 40px rgba(255,215,0,0.3)"
              : "0 0 15px rgba(255,215,0,0.1)",
            transition: "border 0.2s, box-shadow 0.2s, background 0.2s",
          }}
        >
          {/* Badge NUEVO */}
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [-3, 3, -3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              position: "absolute", top: "12px", right: "12px",
              background: "linear-gradient(135deg, #ff006e, #FFD700)",
              color: "#000", fontWeight: 900,
              fontSize: "0.65rem", padding: "3px 10px",
              borderRadius: "20px", fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 1,
            }}
          >✨ NUEVO</motion.div>

          {/* Brillo superior */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, transparent, #FFD700, transparent)",
            opacity: hover === "quest" ? 1 : 0.4,
          }} />

          <motion.div
            animate={seleccionando === "quest"
              ? { scale: [1, 1.4, 0], rotate: 360 }
              : { scale: [1, 1.08, 1], rotate: [-5, 5, -5] }
            }
            transition={seleccionando === "quest"
              ? { duration: 0.5 }
              : { duration: 2, repeat: Infinity }
            }
            style={{ fontSize: "clamp(60px, 12vw, 90px)", marginBottom: "16px" }}
          >⚔️</motion.div>

          <h3 style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: "clamp(1rem, 3vw, 1.3rem)",
            background: "linear-gradient(90deg, #FFD700, #FF6B35)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontWeight: 900,
            marginBottom: "8px",
            letterSpacing: 1,
          }}>Quest Escolar:<br />El Gran Torneo</h3>

          <p style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "clamp(0.8rem, 2vw, 0.95rem)",
            lineHeight: 1.5,
            marginBottom: "20px",
          }}>
            Aprende cualquier materia<br />
            📚 Guía de estudio + IA<br />
            ⚔️ Mundos · 🐉 Bosses · 📊 Reportes
          </p>

          <motion.div
            animate={{ opacity: hover === "quest" ? 1 : 0.6 }}
            style={{
              background: "linear-gradient(135deg, #FFD700, #FF6B35)",
              color: "#000",
              borderRadius: "14px",
              padding: "12px 24px",
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(0.8rem, 2vw, 1rem)",
              letterSpacing: 1,
            }}
          >🏆 ¡ENTRAR AL TORNEO!</motion.div>
        </motion.div>

      </div>

      {/* Nota para maestros/padres */}
      {(tipoUsuario === "maestro" || tipoUsuario === "padre" || tipoUsuario === "admin") && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            marginTop: "24px",
            color: "rgba(255,255,255,0.35)",
            fontSize: "0.8rem",
            textAlign: "center",
            zIndex: 10,
          }}
        >
          💡 Como {tipoUsuario}, en Quest Escolar puedes subir guías de estudio y ver reportes de alumnos
        </motion.p>
      )}
    </div>
  );
}
