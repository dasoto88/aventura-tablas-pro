// ============================================================
//  AVENTURA DE TABLAS PRO — SISTEMA DE VOZ (Web Speech API)
//  Usa la voz del sistema, funciona sin internet, sin librerías
// ============================================================

class VoiceManager {
  constructor() {
    this.enabled = true;
    this.synth = null;
    this.voices = [];
    this._stopFlag = false;
    this._init();
  }

  _init() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    this.synth = window.speechSynthesis;
    const load = () => {
      this.voices = this.synth.getVoices();
    };
    load();
    this.synth.onvoiceschanged = load;
  }

  _getVoz() {
    if (!this.voices.length) this.voices = this.synth?.getVoices() || [];
    // Prioridad: español México > español cualquiera > primera disponible
    return (
      this.voices.find(v => v.lang === "es-MX") ||
      this.voices.find(v => v.lang === "es-US") ||
      this.voices.find(v => v.lang.startsWith("es")) ||
      this.voices[0] ||
      null
    );
  }

  // ─── Hablar texto simple (fire & forget) ──────────────────
  hablar(texto, opciones = {}) {
    if (!this.enabled || !this.synth) return;
    this.synth.cancel();
    const utt = new SpeechSynthesisUtterance(texto);
    utt.lang    = "es-MX";
    utt.rate    = opciones.velocidad  || 0.85;
    utt.pitch   = opciones.tono       || 1.1;
    utt.volume  = opciones.volumen    || 0.95;
    const voz = this._getVoz();
    if (voz) utt.voice = voz;
    this.synth.speak(utt);
    return utt;
  }

  // ─── Hablar y esperar a que termine ───────────────────────
  hablarYEsperar(texto, opciones = {}) {
    return new Promise(resolve => {
      if (!this.enabled || !this.synth) { resolve(); return; }
      this.synth.cancel();
      const utt = new SpeechSynthesisUtterance(texto);
      utt.lang    = "es-MX";
      utt.rate    = opciones.velocidad  || 0.82;
      utt.pitch   = opciones.tono       || 1.1;
      utt.volume  = opciones.volumen    || 0.95;
      const voz = this._getVoz();
      if (voz) utt.voice = voz;
      utt.onend   = resolve;
      utt.onerror = resolve;
      this.synth.speak(utt);
    });
  }

  // ─── Leer tabla completa (con callback por cada hecho) ────
  async leerTabla(tabla, { onHecho, onTerminado, velocidad = 0.82 } = {}) {
    this._stopFlag = false;
    if (!this.enabled || !this.synth) { onTerminado?.(); return; }

    await this.hablarYEsperar(
      `¡Muy bien! Ahora vamos a aprender la tabla del ${tabla}. ¡Repite conmigo!`,
      { velocidad }
    );

    for (let i = 1; i <= 10; i++) {
      if (this._stopFlag) break;
      const resultado = tabla * i;
      onHecho?.(i); // resaltar la fila i en la UI
      await this.hablarYEsperar(
        `${tabla} por ${i}... igual a... ${resultado}`,
        { velocidad }
      );
      await this._esperar(350);
    }

    if (!this._stopFlag) {
      await this._esperar(400);
      await this.hablarYEsperar(
        `¡Excelente! Ya conoces la tabla del ${tabla}. ¡Ahora a practicarla en el juego!`,
        { velocidad }
      );
    }
    onTerminado?.();
  }

  // ─── Leer un solo hecho ───────────────────────────────────
  pronunciarHecho(n1, n2) {
    const res = n1 * n2;
    this.hablar(`${n1} por ${n2}, igual a ${res}`);
  }

  // ─── Mensajes de motivación ───────────────────────────────
  motivar(tipo) {
    const frases = {
      correcto:  ["¡Muy bien!", "¡Correcto!", "¡Eso es!", "¡Excelente!", "¡Genial!"],
      incorrecto:["¡Casi! Sigue intentando.", "¡No te rindas!", "¡Tú puedes!"],
      boss:      ["¡El monstruo se acerca! ¡Responde rápido!","¡Ataca con tus tablas!"],
      victory:   ["¡Ganaste! ¡Eres un campeón!","¡Lo lograste! ¡Increíble!"],
    };
    const lista = frases[tipo] || frases.correcto;
    this.hablar(lista[Math.floor(Math.random() * lista.length)]);
  }

  // ─── Intro del mundo ──────────────────────────────────────
  async introMundo(nombreMundo, tabla) {
    await this.hablarYEsperar(
      `¡Bienvenido al ${nombreMundo}! Aquí aprenderás la tabla del ${tabla}. ¡Vamos con todo!`
    );
  }

  // ─── Voz de villano (diferente por boss) ─────────────────
  hablarVillano(texto, mundoId = 0) {
    // Cada boss tiene su perfil de voz: grave=villano lento, agudo=villano élfico
    const PERFILES = [
      { velocidad: 0.60, tono: 0.50 }, // 0  Jabalí: lento y grave
      { velocidad: 0.65, tono: 0.40 }, // 1  Tiburón: muy grave
      { velocidad: 0.55, tono: 0.30 }, // 2  Dragón de Fuego: profundo
      { velocidad: 0.50, tono: 0.45 }, // 3  Yeti: gruñón lento
      { velocidad: 1.10, tono: 1.80 }, // 4  Hechicero: rápido y agudo
      { velocidad: 1.30, tono: 1.50 }, // 5  Tornado: acelerado
      { velocidad: 0.90, tono: 0.80 }, // 6  Robot: mecánico
      { velocidad: 1.20, tono: 2.00 }, // 7  Alienígena: muy agudo
      { velocidad: 0.50, tono: 0.35 }, // 8  Dragón Supremo: épico y profundo
      { velocidad: 0.70, tono: 0.40 }, // 9  Pulpo Pirata: grave
      { velocidad: 0.45, tono: 0.20 }, // 10 OMEGA: el más grave de todos
    ];
    const perfil = PERFILES[Math.min(mundoId, PERFILES.length - 1)];
    return this.hablar(texto, perfil);
  }

  // ─── Voz heroica / caricatura para el intro ───────────────
  hablarHeroico(texto, opciones = {}) {
    return this.hablar(texto, { velocidad: 1.05, tono: 1.45, ...opciones });
  }

  // ─── Parar todo ───────────────────────────────────────────
  detener() {
    this._stopFlag = true;
    this.synth?.cancel();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.detener();
    return this.enabled;
  }

  _esperar(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

const voiceManager = new VoiceManager();
export default voiceManager;
