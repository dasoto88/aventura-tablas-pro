import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import axios from "axios";
import { useGameStore } from "../utils/store";
import { MUNDOS } from "../utils/gameData";
import { descargarReportePDF } from "../utils/pdfUtils";

const API = process.env.REACT_APP_API_URL || "";
const MUNDOS_TOTAL = 10;

export default function AdminPage() {
  const store = useGameStore();
  const [tab, setTab] = useState("licencias");
  const [licencias, setLicencias] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [solicitudesGrupo, setSolicitudesGrupo] = useState([]);
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null);

  // Crear licencia
  const [newCodigo, setNewCodigo] = useState("");
  const [newTipo, setNewTipo] = useState("alumno");
  const [newNombre, setNewNombre] = useState("");
  const [newCorreo, setNewCorreo] = useState("");
  const [newCelular, setNewCelular] = useState("");
  const [newGrado, setNewGrado] = useState("");
  const [newMaestroLic, setNewMaestroLic] = useState("");
  const [autoGenerando, setAutoGenerando] = useState(false);

  // Reiniciar alumno
  const [reiniciarModal, setReiniciarModal] = useState(null);
  const [opReiniciarMundos, setOpReiniciarMundos] = useState(false);   // ¿reiniciar mundos?
  const [mundosTotalReset, setMundosTotalReset] = useState(true);       // total vs individual
  const [mundosSeleccionados, setMundosSeleccionados] = useState([]);
  const [opReiniciarMonedas, setOpReiniciarMonedas] = useState(false);
  const [opReiniciarInventario, setOpReiniciarInventario] = useState(false);

  // Cambiar contraseña admin
  const [pwActual, setPwActual] = useState("");
  const [pwNueva, setPwNueva] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Backup base de datos
  const [backupLoading, setBackupLoading]   = useState(false);
  const [importando,    setImportando]      = useState(false);
  const importRef = useRef();

  // Importar desde Google Sheets (bulk CSV)
  const [modalImportGS, setModalImportGS]   = useState(false);
  const [csvTexto,      setCsvTexto]        = useState("");
  const [importGSCargando, setImportGSCargando] = useState(false);

  // Reporte seleccionado para imprimir
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
  const printRef = useRef();

  // Alta Directa (efectivo / transferencia)
  const [altaTipo, setAltaTipo]           = useState("alumno");
  const [altaNombre, setAltaNombre]       = useState("");
  const [altaCorreo, setAltaCorreo]       = useState("");
  const [altaCelular, setAltaCelular]     = useState("");
  const [altaEscuela, setAltaEscuela]     = useState("");
  const [altaGrado, setAltaGrado]         = useState("");
  const [altaDeps, setAltaDeps]           = useState([{ nombre:"", correo:"", grado:"" }]);
  const [altaTipoPago, setAltaTipoPago]   = useState("mensual");
  const [altaLoading, setAltaLoading]     = useState(false);
  const [altaResultado, setAltaResultado] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rLic, rSol, rRep, rGrupo] = await Promise.all([
        axios.get(`${API}/api/admin/licencias`),
        axios.get(`${API}/api/admin/solicitudes`).catch(() => ({ data: { solicitudes: [] } })),
        axios.get(`${API}/api/admin/reportes`).catch(() => ({ data: { reportes: [] } })),
        axios.get(`${API}/api/admin/solicitudes-grupo`).catch(() => ({ data: { solicitudes: [] } })),
      ]);
      setLicencias(rLic.data.licencias || []);
      setSolicitudes(rSol.data.solicitudes || []);
      setReportes(rRep.data.reportes || []);
      setSolicitudesGrupo(rGrupo.data.solicitudes || []);
    } catch { toast.error("Error al cargar datos del servidor"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const autoGenerarCodigo = async () => {
    if (!newNombre.trim()) { toast.error("Escribe el nombre primero"); return; }
    setAutoGenerando(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/generar-codigo`, {
        nombre: newNombre.trim(), tipo: newTipo,
      });
      setNewCodigo(data.codigo);
      toast.success("✅ Código generado automáticamente");
    } catch { toast.error("Error al generar código"); }
    finally { setAutoGenerando(false); }
  };

  const crear = async () => {
    if (!newCodigo.trim()) { toast.error("Escribe un código o usa el botón de generar"); return; }
    try {
      await axios.post(`${API}/api/admin/crear-licencia`, {
        codigo: newCodigo.trim(), tipo: newTipo,
        nombre: newNombre, correo: newCorreo, celular: newCelular,
        grado: newGrado, maestro_licencia: newMaestroLic,
      });
      toast.success("✅ Licencia creada");
      setNewCodigo(""); setNewNombre(""); setNewCorreo(""); setNewCelular("");
      setNewGrado(""); setNewMaestroLic(""); setNewTipo("alumno");
      cargar(); setTab("licencias");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al crear licencia");
    }
  };

  const activar = async (codigo) => {
    try {
      const { data } = await axios.post(`${API}/api/admin/activar-licencia`, { codigo });
      toast.success(data.correo_enviado ? "✅ Activada — correo enviado" : "✅ Activada (sin correo configurado)");
      cargar();
    } catch { toast.error("Error al activar"); }
  };

  const desactivar = async (codigo) => {
    if (!window.confirm(`¿Desactivar la licencia ${codigo}?`)) return;
    try {
      await axios.post(`${API}/api/admin/desactivar-licencia`, { codigo });
      toast.success("Licencia desactivada");
      cargar();
    } catch { toast.error("Error al desactivar"); }
  };

  const eliminar = async (codigo) => {
    if (!window.confirm(`¿Eliminar permanentemente ${codigo}?`)) return;
    try {
      await axios.delete(`${API}/api/admin/eliminar-licencia/${codigo}`);
      toast.success("Licencia eliminada");
      cargar();
    } catch { toast.error("Error al eliminar"); }
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    try {
      await axios.post(`${API}/api/admin/editar-licencia`, {
        licencia: editando.Licencia,
        nombre: editando.Nombre || "",
        correo: editando.Correo || "",
        celular: editando.Celular || "",
        monedas: editando.Monedas || 0,
        nivel_max: editando.Nivel_Max || 1,
        grado: editando.Grado || "",
        maestro_licencia: editando.Maestro_Licencia || "",
      });
      toast.success("✅ Datos actualizados");
      setEditando(null);
      cargar();
    } catch { toast.error("Error al guardar"); }
  };

  const cambiarPassword = async () => {
    if (!pwActual.trim()) { toast.error("Escribe tu licencia actual"); return; }
    if (!pwNueva.trim() || pwNueva.length < 6) { toast.error("La nueva licencia debe tener al menos 6 caracteres"); return; }
    if (pwNueva !== pwConfirm) { toast.error("Las licencias nuevas no coinciden"); return; }
    setPwLoading(true);
    try {
      await axios.post(`${API}/api/admin/cambiar-licencia`, {
        licencia_actual: pwActual.trim(), licencia_nueva: pwNueva.trim(),
      });
      toast.success("✅ ¡Licencia de admin cambiada! Cerrando sesión...");
      setPwActual(""); setPwNueva(""); setPwConfirm("");
      setTimeout(() => store.cerrarSesion(), 2000);
    } catch (e) {
      toast.error(`❌ ${e.response?.data?.detail || "Error al cambiar"}`);
    } finally { setPwLoading(false); }
  };

  // ── Backup de base de datos ──────────────────────────────────
  const descargarDB = () => {
    window.open(`${API}/api/admin/exportar-db?licencia=${encodeURIComponent(store.licencia)}`, "_blank");
  };

  const backupPorEmail = async () => {
    setBackupLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/admin/backup-ahora?licencia=${encodeURIComponent(store.licencia)}`);
      toast.success("📧 Backup enviado a tu correo");
    } catch (e) {
      toast.error(`❌ ${e.response?.data?.detail || "Error al enviar backup"}`);
    } finally { setBackupLoading(false); }
  };

  const restaurarDB = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!archivo.name.endsWith(".db")) { toast.error("Solo archivos .db son válidos"); return; }
    if (!window.confirm(`¿Restaurar la base de datos con "${archivo.name}"? Esto reemplazará TODOS los datos actuales.`)) return;
    setImportando(true);
    const form = new FormData();
    form.append("archivo", archivo);
    try {
      const { data } = await axios.post(
        `${API}/api/admin/importar-db?licencia=${encodeURIComponent(store.licencia)}`,
        form, { headers: { "Content-Type": "multipart/form-data" } }
      );
      toast.success(`✅ ${data.mensaje}`);
      cargar();
    } catch (e) {
      toast.error(`❌ ${e.response?.data?.detail || "Error al restaurar"}`);
    } finally { setImportando(false); importRef.current.value = ""; }
  };

  // ── Importar usuarios desde Google Sheets (pegar CSV) ────────
  const importarDesdeCSV = async () => {
    if (!csvTexto.trim()) { toast.error("Pega los datos primero"); return; }
    setImportGSCargando(true);
    try {
      // Parsear CSV o líneas: Licencia,Activa,Tipo,Nombre,Correo,Celular,Monedas,Nivel_Max
      const lineas = csvTexto.trim().split("\n").filter(l => l.trim());
      const licencias = [];
      for (const linea of lineas) {
        const cols = linea.split(/[,\t]/).map(c => c.trim().replace(/^"|"$/g, ""));
        if (cols.length < 1 || !cols[0]) continue;
        // Saltar cabecera si existe
        if (cols[0].toLowerCase() === "licencia" || cols[0].toLowerCase() === "codigo") continue;
        licencias.push({
          licencia:   cols[0] || "",
          activa:     cols[1]?.toUpperCase() === "SI" ? "SI" : (cols[1] || "SI"),
          tipo:       cols[2]?.toLowerCase() || "alumno",
          nombre:     cols[3] || "",
          correo:     cols[4] || "",
          celular:    cols[5] || "",
          monedas:    parseInt(cols[6]) || 0,
          inventario: cols[7] || "",
          nivel_max:  parseInt(cols[8]) || 1,
        });
      }
      if (licencias.length === 0) { toast.error("No se encontraron datos válidos"); return; }
      const { data } = await axios.post(`${API}/api/admin/importar-licencias`, { licencias });
      toast.success(`✅ ${data.creadas} creadas · ${data.actualizadas} actualizadas`);
      if (data.errores?.length) toast.error(`⚠️ ${data.errores.length} errores: ${data.errores[0]}`);
      setModalImportGS(false);
      setCsvTexto("");
      cargar();
    } catch (e) {
      toast.error(`❌ ${e.response?.data?.detail || "Error al importar"}`);
    } finally { setImportGSCargando(false); }
  };

  const altaDirecta = async () => {
    if (!altaNombre.trim() || !altaCorreo.trim() || !altaCelular.trim()) {
      toast.error("Nombre, correo y celular son obligatorios"); return;
    }
    const esTutor = altaTipo === "maestro" || altaTipo === "padre";
    const depsValidos = esTutor ? altaDeps.filter(d => d.nombre.trim()) : [];
    if (esTutor && depsValidos.length === 0) {
      toast.error(`Agrega al menos un ${altaTipo === "maestro" ? "alumno" : "hijo"}`); return;
    }
    setAltaLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/registrar-directo`, {
        tipo: altaTipo, nombre: altaNombre.trim(), correo: altaCorreo.trim(),
        celular: altaCelular.trim(), escuela: altaEscuela.trim(),
        grado: altaGrado, dependientes: depsValidos, tipo_pago: altaTipoPago,
      });
      setAltaResultado(data);
      toast.success("✅ ¡Usuario dado de alta y correo enviado!");
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al dar de alta");
    } finally { setAltaLoading(false); }
  };

  const imprimirReporte = (rep) => {
    setReporteSeleccionado(rep);
    setTimeout(() => {
      const contenido = printRef.current?.innerHTML;
      if (!contenido) return;
      const w = window.open("", "_blank");
      w.document.write(`<!DOCTYPE html><html><head><title>Reporte — ${rep.Nombre}</title>
<style>
  body{font-family:Arial,sans-serif;padding:30px;background:#fff;color:#000;}
  h1{color:#1a1f4e;font-size:22px;margin-bottom:4px;}
  h2{color:#3a3f7e;font-size:16px;margin-top:20px;border-bottom:2px solid #1a1f4e;padding-bottom:4px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;}
  .box{background:#f5f7ff;border:1px solid #dde;border-radius:8px;padding:12px;}
  .label{font-size:10px;text-transform:uppercase;color:#777;margin-bottom:3px;}
  .val{font-size:18px;font-weight:700;color:#1a1f4e;}
  .bar-bg{background:#eee;border-radius:4px;height:18px;margin:4px 0;}
  .bar{background:linear-gradient(90deg,#667eea,#764ba2);border-radius:4px;height:18px;}
  .tabla-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:13px;}
  .footer{margin-top:30px;font-size:11px;color:#aaa;text-align:center;}
</style></head><body>
${contenido}
<div class="footer">Aventura de Tablas Pro — Reporte generado el ${new Date().toLocaleDateString("es-MX", {year:"numeric",month:"long",day:"numeric"})}</div>
</body></html>`);
      w.document.close();
      w.print();
    }, 200);
  };

  const licenciasFiltradas = licencias.filter(l =>
    !busqueda ||
    String(l.Licencia || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    String(l.Nombre   || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    String(l.Correo   || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    String(l.Tipo     || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const maestros = licencias.filter(l => l.Tipo === "maestro");
  const padres   = licencias.filter(l => l.Tipo === "padre");
  const alumnos  = licencias.filter(l => l.Tipo === "alumno");
  const pendientes = solicitudes.filter(s => s.Estado === "Pendiente").length;
  const pendientesGrupo = solicitudesGrupo.filter(s => s.Estado === "Pendiente" || s.Estado === "Pendiente_Ampliacion").length;
  const activas    = licencias.filter(l => l.Activa === "SI").length;

  const bloquear = async (codigo, bloquear) => {
    if (!window.confirm(`¿${bloquear ? "Bloquear" : "Desbloquear"} la licencia ${codigo}?`)) return;
    try {
      await axios.post(`${API}/api/admin/bloquear-licencia`, { codigo, bloqueado: bloquear });
      toast.success(bloquear ? "🔒 Licencia bloqueada (y sus alumnos)" : "🔓 Licencia desbloqueada");
      cargar();
    } catch { toast.error("Error al cambiar estado"); }
  };

  const abrirReiniciarModal = (lic) => {
    setReiniciarModal({ lic, mundosCompletados: (lic.Nivel_Max || 1) - 1 });
    setOpReiniciarMundos(false);
    setMundosTotalReset(true);
    setMundosSeleccionados([]);
    setOpReiniciarMonedas(false);
    setOpReiniciarInventario(false);
  };

  const seleccionarTodo = () => {
    setOpReiniciarMundos(true);
    setMundosTotalReset(true);
    setOpReiniciarMonedas(true);
    setOpReiniciarInventario(true);
  };

  const ejecutarReinicio = async () => {
    if (!reiniciarModal) return;
    if (!opReiniciarMundos && !opReiniciarMonedas && !opReiniciarInventario) {
      toast.error("Selecciona al menos una opción de reinicio");
      return;
    }
    if (opReiniciarMundos && !mundosTotalReset && mundosSeleccionados.length === 0) {
      toast.error("Selecciona al menos un mundo individual");
      return;
    }
    const nombre = reiniciarModal.lic.Nombre || reiniciarModal.lic.Licencia;
    if (!window.confirm(`¿Aplicar el reinicio a ${nombre}? Los cambios serán inmediatos.`)) return;
    try {
      let mundosParam;
      if (!opReiniciarMundos) {
        mundosParam = [];   // lista vacía = no reiniciar mundos
      } else if (mundosTotalReset) {
        mundosParam = null; // null = reinicio total de mundos
      } else {
        mundosParam = mundosSeleccionados;
      }
      await axios.post(`${API}/api/admin/reiniciar-mundos`, {
        licencia: reiniciarModal.lic.Licencia,
        mundos: mundosParam,
        reiniciar_monedas: opReiniciarMonedas,
        reiniciar_inventario: opReiniciarInventario,
      });
      toast.success("✅ Reinicio aplicado — el alumno verá los cambios al entrar al mapa");
      setReiniciarModal(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al reiniciar");
    }
  };

  const activarGrupo = async (id) => {
    try {
      const { data } = await axios.post(`${API}/api/admin/activar-grupo`, { solicitud_id: id });
      toast.success(`✅ Grupo activado — ${data.dependientes?.length || 0} licencias generadas`);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al activar grupo");
    }
  };

  const TABS = [
    { id:"licencias",       label:"🔑 Licencias" },
    { id:"maestros",        label:`🎓 Tutores${(maestros.length+padres.length) ? ` (${maestros.length+padres.length})` : ""}` },
    { id:"reportes",        label:"📊 Reportes" },
    { id:"alta",            label:"💵 Alta Directa" },
    { id:"crear",           label:"➕ Nueva" },
    { id:"solicitudes",     label:`📨 Solicitudes${pendientes ? ` (${pendientes})` : ""}` },
    { id:"grupos",          label:`👥 Grupos${pendientesGrupo ? ` (${pendientesGrupo})` : ""}` },
    { id:"config",          label:"⚙️ Config" },
  ];

  return (
    <div className="page" style={{ background:"radial-gradient(ellipse at top,#0a001f 0%,#030010 70%)", minHeight:"100vh", paddingBottom:40 }}>

      {/* HEADER */}
      <div className="hud" style={{ background:"rgba(0,0,0,0.9)", borderBottom:"1px solid rgba(255,214,0,0.3)" }}>
        <div style={{ fontFamily:"Orbitron,monospace", fontSize:16, fontWeight:700, color:"#FFD700" }}>
          👑 ADMIN — {store.nombre}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={() => useGameStore.setState({ pagina:"seleccion_avatar" })} className="btn btn-neon btn-sm">🎮 Jugar</button>
          <button onClick={() => store.cerrarSesion()} className="btn btn-danger btn-sm">🚪 Salir</button>
        </div>
      </div>

      <div style={{ maxWidth:980, margin:"0 auto", padding:"16px" }}>

        {/* Stats globales */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:24 }}>
          {[
            { label:"Total",       value:licencias.length,                       color:"#00f5ff", icon:"🔑" },
            { label:"Activas",     value:activas,                                color:"#39ff14", icon:"✅" },
            { label:"Maestros",    value:maestros.length,                        color:"#a29bfe", icon:"🎓" },
            { label:"Padres",      value:padres.length,                          color:"#fd79a8", icon:"👨‍👩‍👧" },
            { label:"Alumnos",     value:alumnos.length,                        color:"#00cec9", icon:"🧒" },
            { label:"Sol. Grupo",  value:pendientesGrupo,                       color:"#FFD700", icon:"👥" },
          ].map(s => (
            <div key={s.label} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${s.color}33`, borderRadius:16, padding:"14px 12px", textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{s.icon}</div>
              <div style={{ fontFamily:"Orbitron,monospace", fontSize:24, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20, flexWrap:"wrap" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, minWidth:70, padding:"10px 6px",
              background: tab===t.id ? "linear-gradient(135deg,#667eea,#764ba2)" : "rgba(255,255,255,0.05)",
              border:`1px solid ${tab===t.id ? "transparent" : "rgba(255,255,255,0.1)"}`,
              borderRadius:12, color:tab===t.id ? "#fff" : "rgba(255,255,255,0.4)",
              fontFamily:"Orbitron,monospace", fontSize:10, cursor:"pointer", transition:"all 0.2s"
            }}>{t.label}</button>
          ))}
        </div>

        {loading && (
          <div style={{textAlign:"center",padding:40}}>
            <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}} style={{fontSize:40,display:"inline-block"}}>⚙️</motion.div>
            <p style={{color:"rgba(255,255,255,0.4)",fontFamily:"Nunito,sans-serif",marginTop:12}}>Cargando datos...</p>
          </div>
        )}

        {/* ─── TAB LICENCIAS ─────────────────────────────────── */}
        {!loading && tab === "licencias" && (
          <div>
            <input className="input" placeholder="🔍 Buscar por código, nombre, correo, tipo..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ marginBottom:16, fontSize:15 }} />

            {licenciasFiltradas.length === 0 && (
              <div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.3)",fontFamily:"Nunito,sans-serif"}}>
                {busqueda ? "Sin resultados" : "No hay licencias. Crea la primera."}
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {licenciasFiltradas.map((lic, i) => (
                <motion.div key={lic.Licencia || i} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*0.02}}
                  style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${lic.Activa==="SI"?"rgba(57,255,20,0.2)":"rgba(255,0,110,0.2)"}`, borderRadius:16, padding:"14px 18px" }}>

                  {editando?.Licencia !== lic.Licencia ? (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"start" }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
                          <span style={{ fontFamily:"Orbitron,monospace", fontSize:14, color:"#fff" }}>{lic.Licencia}</span>
                          <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10,
                            background: lic.Activa==="SI" ? "rgba(57,255,20,0.15)" : "rgba(255,0,110,0.15)",
                            color: lic.Activa==="SI" ? "#39ff14" : "#ff006e" }}>
                            {lic.Activa==="SI" ? "● ACTIVA" : "● INACTIVA"}
                          </span>
                          <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10,
                            background: lic.Tipo==="maestro" ? "rgba(162,155,254,0.15)" : lic.Tipo==="padre" ? "rgba(253,121,168,0.15)" : lic.Tipo==="admin" ? "rgba(255,214,0,0.15)" : "rgba(0,200,200,0.1)",
                            color: lic.Tipo==="maestro" ? "#a29bfe" : lic.Tipo==="padre" ? "#fd79a8" : lic.Tipo==="admin" ? "#FFD700" : "#00cec9" }}>
                            {lic.Tipo==="maestro"?"🎓 Maestro":lic.Tipo==="padre"?"👨‍👩‍👧 Padre":lic.Tipo==="admin"?"👑 Admin":"🧒 Alumno"}
                          </span>
                          {lic.Tipo_Licencia === "ilimitada" && (
                            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, background:"rgba(255,214,0,0.12)", color:"#FFD700" }}>♾️ Ilimitada</span>
                          )}
                          {lic.Bloqueado === 1 && (
                            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, background:"rgba(255,0,0,0.2)", color:"#ff4444" }}>🔒 Bloqueado</span>
                          )}
                          {lic.Grado && <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>Grado: {lic.Grado}</span>}
                          {lic.Fecha_Vence && <span style={{ fontSize:10, color:"rgba(255,214,0,0.5)" }}>Vence: {lic.Fecha_Vence}</span>}
                        </div>
                        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.45)", display:"flex", gap:12, flexWrap:"wrap" }}>
                          <span>👤 {lic.Nombre || "Sin nombre"}</span>
                          <span>📧 {lic.Correo || "Sin correo"}</span>
                          {lic.Celular && <span>📱 {lic.Celular}</span>}
                          <span>🪙 {lic.Monedas || 0}</span>
                          <span>🌍 Nivel: {lic.Nivel_Max || 1}</span>
                          {lic.Mundos_Completados > 0 && <span>🏆 Mundos: {lic.Mundos_Completados}</span>}
                          {lic.Tiempo_Total_Min > 0 && <span>⏱ {lic.Tiempo_Total_Min} min</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
                        <button onClick={() => setEditando({ ...lic })}
                          style={{ background:"rgba(0,245,255,0.1)", border:"1px solid rgba(0,245,255,0.3)", color:"#00f5ff", borderRadius:8, cursor:"pointer", padding:"5px 10px", fontSize:11, fontFamily:"Nunito,sans-serif" }}>
                          ✏️
                        </button>
                        {lic.Activa !== "SI" && lic.Bloqueado !== 1 ? (
                          <button onClick={() => activar(lic.Licencia)}
                            style={{ background:"rgba(57,255,20,0.15)", border:"1px solid rgba(57,255,20,0.3)", color:"#39ff14", borderRadius:8, cursor:"pointer", padding:"5px 10px", fontSize:11 }}>
                            ✅ Activar
                          </button>
                        ) : lic.Tipo !== "admin" && lic.Bloqueado !== 1 && lic.Activa === "SI" && (
                          <button onClick={() => desactivar(lic.Licencia)}
                            style={{ background:"rgba(255,140,0,0.15)", border:"1px solid rgba(255,140,0,0.3)", color:"#ff8c00", borderRadius:8, cursor:"pointer", padding:"5px 10px", fontSize:11 }}>
                            🚫
                          </button>
                        )}
                        {lic.Tipo !== "admin" && (
                          <button onClick={() => bloquear(lic.Licencia, lic.Bloqueado !== 1)}
                            style={{ background: lic.Bloqueado === 1 ? "rgba(57,255,20,0.1)" : "rgba(255,0,0,0.1)", border:`1px solid ${lic.Bloqueado === 1 ? "rgba(57,255,20,0.3)" : "rgba(255,0,0,0.3)"}`, color: lic.Bloqueado === 1 ? "#39ff14" : "#ff4444", borderRadius:8, cursor:"pointer", padding:"5px 8px", fontSize:11 }}>
                            {lic.Bloqueado === 1 ? "🔓" : "🔒"}
                          </button>
                        )}
                        {lic.Tipo === "alumno" && (
                          <button onClick={() => abrirReiniciarModal(lic)}
                            style={{ background:"rgba(255,165,0,0.1)", border:"1px solid rgba(255,165,0,0.3)", color:"#ffa500", borderRadius:8, cursor:"pointer", padding:"5px 8px", fontSize:11 }}
                            title="Reiniciar progreso">
                            🔄
                          </button>
                        )}
                        {lic.Tipo !== "admin" && (
                          <button onClick={() => eliminar(lic.Licencia)}
                            style={{ background:"rgba(255,0,110,0.1)", border:"1px solid rgba(255,0,110,0.2)", color:"#ff006e", borderRadius:8, cursor:"pointer", padding:"5px 8px", fontSize:11 }}>
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontFamily:"Orbitron,monospace", fontSize:12, color:"#00f5ff", marginBottom:12 }}>✏️ Editando: {lic.Licencia}</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                        {[
                          { field:"Nombre", label:"Nombre", type:"text" },
                          { field:"Correo", label:"Correo", type:"email" },
                          { field:"Celular", label:"Celular", type:"tel" },
                          { field:"Grado", label:"Grado escolar", type:"text" },
                          { field:"Maestro_Licencia", label:"Código del maestro", type:"text" },
                          { field:"Monedas", label:"Monedas", type:"number" },
                          { field:"Nivel_Max", label:"Nivel Max (1-11)", type:"number" },
                        ].map(({ field, label, type }) => (
                          <div key={field}>
                            <label style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.4)", display:"block", marginBottom:3 }}>{label}</label>
                            <input className="input" style={{ fontSize:13 }} type={type}
                              value={editando[field] || ""}
                              onChange={e => setEditando(p => ({ ...p, [field]: type==="number" ? parseInt(e.target.value)||0 : e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={guardarEdicion} className="btn btn-primary btn-sm" style={{ flex:1 }}>💾 Guardar</button>
                        <button onClick={() => setEditando(null)}
                          style={{ flex:1, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, color:"rgba(255,255,255,0.6)", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:13, padding:"8px" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB TUTORES (MAESTROS + PADRES) ──────────────────── */}
        {!loading && tab === "maestros" && (
          <div>
            {(maestros.length + padres.length) === 0 && (
              <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.3)", fontFamily:"Nunito,sans-serif" }}>
                No hay maestros ni padres registrados.
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[...maestros, ...padres].map((mae, i) => {
                const esPadre = mae.Tipo === "padre";
                const susAlumnos = alumnos.filter(a => a.Maestro_Licencia === mae.Licencia);
                return (
                  <motion.div key={mae.Licencia} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                    style={{ background:"rgba(162,155,254,0.06)", border:"1px solid rgba(162,155,254,0.25)", borderRadius:18, padding:"18px 20px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12, flexWrap:"wrap" }}>
                      <div style={{ fontSize:36 }}>{esPadre ? "👨‍👩‍👧" : "🎓"}</div>
                      <div>
                        <div style={{ fontFamily:"Orbitron,monospace", fontSize:15, color: esPadre ? "#fd79a8" : "#a29bfe", fontWeight:700 }}>{mae.Nombre || "Sin nombre"}</div>
                        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.45)" }}>
                          {esPadre ? "👨‍👩‍👧 Padre/Madre" : "🎓 Maestro"} • {mae.Licencia} • {mae.Correo || "Sin correo"}
                        </div>
                        {mae.Grado && <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.35)" }}>Escuela: {mae.Grado}</div>}
                        {mae.Tipo_Licencia === "ilimitada" && <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"#FFD700" }}>♾️ Licencia ilimitada (5 meses) — Vence: {mae.Fecha_Vence}</div>}
                      </div>
                      <div style={{ marginLeft:"auto", textAlign:"right" }}>
                        <div style={{ fontFamily:"Orbitron,monospace", fontSize:22, color:"#00cec9", fontWeight:700 }}>{susAlumnos.length}</div>
                        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:10, color:"rgba(255,255,255,0.35)" }}>{esPadre ? "hijos" : "alumnos"}</div>
                      </div>
                    </div>

                    {susAlumnos.length > 0 && (
                      <div style={{ borderTop:"1px solid rgba(162,155,254,0.15)", paddingTop:12 }}>
                        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>Alumnos de este maestro:</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {susAlumnos.map(alu => {
                            const pct = Math.round(((alu.Mundos_Completados || 0) / MUNDOS_TOTAL) * 100);
                            return (
                              <div key={alu.Licencia} style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"#fff", fontWeight:700 }}>{alu.Nombre || "Sin nombre"}</div>
                                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                                    {alu.Grado && `${alu.Grado} • `}{alu.Licencia}
                                  </div>
                                </div>
                                <div style={{ minWidth:120 }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.5)", marginBottom:3 }}>
                                    <span>Progreso</span><span>{pct}%</span>
                                  </div>
                                  <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:4, height:6 }}>
                                    <div style={{ width:`${pct}%`, background:"linear-gradient(90deg,#667eea,#a29bfe)", borderRadius:4, height:6 }}/>
                                  </div>
                                </div>
                                <div style={{ textAlign:"center", minWidth:60 }}>
                                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.35)" }}>Tiempo</div>
                                  <div style={{ fontFamily:"Orbitron,monospace", fontSize:12, color:"#00f5ff" }}>{alu.Tiempo_Total_Min || 0} min</div>
                                </div>
                                <span style={{ padding:"3px 8px", borderRadius:12, fontSize:10, background: alu.Activa==="SI"?"rgba(57,255,20,0.15)":"rgba(255,0,110,0.15)", color:alu.Activa==="SI"?"#39ff14":"#ff006e" }}>
                                  {alu.Activa==="SI"?"Activo":"Inactivo"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {susAlumnos.length === 0 && (
                      <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.25)", textAlign:"center", padding:"8px 0" }}>
                        {esPadre ? "Este padre aún no tiene hijos asignados" : "Este maestro aún no tiene alumnos asignados"}
                      </div>
                    )}

                    <div style={{ marginTop:12, display:"flex", gap:8 }}>
                      <button onClick={() => { setNewMaestroLic(mae.Licencia); setNewTipo("alumno"); setTab("crear"); }}
                        style={{ background:"rgba(162,155,254,0.15)", border:"1px solid rgba(162,155,254,0.3)", color:"#a29bfe", borderRadius:10, padding:"7px 16px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:12 }}>
                        ➕ Agregar {esPadre ? "hijo/a" : "alumno"}
                      </button>
                      <button onClick={() => bloquear(mae.Licencia, mae.Bloqueado !== 1)}
                        style={{ background: mae.Bloqueado === 1 ? "rgba(57,255,20,0.1)" : "rgba(255,0,0,0.1)", border:`1px solid ${mae.Bloqueado === 1 ? "rgba(57,255,20,0.3)" : "rgba(255,0,0,0.3)"}`, color: mae.Bloqueado === 1 ? "#39ff14" : "#ff4444", borderRadius:10, padding:"7px 14px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:12 }}>
                        {mae.Bloqueado === 1 ? "🔓 Desbloquear" : "🔒 Bloquear"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB REPORTES ───────────────────────────────────── */}
        {!loading && tab === "reportes" && (
          <div>
            {/* Reporte oculto para impresión */}
            <div ref={printRef} style={{ display:"none" }}>
              {reporteSeleccionado && <ContenidoImpresion rep={reporteSeleccionado} />}
            </div>

            {reportes.length === 0 && alumnos.length === 0 && (
              <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.3)", fontFamily:"Nunito,sans-serif" }}>
                No hay alumnos registrados aún.
              </div>
            )}

            {/* Filtro por maestro */}
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              <select className="input" style={{ flex:1, maxWidth:280, cursor:"pointer" }}
                value={busqueda} onChange={e => setBusqueda(e.target.value)}>
                <option value="">— Todos los alumnos —</option>
                {maestros.map(m => <option key={m.Licencia} value={m.Licencia}>🎓 {m.Nombre}</option>)}
              </select>
              <button onClick={cargar} className="btn btn-neon btn-sm">🔄 Actualizar</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {(reportes.length > 0 ? reportes : alumnos).filter(a =>
                !busqueda || a.Maestro_Licencia === busqueda
              ).map((rep, i) => {
                const mundos = rep.Mundos_Completados || rep.Nivel_Max - 1 || 0;
                const pct = Math.round((mundos / MUNDOS_TOTAL) * 100);
                let fallos = {};
                try { fallos = JSON.parse(rep.Fallos_Tablas || "{}"); } catch {}
                const tablasProblema = Object.entries(fallos).filter(([,v]) => v >= 3).sort((a,b) => b[1]-a[1]);
                const tiempoMin = rep.Tiempo_Total_Min || 0;
                const horas = Math.floor(tiempoMin / 60);
                const mins = tiempoMin % 60;

                return (
                  <motion.div key={rep.Licencia || i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                    style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(0,245,255,0.15)", borderRadius:18, padding:"16px 20px" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"Orbitron,monospace", fontSize:14, color:"#fff", marginBottom:4 }}>{rep.Nombre || "Sin nombre"}</div>
                        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:10 }}>
                          {rep.Grado && `${rep.Grado} • `}{rep.Correo || rep.Licencia}
                          {rep.Maestro_Nombre && ` • 🎓 ${rep.Maestro_Nombre}`}
                        </div>

                        {/* Progreso */}
                        <div style={{ marginBottom:10 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:4 }}>
                            <span>Progreso: {mundos}/{MUNDOS_TOTAL} mundos</span>
                            <span style={{ color: pct>=80?"#39ff14":pct>=50?"#FFD700":"#ff006e", fontWeight:700 }}>{pct}%</span>
                          </div>
                          <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:6, height:10 }}>
                            <div style={{ width:`${pct}%`, background:`linear-gradient(90deg,${pct>=80?"#39ff14,#00b894":pct>=50?"#FFD700,#e17055":"#ff006e,#fd79a8"})`, borderRadius:6, height:10, transition:"width 1s" }}/>
                          </div>
                        </div>

                        {/* Stats rápidas */}
                        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                          <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                            ⏱ <strong style={{ color:"#00f5ff" }}>{horas>0?`${horas}h `:""}${mins} min</strong> conectado
                          </div>
                          <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                            🪙 <strong style={{ color:"#FFD700" }}>{rep.Monedas || 0}</strong> monedas
                          </div>
                          {tablasProblema.length > 0 && (
                            <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,100,100,0.7)" }}>
                              ⚠️ Tablas difíciles: {tablasProblema.map(([t,v]) => `${t}(${v} fallos)`).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        <button onClick={() => imprimirReporte({ ...rep, mundos, pct, fallos, tablasProblema, tiempoMin, horas, mins })}
                          style={{ background:"rgba(255,214,0,0.12)", border:"2px solid rgba(255,214,0,0.35)", color:"#FFD700", borderRadius:12, padding:"10px 18px", cursor:"pointer", fontFamily:"Orbitron,monospace", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                          🖨️ Imprimir
                        </button>
                        <button onClick={() => descargarReportePDF({ ...rep, mundos, pct, fallos, tiempoMin, horas, mins })}
                          style={{ background:"rgba(0,245,255,0.12)", border:"2px solid rgba(0,245,255,0.35)", color:"#00f5ff", borderRadius:12, padding:"10px 18px", cursor:"pointer", fontFamily:"Orbitron,monospace", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                          📥 Descargar PDF
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB CREAR ──────────────────────────────────────── */}
        {!loading && tab === "crear" && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
            className="card" style={{ background:"rgba(5,8,30,0.95)", maxWidth:520, margin:"0 auto" }}>
            <h3 style={{ fontFamily:"Orbitron,monospace", color:"#00f5ff", marginBottom:20, fontSize:16 }}>➕ Nueva Licencia</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

              <div>
                <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>Tipo de usuario</label>
                <select value={newTipo} onChange={e => setNewTipo(e.target.value)} className="input" style={{ cursor:"pointer" }}>
                  <option value="alumno">🧒 Alumno</option>
                  <option value="maestro">🎓 Maestro</option>
                  <option value="padre">👨‍👩‍👧 Padre de Familia</option>
                  <option value="admin">👑 Admin adicional</option>
                </select>
              </div>

              {[
                { val:newNombre,  set:setNewNombre,  label:"Nombre completo *", ph:"Nombre del alumno/maestro", type:"text" },
                { val:newCorreo,  set:setNewCorreo,  label:"Correo electrónico", ph:"correo@ejemplo.com", type:"email" },
                { val:newCelular, set:setNewCelular, label:"Celular", ph:"10 dígitos", type:"tel" },
              ].map(({ val, set, label, ph, type }) => (
                <div key={label}>
                  <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>{label}</label>
                  <input className="input" placeholder={ph} value={val} onChange={e => set(e.target.value)} type={type} />
                </div>
              ))}

              {newTipo === "alumno" && (
                <>
                  <div>
                    <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>Grado escolar</label>
                    <select value={newGrado} onChange={e => setNewGrado(e.target.value)} className="input" style={{ cursor:"pointer" }}>
                      <option value="">— Seleccionar grado —</option>
                      {["1° Primaria","2° Primaria","3° Primaria","4° Primaria","5° Primaria","6° Primaria","1° Secundaria","2° Secundaria","3° Secundaria"].map(g =>
                        <option key={g} value={g}>{g}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>Maestro asignado</label>
                    <select value={newMaestroLic} onChange={e => setNewMaestroLic(e.target.value)} className="input" style={{ cursor:"pointer" }}>
                      <option value="">— Sin maestro asignado —</option>
                      {maestros.map(m => <option key={m.Licencia} value={m.Licencia}>🎓 {m.Nombre} ({m.Licencia})</option>)}
                    </select>
                  </div>
                </>
              )}

              {(newTipo === "maestro" || newTipo === "padre") && (
                <div>
                  <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>
                    {newTipo === "maestro" ? "Grado / salón que imparte" : "Escuela / Institución (opcional)"}
                  </label>
                  <input className="input" placeholder={newTipo === "maestro" ? "ej: 2° A Primaria" : "ej: Escuela Benito Juárez"} value={newGrado} onChange={e => setNewGrado(e.target.value)} />
                </div>
              )}

              {/* Código */}
              <div>
                <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>Código de licencia *</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input className="input" style={{ flex:1, fontFamily:"Orbitron,monospace", letterSpacing:2, fontSize:13 }}
                    placeholder="ej: ALU-MARIA-2025" value={newCodigo} onChange={e => setNewCodigo(e.target.value)} />
                  <button onClick={autoGenerarCodigo} disabled={autoGenerando}
                    style={{ background:"rgba(0,245,255,0.15)", border:"1px solid rgba(0,245,255,0.35)", color:"#00f5ff", borderRadius:10, padding:"0 14px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:12, whiteSpace:"nowrap" }}>
                    {autoGenerando ? "..." : "⚡ Auto"}
                  </button>
                </div>
              </div>

              <div className="tip-box" style={{ fontSize:12 }}>
                💡 Al <strong>activar</strong> la licencia se envía el correo automáticamente. Si es alumno de un maestro, el correo incluirá los datos del maestro.
              </div>
              <button className="btn btn-primary btn-full" style={{ padding:16, fontSize:15, marginTop:4 }} onClick={crear}>
                ➕ CREAR LICENCIA
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── TAB SOLICITUDES ────────────────────────────────── */}
        {!loading && tab === "solicitudes" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {solicitudes.length === 0 && (
              <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.3)", fontFamily:"Nunito,sans-serif" }}>
                No hay solicitudes aún.
              </div>
            )}
            {solicitudes.map((sol, i) => (
              <motion.div key={sol.id || i} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${sol.Estado==="Pendiente"?"rgba(255,214,0,0.2)":"rgba(57,255,20,0.2)"}`, borderRadius:16, padding:"18px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"Orbitron,monospace", fontSize:14, color:"#fff", marginBottom:4 }}>
                      {sol.Nombre} {sol.Tipo==="maestro" && <span style={{ color:"#a29bfe", fontSize:11 }}>🎓 Maestro</span>}
                    </div>
                    <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.45)", display:"flex", gap:12, flexWrap:"wrap" }}>
                      <span>📧 {sol.Correo}</span>
                      <span>📱 {sol.Celular}</span>
                      <span>🏫 {sol.Escuela}</span>
                      {sol.Grado && <span>📚 {sol.Grado}</span>}
                      {sol.Num_Alumnos && <span>👥 {sol.Num_Alumnos} alumnos</span>}
                    </div>
                    <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:4 }}>{sol.Fecha}</div>
                  </div>
                  <span style={{ padding:"4px 12px", borderRadius:20, fontSize:10,
                    background: sol.Estado==="Pendiente" ? "rgba(255,140,0,0.2)" : "rgba(57,255,20,0.15)",
                    color: sol.Estado==="Pendiente" ? "#ff8c00" : "#39ff14" }}>
                    {sol.Estado}
                  </span>
                </div>
                {sol.Estado === "Pendiente" && (
                  <div style={{ marginTop:12, padding:"10px 14px", background:"rgba(0,245,255,0.05)", borderRadius:12 }}>
                    <button onClick={() => { setNewNombre(sol.Nombre); setNewCorreo(sol.Correo); setNewCelular(sol.Celular); setNewTipo(sol.Tipo||"alumno"); setNewGrado(sol.Grado||""); setTab("crear"); }}
                      className="btn btn-neon btn-sm">
                      ➕ Crear licencia para {sol.Nombre.split(" ")[0]}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── TAB GRUPOS ─────────────────────────────────────── */}
        {!loading && tab === "grupos" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {solicitudesGrupo.length === 0 && (
              <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.3)", fontFamily:"Nunito,sans-serif" }}>
                No hay solicitudes de grupo aún.
              </div>
            )}
            {solicitudesGrupo.map((sol, i) => {
              let deps = [];
              try { deps = JSON.parse(sol.Dependientes_Json || "[]"); } catch {}
              const isPendiente = sol.Estado === "Pendiente" || sol.Estado === "Pendiente_Ampliacion";
              const isAmpliacion = sol.Estado === "Pendiente_Ampliacion";
              const esMaestro = sol.Tutor_Tipo === "maestro";
              return (
                <motion.div key={sol.id || i} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                  style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${isPendiente?"rgba(255,214,0,0.25)":"rgba(57,255,20,0.2)"}`, borderRadius:18, padding:"18px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"Orbitron,monospace", fontSize:13, color:"#fff", fontWeight:700 }}>{sol.Tutor_Nombre}</span>
                        <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, background: esMaestro?"rgba(162,155,254,0.15)":"rgba(253,121,168,0.15)", color: esMaestro?"#a29bfe":"#fd79a8" }}>
                          {esMaestro ? "🎓 Maestro" : "👨‍👩‍👧 Padre"}
                        </span>
                        {isAmpliacion && <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, background:"rgba(0,245,255,0.12)", color:"#00f5ff" }}>➕ Ampliación</span>}
                      </div>
                      <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.45)", display:"flex", gap:12, flexWrap:"wrap" }}>
                        <span>📧 {sol.Tutor_Correo}</span>
                        <span>📱 {sol.Tutor_Celular}</span>
                        {sol.Tutor_Escuela && <span>🏫 {sol.Tutor_Escuela}</span>}
                      </div>
                      <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:4, display:"flex", gap:12 }}>
                        <span>👥 {sol.Num_Dependientes} {esMaestro?"alumnos":"hijos"}</span>
                        <span style={{ color:"#FFD700" }}>💰 ${sol.Costo_Total?.toLocaleString()} MXN — {sol.Tipo_Pago === "unico" ? "Pago único" : "Mensual"}</span>
                      </div>
                      {sol.Tutor_Licencia && (
                        <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"#39ff14", marginTop:4 }}>
                          ✅ Licencia tutor: {sol.Tutor_Licencia}
                        </div>
                      )}
                      {sol.Notas && <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:4 }}>{sol.Notas}</div>}
                      {deps.length > 0 && (
                        <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:5 }}>
                          {deps.map((d, di) => (
                            <span key={di} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"3px 8px", fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.6)" }}>
                              {d.nombre || "?"}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:4 }}>{sol.Fecha}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <span style={{ padding:"4px 12px", borderRadius:20, fontSize:10,
                        background: isPendiente ? "rgba(255,140,0,0.2)" : "rgba(57,255,20,0.15)",
                        color: isPendiente ? "#ff8c00" : "#39ff14" }}>
                        {sol.Estado === "Pendiente_Ampliacion" ? "Ampliación pendiente" : sol.Estado}
                      </span>
                      {isPendiente && (
                        <button onClick={() => activarGrupo(sol.id)}
                          style={{ background:"rgba(57,255,20,0.15)", border:"1px solid rgba(57,255,20,0.3)", color:"#39ff14", borderRadius:10, padding:"8px 16px", cursor:"pointer", fontFamily:"Orbitron,monospace", fontSize:10, fontWeight:700 }}>
                          ✅ ACTIVAR GRUPO
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ─── TAB ALTA DIRECTA ───────────────────────────────── */}
        {!loading && tab === "alta" && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
            className="card" style={{ background:"rgba(5,8,30,0.95)", maxWidth:540, margin:"0 auto" }}>

            {altaResultado ? (
              /* ── Resultado exitoso ── */
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:56, marginBottom:8 }}>🎉</div>
                <h3 style={{ fontFamily:"Orbitron,monospace", color:"#39ff14", fontSize:15, marginBottom:4 }}>¡Alta completada!</h3>
                <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.5)", fontSize:13, marginBottom:20 }}>
                  Se activaron las licencias y se enviaron los correos automáticamente.
                </p>
                {/* Licencia principal */}
                <div style={{ background:"rgba(57,255,20,0.08)", border:"1px solid rgba(57,255,20,0.3)", borderRadius:14, padding:"16px 20px", marginBottom:12, textAlign:"left" }}>
                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>
                    {altaTipo === "alumno" ? "Licencia del alumno" : altaTipo === "maestro" ? "Licencia del maestro" : "Licencia del padre"}
                  </div>
                  <div style={{ fontFamily:"Orbitron,monospace", fontSize:18, color:"#39ff14", letterSpacing:2, fontWeight:700 }}>{altaResultado.licencia}</div>
                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>Vence: {altaResultado.fecha_vence}</div>
                </div>
                {/* Licencias dependientes */}
                {altaResultado.dependientes?.length > 0 && (
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
                      Licencias de {altaTipo === "maestro" ? "alumnos" : "hijos"}:
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {altaResultado.dependientes.map((d, i) => (
                        <div key={i} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.7)" }}>{d.nombre}</div>
                          <div style={{ fontFamily:"Orbitron,monospace", fontSize:12, color:"#a29bfe", letterSpacing:1 }}>{d.licencia}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn btn-primary btn-full" style={{ marginTop:20 }}
                  onClick={() => { setAltaResultado(null); setAltaNombre(""); setAltaCorreo(""); setAltaCelular(""); setAltaEscuela(""); setAltaGrado(""); setAltaDeps([{nombre:"",correo:"",grado:""}]); setAltaTipoPago("mensual"); }}>
                  ➕ Dar de alta a otro usuario
                </button>
              </div>
            ) : (
              /* ── Formulario ── */
              <>
                <h3 style={{ fontFamily:"Orbitron,monospace", color:"#FFD700", marginBottom:4, fontSize:15 }}>💵 Alta Directa</h3>
                <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.4)", fontSize:12, marginBottom:20 }}>
                  Para pagos en efectivo o transferencia. Se activa y envía el correo al instante.
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

                  {/* Tipo */}
                  <div>
                    <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>Tipo de usuario</label>
                    <div style={{ display:"flex", gap:8 }}>
                      {[{v:"alumno",l:"🧒 Alumno"},{v:"maestro",l:"🎓 Maestro"},{v:"padre",l:"👨‍👩‍👧 Padre"}].map(o => (
                        <button key={o.v} onClick={() => setAltaTipo(o.v)} style={{
                          flex:1, padding:"10px 4px", borderRadius:10, border:`1px solid ${altaTipo===o.v?"rgba(0,245,255,0.6)":"rgba(255,255,255,0.1)"}`,
                          background: altaTipo===o.v ? "rgba(0,245,255,0.12)" : "rgba(255,255,255,0.04)",
                          color: altaTipo===o.v ? "#00f5ff" : "rgba(255,255,255,0.4)",
                          fontFamily:"Nunito,sans-serif", fontSize:12, fontWeight:700, cursor:"pointer",
                        }}>{o.l}</button>
                      ))}
                    </div>
                  </div>

                  {/* Datos principales */}
                  {[
                    { val:altaNombre, set:setAltaNombre, label:"Nombre completo *", ph:"Nombre del alumno/maestro/padre", type:"text" },
                    { val:altaCorreo, set:setAltaCorreo, label:"Correo electrónico *", ph:"correo@ejemplo.com (se envía la licencia)", type:"email" },
                    { val:altaCelular, set:setAltaCelular, label:"Celular *", ph:"10 dígitos", type:"tel" },
                  ].map(({ val, set, label, ph, type }) => (
                    <div key={label}>
                      <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>{label}</label>
                      <input className="input" placeholder={ph} value={val} onChange={e => set(e.target.value)} type={type} />
                    </div>
                  ))}

                  {/* Grado / Escuela */}
                  {altaTipo === "alumno" && (
                    <div>
                      <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>Grado escolar</label>
                      <select value={altaGrado} onChange={e => setAltaGrado(e.target.value)} className="input" style={{ cursor:"pointer" }}>
                        <option value="">— Seleccionar grado —</option>
                        {["1° Primaria","2° Primaria","3° Primaria","4° Primaria","5° Primaria","6° Primaria","1° Secundaria","2° Secundaria","3° Secundaria"].map(g =>
                          <option key={g} value={g}>{g}</option>
                        )}
                      </select>
                    </div>
                  )}
                  {(altaTipo === "maestro" || altaTipo === "padre") && (
                    <div>
                      <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>
                        {altaTipo === "maestro" ? "Grado / salón que imparte" : "Escuela (opcional)"}
                      </label>
                      <input className="input" placeholder={altaTipo === "maestro" ? "ej: 2° A Primaria" : "ej: Escuela Benito Juárez"} value={altaEscuela} onChange={e => setAltaEscuela(e.target.value)} />
                    </div>
                  )}

                  {/* Tipo de pago */}
                  {(altaTipo === "maestro" || altaTipo === "padre") && (
                    <div>
                      <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:6 }}>Tipo de pago</label>
                      <div style={{ display:"flex", gap:8 }}>
                        {[{v:"mensual",l:"📅 Mensual (30 días)"},{v:"unico",l:"🏆 Pago único (5 meses)"}].map(o => (
                          <button key={o.v} onClick={() => setAltaTipoPago(o.v)} style={{
                            flex:1, padding:"10px 4px", borderRadius:10,
                            border:`1px solid ${altaTipoPago===o.v?"rgba(255,214,0,0.6)":"rgba(255,255,255,0.1)"}`,
                            background: altaTipoPago===o.v ? "rgba(255,214,0,0.1)" : "rgba(255,255,255,0.04)",
                            color: altaTipoPago===o.v ? "#FFD700" : "rgba(255,255,255,0.4)",
                            fontFamily:"Nunito,sans-serif", fontSize:11, fontWeight:700, cursor:"pointer",
                          }}>{o.l}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dependientes */}
                  {(altaTipo === "maestro" || altaTipo === "padre") && (
                    <div>
                      <label style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:8 }}>
                        {altaTipo === "maestro" ? "Alumnos" : "Hijos"} ({altaDeps.filter(d=>d.nombre.trim()).length} registrados)
                      </label>
                      <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflowY:"auto" }}>
                        {altaDeps.map((dep, i) => (
                          <div key={i} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"10px 12px" }}>
                            <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6 }}>
                              <span style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.3)", minWidth:20 }}>#{i+1}</span>
                              <input className="input" placeholder="Nombre *" value={dep.nombre}
                                onChange={e => setAltaDeps(p => p.map((d,idx) => idx===i ? {...d,nombre:e.target.value} : d))}
                                style={{ flex:2, padding:"8px 10px", fontSize:13 }} />
                              {altaDeps.length > 1 && (
                                <button onClick={() => setAltaDeps(p => p.filter((_,idx)=>idx!==i))}
                                  style={{ background:"rgba(255,0,110,0.15)", border:"1px solid rgba(255,0,110,0.3)", color:"#ff006e", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:14 }}>✕</button>
                              )}
                            </div>
                            <div style={{ display:"flex", gap:6 }}>
                              <input className="input" placeholder="Correo (opcional)" value={dep.correo}
                                onChange={e => setAltaDeps(p => p.map((d,idx) => idx===i ? {...d,correo:e.target.value} : d))}
                                style={{ flex:3, padding:"7px 10px", fontSize:12 }} type="email" />
                              <input className="input" placeholder="Grado" value={dep.grado}
                                onChange={e => setAltaDeps(p => p.map((d,idx) => idx===i ? {...d,grado:e.target.value} : d))}
                                style={{ flex:2, padding:"7px 10px", fontSize:12 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setAltaDeps(p => [...p, {nombre:"",correo:"",grado:""}])}
                        style={{ marginTop:8, width:"100%", background:"rgba(0,245,255,0.06)", border:"1px dashed rgba(0,245,255,0.3)", color:"#00f5ff", borderRadius:10, padding:"10px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:13 }}>
                        ➕ Agregar {altaTipo === "maestro" ? "alumno" : "hijo"}
                      </button>
                    </div>
                  )}

                  <div className="tip-box" style={{ fontSize:12 }}>
                    💡 Se generará el código automáticamente, se activará al instante y se enviará por correo a <strong>{altaCorreo || "el usuario"}</strong>{altaTipo !== "alumno" ? " y a cada alumno/hijo con correo" : ""}.
                  </div>

                  <button className="btn btn-primary btn-full" style={{ padding:16, fontSize:15, marginTop:4 }}
                    onClick={altaDirecta} disabled={altaLoading}>
                    {altaLoading ? "⏳ Procesando..." : "✅ DAR DE ALTA Y ACTIVAR"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ─── TAB CONFIG ─────────────────────────────────────── */}
        {!loading && tab === "config" && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
            className="card" style={{ background:"rgba(5,8,30,0.95)", maxWidth:500, margin:"0 auto" }}>

            <h3 style={{ fontFamily:"Orbitron,monospace", color:"#FFD700", marginBottom:8, fontSize:15 }}>⚙️ Cambiar Código de Admin</h3>
            <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.4)", fontSize:13, marginBottom:18 }}>
              Al cambiarlo, el sistema cerrará tu sesión automáticamente.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { val:pwActual,  set:setPwActual,  label:"🔑 Código actual",        ph:"Tu código actual" },
                { val:pwNueva,   set:setPwNueva,   label:"🔒 Nuevo código",         ph:"Mínimo 6 caracteres" },
                { val:pwConfirm, set:setPwConfirm, label:"🔒 Confirmar nuevo código", ph:"Repite el nuevo código" },
              ].map(({ val, set, label, ph }) => (
                <div key={label}>
                  <label style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.45)", display:"block", marginBottom:5 }}>{label}</label>
                  <input className="input" placeholder={ph} value={val} onChange={e => set(e.target.value)} type="password" />
                </div>
              ))}
              {pwNueva && pwConfirm && pwNueva !== pwConfirm && (
                <div style={{ background:"rgba(255,0,110,0.1)", border:"1px solid rgba(255,0,110,0.3)", borderRadius:10, padding:"8px 14px", fontFamily:"Nunito,sans-serif", fontSize:12, color:"#ff006e" }}>
                  ⚠️ Los códigos no coinciden
                </div>
              )}
              <button className="btn btn-primary btn-full" style={{ padding:14 }} onClick={cambiarPassword} disabled={pwLoading}>
                {pwLoading ? "Cambiando..." : "🔒 CAMBIAR CÓDIGO DE ADMIN"}
              </button>
            </div>

            <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", margin:"24px 0 18px" }} />

            {/* ── Backup de base de datos ── */}
            <h3 style={{ fontFamily:"Orbitron,monospace", color:"#00f5ff", marginBottom:6, fontSize:14 }}>🗄️ Respaldo de Base de Datos</h3>
            <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.4)", fontSize:12, marginBottom:14, lineHeight:1.6 }}>
              El sistema envía un backup automático a tu correo cada 6 horas. También puedes hacerlo manualmente.
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
              {/* Descargar DB */}
              <button onClick={descargarDB}
                style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(0,245,255,0.08)", border:"1px solid rgba(0,245,255,0.3)", borderRadius:12, padding:"12px 16px", cursor:"pointer", color:"#00f5ff", fontFamily:"Nunito,sans-serif", fontSize:14, fontWeight:700, textAlign:"left" }}>
                <span style={{ fontSize:22 }}>💾</span>
                <div>
                  <div>Descargar base de datos</div>
                  <div style={{ fontSize:11, color:"rgba(0,245,255,0.5)", fontWeight:400 }}>Guarda el archivo .db antes de actualizar el sistema</div>
                </div>
              </button>

              {/* Backup por email */}
              <button onClick={backupPorEmail} disabled={backupLoading}
                style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(162,155,254,0.08)", border:"1px solid rgba(162,155,254,0.3)", borderRadius:12, padding:"12px 16px", cursor:"pointer", color:"#a29bfe", fontFamily:"Nunito,sans-serif", fontSize:14, fontWeight:700, textAlign:"left", opacity: backupLoading ? 0.6 : 1 }}>
                <span style={{ fontSize:22 }}>📧</span>
                <div>
                  <div>{backupLoading ? "Enviando..." : "Enviar backup por correo ahora"}</div>
                  <div style={{ fontSize:11, color:"rgba(162,155,254,0.5)", fontWeight:400 }}>Recibirás el archivo .db en tu email</div>
                </div>
              </button>

              {/* Restaurar DB */}
              <input type="file" accept=".db" ref={importRef} onChange={restaurarDB} style={{ display:"none" }} />
              <button onClick={() => importRef.current?.click()} disabled={importando}
                style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,165,0,0.08)", border:"1px solid rgba(255,165,0,0.3)", borderRadius:12, padding:"12px 16px", cursor:"pointer", color:"#ffa500", fontFamily:"Nunito,sans-serif", fontSize:14, fontWeight:700, textAlign:"left", opacity: importando ? 0.6 : 1 }}>
                <span style={{ fontSize:22 }}>📂</span>
                <div>
                  <div>{importando ? "Restaurando..." : "Restaurar desde archivo .db"}</div>
                  <div style={{ fontSize:11, color:"rgba(255,165,0,0.5)", fontWeight:400 }}>Sube un backup para recuperar todos los datos</div>
                </div>
              </button>

              {/* Importar desde Google Sheets */}
              <button onClick={() => setModalImportGS(true)}
                style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.35)", borderRadius:12, padding:"12px 16px", cursor:"pointer", color:"#34d399", fontFamily:"Nunito,sans-serif", fontSize:14, fontWeight:700, textAlign:"left" }}>
                <span style={{ fontSize:22 }}>📊</span>
                <div>
                  <div>Importar usuarios desde Google Sheets</div>
                  <div style={{ fontSize:11, color:"rgba(52,211,153,0.5)", fontWeight:400 }}>Pega los datos del Sheet para cargar usuarios en masa</div>
                </div>
              </button>
            </div>

            <div style={{ background:"rgba(57,255,20,0.06)", border:"1px solid rgba(57,255,20,0.2)", borderRadius:10, padding:"10px 14px", fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(57,255,20,0.7)", lineHeight:1.8 }}>
              ✅ Backup automático activo — cada 6 horas llega a tu correo<br/>
              📊 {alumnos.length} alumnos · {maestros.length} maestros · {padres.length} padres registrados
            </div>

            <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", margin:"20px 0 14px" }} />
            <h3 style={{ fontFamily:"Orbitron,monospace", color:"#a29bfe", marginBottom:8, fontSize:13 }}>ℹ️ Sistema</h3>
            <div style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(255,255,255,0.35)", lineHeight:2.2 }}>
              <div>📦 Base de datos: <strong style={{ color:"#00f5ff" }}>SQLite en Render</strong></div>
              <div>🔄 Backup automático: <strong style={{ color:"#39ff14" }}>cada 6 horas por email</strong></div>
              <div>🌐 Servidor siempre activo con UptimeRobot</div>
            </div>
          </motion.div>
        )}

        <div style={{ textAlign:"center", marginTop:24 }}>
          <button onClick={cargar} className="btn btn-neon btn-sm">🔄 Actualizar datos</button>
        </div>
      </div>

      {/* ─── MODAL IMPORTAR GOOGLE SHEETS ───────────────────────── */}
      <AnimatePresence>
        {modalImportGS && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setModalImportGS(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <motion.div initial={{ scale:0.9, y:30 }} animate={{ scale:1, y:0 }} exit={{ scale:0.9 }}
              onClick={e => e.stopPropagation()}
              style={{ background:"#0a1520", border:"1px solid rgba(52,211,153,0.4)", borderRadius:20, padding:28, width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto" }}>

              <h2 style={{ fontFamily:"Orbitron,monospace", color:"#34d399", marginBottom:6, fontSize:16 }}>
                📊 Importar desde Google Sheets
              </h2>
              <p style={{ fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.5)", fontSize:13, marginBottom:16, lineHeight:1.6 }}>
                Ve a Google Sheets → selecciona las filas de la pestaña <strong style={{color:"#34d399"}}>Licencias</strong>
                → copia (Ctrl+C) → pega aquí abajo (Ctrl+V).<br/>
                Formato esperado: <code style={{color:"#00f5ff", fontSize:11}}>Licencia, Activa, Tipo, Nombre, Correo, Celular, Monedas, Inventario, Nivel_Max</code>
              </p>

              <textarea
                value={csvTexto}
                onChange={e => setCsvTexto(e.target.value)}
                placeholder={"Pega aquí el contenido copiado de Google Sheets...\n\nEjemplo:\nDEBO7139\tSI\talumno\tDeborah Soto\tdasoto@gmail.com\t6331124596\t0\t\t1\nDEBO0061\tSI\talumno\tDeborah Soto\tdasoto@gmail.com\t6331124596\t0\t\t1"}
                style={{ width:"100%", minHeight:180, background:"#050a0f", color:"#00ff88", border:"1px solid rgba(52,211,153,0.3)", borderRadius:10, padding:12, fontFamily:"Courier,monospace", fontSize:12, resize:"vertical", boxSizing:"border-box" }}
              />

              <div style={{ display:"flex", gap:10, marginTop:16 }}>
                <button onClick={importarDesdeCSV} disabled={importGSCargando}
                  style={{ flex:1, background:"#34d399", color:"#050a0f", border:"none", borderRadius:12, padding:"12px 0", fontFamily:"Nunito,sans-serif", fontSize:14, fontWeight:800, cursor:"pointer", opacity: importGSCargando ? 0.6 : 1 }}>
                  {importGSCargando ? "⏳ Importando..." : "✅ Importar usuarios"}
                </button>
                <button onClick={() => { setModalImportGS(false); setCsvTexto(""); }}
                  style={{ background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:12, padding:"12px 20px", fontFamily:"Nunito,sans-serif", fontSize:13, cursor:"pointer" }}>
                  Cancelar
                </button>
              </div>

              <div style={{ marginTop:14, background:"rgba(0,245,255,0.06)", border:"1px solid rgba(0,245,255,0.2)", borderRadius:10, padding:"10px 14px", fontFamily:"Nunito,sans-serif", fontSize:12, color:"rgba(0,245,255,0.7)", lineHeight:1.8 }}>
                💡 <strong>Tip:</strong> Los usuarios que ya existen se actualizarán. Los nuevos se crearán automáticamente.
                No necesitas incluir la fila del encabezado (Licencia, Activa...) pero no pasa nada si la incluyes.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MODAL REINICIAR ALUMNO ──────────────────────────── */}
      <AnimatePresence>
        {reiniciarModal && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setReiniciarModal(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          >
            <motion.div
              initial={{ scale:0.85, y:30 }} animate={{ scale:1, y:0 }} exit={{ scale:0.85, y:30 }}
              onClick={e => e.stopPropagation()}
              style={{ background:"linear-gradient(135deg,#0d001a,#030010)", border:"1px solid rgba(255,165,0,0.4)", borderRadius:20, padding:"24px 20px", maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto" }}
            >
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <h3 style={{ fontFamily:"Orbitron,monospace", color:"#ffa500", fontSize:15, margin:0 }}>🔄 Reiniciar Alumno</h3>
                <button onClick={() => setReiniciarModal(null)}
                  style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:16 }}>✕</button>
              </div>
              <div style={{ fontFamily:"Nunito,sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:18 }}>
                <strong style={{ color:"#fff" }}>{reiniciarModal.lic.Nombre || reiniciarModal.lic.Licencia}</strong>
                {" "}— Mundos: {reiniciarModal.mundosCompletados} completados · 🪙 {reiniciarModal.lic.Monedas || 0} · 🎒 {reiniciarModal.lic.Inventario ? reiniciarModal.lic.Inventario.split(",").filter(Boolean).length : 0} items
              </div>

              {/* Botón Reiniciar Todo */}
              <button onClick={seleccionarTodo}
                style={{ width:"100%", marginBottom:16, background:"rgba(255,0,110,0.15)", border:"2px solid rgba(255,0,110,0.5)", color:"#ff006e", borderRadius:12, padding:"12px", cursor:"pointer", fontFamily:"Orbitron,monospace", fontSize:12, fontWeight:700 }}>
                ⚠️ SELECCIONAR TODO (Mundos + Monedas + Inventario)
              </button>

              {/* ── Sección: Mundos ── */}
              <div style={{ background:"rgba(255,165,0,0.06)", border:"1px solid rgba(255,165,0,0.25)", borderRadius:14, padding:"14px", marginBottom:12 }}>
                <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:10 }}>
                  <input type="checkbox" checked={opReiniciarMundos} onChange={e => setOpReiniciarMundos(e.target.checked)}
                    style={{ accentColor:"#ffa500", width:18, height:18 }} />
                  <span style={{ fontFamily:"Nunito,sans-serif", fontSize:14, color:"#ffa500", fontWeight:700 }}>🌍 Reiniciar Mundos</span>
                </label>

                {opReiniciarMundos && (
                  <div style={{ paddingLeft:28 }}>
                    {/* Sub-opción: total vs individual */}
                    <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                      <button onClick={() => setMundosTotalReset(true)}
                        style={{ flex:1, background: mundosTotalReset ? "rgba(255,0,110,0.2)" : "rgba(255,255,255,0.05)", border:`1px solid ${mundosTotalReset ? "rgba(255,0,110,0.5)" : "rgba(255,255,255,0.1)"}`, color: mundosTotalReset ? "#ff006e" : "rgba(255,255,255,0.4)", borderRadius:8, padding:"7px 10px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:12, fontWeight:700 }}>
                        ⚠️ Reinicio total (desde el mundo 1)
                      </button>
                      <button onClick={() => setMundosTotalReset(false)}
                        style={{ flex:1, background: !mundosTotalReset ? "rgba(255,165,0,0.2)" : "rgba(255,255,255,0.05)", border:`1px solid ${!mundosTotalReset ? "rgba(255,165,0,0.5)" : "rgba(255,255,255,0.1)"}`, color: !mundosTotalReset ? "#ffa500" : "rgba(255,255,255,0.4)", borderRadius:8, padding:"7px 10px", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:12, fontWeight:700 }}>
                        🎯 Mundos individuales
                      </button>
                    </div>

                    {/* Lista de mundos completados */}
                    {!mundosTotalReset && (
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        {reiniciarModal.mundosCompletados === 0 && (
                          <div style={{ color:"rgba(255,255,255,0.3)", fontFamily:"Nunito,sans-serif", fontSize:12, textAlign:"center", padding:"8px 0" }}>
                            No hay mundos completados para reiniciar
                          </div>
                        )}
                        {Array.from({ length: reiniciarModal.mundosCompletados }, (_, i) => i).map(idx => {
                          const checked = mundosSeleccionados.includes(idx);
                          return (
                            <label key={idx} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                              background: checked ? "rgba(255,165,0,0.1)" : "rgba(255,255,255,0.03)",
                              border:`1px solid ${checked ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.07)"}`,
                              borderRadius:8, padding:"7px 10px" }}>
                              <input type="checkbox" checked={checked}
                                onChange={e => {
                                  if (e.target.checked) setMundosSeleccionados(prev => [...prev, idx].sort((a,b)=>a-b));
                                  else setMundosSeleccionados(prev => prev.filter(m => m !== idx));
                                }}
                                style={{ accentColor:"#ffa500", width:15, height:15 }} />
                              <span style={{ fontSize:18 }}>{MUNDOS[idx]?.emoji || "🌍"}</span>
                              <span style={{ fontFamily:"Nunito,sans-serif", fontSize:12, color:"#fff" }}>
                                Mundo {idx + 1} — {MUNDOS[idx]?.nombre || ""}
                              </span>
                              <span style={{ marginLeft:"auto", fontSize:11, color:"rgba(255,255,255,0.3)" }}>✅</span>
                            </label>
                          );
                        })}
                        {reiniciarModal.mundosCompletados > 0 && (
                          <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:4 }}>
                            El alumno reiniciará desde el mundo más bajo que selecciones.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Sección: Monedas ── */}
              <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:10,
                background:"rgba(255,214,0,0.06)", border:`1px solid ${opReiniciarMonedas ? "rgba(255,214,0,0.4)" : "rgba(255,214,0,0.15)"}`, borderRadius:12, padding:"12px 14px" }}>
                <input type="checkbox" checked={opReiniciarMonedas} onChange={e => setOpReiniciarMonedas(e.target.checked)}
                  style={{ accentColor:"#FFD700", width:18, height:18 }} />
                <div>
                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:14, color:"#FFD700", fontWeight:700 }}>🪙 Reiniciar Monedas</div>
                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                    {reiniciarModal.lic.Monedas || 0} monedas → 0
                  </div>
                </div>
              </label>

              {/* ── Sección: Inventario ── */}
              <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:18,
                background:"rgba(162,155,254,0.06)", border:`1px solid ${opReiniciarInventario ? "rgba(162,155,254,0.4)" : "rgba(162,155,254,0.15)"}`, borderRadius:12, padding:"12px 14px" }}>
                <input type="checkbox" checked={opReiniciarInventario} onChange={e => setOpReiniciarInventario(e.target.checked)}
                  style={{ accentColor:"#a29bfe", width:18, height:18 }} />
                <div>
                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:14, color:"#a29bfe", fontWeight:700 }}>🎒 Reiniciar Inventario</div>
                  <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                    {reiniciarModal.lic.Inventario ? reiniciarModal.lic.Inventario.split(",").filter(Boolean).length : 0} items → vacío
                  </div>
                </div>
              </label>

              {/* Botón Aplicar */}
              <button onClick={ejecutarReinicio}
                style={{ width:"100%", background:"rgba(255,165,0,0.2)", border:"2px solid rgba(255,165,0,0.6)", color:"#ffa500", borderRadius:12, padding:"14px", cursor:"pointer", fontFamily:"Orbitron,monospace", fontSize:13, fontWeight:700 }}>
                ✅ APLICAR REINICIO
              </button>
              <div style={{ fontFamily:"Nunito,sans-serif", fontSize:11, color:"rgba(255,255,255,0.25)", textAlign:"center", marginTop:10 }}>
                Los cambios se aplicarán de inmediato — el alumno los verá en cuanto abra el mapa.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Contenido de impresión (oculto en DOM, usado por window.print) ────────
