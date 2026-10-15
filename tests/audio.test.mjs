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
    state = 'running'; currentTime = 0; destination = {}; notes = 0;
    createGain() { return { gain: parameter(), connect() {} }; }
    createOscillator() { this.notes++; return { frequency: parameter(), connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { frequency: parameter(), Q: parameter(), connect() {} }; }
  }
  globalThis.window = { AudioContext };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  return { engine: new sound.constructor(), timers };
}

test('Lofi started while muted keeps its loop and becomes audible on unmute', t => {
  const { engine, timers } = audio(t);
  engine.toggleMute();
  assert.equal(engine.toggleAmbient(true), true);
  assert.equal(timers.size, 1);
  assert.equal(engine.ambientGain.gain.events.at(-1).value, 0);
  assert.equal(engine.ctx.notes, 5, 'chords are scheduled behind the muted gain');
  engine.toggleMute();
  assert.equal(engine.ambientGain.gain.events.at(-1).value, 0.12);
  for (const tick of timers.values()) tick();
  assert.equal(engine.ctx.notes, 10);
  engine.toggleAmbient(false);
  assert.equal(timers.size, 0);
});

test('mute cancels the pending fade-in, and stopping while muted stays silent', t => {
  const { engine, timers } = audio(t);
  engine.toggleAmbient(true);
  engine.toggleAmbient(true);
  assert.equal(timers.size, 1, 'enabling twice must not create a second loop');
  engine.ctx.currentTime = 0.5;
  engine.toggleMute();
  assert.ok(engine.ambientGain.gain.events.every(event => event.time < 0.5 || event.value === 0));
  for (const tick of timers.values()) tick();
  assert.equal(engine.ctx.notes, 10);
  engine.toggleAmbient(false);
  assert.equal(engine.ambientGain.gain.events.at(-1).value, 0);
  assert.equal(timers.size, 0);
});
