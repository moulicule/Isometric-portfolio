const TRAIL_MS = 1200;
const REACH = 41;
const GLYPHS = '•.:-=+*#@';

export function setupCloudWake(container, reducedMotion) {
  const shape = container.querySelector('#skyCloudShape');
  if (!shape?.isPointInFill) return;

  // Use one text node per row so a moving wake only repaints changed strings.
  const layout = [];
  for (let y = 6; y < 110; y += 8) {
    const points = [];
    for (let x = 4; x < 240; x += 7) {
      points.push(shape.isPointInFill(new DOMPoint(x, y)) ? x : null);
    }
    if (points.some(x => x !== null)) layout.push({ y, points });
  }
  if (!layout.length) return;

  const clouds = Array.from(container.querySelectorAll('.sky-cloud'), svg => {
    const rows = layout.map(({ y, points }) => {
      const text = document.createElementNS(svg.namespaceURI, 'text');
      text.setAttribute('x', '0.5');
      text.setAttribute('y', y);
      text.setAttribute('textLength', points.length * 7);
      text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      const rest = points.map(x => x === null ? ' ' : GLYPHS[0]).join('');
      text.textContent = rest;
      return { text, rest, y, points, expires: new Float64Array(points.length) };
    });
    svg.setAttribute('fill', 'url(#cloudGrain)');
    svg.replaceChildren(...rows.map(row => row.text));
    return { svg, rows, ring: null, cooling: false };
  });

  let pointer = null, previous = null, frame = 0;

  function render(now) {
    frame = 0;
    let active = false;
    const boxes = clouds.map(cloud => cloud.svg.getBoundingClientRect());
    for (const [index, cloud] of clouds.entries()) {
      const box = boxes[index];
      const scale = box.width / 240;
      const near = pointer && scale && pointer.x >= box.left - REACH * scale && pointer.x <= box.right + REACH * scale
        && pointer.y >= box.top - REACH * scale && pointer.y <= box.bottom + REACH * scale;
      if (!near && !cloud.ring && !cloud.cooling) continue;
      // Sample the segment between frames so quick sweeps leave a continuous trail.
      const from = previous || pointer;
      const dx = near ? pointer.x - from.x : 0, dy = near ? pointer.y - from.y : 0;
      const lengthSquared = dx * dx + dy * dy || 1;
      const ring = cloud.ring;
      const radius = ring ? (now - ring.start) * 0.22 : 0;
      if (radius > 280) cloud.ring = null;
      cloud.cooling = false;
      for (const row of cloud.rows) {
        let line = '';
        for (const [i, x] of row.points.entries()) {
          if (x === null) { line += ' '; continue; }
          if (near) {
            const px = box.left + x * scale, py = box.top + row.y * scale;
            const t = Math.max(0, Math.min(1, ((px - from.x) * dx + (py - from.y) * dy) / lengthSquared));
            const distance = Math.hypot(px - from.x - t * dx, py - from.y - t * dy) / scale;
            if (distance < REACH) row.expires[i] = Math.max(row.expires[i], now + TRAIL_MS * (1 - distance / REACH));
          }
          const trail = Math.max(0, (row.expires[i] - now) / TRAIL_MS);
          const wave = cloud.ring ? Math.max(0, 1 - Math.abs(Math.hypot(x - ring.x, row.y - ring.y) - radius) / 14) : 0;
          const level = Math.max(trail, wave);
          line += GLYPHS[Math.min(GLYPHS.length - 1, Math.ceil(level * (GLYPHS.length - 1)))];
          if (trail > 0) cloud.cooling = true;
        }
        if (row.text.textContent !== line) row.text.textContent = line;
      }
      active ||= near || cloud.cooling || !!cloud.ring;
    }
    previous = pointer;
    if (active) schedule();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  const leave = () => { pointer = previous = null; };
  window.addEventListener('pointermove', e => {
    if (reducedMotion.matches || document.hidden || e.buttons || e.pointerType === 'touch'
      || (e.target.id !== 'app' && e.target.id !== 'canvas3d')) { leave(); return; }
    pointer = { x: e.clientX, y: e.clientY };
    schedule();
  }, { passive: true });
  window.addEventListener('pointerdown', leave, { passive: true });
  window.addEventListener('pointerout', e => { if (!e.relatedTarget) leave(); });
  window.addEventListener('blur', leave);

  function ripple(e) {
    if (reducedMotion.matches || document.hidden) return;
    for (const cloud of clouds) {
      const box = cloud.svg.getBoundingClientRect();
      if (!box.width || e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) continue;
      const x = (e.clientX - box.left) * 240 / box.width;
      const y = (e.clientY - box.top) * 128 / box.height;
      if (shape.isPointInFill(new DOMPoint(x, y))) {
        cloud.ring = { x, y, start: performance.now() };
        schedule();
      }
    }
  }
  // Before entry the empty sky targets #app. Inside the room its tap handler
  // calls ripple after excluding drags, multi-touch gestures, and hotspot hits.
  window.addEventListener('click', e => { if (e.target.id === 'app' && e.button === 0) ripple(e); });
  function reset() {
    leave();
    cancelAnimationFrame(frame);
    frame = 0;
    for (const cloud of clouds) {
      cloud.ring = null;
      cloud.cooling = false;
      for (const row of cloud.rows) {
        row.expires.fill(0);
        row.text.textContent = row.rest;
      }
    }
  }
  reducedMotion.addEventListener('change', reset);
  document.addEventListener('visibilitychange', reset);
  return ripple;
}
