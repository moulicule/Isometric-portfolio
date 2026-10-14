import assert from 'node:assert/strict';
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {firstTier,nextTier,CappyEngine} from '../public/projects/cap/cappy.js';
import {proximity,returnMotion} from '../public/projects/cap/proximity.js';
import {screenSurface} from '../public/projects/cap/screen-surface.js';
const capRoot = new URL('../public/projects/cap/', import.meta.url);
assert.ok(lstatSync(capRoot).isDirectory(), 'CAP must be a real folder in this repository');
assert.equal(firstTier(-74),'curious');assert.equal(firstTier(-73),'angry');assert.equal(firstTier(-55),'rage');
assert.equal(nextTier('angry',-78),'angry');assert.equal(nextTier('angry',-79),'curious');assert.equal(nextTier('rage',-62),'rage');assert.equal(nextTier('rage',-63),'angry');assert.equal(nextTier('rage',-80),'curious');
const e=new CappyEngine(1);assert.deepEqual(e.update(true,-85,1),{emotion:'curious',buzz:'curious'});assert.equal(e.update(true,-45,500).emotion,'curious');for(let t=533;t<=1050;t+=33)e.update(true,-45,t);assert.equal(e.emotion,'rage');assert.equal(e.update(false,-45,1500).emotion,'rage');assert.equal(e.update(false,-45,2600).emotion,'happy');
e.idle(30000,3000);assert.equal(e.update(false,-85,3000).emotion,'sleepy');e.idle(60000,4000);assert.equal(e.update(false,-85,4000).emotion,'sleeping');assert.equal(e.wake(4100),true);assert.equal(e.update(true,-45,11599).emotion,'dazed');assert.equal(e.update(false,-45,11600).emotion,'happy');assert.equal(e.wake(11601),false);
for(const page of ['index.html','journal.html']){const html=readFileSync(new URL(page,capRoot),'utf8');for(const m of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)){const file=m[1].split('#')[0];if(!/^(https?:|data:)/.test(file))assert.ok(existsSync(new URL(file,capRoot)),`${page}: missing ${file}`);}for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${m[1]}"`),`Missing anchor ${m[1]}`);}
const firmware=readFileSync(new URL('assets/firmware/main.cpp',capRoot),'utf8');for(const value of ['-55','-62','-73','-78','30000','60000','7500'])assert.ok(firmware.includes(value));
console.log('PASS: hysteresis, debounce, signal timeout, sleep/wake timing, local links and anchors.');

assert.deepEqual(proximity(100,100),{metres:5,rssi:-85,active:false});
assert.deepEqual(proximity(0,100),{metres:.25,rssi:-45,active:true});
assert.equal(proximity(200,100).metres,5);assert.ok(Number.isFinite(proximity(0,0).rssi));
const short=returnMotion(10,100),long=returnMotion(100,100);
assert.ok(100/long.duration>10/short.duration);assert.ok(long.amplitude>short.amplitude);assert.ok(long.period<short.period);
const interactive=new CappyEngine(1);interactive.update(true,-85,1,true);assert.equal(interactive.update(true,-45,2,true).emotion,'rage');assert.equal(interactive.update(true,-85,3,true).emotion,'curious');
const surface=screenSurface([{x:-1,y:2,z:0},{x:1,y:2,z:0},{x:0,y:2,z:-1},{x:0,y:2,z:1},{x:5,y:1,z:0}]);
assert.equal(surface.x,0);assert.equal(surface.z,0);assert.equal(surface.radius,1);assert.ok(surface.y>2);
console.log('PASS: emulated distance endpoints, spring speed/bounce, immediate drag reactions, and circular-screen alignment.');
