import { CappyEngine, createFace, HAPTICS } from './cappy.js';
import './journal.js';
import { proximity, returnMotion } from './proximity.js';
const $=s=>document.querySelector(s), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const labels={happy:['Happy','The coast is clear. Looking around.'],curious:['Curious','A matching signal nearby. One short vibration.'],angry:['Angry','The glasses are getting close. Two vibrations.'],rage:['Rage','Right in your personal space. Three vibrations.'],sleepy:['Sleepy','30 seconds of quiet. Time for a nap.'],sleeping:['Sleeping','zzZ… Knock twice to wake Cappy.'],dazed:['Waking up','A little groggy. Back in 7.5 seconds.']};
const engine=new CappyEngine(performance.now()),paint=createFace($('#cappy-face'));
for(const canvas of document.querySelectorAll('.state-icon canvas'))createFace(canvas)(canvas.dataset.emotion,0,true);
let lastEmotion='',lastStep=0,hapticEnd=0,hapticStart=0,hapticPattern=null;
const glasses=$('#glasses'),playground=$('#proximity-playground');
const cappy=$('#cappy-tap'),buzzFeedback=$('#buzz-feedback');
let hapticMotion,tapMotion;
function showBuzz(buzz){
 buzzFeedback.textContent={curious:'Bzz',angry:'Bzz Bzz',rage:'Bzz Bzz Bzz'}[buzz];
 buzzFeedback.classList.add('active');
 if(reduced||!window.gsap)return;
 hapticMotion?.kill();gsap.set(cappy,{x:0,rotation:0});
 const strength={curious:2,angry:3,rage:4}[buzz];
 hapticMotion=gsap.timeline({defaults:{ease:'none'}});
 HAPTICS[buzz].forEach((ms,i)=>{
  if(i%2)hapticMotion.to(cappy,{x:0,rotation:0,duration:ms/1000});
  else hapticMotion.to(cappy,{x:strength,rotation:.7,duration:ms/4000})
   .to(cappy,{x:-strength,rotation:-.7,duration:ms/2000})
   .to(cappy,{x:0,rotation:0,duration:ms/4000});
 });
}
const position={x:0,y:0},home={x:0,y:0},device={x:0,y:0};
let homeSeparation=1,drag=null,returnTween,geometryReady=false;
function currentProximity(){return proximity(Math.hypot(position.x-device.x,position.y-device.y),homeSeparation);}
function renderGlasses(){
 const rotation=(home.x-position.x)/homeSeparation*-8;
 const x=position.x-glasses.offsetWidth/2,y=position.y-glasses.offsetHeight/2;
 if(window.gsap)gsap.set(glasses,{x,y,rotation});else glasses.style.transform=`translate(${x}px,${y}px) rotate(${rotation}deg)`;
 const {metres,active}=currentProximity();
 $('#distance-value').innerHTML=active?`${metres.toFixed(1)} <small>m</small>`:'Far';
 glasses.setAttribute('aria-valuenow',metres.toFixed(2));glasses.setAttribute('aria-valuetext',active?`${metres.toFixed(1)} emulated metres away`:'Far from Cappy');
}
function measure(){
 returnTween?.kill();drag=null;glasses.classList.remove('dragging');
 const board=playground.getBoundingClientRect(),cap=$('.sim-anchor').getBoundingClientRect();
 device.x=cap.x+cap.width/2-board.x;device.y=cap.y+cap.height/2-board.y;
 home.x=playground.clientWidth-glasses.offsetWidth/2-28;home.y=playground.clientHeight*.42;
 homeSeparation=Math.hypot(home.x-device.x,home.y-device.y);position.x=home.x;position.y=home.y;geometryReady=true;
 const marker=$('.glasses-home');marker.style.left=`${home.x}px`;marker.style.top=`${home.y}px`;renderGlasses();
}
function springHome(){
 drag=null;glasses.classList.remove('dragging');glasses.querySelector('span').textContent='DRAG ME';
 const motion=returnMotion(Math.hypot(position.x-home.x,position.y-home.y),homeSeparation);
 returnTween?.kill();
 if(reduced||!window.gsap){position.x=home.x;position.y=home.y;renderGlasses();engine.idle(0,performance.now());return;}
 returnTween=gsap.to(position,{x:home.x,y:home.y,duration:motion.duration,ease:`elastic.out(${motion.amplitude},${motion.period})`,overwrite:true,onUpdate:renderGlasses,onComplete:()=>engine.idle(0,performance.now())});
}
function constrain(x,y){position.x=Math.max(glasses.offsetWidth/2+8,Math.min(playground.clientWidth-glasses.offsetWidth/2-8,x));position.y=Math.max(glasses.offsetHeight/2+8,Math.min(playground.clientHeight-glasses.offsetHeight/2-8,y));renderGlasses();}
glasses.addEventListener('pointerdown',e=>{
 if(!e.isPrimary||e.button!==0)return;e.preventDefault();returnTween?.kill();
 const rect=playground.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-rect.x-position.x,dy:e.clientY-rect.y-position.y};
 glasses.setPointerCapture(e.pointerId);glasses.classList.add('dragging');glasses.querySelector('span').textContent='LET GO';
});
glasses.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const rect=playground.getBoundingClientRect();constrain(e.clientX-rect.x-drag.dx,e.clientY-rect.y-drag.dy);});
function release(e){if(!drag||e.pointerId!==drag.id)return;glasses.releasePointerCapture(e.pointerId);springHome();}
glasses.addEventListener('pointerup',release);glasses.addEventListener('pointercancel',release);glasses.addEventListener('lostpointercapture',()=>{if(drag)springHome();});
glasses.addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Escape'].includes(e.key))return;e.preventDefault();returnTween?.kill();
 if(e.key==='Home'||e.key==='Escape'){springHome();return;}
 const step=homeSeparation*.08;constrain(position.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),position.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));
});
glasses.addEventListener('keyup',e=>{if(e.key.startsWith('Arrow'))springHome();});glasses.addEventListener('blur',()=>{if(!drag)springHome();});
new ResizeObserver(measure).observe(playground);measure();
for(const [id,ms] of [['sleepy',30000],['sleep',60000]])$('#'+id).addEventListener('click',()=>{returnTween?.kill();position.x=home.x;position.y=home.y;renderGlasses();engine.idle(ms,performance.now());});
function wake(){const woke=engine.wake(performance.now());$('#wake-note').textContent=woke?'Double knock received. Cappy is waking up.':'Cappy is already awake.';}
$('#wake').addEventListener('click',wake);
// Two quick clicks/taps on the face are equivalent to the accessible wake button.
let lastTap=-Infinity;cappy.addEventListener('click',()=>{
 if(!reduced&&window.gsap){tapMotion?.kill();tapMotion=gsap.fromTo(cappy,{scale:.94},{scale:1,duration:.28,ease:'back.out(2)',overwrite:'auto'});}
 const now=performance.now();if(now-lastTap<400){wake();lastTap=-Infinity;}else lastTap=now;
});
let visible=true;new IntersectionObserver(([e])=>visible=e.isIntersecting).observe($('#play'));
const gaze={x:0,y:0};
document.addEventListener('pointermove',e=>{
 if(e.pointerType!=='mouse'||!visible)return;
 const rect=$('#cappy-face').getBoundingClientRect();
 gaze.x=(e.clientX-rect.left-rect.width/2)/Math.max(1,rect.width/2);
 gaze.y=(e.clientY-rect.top-rect.height/2)/Math.max(1,rect.height/2);
});
function clearGaze(){gaze.x=gaze.y=0;}
document.addEventListener('pointerleave',clearGaze);addEventListener('blur',clearGaze);
function frame(now){requestAnimationFrame(frame);if(document.hidden||now-lastStep<33)return;lastStep=now;
 const simulated=currentProximity();
 const {emotion,buzz}=engine.update(geometryReady&&simulated.active,simulated.rssi,now,true);
 if(emotion!==lastEmotion){lastEmotion=emotion;$('#emotion-label').textContent=labels[emotion][0];$('#emotion-detail').textContent=labels[emotion][1];$('#cappy-face').setAttribute('aria-label',`Cappy is ${labels[emotion][0].toLowerCase()}`);$('#wake-note').textContent=['sleepy','sleeping'].includes(emotion)?'Double-knock on Cappy, or use the button above to wake him up.':emotion==='dazed'?'Cappy is waking up.':'Cappy is already awake.';}
 if(buzz){hapticPattern=HAPTICS[buzz];hapticStart=now;hapticEnd=now+hapticPattern.reduce((a,b)=>a+b,0);$('#haptic-label').textContent={curious:'One vibration',angry:'Two vibrations',rage:'Three vibrations'}[buzz];showBuzz(buzz);}
 const elapsed=now-hapticStart;
 document.querySelectorAll('#haptic-bars i').forEach((bar,i)=>{const offset=hapticPattern?hapticPattern.slice(0,i*2).reduce((a,b)=>a+b,0):0;const length=hapticPattern?.[i*2]||0;bar.classList.toggle('on',now<hapticEnd&&elapsed>=offset&&elapsed<offset+length);});
 if(now>=hapticEnd)$('#haptic-label').textContent='Quiet';
 if(now>=hapticEnd+450)buzzFeedback.classList.remove('active');
 if(visible)paint(emotion,now,reduced,gaze);
}paint('happy');requestAnimationFrame(frame);
const info={all:'Complete CAP 2.0 assembly—3D-printed squircle shell, round TFT screen, ESP32-S3-Zero, sensors, and battery.',shell:'My snap-fit, two-piece printed shell supports the screen and leaves room for the on/off switch and USB-C port.',display:'Cappy lives on CAP’s 1.28-inch GC9A01 TFT screen: 240 × 240 pixels, with his eyes animated at around 30fps using LovyanGFX.',brain:'The ESP32-S3-Zero scans BLE advertisements with NimBLE and turns smoothed signal strength into Cappy’s reactions.',touch:'The ADXL345 listens for a double-knock. A MOSFET-driven motor gives alerts you can feel without checking the screen.',power:'A 3.7V LiPo battery and TP4056 USB-C charging circuit power CAP, with a physical on/off switch.'};
let hero,bench,manualView=null,activePart='shell';
$('#hero-zoom-out').addEventListener('click',()=>hero?.zoom(.6));
$('#hero-zoom-in').addEventListener('click',()=>hero?.zoom(-.6));
function describePart(part){
 const element=$('#part-info'),text=info[part];
 if(window.gsap)gsap.killTweensOf(element);
 if(element.textContent===text||reduced||!window.gsap){
  element.textContent=text;
  if(window.gsap)gsap.set(element,{opacity:1,y:0});
  return;
 }
 gsap.to(element,{opacity:0,y:4,duration:.12,overwrite:true,onComplete:()=>{
  element.textContent=text;
  gsap.to(element,{opacity:1,y:0,duration:.22,overwrite:true});
 }});
}
function setBench(){
 const amount=manualView??Number(activePart!=='shell'),button=$('#explode');
 describePart(activePart);
 $('#assembly-status').textContent=assemblySteps.find(step=>step.dataset.part===activePart).dataset.step;
 button.setAttribute('aria-pressed',String(amount>0));
 const label=amount?'Switch to assembled view':'Switch to exploded view';
 button.setAttribute('aria-label',label);button.title=label;
 button.querySelector('span').textContent=amount?'↙':'↗';
 bench?.focus(activePart,amount);
}
$('#explode').addEventListener('click',()=>{manualView=bench.exploded?0:1;setBench();});
function chapter(step){activePart=step.dataset.part;setBench();}
const assemblySteps=[...document.querySelectorAll('.assembly-step')];
function syncChapter(){
 const marker=innerHeight*(innerWidth<701 ? .82 : .65);
 const step=assemblySteps.filter(step=>step.getBoundingClientRect().top<=marker).at(-1)||assemblySteps[0];
 if(step.dataset.part!==activePart)chapter(step);
}
let sceneModule;
function fail(host,error){console.error('CAP model unavailable:',error);host.classList.add('failed');host.setAttribute('aria-busy','false');host.querySelector('.model-loading p').textContent='3D view unavailable. Here’s my project photo instead.';}
async function loadViewer(host){
 try{
  const {makeScene}=await(sceneModule??=import('./scene.js?v=4'));
  const isHero=host.id==='hero-viewer';
  const scene=await makeScene(host,{hero:isHero});
  if(isHero){hero=scene;$('#hero-zoom-out').disabled=false;$('#hero-zoom-in').disabled=false;}
  else{bench=scene;$('#explode').disabled=false;setBench();}
 }catch(error){fail(host,error);}
}
const pendingViewers=new Set([$('#hero-viewer'),$('#bench-viewer')]);
const viewerObserver=new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(!entry.isIntersecting||!pendingViewers.delete(entry.target))continue;
  viewerObserver.unobserve(entry.target);
  loadViewer(entry.target);
 }
},{rootMargin:'200px'});
for(const host of pendingViewers)viewerObserver.observe(host);
if(window.gsap&&window.ScrollTrigger){gsap.registerPlugin(ScrollTrigger);
 assemblySteps.forEach(step=>ScrollTrigger.create({trigger:step,start:()=>innerWidth<701?'top 82%':'top 65%',end:'bottom 30%',onEnter:syncChapter,onLeaveBack:syncChapter,onUpdate:syncChapter,onRefresh:syncChapter}));
 gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{document.querySelectorAll('.idea-grid h2,.play-heading h2,.field-heading h2,.field-copy h2,.build-banner h2').forEach(el=>gsap.from(el,{y:25,opacity:.45,duration:.8,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 90%',once:true}}));});
 addEventListener('load',()=>ScrollTrigger.refresh());
}else{const observer=new IntersectionObserver(syncChapter,{threshold:.4});assemblySteps.forEach(s=>observer.observe(s));}
