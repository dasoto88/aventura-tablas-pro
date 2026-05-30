import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useGameStore } from "../utils/store";
import { TIENDA_ITEMS, AVATARES } from "../utils/gameData";

const CATEGORIAS = ["Todos", "cabeza", "arma", "accesorio"];
const CATEGORIA_LABEL = { cabeza:"🪖 Sombreros", arma:"⚔️ Armas", accesorio:"🎒 Accesorios" };
const RAREZA_ORDER = { comun:0, raro:1, epico:2, legendaria:3 };

export default function TiendaPage() {
  const store = useGameStore();
  const avatar = AVATARES.find(a => a.id === store.avatarId) || AVATARES[0];
  const [categoria, setCategoria] = useState("Todos");
  const [tabActiva, setTabActiva] = useState("tienda"); // tienda | inventario
  const [itemDetalle, setItemDetalle] = useState(null);
  const [comprando, setComprando] = useState(null);

  const volverJuego = () => store.setPagina("mapa");

  const items = TIENDA_ITEMS
    .filter(it => categoria === "Todos" || it.tipo === categoria)
    .sort((a, b) => RAREZA_ORDER[a.rareza] - RAREZA_ORDER[b.rareza]);

  const itemsInventario = TIENDA_ITEMS.filter(it => store.inventario.includes(it.id));

  const comprar = (item) => {
    if (store.inventario.includes(item.id)) { toast("Ya tienes este item 📦"); return; }
    if (store.monedas < item.precio) { toast.error(`¡Te faltan 🪙 ${item.precio - store.monedas} monedas!`); return; }
    if (item.requiere_nivel && store.nivelMax < item.requiere_nivel) {
      toast.error(`🔒 Necesitas llegar al mundo ${item.requiere_nivel} primero`); return;
    }
    setComprando(item.id);
    setTimeout(() => {
      const ok = store.comprarItem(item);
      setComprando(null);
      if (ok) {
        toast.success(`✅ ¡Compraste ${item.nombre}!`);
        setItemDetalle(null);
      }
    }, 600);
  };

  const equipar = (item) => {
    store.equiparItem(item.tipo, item.id);
    toast.success(`⚔️ ${item.nombre} equipado`);
  };

  return (
    <div className="page" style={{
      background:"radial-gradient(ellipse at top, #0d002b 0%, #030010 70%)",
      minHeight:"100vh", paddingBottom:40
    }}>
      {/* Header */}
      <div className="hud" style={{background:"rgba(0,0,0,0.85)"}}>
        <button onClick={volverJuego} className="btn btn-neon btn-sm">← Volver</button>
        <div style={{fontFamily:"Orbitron,monospace", fontSize:18, fontWeight:700,
          background:"linear-gradient(90deg,#FFD700,#ff8c00)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"
        }}>
          🛒 TIENDA ÉPICA
        </div>
        <div className="hud-item" style={{marginLeft:"auto"}}>
          <span>🪙</span>
          <span className="hud-value" style={{color:"#FFD700", fontSize:18}}>{store.monedas.toLocaleString()}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex", gap:4, padding:"16px 16px 0", maxWidth:800, margin:"0 auto"}}>
        {["tienda","inventario"].map(t => (
          <button key={t} onClick={() => setTabActiva(t)}
            style={{
              flex:1, padding:"12px 0",
              background: tabActiva===t ? "linear-gradient(135deg,#667eea,#764ba2)" : "rgba(255,255,255,0.05)",
              border:`1px solid ${tabActiva===t ? "transparent" : "rgba(255,255,255,0.1)"}`,
              borderRadius:12, color:tabActiva===t ? "#fff" : "rgba(255,255,255,0.45)",
              fontFamily:"Orbitron,monospace", fontSize:13, cursor:"pointer",
              transition:"all 0.3s"
            }}
          >
            {t === "tienda" ? "🛒 Tienda" : `🎒 Mi Inventario (${store.inventario.length})`}
          </button>
        ))}
      </div>

      <div style={{padding:"16px", maxWidth:800, margin:"0 auto"}}>
        {tabActiva === "tienda" && (
          <>
            {/* Filtros categoría */}
            <div style={{display:"flex", gap:8, marginBottom:20, flexWrap:"wrap"}}>
              {CATEGORIAS.map(c => (
                <button key={c} onClick={() => setCategoria(c)}
                  style={{
                    padding:"8px 16px",
                    background: categoria===c ? "rgba(0,245,255,0.2)" : "rgba(255,255,255,0.05)",
                    border:`1px solid ${categoria===c ? "rgba(0,245,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius:20, color: categoria===c ? "#00f5ff" : "rgba(255,255,255,0.45)",
                    fontFamily:"Nunito,sans-serif", fontSize:13, cursor:"pointer",
                    transition:"all 0.2s"
                  }}
                >
                  {c === "Todos" ? "✨ Todos" : CATEGORIA_LABEL[c]}
                </button>
              ))}
            </div>

            {/* Grid items */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:14}}>
              {items.map((item, i) => {
                const poseido = store.inventario.includes(item.id);
                const bloqueado = item.requiere_nivel && store.nivelMax < item.requiere_nivel;
                const puedePagar = store.monedas >= item.precio;

                return (
                  <motion.div
                    key={item.id}
                    initial={{opacity:0, scale:0.8}}
                    animate={{opacity:1, scale:1}}
                    transition={{delay: i * 0.04}}
                    onClick={() => setItemDetalle(item)}
                    className={`item-card ${item.rareza === "legendaria" ? "legendaria" : ""} ${poseido ? "poseido" : ""}`}
                    style={{
                      cursor:"pointer",
                      opacity: bloqueado ? 0.4 : 1,
                      filter: poseido ? "brightness(0.7)" : "none",
                    }}
                  >
                    <span className={`rareza-badge rareza-${item.rareza}`}>{item.rareza}</span>

                    <motion.div
                      animate={item.rareza === "legendaria" ? {filter:["hue-rotate(0deg)","hue-rotate(360deg)"]} : {}}
                      transition={{duration:4, repeat:Infinity, ease:"linear"}}
                      style={{fontSize:52, marginBottom:10, lineHeight:1}}
                    >
                      {item.emoji}
                    </motion.div>

                    <div style={{fontFamily:"Orbitron,monospace", fontSize:12, fontWeight:700, color:"#fff", marginBottom:4}}>
                      {item.nombre}
                    </div>

                    {bloqueado ? (
                      <div style={{color:"rgba(255,255,255,0.4)", fontFamily:"Nunito,sans-serif", fontSize:11}}>
                        🔒 Mundo {item.requiere_nivel}
                      </div>
                    ) : poseido ? (
                      <div style={{color:"#39ff14", fontFamily:"Nunito,sans-serif", fontSize:12}}>✅ Comprado</div>
                    ) : (
                      <div style={{fontFamily:"Orbitron,monospace", fontSize:14, color: puedePagar ? "#FFD700" : "#ff006e"}}>
                        🪙 {item.precio.toLocaleString()}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {tabActiva === "inventario" && (
          <InventarioTab
            items={itemsInventario}
            equipado={store.equipado}
            onEquipar={equipar}
            avatar={avatar}
            nombre={store.nombre}
          />
        )}
      </div>

      {/* Modal detalle item */}
      <AnimatePresence>
        {itemDetalle && (
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.8)",
              display:"flex", alignItems:"center", justifyContent:"center",
              padding:16, zIndex:200
            }}
            onClick={() => setItemDetalle(null)}
          >
            <motion.div
              initial={{scale:0.7, y:40}} animate={{scale:1, y:0}} exit={{scale:0.7, y:40}}
              onClick={e => e.stopPropagation()}
              style={{
                background:"rgba(5,8,30,0.98)", backdropFilter:"blur(20px)",
                border:`2px solid ${itemDetalle.rareza === "legendaria" ? "#FFD700" : "rgba(0,245,255,0.4)"}`,
                borderRadius:28, padding:32, maxWidth:420, width:"100%", textAlign:"center",
                boxShadow: itemDetalle.rareza === "legendaria" ? "0 0 60px rgba(255,214,0,0.4)" : "0 0 40px rgba(0,245,255,0.2)"
              }}
            >
              <motion.div
                animate={itemDetalle.rareza==="legendaria" ? {filter:["hue-rotate(0deg)","hue-rotate(360deg)"],scale:[1,1.1,1]} : {}}
                transition={{duration:3, repeat:Infinity}}
                style={{fontSize:80, marginBottom:12}}
              >
                {itemDetalle.emoji}
              </motion.div>

              <span className={`rareza-badge rareza-${itemDetalle.rareza}`} style={{position:"static", display:"inline-block", marginBottom:12}}>
                ⭐ {itemDetalle.rareza.toUpperCase()}
              </span>

              <h2 style={{fontFamily:"Orbitron,monospace", color:"#fff", fontSize:20, marginBottom:8}}>
                {itemDetalle.nombre}
              </h2>
              <p style={{fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.6)", fontSize:15, marginBottom:16, lineHeight:1.5}}>
                {itemDetalle.descripcion}
              </p>

              {itemDetalle.requiere_nivel && (
                <div style={{marginBottom:12, color:"rgba(255,214,0,0.8)", fontFamily:"Nunito,sans-serif", fontSize:13}}>
                  🔒 Requiere: Mundo {itemDetalle.requiere_nivel}
                </div>
              )}

              {store.inventario.includes(itemDetalle.id) ? (
                <button
                  onClick={() => { equipar(itemDetalle); setItemDetalle(null); }}
                  className="btn btn-neon btn-full"
                  style={{padding:14, fontSize:16}}
                >
                  ⚔️ Equipar
                </button>
              ) : (
                <button
                  onClick={() => comprar(itemDetalle)}
                  disabled={comprando === itemDetalle.id || store.monedas < itemDetalle.precio || (itemDetalle.requiere_nivel && store.nivelMax < itemDetalle.requiere_nivel)}
                  className="btn btn-gold btn-full"
                  style={{padding:14, fontSize:17}}
                >
                  {comprando === itemDetalle.id ? "⏳ Comprando..." : `🛒 Comprar — 🪙 ${itemDetalle.precio.toLocaleString()}`}
                </button>
              )}

              <button onClick={() => setItemDetalle(null)} style={{
                background:"transparent", border:"none", color:"rgba(255,255,255,0.3)",
                marginTop:14, cursor:"pointer", fontFamily:"Nunito,sans-serif", fontSize:13
              }}>Cerrar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InventarioTab({ items, equipado, onEquipar, avatar, nombre }) {
  if (items.length === 0) return (
    <div style={{textAlign:"center", padding:60}}>
      <div style={{fontSize:60, marginBottom:16}}>🎒</div>
      <p style={{fontFamily:"Nunito,sans-serif", color:"rgba(255,255,255,0.45)", fontSize:16}}>
        Tu inventario está vacío. ¡Compra items en la tienda!
      </p>
    </div>
  );

  return (
    <div>
      {/* Avatar con items equipados */}
      <div style={{
        background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:20, padding:24, marginBottom:24, textAlign:"center"
      }}>
        <div style={{fontFamily:"Orbitron,monospace", fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:12, letterSpacing:2}}>
          PERSONAJE: {nombre}
        </div>
        <div style={{fontSize:80, filter:`drop-shadow(0 0 20px ${avatar.color})`}}>{avatar.emoji}</div>
        <div style={{marginTop:8, display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap"}}>
          {["cabeza","arma","accesorio"].map(tipo => {
            const eqId = equipado[tipo];
            const eqItem = items.find(it => it.id === eqId);
            return (
              <div key={tipo} style={{
                background:"rgba(0,0,0,0.3)", borderRadius:12, padding:"8px 16px",
                border:`1px solid ${eqItem ? "rgba(0,245,255,0.3)" : "rgba(255,255,255,0.1)"}`,
                fontFamily:"Nunito,sans-serif", fontSize:13
              }}>
                <span style={{color:"rgba(255,255,255,0.35)", fontSize:11}}>{tipo}: </span>
                {eqItem ? `${eqItem.emoji} ${eqItem.nombre}` : "—"}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:14}}>
        {items.map((item, i) => {
          const esEquipado = equipado[item.tipo] === item.id;
          return (
            <motion.div
              key={item.id}
              initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}}
              transition={{delay: i * 0.05}}
              className={`item-card ${item.rareza === "legendaria" ? "legendaria" : ""}`}
              style={{border: esEquipado ? "2px solid #00f5ff" : undefined}}
            >
              <span className={`rareza-badge rareza-${item.rareza}`}>{item.rareza}</span>
              {esEquipado && <div style={{position:"absolute", top:8, left:10, fontSize:11, color:"#00f5ff"}}>✓ Equipado</div>}
              <div style={{fontSize:52, marginBottom:8, marginTop:8}}>{item.emoji}</div>
              <div style={{fontFamily:"Orbitron,monospace", fontSize:11, color:"#fff", marginBottom:10}}>{item.nombre}</div>
              <button
                onClick={() => onEquipar(item)}
                style={{
                  background: esEquipado ? "rgba(0,245,255,0.15)" : "rgba(255,255,255,0.08)",
                  border:`1px solid ${esEquipado ? "rgba(0,245,255,0.4)" : "rgba(255,255,255,0.15)"}`,
                  borderRadius:8, color: esEquipado ? "#00f5ff" : "rgba(255,255,255,0.6)",
                  padding:"6px 12px", fontFamily:"Nunito,sans-serif", fontSize:12, cursor:"pointer", width:"100%"
                }}
              >
                {esEquipado ? "✓ Equipado" : "Equipar"}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
