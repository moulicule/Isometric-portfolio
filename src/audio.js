// Web Audio API procedural sound engine - 100% offline, zero external dependencies

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.ambientPlaying = false;
    this.ambientGain = null;
    this.ambientInterval = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.ambientGain) this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } else {
      if (this.ambientGain && this.ambientPlaying) {
        this.ambientGain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.5);
      }
    }
    return this.isMuted;
  }

  // Crisp lamp switch / click
  playSwitch(isOn = true) {
    if (this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isOn ? 800 : 650, t);
    osc.frequency.exponentialRampToValueAtTime(isOn ? 1200 : 400, t + 0.04);
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);

    // Subtle snap noise
    const bufferSize = this.ctx.sampleRate * 0.02;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    noise.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
  }

  // Soft UI hover / pop
  playPop(pitch = 1) {
    if (this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    const baseFreq = 420 * pitch;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.06);
    
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Chair swivel whoosh
  playWhoosh() {
    if (this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(90, t + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.2);
    filter.frequency.exponentialRampToValueAtTime(150, t + 0.5);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.52);
  }

  // Plant water sprinkle shimmer
  playWaterChime() {
    if (this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C E G C E pentatonic shimmer
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = t + idx * 0.06;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.1, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.45);
    });
  }

  // Procedural cozy Lofi chords
  toggleAmbient(enable = null) {
    this.init();
    const shouldPlay = enable !== null ? enable : !this.ambientPlaying;
    if (shouldPlay === this.ambientPlaying) return this.ambientPlaying;
    this.ambientPlaying = shouldPlay;

    if (!this.ambientGain) {
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.connect(this.ctx.destination);
    }

    if (this.ambientPlaying && !this.isMuted) {
      this.ambientGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 1);
      this.startLofiLoop();
    } else {
      if (this.ambientGain) {
        this.ambientGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      }
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    return this.ambientPlaying;
  }

  startLofiLoop() {
    clearInterval(this.ambientInterval);
    // Smooth neo-soul / lofi chords: Dm9 -> G13 -> Cmaj9 -> Am7
    const chords = [
      [146.83, 220.00, 261.63, 329.63, 392.00], // D F A C E
      [196.00, 246.94, 293.66, 329.63, 440.00], // G B D E A
      [130.81, 196.00, 246.94, 293.66, 329.63], // C G B D E
      [220.00, 261.63, 329.63, 392.00, 493.88]  // A C E G B
    ];
    let chordIdx = 0;

    const playChord = () => {
      if (!this.ambientPlaying || this.isMuted) return;
      const t = this.ctx.currentTime;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const noteGain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.04);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, t);
        filter.Q.setValueAtTime(2, t);

        noteGain.gain.setValueAtTime(0.001, t + i * 0.04);
        noteGain.gain.linearRampToValueAtTime(0.05, t + i * 0.04 + 0.4);
        noteGain.gain.exponentialRampToValueAtTime(0.001, t + 3.8);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.ambientGain);

        osc.start(t + i * 0.04);
        osc.stop(t + 4.0);
      });
    };

    playChord();
    this.ambientInterval = setInterval(playChord, 3800);
  }
}

export const sound = new SoundEngine();
