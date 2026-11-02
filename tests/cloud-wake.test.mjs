import test from 'node:test';
import assert from 'node:assert/strict';
import { setupCloudWake } from '../src/cloud-wake.js';

test('hover leaves a cooling trail and clicks send a ring through the cloud', t => {
  let nextFrame;
  const events = {}, frameOperations = [];
  const svg = {
    setAttribute() {}, replaceChildren(...rows) { this.rows = rows; },
    getBoundingClientRect() {
      frameOperations.push('read');
      return { left: 0, right: 240, top: 0, bottom: 128, width: 240, height: 128 };
    }
  };
  const container = {
    querySelector: () => ({ isPointInFill: p => p.x >= 18 && p.x <= 200 && p.y >= 6 && p.y <= 94 }),
    querySelectorAll: () => [svg, ...[300, 600].map(left => ({
      setAttribute() {}, replaceChildren() {},
      getBoundingClientRect() {
        frameOperations.push('read');
        return { left, right: left + 240, top: 0, bottom: 128, width: 240, height: 128 };
      }
    }))]
  };
  const media = { matches: false, addEventListener() {} };
  const globals = {
    window: { addEventListener(name, fn) { events[name] = fn; } },
    document: { addEventListener() {}, createElementNS() {
      let text;
      return {
        setAttribute() {},
        get textContent() { return text; },
        set textContent(value) { frameOperations.push('write'); text = value; }
      };
    } },
    DOMPoint: class { constructor(x, y) { this.x = x; this.y = y; } },
    requestAnimationFrame: fn => { nextFrame = fn; return 1; },
    cancelAnimationFrame: () => {}, performance: { now: () => 2000 }
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }

  const ripple = setupCloudWake(container, media);
  const row = () => svg.rows[3].textContent;
  const rest = row();
  events.pointermove({ target: { id: 'canvas3d' }, pointerType: 'mouse', clientX: 39, clientY: 30 });
  frameOperations.length = 0;
  nextFrame(400);
  assert.deepEqual(frameOperations.slice(0, 3), ['read', 'read', 'read']);
  assert.ok(frameOperations.slice(3).length > 0);
  assert.ok(frameOperations.slice(3).every(operation => operation === 'write'), 'all bounds are read before changing SVG text');
  assert.equal(row()[5], '@');
  events.pointermove({ target: { id: 'canvas3d' }, pointerType: 'mouse', clientX: 123, clientY: 30 });
  nextFrame(416);
  assert.equal(row()[11], '@', 'fast strokes fill the gap between pointer samples');
  events.pointerout({ relatedTarget: null });
  nextFrame(1016);
  assert.equal(row()[11], '=');
  nextFrame(1700);
  assert.equal(row(), rest);

  ripple({ clientX: 39, clientY: 30 });
  nextFrame(2001);
  assert.equal(row()[5], '@');
  nextFrame(2255);
  assert.equal(row()[5], '•');
  assert.equal(row()[13], '@', 'the wavefront reaches a point 56 units away');
  nextFrame(3500);
  assert.equal(row(), rest);
  nextFrame = null;
  ripple({ clientX: 0, clientY: 0 });
  media.matches = true;
  ripple({ clientX: 39, clientY: 30 });
  assert.equal(nextFrame, null, 'empty sky and reduced motion do not start rings');
});
