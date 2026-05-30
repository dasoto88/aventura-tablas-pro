// ============================================================
//  AVENTURA DE TABLAS PRO — SISTEMA DE SONIDOS
//  Usa Web Audio API (sin archivos externos, funciona offline)
// ============================================================

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicNode = null;
    this.musicGain = null;
    this._musicPlaying = false;
    this._bossMusicPlaying = false;
    this._bossMusicInterval = null;
    this.bossMusicGain = null;
  }

  _getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  // Tono simple
  _tone(freq, duration, type = "sine", volume = 0.3, delay = 0) {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.05);
    } catch (e) {}
  }

  // Secuencia de tonos
  _seq(notes) {
    // notes = [{freq, dur, vol, type, delay}]
    notes.forEach(n => this._tone(n.freq, n.dur, n.type || "sine", n.vol || 0.25, n.delay || 0));
  }

  // ─── SONIDOS DEL JUEGO ─────────────────────────────────────

  // ✅ Respuesta correcta — acorde ascendente alegre
  correcto() {
    this._seq([
      { freq: 523, dur: 0.1, delay: 0,    vol: 0.3, type: "square" },
      { freq: 659, dur: 0.1, delay: 0.08, vol: 0.3, type: "square" },
      { freq: 784, dur: 0.2, delay: 0.16, vol: 0.4, type: "square" },
    ]);
  }

  // ❌ Respuesta incorrecta — sonido de error
  incorrecto() {
    this._seq([
      { freq: 330, dur: 0.15, delay: 0,    vol: 0.3, type: "sawtooth" },
      { freq: 220, dur: 0.25, delay: 0.15, vol: 0.35, type: "sawtooth" },
    ]);
  }

  // 🔥 Racha de 3
  racha3() {
    this._seq([
      { freq: 440, dur: 0.08, delay: 0,    vol: 0.25, type: "square" },
      { freq: 554, dur: 0.08, delay: 0.09, vol: 0.25, type: "square" },
      { freq: 659, dur: 0.08, delay: 0.18, vol: 0.25, type: "square" },
      { freq: 880, dur: 0.18, delay: 0.27, vol: 0.35, type: "square" },
    ]);
  }

  // ⭐ Racha de 5
  racha5() {
    this._seq([
      { freq: 523, dur: 0.06, delay: 0,    vol: 0.3, type: "square" },
      { freq: 659, dur: 0.06, delay: 0.07, vol: 0.3, type: "square" },
      { freq: 784, dur: 0.06, delay: 0.14, vol: 0.3, type: "square" },
      { freq: 1047,dur: 0.06, delay: 0.21, vol: 0.3, type: "square" },
      { freq: 1319,dur: 0.2,  delay: 0.28, vol: 0.4, type: "square" },
    ]);
  }

  // 💀 Game Over — drama descendente
  gameOver() {
    this._seq([
      { freq: 392, dur: 0.2, delay: 0,    vol: 0.4, type: "sawtooth" },
      { freq: 349, dur: 0.2, delay: 0.22, vol: 0.4, type: "sawtooth" },
      { freq: 311, dur: 0.2, delay: 0.44, vol: 0.4, type: "sawtooth" },
      { freq: 262, dur: 0.5, delay: 0.66, vol: 0.5, type: "sawtooth" },
    ]);
  }

  // 🏆 Mundo completado — fanfarria épica
  mundoCompleto() {
    this._seq([
      { freq: 523, dur: 0.1, delay: 0,    vol: 0.35, type: "square" },
      { freq: 523, dur: 0.1, delay: 0.1,  vol: 0.35, type: "square" },
      { freq: 523, dur: 0.1, delay: 0.2,  vol: 0.35, type: "square" },
      { freq: 415, dur: 0.1, delay: 0.3,  vol: 0.3,  type: "square" },
      { freq: 523, dur: 0.3, delay: 0.4,  vol: 0.4,  type: "square" },
      { freq: 659, dur: 0.15,delay: 0.7,  vol: 0.35, type: "square" },
      { freq: 784, dur: 0.5, delay: 0.85, vol: 0.45, type: "square" },
    ]);
  }

  // ⚔️ Ataque al boss
  ataqueBoss() {
    this._seq([
      { freq: 200, dur: 0.05, delay: 0,    vol: 0.4, type: "sawtooth" },
      { freq: 150, dur: 0.15, delay: 0.05, vol: 0.5, type: "sawtooth" },
    ]);
    // impacto
    this._tone(80, 0.2, "square", 0.3, 0.1);
  }

  // 😈 Boss te ataca
  bossAtaca() {
    this._seq([
      { freq: 150, dur: 0.1,  delay: 0,    vol: 0.5, type: "sawtooth" },
      { freq: 100, dur: 0.1,  delay: 0.1,  vol: 0.5, type: "sawtooth" },
      { freq: 80,  dur: 0.25, delay: 0.2,  vol: 0.6, type: "sawtooth" },
    ]);
  }

  // 💥 Boss derrotado
  bossDerrotado() {
    this._seq([
      { freq: 300, dur: 0.1, delay: 0,    vol: 0.3, type: "sawtooth" },
      { freq: 250, dur: 0.1, delay: 0.1,  vol: 0.3, type: "sawtooth" },
      { freq: 200, dur: 0.1, delay: 0.2,  vol: 0.3, type: "sawtooth" },
      { freq: 150, dur: 0.3, delay: 0.3,  vol: 0.4, type: "sawtooth" },
      // luego fanfarria
      { freq: 523, dur: 0.15,delay: 0.7,  vol: 0.4, type: "square" },
      { freq: 659, dur: 0.15,delay: 0.85, vol: 0.4, type: "square" },
      { freq: 784, dur: 0.3, delay: 1.0,  vol: 0.5, type: "square" },
    ]);
  }

  // 🛒 Compra en tienda
  compra() {
    this._seq([
      { freq: 880, dur: 0.08, delay: 0,    vol: 0.25, type: "sine" },
      { freq: 1109,dur: 0.08, delay: 0.09, vol: 0.25, type: "sine" },
      { freq: 1319,dur: 0.15, delay: 0.18, vol: 0.3,  type: "sine" },
    ]);
  }

  // ⏱ Tiempo acabándose (llama cada segundo cuando quedan ≤5s)
  tickPeligro() {
    this._tone(880, 0.08, "square", 0.2);
  }

  // 🌟 Logro / descubrimiento
  logro() {
    this._seq([
      { freq: 784, dur: 0.1, delay: 0,   vol: 0.3, type: "sine" },
      { freq: 988, dur: 0.1, delay: 0.1, vol: 0.3, type: "sine" },
      { freq: 1175,dur: 0.2, delay: 0.2, vol: 0.4, type: "sine" },
    ]);
  }

  // ─── MÚSICA DE FONDO ───────────────────────────────────────
  // Melodía chiptune tipo aventura, generada proceduralmente
  iniciarMusica() {
    if (!this.enabled || this._musicPlaying) return;
    try {
      const ctx = this._getCtx();
      this._musicPlaying = true;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.12;
      masterGain.connect(ctx.destination);
      this.musicGain = masterGain;

      // Melodía principal en loop
      const TEMPO = 0.18; // segundos por nota
      const melody = [
        // compas 1
        659,523,587,659,  784,659,523,440,
        // compas 2
        523,440,392,440,  523,659,784,880,
        // compas 3
        784,659,523,587,  659,523,440,392,
        // compas 4
        440,523,659,784,  880,784,659,523,
      ];

      const playMelody = (startTime) => {
        melody.forEach((freq, i) => {
          if (!this._musicPlaying) return;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g);
          g.connect(masterGain);
          osc.type = "square";
          osc.frequency.value = freq;
          const t = startTime + i * TEMPO;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.6, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + TEMPO * 0.85);
          osc.start(t);
          osc.stop(t + TEMPO);
        });

        // bajo
        const bass = [130,130,165,165, 174,174,196,196, 174,174,130,130, 196,196,174,174];
        bass.forEach((freq, i) => {
          if (!this._musicPlaying) return;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g);
          g.connect(masterGain);
          osc.type = "triangle";
          osc.frequency.value = freq;
          const t = startTime + i * TEMPO * 2;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.4, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + TEMPO * 1.7);
          osc.start(t);
          osc.stop(t + TEMPO * 2);
        });
      };

      const loopDuration = melody.length * TEMPO;
      playMelody(ctx.currentTime + 0.1);

      this._musicInterval = setInterval(() => {
        if (!this._musicPlaying) { clearInterval(this._musicInterval); return; }
        playMelody(ctx.currentTime + 0.05);
      }, loopDuration * 1000);

    } catch (e) {}
  }

  detenerMusica() {
    this._musicPlaying = false;
    if (this._musicInterval) clearInterval(this._musicInterval);
    if (this.musicGain) {
      try { this.musicGain.gain.linearRampToValueAtTime(0, this._getCtx().currentTime + 0.5); } catch (e) {}
    }
  }

  // ─── MÚSICA DE BATALLA BOSS — suspense épico ───────────────
  iniciarMusicaBoss() {
    if (!this.enabled || this._bossMusicPlaying) return;
    this.detenerMusica();
    try {
      const ctx = this._getCtx();
      this._bossMusicPlaying = true;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(ctx.destination);
      this.bossMusicGain = masterGain;

      const TEMPO = 0.075; // Muy rápido — tensión máxima

      // Melodía de tensión estilo Castlevania/Final Boss
      const melody = [
        // Apertura de alarma
        440, 0, 440, 0, 415, 0, 440, 0,
        392, 0, 392, 0, 370, 0, 392, 0,
        // Escalada dramática
        349, 370, 392, 415, 440, 0, 415, 440,
        466, 0, 440, 466, 494, 0, 466, 494,
        // Clímax — notas cortas y nerviosas
        523, 494, 466, 494, 523, 0, 494, 466,
        440, 466, 440, 415, 440, 0, 415, 392,
        // Caída amenazante
        370, 0, 349, 0, 330, 0, 311, 0,
        294, 0, 277, 0, 262, 0, 247, 0,
      ];

      // Bajo pulsante (latido del corazón amenazante)
      const bass = [
        110, 0, 82, 0, 110, 0, 82, 0,
        98,  0, 73, 0, 98,  0, 73, 0,
        110, 0, 82, 0, 110, 0, 82, 0,
        87,  0, 65, 0, 87,  0, 65, 0,
      ];

      // Notas de percusión (kick drum simulado con ruido)
      const kicks = [0, 4, 8, 12, 16, 20, 24, 28];

      const playBossMusic = (startTime) => {
        melody.forEach((freq, i) => {
          if (!this._bossMusicPlaying || freq === 0) return;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(masterGain);
          osc.type = "square";
          osc.frequency.value = freq;
          const t = startTime + i * TEMPO;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.55, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.001, t + TEMPO * 0.6);
          osc.start(t); osc.stop(t + TEMPO);
        });

        bass.forEach((freq, i) => {
          if (!this._bossMusicPlaying || freq === 0) return;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(masterGain);
          osc.type = "sawtooth";
          osc.frequency.value = freq;
          const t = startTime + i * TEMPO * 2;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.45, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + TEMPO * 1.6);
          osc.start(t); osc.stop(t + TEMPO * 2);
        });

        // Kick drum: golpe grave en los tiempos fuertes
        kicks.forEach(i => {
          if (!this._bossMusicPlaying) return;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(masterGain);
          osc.type = "sine";
          const t = startTime + i * TEMPO;
          osc.frequency.setValueAtTime(120, t);
          osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
          g.gain.setValueAtTime(0.6, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.start(t); osc.stop(t + 0.12);
        });
      };

      const loopDuration = melody.length * TEMPO;
      playBossMusic(ctx.currentTime + 0.1);
      this._bossMusicInterval = setInterval(() => {
        if (!this._bossMusicPlaying) { clearInterval(this._bossMusicInterval); return; }
        playBossMusic(ctx.currentTime + 0.05);
      }, loopDuration * 1000);

    } catch (e) {}
  }

  detenerMusicaBoss() {
    this._bossMusicPlaying = false;
    if (this._bossMusicInterval) clearInterval(this._bossMusicInterval);
    if (this.bossMusicGain) {
      try { this.bossMusicGain.gain.linearRampToValueAtTime(0, this._getCtx().currentTime + 0.4); } catch (e) {}
      this.bossMusicGain = null;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.detenerMusica();
    else this.iniciarMusica();
    return this.enabled;
  }
}

const soundManager = new SoundManager();
export default soundManager;
