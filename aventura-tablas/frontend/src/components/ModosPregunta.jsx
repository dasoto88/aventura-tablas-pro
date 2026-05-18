import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── MODO 1: OPCIONES MÚLTIPLES (clásico) ────────────────────
export function ModoOpciones({ pregunta, opciones, onResponder, seleccionado }) {
  return (
    <div className="opciones-grid">
      {opciones.map((op, i) => (
        <motion.button
          key={`${op}-${i}`}
          className={`opcion-btn ${seleccionado === op ? (op === pregunta.respuesta ? "correcto" : "incorrecto") : ""}`}
          whileHover={seleccionado === null ? { scale: 1.04, y: -4 } : {}}
          whileTap={seleccionado === null ? { scale: 0.97 } : {}}
          onClick={() => onResponder(op)}
          disabled={seleccionado !== null}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
        >
          {op}
        </motion.button>
      ))}
    </div>
  );
}

// ─── MODO 2: ESCRIBE LA RESPUESTA ────────────────────────────
export function ModoEscribir({ pregunta, onResponder }) {
  const [valor, setValor] = useState("");
  const [estado, setEstado] = useState(null); // null | "correcto" | "incorrecto"

  const enviar = () => {
    if (!valor || estado) return;
    const num = parseInt(valor);
    const correcto = num === pregunta.respuesta;
    setEstado(correcto ? "correcto" : "incorrecto");
    setTimeout(() => {
      onResponder(num);
      setValor("");
      setEstado(null);
    }, 600);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <p style={{ fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.6)", fontSize: 15, textAlign: "center" }}>
        ✍️ Escribe la respuesta:
      </p>
      <motion.input
        animate={estado === "incorrecto" ? { x: [-10, 10, -8, 8, 0] } : estado === "correcto" ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.4 }}
        type="number"
        value={valor}
        onChange={e => setValor(e.target.value)}
        onKeyDown={e => e.key === "Enter" && enviar()}
        placeholder="?"
        min="0"
        max="200"
        style={{
          background: estado === "correcto" ? "rgba(0,184,148,0.3)"
            : estado === "incorrecto" ? "rgba(214,48,49,0.3)"
            : "rgba(0,0,0,0.4)",
          border: `3px solid ${estado === "correcto" ? "#39ff14" : estado === "incorrecto" ? "#ff006e" : "rgba(0,245,255,0.4)"}`,
          borderRadius: 16, color: "#fff",
          fontFamily: "Orbitron, monospace", fontSize: "clamp(32px, 8vw, 56px)",
          fontWeight: 700, textAlign: "center",
          padding: "12px 24px", width: 160, outline: "none",
          transition: "all 0.2s",
        }}
        autoFocus
      />
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
        onClick={enviar}
        disabled={!valor || !!estado}
        style={{
          background: "linear-gradient(135deg, #667eea, #764ba2)",
          border: "none", borderRadius: 14, color: "#fff",
          fontFamily: "Orbitron, monospace", fontSize: 16, fontWeight: 700,
          padding: "14px 40px", cursor: "pointer",
          opacity: !valor ? 0.5 : 1,
        }}
      >
        ✅ CONFIRMAR
      </motion.button>
    </div>
  );
}

