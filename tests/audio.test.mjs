import test from 'node:test';
import assert from 'node:assert/strict';
import { sound } from '../src/audio.js';

function audio(t) {
  const timers = new Map();
  let nextTimer = 0;
  t.mock.method(globalThis, 'setInterval', callback => { timers.set(++nextTimer, callback); return nextTimer; });
  t.mock.method(globalThis, 'clearInterval', id => timers.delete(id));
  const previousWindow = globalThis.window;
  const parameter = () => ({
    events: [],
    setValueAtTime(value, time) { this.events.push({ type: 'set', value, time }); },
    linearRampToValueAtTime(value, time) { this.events.push({ type: 'ramp', value, time }); },
    exponentialRampToValueAtTime() {}, setTargetAtTime(value, time) { this.setValueAtTime(value, time); },
    cancelScheduledValues(time) { this.events = this.events.filter(event => event.time < time); }
  });
  class AudioContext {
    state = 'running'; currentTime = 0; destination = {}; notes = 0; sampleRate = 8000; sources = [];
    createGain() { return { gain: parameter(), connect() {} }; }
    createOscillator() { this.notes++; return { frequency: parameter(), connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { frequency: parameter(), Q: parameter(), connect() {} }; }
    createBuffer(channels, length) {
      const samples = new Float32Array(length);
      return { getChannelData: () => samples };
    }
    createBufferSource() {
      const source = { connect() {}, start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; } };
      this.sources.push(source);
      return source;
    }
  }
  globalThis.window = { AudioContext };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  return { engine: new sound.constructor(), timers };
}

test('Lofi started while effects are muted is audible and keeps its loop', t => {
  const { engine, timers } = audio(t);
  engine.toggleMute();
  assert.equal(engine.toggleAmbient(true), true);
  assert.equal(timers.size, 1);
  assert.equal(engine.ambientGain.gain.events.at(-1).value, 0.12);
  assert.equal(engine.ctx.notes, 5);
  const fade = structuredClone(engine.ambientGain.gain.events);
  engine.toggleMute();
  assert.deepEqual(engine.ambientGain.gain.events, fade);
  for (const tick of timers.values()) tick();
  assert.equal(engine.ctx.notes, 10);
  engine.toggleAmbient(false);
  assert.equal(timers.size, 0);
});

test('muting effects preserves the lofi fade and its control still stops playback', t => {
  const { engine, timers } = audio(t);
  engine.toggleAmbient(true);
  engine.toggleAmbient(true);
  assert.equal(timers.size, 1, 'enabling twice must not create a second loop');
  const fade = structuredClone(engine.ambientGain.gain.events);
  engine.ctx.currentTime = 0.5;
  engine.toggleMute();
  assert.deepEqual(engine.ambientGain.gain.events, fade);
  for (const tick of timers.values()) tick();
  assert.equal(engine.ctx.notes, 10);
  engine.toggleAmbient(false);
  assert.deepEqual(engine.ambientGain.gain.events.at(-1), { type: 'ramp', value: 0.001, time: 1 });
  assert.equal(timers.size, 0);
  engine.toggleMute();
  assert.equal(timers.size, 0, 'unmuting effects must not restart lofi');
});

test('mute suppresses every sound effect and unmute restores effects', t => {
  const { engine } = audio(t);
  assert.equal(engine.toggleMute(), true);
  engine.playSwitch();
  engine.playPop();
  engine.playWhoosh();
  engine.playWaterPour();
  engine.playCoffeeSip();
  engine.playCoffeePour();
  assert.equal(engine.ctx, null, 'muted effects must not create audio sources');
  assert.equal(engine.toggleMute(), false);
  engine.playPop();
  assert.equal(engine.ctx.notes, 1);
});

test('coffee sip and refill are finite local sounds and leave lofi gain alone', t => {
  const { engine, timers } = audio(t);
  engine.toggleAmbient(true);
  const fade = structuredClone(engine.ambientGain.gain.events);
  engine.playCoffeeSip();
  assert.equal(engine.ctx.sources.length, 1);
  assert.equal(engine.ctx.sources[0].stoppedAt, 0.4);
  engine.ctx.currentTime = 2;
  engine.playCoffeePour();
  assert.equal(engine.ctx.sources.length, 2);
  assert.equal(engine.ctx.sources[1].stoppedAt, 2.85);
  assert.equal(engine.ctx.notes, 9, 'each coffee sound adds two ceramic harmonics');
  assert.deepEqual(engine.ambientGain.gain.events, fade);
  assert.equal(timers.size, 1);
});

test('watering is a short, softly fading trickle without musical notes or lofi changes', t => {
  const { engine } = audio(t);
  engine.toggleAmbient(true);
  const fade = structuredClone(engine.ambientGain.gain.events);
  engine.playWaterPour();
  assert.equal(engine.ctx.notes, 5, 'watering does not add pitched chime oscillators');
  assert.equal(engine.ctx.sources.length, 1);
  const stream = engine.ctx.sources[0];
  assert.equal(stream.startedAt, 0);
  assert.equal(stream.stoppedAt, 0.5);
  const samples = stream.buffer.getChannelData(0);
  assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  assert.ok(samples.some(value => Math.abs(value) > 0.05));
  assert.ok(samples.slice(-300).every(value => value === 0), 'the trickle ends cleanly without a long bubbling tail');
  assert.deepEqual(engine.ambientGain.gain.events, fade);
});
