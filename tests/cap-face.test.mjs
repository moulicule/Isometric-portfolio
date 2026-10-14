import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFace } from '../public/projects/cap/cappy.js';

function draw(emotion, now = 0, reduced = true, gaze) {
  const eyes = [], zs = [];
  const context = {
    setTransform() {}, fillRect() {}, save() {}, restore() {}, beginPath() {},
    roundRect() {}, fill() {},
    translate(x, y) { eyes.push({ x, y }); },
    rotate(angle) { eyes.at(-1).angle = angle; },
    moveTo(x, y) { zs.push({ points: [{ x, y }], color: this.strokeStyle }); },
    lineTo(x, y) { zs.at(-1).points.push({ x, y }); },
    stroke() {}
  };
  const paint = createFace({ width: 240, getContext: () => context });
  paint(emotion, now, reduced, gaze);
  return { eyes, zs };
}

test('happy eyes are above the face center in the shared playground and 3D painter', () => {
  const { eyes } = draw('happy');
  assert.equal(eyes.length, 2);
  assert.ok(eyes.every(eye => eye.y < 120));
  assert.ok(eyes[0].x < eyes[1].x);
});

test('awake eyes follow the cursor together with bounded movement; resting eyes stay centered', () => {
  for (const emotion of ['happy', 'curious', 'angry', 'rage', 'dazed']) {
    const centered=draw(emotion).eyes;
    const right=draw(emotion,0,true,{x:10,y:-10}).eyes;
    const left=draw(emotion,0,true,{x:-10,y:10}).eyes;
    centered.forEach((eye,i)=>{
      assert.equal(right[i].x-eye.x,12);
      assert.equal(right[i].y-eye.y,-8);
      assert.equal(left[i].x-eye.x,-12);
      assert.equal(left[i].y-eye.y,8);
      assert.equal(right[i].angle,eye.angle);
    });
  }
  for(const emotion of ['sleepy','sleeping']){
    assert.deepEqual(draw(emotion,0,true,{x:1,y:1}),draw(emotion));
  }
  const midway=draw('happy',0,false,{x:1,y:1}).eyes;
  assert.ok(midway[0].x>84 && midway[0].x<96,'Normal motion eases toward the pointer');
});

test('resting lids sit below center and sleeping letters remain above the eyes', () => {
  for (const emotion of ['sleepy', 'sleeping']) {
    const { eyes, zs } = draw(emotion);
    assert.ok(eyes.every(eye => eye.y > 120));
    assert.ok(eyes[0].x < eyes[1].x);
    assert.ok(zs.every(z => z.points.every(point => point.y < eyes[0].y)));
  }
  assert.equal(draw('sleeping').zs.length, 3);
  assert.equal(draw('sleepy').zs.length, 0);
});

test('sleep Zs use three staggered vector letters that rise, fade, and repeat after 2.6 seconds', () => {
  const start = draw('sleeping', 430, false).zs;
  const later = draw('sleeping', 530, false).zs;
  assert.equal(start.length, 3);
  assert.deepEqual(start, draw('sleeping', 3030, false).zs);
  start.forEach((z, i) => {
    assert.equal(z.points.length, 4);
    assert.ok(z.points.every(point => point.x < 120));
    assert.ok(later[i].points[0].y < z.points[0].y);
    assert.ok(z.points[1].x > z.points[0].x && z.points[2].x < z.points[1].x);
  });
  assert.notEqual(start[0].color, later[0].color);
  assert.deepEqual(draw('sleeping', 430).zs, draw('sleeping', 530).zs, 'Reduced motion freezes the letters');
});

test('curious, angry, and rage keep their existing eye positions and slopes', () => {
  for (const [emotion, expected] of [
    ['curious', [[124, 144, -30], [172, 152, -30]]],
    ['angry', [[82, 126, 45], [158, 126, -45]]],
    ['rage', [[85, 122, 40], [155, 122, -40]]]
  ]) {
    const { eyes } = draw(emotion);
    eyes.forEach((eye, i) => {
      assert.equal(eye.x, expected[i][0]);
      assert.equal(eye.y, expected[i][1]);
      assert.equal(eye.angle, -expected[i][2] * Math.PI / 180);
    });
  }
});
