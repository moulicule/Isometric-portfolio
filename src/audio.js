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

  // A quiet watering trickle with soft droplets and rounded, warm edges.
  playWaterPour() {
    if (this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const duration = 0.5;
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.ceil(rate * duration), rate);
    const data = buffer.getChannelData(0);
    let smoothNoise = 0;
    for (let i = 0; i < data.length; i++) {
      const seconds = i / rate;
      const noise = Math.random() * 2 - 1;
      smoothNoise = smoothNoise * 0.88 + noise * 0.12;
      const flow = Math.min(1, seconds / 0.06) * Math.max(0, Math.min(1, (0.44 - seconds) / 0.14));
      data[i] = smoothNoise * 0.18 * flow;
    }
    for (let drop = 0; drop < 8; drop++) {
      const start = Math.floor((0.03 + drop * 0.05 + Math.random() * 0.01) * rate);
      let splash = 0;
      for (let i = start; i < Math.min(data.length, start + rate * 0.045); i++) {
        const progress = (i - start) / (rate * 0.045);
        splash = splash * 0.8 + (Math.random() * 2 - 1) * 0.2;
        data[i] += splash * Math.sin(Math.PI * progress) ** 2 * 0.22;
      }
    }
    const source = this.ctx.createBufferSource();
    const highpass = this.ctx.createBiquadFilter();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    highpass.type = 'highpass';
    highpass.Q.setValueAtTime(0.5, t);
    highpass.frequency.setValueAtTime(180, t);
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(0.5, t);
    filter.frequency.setValueAtTime(1800, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.065);
    gain.gain.setValueAtTime(0.28, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(highpass);
    highpass.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(t);
    source.stop(t + duration);
  }

  playCoffeeSip() {
    this.playCoffeeSound(false);
  }

  playCoffeePour() {
    this.playCoffeeSound(true);
  }

  playCoffeeSound(pouring) {
    if (this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const duration = pouring ? 0.85 : 0.4;
    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const ripple = Math.sin(i / this.ctx.sampleRate * (pouring ? 85 : 45));
      data[i] = (Math.random() * 2 - 1) * (0.3 + 0.7 * ripple * ripple);
    }
    const noise = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.5, t);
    filter.frequency.setValueAtTime(pouring ? 1100 : 1700, t);
    filter.frequency.exponentialRampToValueAtTime(pouring ? 650 : 800, t + duration);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(pouring ? 0.11 : 0.07, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + duration);

    // A quiet ceramic clink as the mug comes back to rest.
    [2400, 3900].forEach(frequency => {
      const osc = this.ctx.createOscillator();
      const clink = this.ctx.createGain();
      const at = t + (pouring ? 0.88 : 1.05);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, at);
      clink.gain.setValueAtTime(0.025, at);
      clink.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
      osc.connect(clink);
      clink.connect(this.ctx.destination);
      osc.start(at);
      osc.stop(at + 0.14);
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

    this.ambientGain.gain.cancelScheduledValues(this.ctx.currentTime);
    if (this.ambientPlaying) {
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
      if (!this.ambientPlaying) return;
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
