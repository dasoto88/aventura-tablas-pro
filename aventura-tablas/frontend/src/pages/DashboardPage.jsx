import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import axios from "axios";
import { useGameStore } from "../utils/store";
import { descargarReportePDF } from "../utils/pdfUtils";

const API = process.env.REACT_APP_API_URL || "";
const MUNDOS_TOTAL = 10;

export default function DashboardPage() {
  const store = useGameStore();
  const esMaestro = store.tipoUsuario === "maestro";
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alumnoDetalle, setAlumnoDetalle] = useState(null);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [newDeps, setNewDeps] = useState([{ nombre: "", correo: "", grado: "" }]);
  const [enviandoAmp, setEnviandoAmp] = useState(false);

  const depTxt  = esMaestro ? "alumnos" : "hijos";
  const icono   = esMaestro ? "🎓" : "👨‍👩‍👧";

  const cargar = useCallback(async () => {
    if (!store.licencia) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/dashboard/tutor/${store.licencia}`);
      setAlumnos(data.alumnos || []);
    } catch (e) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [store.licencia]);

  useEffect(() => { cargar(); }, [cargar]);

  const irAJugar = () => {
    useGameStore.setState({ pagina: "seleccion_avatar" });
  };

  const addDepRow = () => setNewDeps(p => [...p, { nombre: "", correo: "", grado: "" }]);
  const removeDepRow = (i) => setNewDeps(p => p.filter((_, idx) => idx !== i));
  const updateDep = (i, field, val) => setNewDeps(p => p.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  const enviarAmpliacion = async () => {
    const validos = newDeps.filter(d => d.nombre.trim());
    if (validos.length === 0) { toast.error("Agrega al menos un nombre"); return; }
    setEnviandoAmp(true);
    try {
      const { data } = await axios.post(`${API}/api/tutor/agregar-dependientes`, {
        tutor_licencia: store.licencia,
        dependientes: validos,
      });
      toast.success(`✅ Solicitud enviada. Costo adicional: $${data.costo_adicional} MXN. Revisa tu correo.`);
      setMostrarAgregar(false);
      setNewDeps([{ nombre: "", correo: "", grado: "" }]);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al enviar solicitud");
    } finally {
      setEnviandoAmp(false);
    }
  };

  return (
    <div className="page" style={{
      background: "radial-gradient(ellipse at top, #0a001f 0%, #030010 70%)",
      minHeight: "100vh", paddingBottom: 40
    }}>
      {/* HEADER */}
      <div className="hud" style={{ background: "rgba(0,0,0,0.9)", borderBottom: "1px solid rgba(162,155,254,0.3)" }}>
        <div style={{ fontFamily: "Orbitron,monospace", fontSize: 15, fontWeight: 700, color: "#a29bfe" }}>
          {icono} {esMaestro ? "MAESTRO" : "PADRE"} — {store.nombre}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={irAJugar} className="btn btn-neon btn-sm">🎮 Jugar</button>
          <button onClick={() => store.cerrarSesion()} className="btn btn-danger btn-sm">🚪 Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>

        {/* Título */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>{icono}</div>
          <h2 style={{ fontFamily: "Orbitron,monospace", color: "#a29bfe", fontSize: "clamp(18px,4vw,28px)", marginBottom: 6 }}>
            {esMaestro ? "Panel del Maestro" : "Panel de Padres"}
          </h2>
          <p style={{ fontFamily: "Nunito,sans-serif", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            {esMaestro ? "Monitorea el avance de tus alumnos en tiempo real" : "Sigue el progreso de tus hijos"}
          </p>
        </motion.div>

        {/* Stats resumen */}
        {!loading && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: `Total ${depTxt}`, value: alumnos.length, color: "#a29bfe", icon: "👥" },
              { label: "Activos", value: alumnos.filter(a => a.Activa === "SI").length, color: "#39ff14", icon: "✅" },
              { label: "Mundos prom.", value: alumnos.length ? Math.round(alumnos.reduce((s, a) => s + (a.Mundos_Completados || 0), 0) / alumnos.length) : 0, color: "#FFD700", icon: "🌍" },
              { label: "Tiempo total (min)", value: alumnos.reduce((s, a) => s + (a.Tiempo_Total_Min || 0), 0), color: "#00f5ff", icon: "⏱" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${s.color}33`, borderRadius: 16, padding: "14px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>{s.icon}</div>
                <div style={{ fontFamily: "Orbitron,monospace", fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontFamily: "Nunito,sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Botón agregar */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button onClick={() => setMostrarAgregar(true)}
            style={{ background: "linear-gradient(135deg,rgba(162,155,254,0.2),rgba(108,92,231,0.2))", border: "2px solid rgba(162,155,254,0.4)", borderRadius: 12, color: "#a29bfe", padding: "10px 20px", fontFamily: "Orbitron,monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
            ➕ Agregar {depTxt}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ fontSize: 40, display: "inline-block" }}>⚙️</motion.div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Nunito,sans-serif", marginTop: 12 }}>Cargando datos...</p>
          </div>
        )}

        {/* Lista de alumnos/hijos */}
        {!loading && alumnos.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,0.03)", borderRadius: 24, border: "1px dashed rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Nunito,sans-serif", fontSize: 15 }}>
              Aún no tienes {depTxt} registrados.<br />Usa el botón "Agregar {depTxt}" para añadirlos.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alumnos.map((alu, i) => {
            const mundos = alu.Mundos_Completados || 0;
            const pct = alu.pct_progreso || Math.round((mundos / MUNDOS_TOTAL) * 100);
            const tiempo = alu.Tiempo_Total_Min || 0;
            const horas = Math.floor(tiempo / 60);
            const mins = tiempo % 60;
            const fallos = alu.fallos_obj || {};
            const tablasProb = Object.entries(fallos).filter(([,v]) => v >= 3).sort((a,b) => b[1]-a[1]).slice(0,3);
            const ultimaSesion = alu.Ultima_Sesion ? new Date(alu.Ultima_Sesion).toLocaleDateString("es-MX", { day:"2-digit", month:"short", year:"numeric" }) : "Nunca";

            return (
              <motion.div key={alu.Licencia || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${alu.Activa==="SI" ? "rgba(162,155,254,0.25)" : "rgba(255,0,110,0.2)"}`, borderRadius: 20, padding: "18px 20px" }}>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                  {/* Avatar emoji */}
                  <div style={{ fontSize: 44, flexShrink: 0, lineHeight: 1 }}>
                    {pct >= 100 ? "🏆" : pct >= 60 ? "⭐" : pct >= 30 ? "🌱" : "🧒"}
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontFamily: "Orbitron,monospace", fontSize: 15, color: "#fff", fontWeight: 700 }}>{alu.Nombre || "Sin nombre"}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10,
                        background: alu.Activa==="SI" ? "rgba(57,255,20,0.15)" : "rgba(255,0,110,0.15)",
                        color: alu.Activa==="SI" ? "#39ff14" : "#ff006e" }}>
                        {alu.Activa==="SI" ? "● Activo" : "● Inactivo"}
                      </span>
                      {alu.Grado && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{alu.Grado}</span>}
                    </div>

                    {/* Barra de progreso */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Nunito,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
                        <span>Progreso: {mundos}/{MUNDOS_TOTAL} mundos</span>
                        <span style={{ color: pct>=80?"#39ff14":pct>=50?"#FFD700":"#ff006e", fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 10 }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: i * 0.1 }}
                          style={{ background: `linear-gradient(90deg,${pct>=80?"#39ff14,#00b894":pct>=50?"#FFD700,#e17055":"#ff006e,#fd79a8"})`, borderRadius: 6, height: 10 }} />
                      </div>
                    </div>

                    {/* Stats en fila */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "Nunito,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      <span>⏱ <strong style={{ color: "#00f5ff" }}>{horas > 0 ? `${horas}h ` : ""}{mins} min</strong></span>
                      <span>🪙 <strong style={{ color: "#FFD700" }}>{alu.Monedas || 0}</strong></span>
                      <span>📅 Última sesión: <strong style={{ color: "rgba(255,255,255,0.6)" }}>{ultimaSesion}</strong></span>
                      {alu.Num_Sesiones > 0 && <span>📊 <strong style={{ color: "#a29bfe" }}>{alu.Num_Sesiones}</strong> sesiones</span>}
                    </div>

                    {/* Tablas problemáticas */}
                    {tablasProb.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "Nunito,sans-serif", fontSize: 11, color: "rgba(255,120,120,0.7)" }}>⚠️ Dificultad en:</span>
                        {tablasProb.map(([t, v]) => (
                          <span key={t} style={{ background: "rgba(255,0,110,0.12)", border: "1px solid rgba(255,0,110,0.3)", borderRadius: 20, padding: "2px 8px", fontSize: 10, color: "#ff006e" }}>
                            Tabla ×{t} ({v} errores)
                          </span>
                        ))}
                      </div>
                    )}
                    {tablasProb.length === 0 && mundos > 0 && (
                      <div style={{ marginTop: 6, fontFamily: "Nunito,sans-serif", fontSize: 11, color: "rgba(57,255,20,0.7)" }}>
                        ✅ Sin tablas problemáticas — ¡excelente rendimiento!
                      </div>
                    )}
                  </div>

                  <button onClick={() => setAlumnoDetalle(alumnoDetalle?.Licencia === alu.Licencia ? null : alu)}
                    style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.25)", borderRadius: 10, color: "#00f5ff", padding: "8px 14px", fontFamily: "Nunito,sans-serif", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {alumnoDetalle?.Licencia === alu.Licencia ? "▲ Ocultar" : "▼ Ver detalle"}
                  </button>
                </div>

                {/* Panel de detalle */}
                <AnimatePresence>
                  {alumnoDetalle?.Licencia === alu.Licencia && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 16, paddingTop: 16, overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontFamily: "Orbitron,monospace", fontSize: 12, color: "#00f5ff" }}>📊 HISTORIAL DETALLADO</div>
                        <button
                          onClick={() => descargarReportePDF({
                            Nombre: alu.Nombre,
                            Grado: alu.Grado,
                            Correo: alu.Correo,
                            Maestro_Nombre: esMaestro ? store.nombre : undefined,
                            mundos,
                            pct,
                            fallos: alu.fallos_obj || {},
                            Monedas: alu.Monedas,
                            tiempoMin: tiempo,
                            horas,
                            mins,
                          })}
                          style={{ background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.35)", color: "#00f5ff", borderRadius: 10, padding: "7px 14px", cursor: "pointer", fontFamily: "Nunito,sans-serif", fontSize: 12, fontWeight: 700 }}>
                          📥 Descargar PDF
                        </button>
                      </div>

                      {/* Todas las tablas */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontFamily: "Nunito,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Errores por tabla:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {Array.from({ length: 10 }, (_, idx) => {
                            const tabla = String(idx + 1);
                            const errores = (alu.fallos_obj || {})[tabla] || 0;
                            return (
                              <div key={tabla} style={{ background: errores >= 5 ? "rgba(255,0,110,0.15)" : errores >= 3 ? "rgba(255,140,0,0.15)" : errores > 0 ? "rgba(255,214,0,0.1)" : "rgba(57,255,20,0.08)", border: `1px solid ${errores >= 5 ? "rgba(255,0,110,0.4)" : errores >= 3 ? "rgba(255,140,0,0.4)" : errores > 0 ? "rgba(255,214,0,0.3)" : "rgba(57,255,20,0.3)"}`, borderRadius: 10, padding: "6px 10px", textAlign: "center", minWidth: 60 }}>
                                <div style={{ fontFamily: "Orbitron,monospace", fontSize: 13, fontWeight: 700, color: "#fff" }}>×{tabla}</div>
                                <div style={{ fontFamily: "Nunito,sans-serif", fontSize: 10, color: errores >= 3 ? "#ff006e" : errores > 0 ? "#FFD700" : "#39ff14" }}>
                                  {errores > 0 ? `${errores} err.` : "✓ OK"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Últimas sesiones */}
                      {alu.sesiones_recientes?.length > 0 && (
                        <div>
                          <div style={{ fontFamily: "Nunito,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Últimas sesiones:</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {alu.sesiones_recientes.slice(0, 5).map((s, si) => (
                              <div key={si} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontFamily: "Nunito,sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                                  📅 {new Date(s.Inicio).toLocaleDateString("es-MX", { day:"2-digit", month:"short" })}
                                </span>
                                <span style={{ fontFamily: "Nunito,sans-serif", fontSize: 11, color: "#00f5ff" }}>
                                  ⏱ {s.Tiempo_Min || 0} min
                                </span>
                                {s.Fin && s.Fin !== "" && (
                                  <span style={{ fontFamily: "Nunito,sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                                    {new Date(s.Inicio).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} → {new Date(s.Fin).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(!alu.sesiones_recientes || alu.sesiones_recientes.length === 0) && (
                        <p style={{ fontFamily: "Nunito,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                          Aún no hay sesiones registradas para este alumno.
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Quest Escolar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "linear-gradient(135deg, rgba(108,52,131,0.2), rgba(26,82,118,0.2))",
            border: "2px solid rgba(108,52,131,0.4)",
            borderRadius: "16px",
            padding: "20px",
            marginTop: "20px",
            cursor: "pointer",
          }}
          onClick={() => store.setPagina("quest_menu")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "2.5rem" }}>⚔️</span>
            <div>
              <h3 style={{ color: "#FFD700", marginBottom: "4px", fontFamily: "'Orbitron', sans-serif", fontSize: "1rem" }}>
                Quest Escolar: El Gran Torneo
              </h3>
              <p style={{ color: "#aaa", fontSize: "0.9rem", margin: 0 }}>
                Sube guías de estudio · Ve el progreso de tus alumnos · Descarga reportes
              </p>
            </div>
            <span style={{ marginLeft: "auto", color: "#8E44AD", fontSize: "1.5rem" }}>→</span>
          </div>
        </motion.div>

        {/* Botón refrescar */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={cargar} className="btn btn-neon btn-sm">🔄 Actualizar datos</button>
        </div>
      </div>

      {/* Modal agregar dependientes */}
      <AnimatePresence>
        {mostrarAgregar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}
            onClick={() => setMostrarAgregar(false)}>
            <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 30 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "linear-gradient(135deg,#1a1f4e,#0d1237)", border: "2px solid rgba(162,155,254,0.4)", borderRadius: 24, padding: "28px 24px", maxWidth: 560, width: "100%" }}>
              <h3 style={{ fontFamily: "Orbitron,monospace", color: "#a29bfe", marginBottom: 6, fontSize: 16 }}>
                ➕ Agregar {depTxt}
              </h3>
              <p style={{ fontFamily: "Nunito,sans-serif", color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
                Costo: <strong style={{ color: "#FFD700" }}>$99 MXN/mes por cada {esMaestro ? "alumno" : "hijo"}</strong>. Se enviará por transferencia bancaria.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, maxHeight: 320, overflowY: "auto" }}>
                {newDeps.map((d, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: "Nunito,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{esMaestro ? "Alumno" : "Hijo/a"} #{i + 1}</span>
                      {newDeps.length > 1 && (
                        <button onClick={() => removeDepRow(i)} style={{ background: "transparent", border: "none", color: "#ff006e", cursor: "pointer", fontSize: 16 }}>✕</button>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input className="input" style={{ fontSize: 13 }} placeholder="Nombre *" value={d.nombre} onChange={e => updateDep(i, "nombre", e.target.value)} />
                      <input className="input" style={{ fontSize: 13 }} placeholder="Correo (opcional)" value={d.correo} onChange={e => updateDep(i, "correo", e.target.value)} type="email" />
                      <input className="input" style={{ fontSize: 13, gridColumn: "1/-1" }} placeholder="Grado (ej: 2° Primaria)" value={d.grado} onChange={e => updateDep(i, "grado", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addDepRow} style={{ width: "100%", background: "rgba(162,155,254,0.1)", border: "1px dashed rgba(162,155,254,0.4)", borderRadius: 12, color: "#a29bfe", padding: "10px", fontFamily: "Nunito,sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 12 }}>
                + Agregar otro {esMaestro ? "alumno" : "hijo/a"}
              </button>

              <div style={{ background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.3)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontFamily: "Nunito,sans-serif", fontSize: 13, color: "#FFD700" }}>
                💰 Total estimado: <strong>${(newDeps.filter(d => d.nombre.trim()).length) * 99} MXN/mes</strong> ({newDeps.filter(d => d.nombre.trim()).length} {depTxt})
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1, padding: "13px" }} onClick={enviarAmpliacion} disabled={enviandoAmp}>
                  {enviandoAmp ? "Enviando..." : `📨 Solicitar ${depTxt}`}
                </button>
                <button onClick={() => setMostrarAgregar(false)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "Nunito,sans-serif", fontSize: 14, padding: "13px" }}>
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
