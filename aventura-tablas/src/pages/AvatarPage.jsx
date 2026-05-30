import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../utils/store";
import { AVATARES } from "../utils/gameData";

export default function AvatarPage() {
  const { nombre, seleccionarAvatar, modoDemo } = useGameStore();
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const confirmar = () => {
    if (!selectedId) return;
    seleccionarAvatar(selectedId);
  };

  const avatar = AVATARES.find(a => a.id === selectedId);

  return (
    <div className="page" style={{
      background: "radial-gradient(ellipse at top, #1a0050 0%, #030010 60%)",
      padding: "24px 16px",
      minHeight: "100vh",
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", marginBottom: 32 }}
      >
        <div style={{ fontSize: 48, marginBottom: 8 }}>⚔️</div>
        <h1 style={{
          fontFamily: "Orbitron, monospace", fontSize: "clamp(18px,5vw,32px)",
          fontWeight: 900, color: "#fff", marginBottom: 8,
        }}>
          ¡Elige tu Aventurero!
        </h1>
        <p style={{ fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.55)", fontSize: 16 }}>
          Hola <span style={{ color: "#00f5ff", fontWeight: 700 }}>{nombre}</span>, ¿quién serás en la aventura?
        </p>
        {modoDemo && (
          <div style={{ display: "inline-block", background: "rgba(255,214,0,0.15)", border: "1px solid #FFD700", borderRadius: 20, padding: "4px 14px", marginTop: 8 }}>
            <span style={{ color: "#FFD700", fontFamily: "Orbitron, monospace", fontSize: 11 }}>🎮 MODO DEMO</span>
          </div>
        )}
      </motion.div>

      {/* Grid avatares */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 16,
        maxWidth: 860,
        margin: "0 auto 32px",
      }}>
        {AVATARES.map((av, i) => (
          <motion.div
            key={av.id}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
            onHoverStart={() => setHoveredId(av.id)}
            onHoverEnd={() => setHoveredId(null)}
            onClick={() => setSelectedId(av.id)}
            style={{
              background: selectedId === av.id
                ? `linear-gradient(135deg, ${av.color}33, ${av.colorSecundario}33)`
                : hoveredId === av.id
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.04)",
              border: `2px solid ${selectedId === av.id ? av.color : hoveredId === av.id ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 20,
              padding: 20,
              textAlign: "center",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.3s ease",
              boxShadow: selectedId === av.id ? `0 0 30px ${av.color}66` : "none",
              transform: selectedId === av.id ? "scale(1.04)" : "scale(1)",
            }}
          >
            {/* Glow background si seleccionado */}
            {selectedId === av.id && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(circle, ${av.color}20, transparent 70%)`,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Check */}
            {selectedId === av.id && (
              <div style={{
                position: "absolute", top: 8, right: 8,
                width: 24, height: 24, borderRadius: "50%",
                background: av.color, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700
              }}>✓</div>
            )}

            <motion.div
              animate={selectedId === av.id ? { rotate: [0, -10, 10, 0] } : {}}
              transition={{ duration: 0.5, repeat: selectedId === av.id ? Infinity : 0, repeatDelay: 2 }}
              style={{ fontSize: 64, lineHeight: 1, marginBottom: 10, filter: `drop-shadow(0 0 12px ${av.color})` }}
            >
              {av.emoji}
            </motion.div>

            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              {av.nombre}
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
              {av.descripcion}
            </div>

            {/* Estrellas */}
            <div style={{ marginTop: 8 }}>
              {Array.from({ length: 5 }, (_, j) => (
                <span key={j} style={{ fontSize: 10, color: j < av.estrellas ? "#FFD700" : "rgba(255,255,255,0.2)" }}>★</span>
              ))}
            </div>

            {/* Habilidad al hover */}
            <AnimatePresence>
              {hoveredId === av.id && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  style={{
                    marginTop: 8,
                    background: "rgba(0,0,0,0.5)",
                    borderRadius: 8, padding: "4px 8px",
                    fontSize: 10, color: av.color,
                    fontFamily: "Nunito, sans-serif",
                    lineHeight: 1.3,
                  }}
                >
                  ⚡ {av.habilidad}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Panel de confirmación */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            style={{
              maxWidth: 500, margin: "0 auto",
              background: "rgba(5,8,30,0.95)", backdropFilter: "blur(20px)",
              border: `2px solid ${avatar?.color}`,
              borderRadius: 24, padding: 24, textAlign: "center",
              boxShadow: `0 0 40px ${avatar?.color}44`,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 8 }}>{avatar?.emoji}</div>
            <h3 style={{ fontFamily: "Orbitron, monospace", color: avatar?.color, marginBottom: 6, fontSize: 18 }}>
              {avatar?.nombre}
            </h3>
            <p style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Nunito, sans-serif", fontSize: 14, marginBottom: 16 }}>
              ⚡ Habilidad: {avatar?.habilidad}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={confirmar}
              className="btn btn-full"
              style={{
                background: `linear-gradient(135deg, ${avatar?.color}, ${avatar?.colorSecundario})`,
                color: "#fff",
                padding: "16px 32px",
                borderRadius: 16,
                fontFamily: "Orbitron, monospace",
                fontSize: 18, fontWeight: 700,
                border: "none", cursor: "pointer",
                boxShadow: `0 8px 30px ${avatar?.color}66`,
              }}
            >
              ¡ELEGIR A {avatar?.nombre.split(" ")[0].toUpperCase()}! 🚀
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
