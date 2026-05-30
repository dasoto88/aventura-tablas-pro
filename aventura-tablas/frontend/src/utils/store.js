import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

// ── Backup de nivelMax FUERA de Zustand (doble protección) ─────────────────
const NIVEL_KEY = "aventura-nivelmax-backup-v2";
const saveNivelBackup = (licencia, nivel) => {
  try {
    const data = JSON.parse(localStorage.getItem(NIVEL_KEY) || "{}");
    if (!data[licencia] || nivel > data[licencia]) {
      data[licencia] = nivel;
      localStorage.setItem(NIVEL_KEY, JSON.stringify(data));
    }
  } catch {}
};
const loadNivelBackup = (licencia) => {
  try {
    const data = JSON.parse(localStorage.getItem(NIVEL_KEY) || "{}");
    return data[licencia] || 1;
  } catch { return 1; }
};

const MAX_REPLAYS = 2; // veces máximas que se puede repetir un mundo ya completado

export const useGameStore = create(
  persist(
    (set, get) => ({
      // ─── AUTH ────────────────────────────────────────────
      licencia: null,
      nombre: null,
      tipoUsuario: null,   // "alumno" | "admin" | "demo" | "maestro"
      fila: null,
      modoDemo: false,
      demoInicio: null,
      sesionInicio: null,
      correo: null,

      // ─── AVATAR ──────────────────────────────────────────
      avatarId: null,
      avatarSeleccionado: false,

      // ─── PROGRESO ────────────────────────────────────────
      mundoActual: 0,
      nivelMax: 1,
      aciertos: 0,
      vidas: 3,
      monedas: 0,
      monedasMundo: 0,
      inventario: [],
      equipado: {},
      rachaActual: 0,
      mundosCompletados: 0,
      fallosTablas: {},
      replayCount: {},          // { "0": 2, "1": 1 } → replays por mundo
      todosCompletados: false,  // completó TODOS los mundos incluido el Supremo
      esRepeticion: false,      // el mundo actual es un replay
      multiplicadorRepeticion: 1.0,  // 1.0 normal | 0.5 primer replay | 0.25 segundo

      // ─── QUEST ESCOLAR ───────────────────────────────────
      questGuias: [],
      questGuiaActual: null,
      questDiaActual: 1,
      questFaseActual: 'estudio',

      // ─── ESTADO UI ───────────────────────────────────────
      pagina: "login",
      animacion: "idle",
      mostrarTienda: false,
      mostrarMapa: false,
      boss: {
        activo: false, num1: 0, num2: 0,
        vidaBoss: 0, vidaBossMax: 0, fase: 1,
      },
      logros: [],

      // ─── ACCIONES ────────────────────────────────────────

      iniciarSesion: (datos) => {
        const prev = get();
        const isSameUser = prev.licencia === datos.licencia;
        const serverNivelMax = datos.nivel_max || 1;
        // Protección triple: Zustand local + backup localStorage + servidor
        const backupNivel = loadNivelBackup(datos.licencia);
        const nivelMax = isSameUser
          ? Math.max(prev.nivelMax || 1, serverNivelMax, backupNivel)
          : Math.max(serverNivelMax, backupNivel);

        set({
          licencia:       datos.licencia,
          nombre:         datos.nombre,
          correo:         datos.correo || "",
          tipoUsuario:    datos.tipo,
          fila:           datos.fila,
          monedas:        datos.monedas || 0,
          inventario:     datos.inventario ? datos.inventario.split(",").filter(Boolean) : [],
          nivelMax:       nivelMax,
          mundoActual:    Math.min(nivelMax - 1, 10),
          sesionInicio:   Date.now(),
          pagina: datos.tipo === "admin"
            ? "admin"
            : datos.tipo === "maestro" || datos.tipo === "padre"
            ? "dashboard"
            : "intro",
        });

        // Guardar en backup inmediatamente
        saveNivelBackup(datos.licencia, nivelMax);

        if (datos.licencia && datos.tipo !== "demo") {
          axios.post(`${API}/api/sesion/iniciar`, { licencia: datos.licencia }).catch(() => {});
          // Si local está más adelantado que el servidor → sincronizar
          if (isSameUser && Math.max(prev.nivelMax || 1, backupNivel) > serverNivelMax) {
            setTimeout(() => get().guardarProgreso(), 1500);
          }
        }
      },

      iniciarDemo: () => {
        set({
          modoDemo: true,
          demoInicio: Date.now(),
          sesionInicio: Date.now(),
          nombre: "Invitado",
          tipoUsuario: "demo",
          pagina: "intro",
          monedas: 0, inventario: [], nivelMax: 1, mundoActual: 0,
          replayCount: {}, todosCompletados: false, esRepeticion: false,
          multiplicadorRepeticion: 1.0,
        });
      },

      seleccionarAvatar: (avatarId) => {
        set({ avatarId, avatarSeleccionado: true, pagina: "selector_juego" });
      },

      irAMundo: (mundoId) => {
        const state = get();

        // Es repetición si el mundo ya fue completado (mundoId < nivelMax - 1)
        // Y todavía no se han completado todos los mundos
        const esCompletado = mundoId < state.nivelMax - 1;
        const esRepeticion = esCompletado && !state.todosCompletados;

        const replayCount = { ...state.replayCount };
        const currentReplays = replayCount[String(mundoId)] || 0;

        // Bloquear si ya agotó los replays (la UI ya lo previene, esto es doble seguro)
        if (esRepeticion && currentReplays >= MAX_REPLAYS) return;

        // Incrementar replay count solo para mundos ya completados
        if (esRepeticion) {
          replayCount[String(mundoId)] = currentReplays + 1;
        }

        // Multiplicador de monedas: 50% primer replay, 25% segundo
        let multiplicadorRepeticion = 1.0;
        if (esRepeticion) {
          multiplicadorRepeticion = currentReplays === 0 ? 0.5 : 0.25;
        }

        // Aplicar vidas extra de accesorios
        let vidasInicio = 3;
        try {
          const { getPoderes } = require("./gameData");
          const poderes = getPoderes(state.inventario, state.equipado);
          vidasInicio = 3 + (poderes.vidasExtra || 0);
        } catch {}

        set({
          mundoActual: mundoId,
          aciertos: 0,
          vidas: vidasInicio,
          monedasMundo: 0,
          rachaActual: 0,
          boss: { activo: false, num1: 0, num2: 0, vidaBoss: 0, vidaBossMax: 0, fase: 1 },
          pagina: "estudio_tabla",
          mostrarMapa: false,
          animacion: "idle",
          esRepeticion,
          multiplicadorRepeticion,
          replayCount,
        });
      },

      irAJuego: () => set({ pagina: "juego" }),

      // Llamar cuando el boss es derrotado (BossPage controla vida local)
      completarMundo: () => {
        const state = get();
        const { MUNDOS } = require("./gameData");
        const mundoData   = MUNDOS[state.mundoActual];
        const premioFinal = Math.round(mundoData.premio * state.multiplicadorRepeticion);
        const nuevoNivel  = Math.max(state.nivelMax, state.mundoActual + 2);
        const todosAhora  = state.mundoActual >= MUNDOS.length - 1;
        const nuevosMundosCompletados = state.esRepeticion
          ? state.mundosCompletados
          : state.mundosCompletados + 1;

        set({
          boss:              { activo: false, num1: 0, num2: 0, vidaBoss: 0, vidaBossMax: 0, fase: 1 },
          monedas:           state.monedas + premioFinal,
          animacion:         "celebrate",
          nivelMax:          nuevoNivel,
          mundosCompletados: nuevosMundosCompletados,
          todosCompletados:  state.todosCompletados || todosAhora,
        });

        if (state.licencia) saveNivelBackup(state.licencia, nuevoNivel);
        if (!state.modoDemo) {
          setTimeout(() => get().guardarProgreso(nuevosMundosCompletados), 500);
        }
      },

      volverABoss: () => {
        set({
          vidas: 3,
          boss: { activo: false, num1: 0, num2: 0, vidaBoss: 0, vidaBossMax: 0, fase: 1 },
          pagina: "boss",
        });
      },

      respuestaCorrecta: (monedasGanadas) => {
        const state = get();
        const nuevaRacha    = state.rachaActual + 1;
        const nuevosAciertos = state.aciertos + 1;
        // Aplicar multiplicador de repetición sobre las monedas calculadas por el componente
        const monedasFinal  = Math.round(monedasGanadas * state.multiplicadorRepeticion);
        const totalMonedas  = state.monedas + monedasFinal;
        const monedoActual  = state.monedasMundo + monedasFinal;

        set({
          aciertos:     nuevosAciertos,
          monedas:      totalMonedas,
          monedasMundo: monedoActual,
          vidas:        Math.max(state.vidas, 1), // no restaurar vidas en boss
          rachaActual:  nuevaRacha,
          animacion:    "win",
        });

        if (nuevosAciertos >= 10) {
          setTimeout(() => {
            const mundo = require("./gameData").MUNDOS[state.mundoActual];
            set({
              boss: {
                activo:      true,
                num1:        mundo.esSupremo ? Math.floor(Math.random() * 10) + 1 : mundo.boss.num1,
                num2:        mundo.esSupremo ? Math.floor(Math.random() * 10) + 1 : mundo.boss.num2,
                vidaBoss:    mundo.bossVida,
                vidaBossMax: mundo.bossVida,
                fase: 1,
              },
            });
          }, 800);
        }
        if (!get().modoDemo) get().guardarProgreso();
      },

      respuestaIncorrecta: (mantenerMonedas = false) => {
        const state = get();
        const nuevasVidas = state.vidas - 1;
        const tabla = require("./gameData").MUNDOS[state.mundoActual]?.tabla || 1;

        const fallos = { ...state.fallosTablas };
        fallos[tabla] = (fallos[tabla] || 0) + 1;

        set({
          vidas:       nuevasVidas,
          animacion:   "sad",
          rachaActual: 0,
          fallosTablas: fallos,
        });

        if (nuevasVidas <= 0) {
          setTimeout(() => {
            set({
              vidas: 3, aciertos: 0, monedasMundo: 0, rachaActual: 0,
              monedas: mantenerMonedas
                ? state.monedas
                : Math.max(0, state.monedas - state.monedasMundo),
              boss: { activo: false, num1: 0, num2: 0, vidaBoss: 0, vidaBossMax: 0, fase: 1 },
              animacion: "sad",
            });
          }, 2000);
        }
      },

      atacarBoss: (correcto, danoExtra = 0) => {
        const state = get();
        if (correcto) {
          const danoPorGolpe = 1 + danoExtra;
          const nuevaVida = state.boss.vidaBoss - danoPorGolpe;
          if (nuevaVida <= 0) {
            const { MUNDOS } = require("./gameData");
            const mundoData   = MUNDOS[state.mundoActual];
            const premioFinal = Math.round(mundoData.premio * state.multiplicadorRepeticion);
            const nuevasMonedas = state.monedas + premioFinal;
            const nuevoNivel    = Math.max(state.nivelMax, state.mundoActual + 2);

            // Completó todos los mundos si terminó el mundo supremo (último)
            const todosAhora = state.mundoActual >= MUNDOS.length - 1;

            // No incrementar mundosCompletados en replays
            const nuevosMundosCompletados = state.esRepeticion
              ? state.mundosCompletados
              : state.mundosCompletados + 1;

            set({
              boss:              { ...state.boss, vidaBoss: 0, activo: false },
              monedas:           nuevasMonedas,
              animacion:         "celebrate",
              pagina:            "mundo_completo",
              nivelMax:          nuevoNivel,
              mundosCompletados: nuevosMundosCompletados,
              todosCompletados:  state.todosCompletados || todosAhora,
            });

            // Guardar nivelMax en backup inmediatamente
            if (state.licencia) saveNivelBackup(state.licencia, nuevoNivel);

            if (!state.modoDemo) {
              setTimeout(() => get().guardarProgreso(nuevosMundosCompletados), 500);
            }
          } else {
            set({ boss: { ...state.boss, vidaBoss: Math.max(0, nuevaVida) } });
          }
        } else {
          const nuevasVidas = state.vidas - 1;
          set({ vidas: nuevasVidas, animacion: "sad" });
          if (nuevasVidas <= 0) {
            setTimeout(() => {
              set({
                vidas: 3, aciertos: 0, monedasMundo: 0,
                monedas: Math.max(0, state.monedas - state.monedasMundo),
                boss: { activo: false, num1: 0, num2: 0, vidaBoss: 0, vidaBossMax: 0, fase: 1 },
                pagina: "juego",
              });
            }, 2500);
          }
        }
      },

      comprarItem: (item) => {
        const state = get();
        if (state.monedas < item.precio) return false;
        if (state.inventario.includes(item.id)) return false;
        const nuevasMonedas = state.monedas - item.precio;
        const nuevoInv = [...state.inventario, item.id];
        set({ monedas: nuevasMonedas, inventario: nuevoInv });
        if (!state.modoDemo) setTimeout(() => get().guardarProgreso(), 300);
        return true;
      },

      equiparItem: (tipo, itemId) => {
        set((state) => ({ equipado: { ...state.equipado, [tipo]: itemId } }));
      },

      sincronizarConServidor: async () => {
        const state = get();
        if (!state.licencia || state.modoDemo || state.tipoUsuario === "demo") return;
        try {
          const { data } = await axios.get(`${API}/api/sincronizar/${state.licencia}`);
          if (data.forzar) {
            // El admin reinició datos — aplicar valores del servidor y limpiar backup local
            const nuevoInventario = data.inventario
              ? data.inventario.split(",").filter(Boolean)
              : [];
            // Limpiar backup localStorage para esta licencia
            try {
              const backup = JSON.parse(localStorage.getItem(NIVEL_KEY) || "{}");
              backup[state.licencia] = data.nivel_max;
              localStorage.setItem(NIVEL_KEY, JSON.stringify(backup));
            } catch {}
            set({
              nivelMax:          data.nivel_max,
              mundosCompletados: data.mundos_completados,
              monedas:           data.monedas,
              inventario:        nuevoInventario,
              fallosTablas:      JSON.parse(data.fallos_tablas || "{}"),
              replayCount:       {},
              todosCompletados:  false,
              esRepeticion:      false,
              mundoActual:       Math.min(data.nivel_max - 1, 10),
            });
          }
        } catch {}
      },

      guardarProgreso: async (mundosCompletadosOverride) => {
        const state = get();
        const mundosTotal = mundosCompletadosOverride ?? state.mundosCompletados;
        const tiempoMin = state.sesionInicio
          ? Math.round((Date.now() - state.sesionInicio) / 60000)
          : 0;
        try {
          await axios.post(`${API}/api/actualizar-progreso`, {
            licencia:           state.licencia,
            monedas:            state.monedas,
            inventario:         state.inventario.join(","),
            nivel_max:          state.nivelMax,
            nombre:             state.nombre,
            mundos_completados: mundosTotal,
            fallos_tablas:      JSON.stringify(state.fallosTablas || {}),
            tiempo_min:         tiempoMin,
          });
          // También actualizar el backup tras guardar exitosamente
          if (state.licencia) saveNivelBackup(state.licencia, state.nivelMax);
        } catch (e) {
          console.error("Error guardando progreso:", e);
        }
      },

      solicitarCertificado: async () => {
        const state = get();
        if (!state.licencia || state.modoDemo) return { ok: false };
        try {
          const res = await axios.post(`${API}/api/certificado/enviar`, {
            licencia: state.licencia,
            nombre:   state.nombre,
            correo:   state.correo,
          });
          return res.data;
        } catch (e) {
          console.error("Error solicitando certificado:", e);
          return { ok: false };
        }
      },

      cerrarSesion: () => {
        const state = get();
        if (state.licencia && state.tipoUsuario !== "demo") {
          const tiempoMin = state.sesionInicio
            ? Math.round((Date.now() - state.sesionInicio) / 60000)
            : 0;
          axios.post(`${API}/api/sesion/terminar`, {
            licencia: state.licencia,
            tiempo_min: tiempoMin,
          }).catch(() => {});
        }
        set({
          licencia: null, nombre: null, correo: null, tipoUsuario: null, fila: null,
          modoDemo: false, demoInicio: null, sesionInicio: null,
          avatarId: null, avatarSeleccionado: false,
          mundoActual: 0, nivelMax: 1,
          aciertos: 0, vidas: 3, monedas: 0, monedasMundo: 0,
          inventario: [], equipado: {}, rachaActual: 0,
          mundosCompletados: 0, fallosTablas: {},
          replayCount: {}, todosCompletados: false, esRepeticion: false,
          multiplicadorRepeticion: 1.0,
          pagina: "login", animacion: "idle",
          boss: { activo: false, num1: 0, num2: 0, vidaBoss: 0, vidaBossMax: 0, fase: 1 },
          logros: [],
        });
      },

      setAnimacion: (anim) => set({ animacion: anim }),
      setPagina:    (p)    => set({ pagina: p }),

      // ─── QUEST ESCOLAR ───────────────────────────────────
      setQuestGuias:      (guias) => set({ questGuias: guias }),
      setQuestGuiaActual: (guia)  => set({ questGuiaActual: guia }),
      setQuestDiaActual:  (dia)   => set({ questDiaActual: dia }),
      setQuestFaseActual: (fase)  => set({ questFaseActual: fase }),
    }),
    {
      name: "aventura-tablas-store-v2",
      partialize: (state) => ({
        licencia: state.licencia, nombre: state.nombre, correo: state.correo,
        tipoUsuario: state.tipoUsuario, fila: state.fila,
        mundoActual: state.mundoActual, nivelMax: state.nivelMax,
        monedas: state.monedas, inventario: state.inventario, equipado: state.equipado,
        avatarId: state.avatarId, logros: state.logros,
        mundosCompletados: state.mundosCompletados, fallosTablas: state.fallosTablas,
        replayCount: state.replayCount, todosCompletados: state.todosCompletados,
      }),
    }
  )
);