// ─── MODO 3: ARRASTRA LOS DÍGITOS ────────────────────────────
export function ModoDigitos({ pregunta, onResponder }) {
  const respStr = String(pregunta.respuesta);
  const digits = respStr.split("").map(Number);

  // Dígitos disponibles (correctos + señuelos)
  const allDigits = [...new Set([
    ...digits,
    ...Array.from({ length: 6 }, () => Math.floor(Math.random() * 10))
  ])].slice(0, 8);
  const shuffled = [...allDigits].sort(() => Math.random() - 0.5);

  const [seleccionados, setSeleccionados] = useState([]);
  const [disponibles] = useState(shuffled);
  const [estado, setEstado] = useState(null);

  const agregar = (d) => {
    if (seleccionados.length >= respStr.length || estado) return;
    const nuevos = [...seleccionados, d];
    setSeleccionados(nuevos);
    if (nuevos.length === respStr.length) {
      const num = parseInt(nuevos.join(""));
      const correcto = num === pregunta.respuesta;
      setEstado(correcto ? "correcto" : "incorrecto");
      setTimeout(() => onResponder(num), 700);
    }
  };

  const borrar = () => { if (!estado) setSeleccionados(sel => sel.slice(0, -1)); };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <p style={{ fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.6)", fontSize: 15 }}>
        🔢 Toca los números para formar la respuesta:
      </p>

      {/* Cajas de la respuesta */}
      <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
        {Array.from({ length: respStr.length }, (_, i) => (
          <motion.div
            key={i}
            animate={estado === "correcto" ? { scale: [1, 1.2, 1] } : estado === "incorrecto" ? { x: [-6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
            style={{
              width: 56, height: 64,
              background: seleccionados[i] !== undefined
                ? (estado === "correcto" ? "rgba(0,184,148,0.3)" : estado === "incorrecto" ? "rgba(214,48,49,0.2)" : "rgba(0,245,255,0.2)")
                : "rgba(255,255,255,0.06)",
              border: `2px solid ${seleccionados[i] !== undefined ? (estado === "correcto" ? "#39ff14" : estado === "incorrecto" ? "#ff006e" : "#00f5ff") : "rgba(255,255,255,0.2)"}`,
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Orbitron, monospace", fontSize: 32, fontWeight: 700, color: "#fff",
            }}
          >
            {seleccionados[i] !== undefined ? seleccionados[i] : ""}
          </motion.div>
        ))}
      </div>

      {/* Dígitos disponibles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 300 }}>
        {disponibles.map((d, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.1, y: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => agregar(d)}
            disabled={!!estado}
            style={{
              width: 50, height: 50,
              background: "linear-gradient(135deg, rgba(102,126,234,0.3), rgba(118,75,162,0.3))",
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: 12, color: "#fff",
              fontFamily: "Orbitron, monospace", fontSize: 22, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {d}
          </motion.button>
        ))}
      </div>

      <button onClick={borrar} disabled={!seleccionados.length || !!estado}
        style={{ background: "transparent", border: "1px solid rgba(255,0,110,0.4)", color: "rgba(255,0,110,0.7)", borderRadius: 10, padding: "6px 20px", fontFamily: "Nunito, sans-serif", fontSize: 13, cursor: "pointer" }}>
        ⌫ Borrar último
      </button>
    </div>
  );
}

// ─── MODO 4: MEMORAMA (empareja la operación con el resultado) ─
export function ModoMemoria({ mundo, onResponder }) {
  const tabla = mundo.tabla;
  // Genera 3 pares de esta tabla
  const nums = Array.from({ length: 10 }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5).slice(0, 3);

  const pares = nums.map(n => ({ operacion: `${tabla}×${n}`, resultado: tabla * n, id: n }));
  const tarjetas = [
    ...pares.map(p => ({ texto: p.operacion, tipo: "op",  id: p.id, valor: p.id })),
    ...pares.map(p => ({ texto: String(p.resultado), tipo: "res", id: p.id, valor: p.id })),
  ].sort(() => Math.random() - 0.5);

  const [selA, setSelA] = useState(null);
  const [selB, setSelB] = useState(null);
  const [paresEncontrados, setParesEncontrados] = useState([]);
  const [errorPar, setErrorPar] = useState(false);
  const [terminado, setTerminado] = useState(false);

  const seleccionar = (tarjeta, idx) => {
    if (paresEncontrados.includes(tarjeta.valor) || terminado) return;
    if (!selA) { setSelA({ ...tarjeta, idx }); return; }
    if (selA.idx === idx) return; // misma tarjeta
    setSelB({ ...tarjeta, idx });

    if (selA.valor === tarjeta.valor && selA.tipo !== tarjeta.tipo) {
      // ¡Par correcto!
      const nuevos = [...paresEncontrados, tarjeta.valor];
      setParesEncontrados(nuevos);
      setSelA(null); setSelB(null);
      if (nuevos.length === pares.length) {
        setTerminado(true);
        setTimeout(() => onResponder(true), 600);
      }
    } else {
      setErrorPar(true);
      setTimeout(() => { setSelA(null); setSelB(null); setErrorPar(false); }, 700);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <p style={{ fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center" }}>
        🃏 Empareja la operación con su resultado:
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 360 }}>
        {tarjetas.map((t, i) => {
          const encontrado = paresEncontrados.includes(t.valor);
          const esSelA = selA?.idx === i;
          const esSelB = selB?.idx === i;
          return (
            <motion.button
              key={i}
              onClick={() => seleccionar(t, i)}
              animate={errorPar && (esSelA || esSelB) ? { x: [-6, 6, -4, 4, 0] } : encontrado ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.35 }}
              style={{
                height: 64, borderRadius: 14,
                background: encontrado ? "rgba(0,184,148,0.3)"
                  : (esSelA || esSelB) ? (errorPar ? "rgba(214,48,49,0.3)" : "rgba(0,245,255,0.25)")
                  : "rgba(255,255,255,0.06)",
                border: `2px solid ${encontrado ? "#39ff14" : (esSelA || esSelB) ? (errorPar ? "#ff006e" : "#00f5ff") : "rgba(255,255,255,0.15)"}`,
                color: "#fff", cursor: encontrado ? "default" : "pointer",
                fontFamily: t.tipo === "op" ? "Rajdhani, sans-serif" : "Orbitron, monospace",
                fontSize: t.tipo === "op" ? 15 : 22, fontWeight: 700,
                opacity: encontrado ? 0.7 : 1,
                transition: "background 0.2s, border 0.2s",
              }}
            >
              {encontrado ? "✅" : t.texto}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MODO 5: COMPLETA LA TABLA (llena el hueco) ──────────────
export function ModoCompletaTabla({ pregunta, onResponder }) {
  // Muestra: 5 × __ = 35  o  __ × 7 = 42
  const hueco = Math.random() > 0.5 ? "num1" : "num2";
  const mostrar = {
    izq: hueco === "num1" ? "?" : pregunta.num1,
    der: hueco === "num2" ? "?" : pregunta.num2,
    res: pregunta.respuesta,
  };

  const valorCorrecto = hueco === "num1" ? pregunta.num1 : pregunta.num2;
  const opciones = [...new Set([valorCorrecto,
    ...Array.from({ length: 5 }, () => Math.max(1, valorCorrecto + Math.floor(Math.random() * 6) - 3))
  ])].slice(0, 4).sort(() => Math.random() - 0.5);

  const [sel, setSel] = useState(null);

  const responder = (op) => {
    if (sel) return;
    setSel(op);
    // La respuesta real para el store sigue siendo la multiplicación
    setTimeout(() => onResponder(op === valorCorrecto ? pregunta.respuesta : -1), 600);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <p style={{ fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
        🧩 ¿Qué número va en el hueco?
      </p>

      {/* Ecuación con hueco */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: "Orbitron, monospace", fontSize: "clamp(28px, 7vw, 52px)", fontWeight: 900, color: "#fff",
        padding: "20px 24px",
        background: "linear-gradient(135deg, rgba(255,0,110,0.1), rgba(0,245,255,0.1))",
        border: "2px solid rgba(255,255,255,0.15)", borderRadius: 20,
      }}>
        <span style={{ color: "#fff" }}>{mostrar.izq}</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>×</span>
        <span style={{ color: "#fff" }}>{mostrar.der}</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>=</span>
        <span style={{ color: "#00f5ff" }}>{mostrar.res}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, maxWidth: 300 }}>
        {opciones.map((op, i) => (
          <motion.button
            key={i}
            className={`opcion-btn ${sel === op ? (op === valorCorrecto ? "correcto" : "incorrecto") : ""}`}
            whileHover={!sel ? { scale: 1.05, y: -3 } : {}}
            whileTap={!sel ? { scale: 0.97 } : {}}
            onClick={() => responder(op)}
            disabled={!!sel}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            style={{ fontSize: 32, padding: 16 }}
          >
            {op}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── SELECTOR DE MODO ─────────────────────────────────────────
// Cambia de modo lentamente (cada 3 aciertos), sin memorama
export function getModoPreguntas(aciertos, mundoId) {
  // Mundos 0-2: siempre opciones (fácil para principiantes)
  if (mundoId <= 2) return "opciones";

  // Mundos 3-5: opciones + escribir ocasional (cada 3 aciertos)
  if (mundoId <= 5) {
    const ciclo = Math.floor(aciertos / 3) % 3;
    if (ciclo === 1) return "escribir";
    return "opciones";
  }

  // Mundos 6+: opciones + escribir + completa (sin digitos ni memoria)
  const ciclo = Math.floor(aciertos / 3) % 4;
  if (ciclo === 1) return "escribir";
  if (ciclo === 3) return "completa";
  return "opciones";
}