function ContenidoImpresion({ rep }) {
  const pct = rep.pct || 0;
  const TABLAS_NOMBRES = ["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez"];

  return (
    <div>
      <h1>Reporte de Progreso — Aventura de Tablas Pro</h1>
      <p><strong>Alumno:</strong> {rep.Nombre || "Sin nombre"}</p>
      {rep.Grado && <p><strong>Grado:</strong> {rep.Grado}</p>}
      {rep.Correo && <p><strong>Correo:</strong> {rep.Correo}</p>}
      {rep.Maestro_Nombre && <p><strong>Maestro:</strong> {rep.Maestro_Nombre}</p>}

      <h2>Progreso General</h2>
      <div className="grid">
        <div className="box"><div className="label">Mundos completados</div><div className="val">{rep.mundos || 0} / 10</div></div>
        <div className="box"><div className="label">Avance total</div><div className="val">{pct}%</div></div>
        <div className="box"><div className="label">Tiempo conectado</div><div className="val">{rep.horas>0?`${rep.horas}h `:""}{ rep.mins || 0} min</div></div>
        <div className="box"><div className="label">Monedas ganadas</div><div className="val">🪙 {rep.Monedas || 0}</div></div>
      </div>
      <div className="bar-bg"><div className="bar" style={{ width:`${pct}%` }}/></div>

      {rep.tablasProblema && rep.tablasProblema.length > 0 && (
        <>
          <h2>Tablas que Necesitan Práctica</h2>
          {rep.tablasProblema.map(([tabla, count]) => (
            <div className="tabla-row" key={tabla}>
              <span>Tabla del {tabla} ({TABLAS_NOMBRES[parseInt(tabla)] || tabla})</span>
              <span style={{ color:"#c0392b", fontWeight:"bold" }}>{count} errores</span>
            </div>
          ))}
          <p style={{ fontSize:13, color:"#555", marginTop:8 }}>Recomendación: practicar estas tablas con ejercicios adicionales en casa.</p>
        </>
      )}

      {(!rep.tablasProblema || rep.tablasProblema.length === 0) && (
        <p style={{ color:"green", fontWeight:"bold" }}>✅ ¡Excelente rendimiento! No se detectaron tablas problemáticas.</p>
      )}
    </div>
  );
}
