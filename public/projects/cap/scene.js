import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFace } from './cappy.js';
import { screenSurface } from './screen-surface.js';
import { PART_SLOTS, inspectionView } from './assembly-layout.js';
let modelPromise;
const partNames=['power','shell','brain','touch','power','display','shell','power','touch'];
export async function makeScene(host,{hero=false}={}) {
  const gltf=await(modelPromise??=new GLTFLoader().loadAsync(new URL('./assets/cap.glb',import.meta.url).href));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setClearColor(0,0); renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100);
  const home=hero?new THREE.Vector3(3.2,2.1,7.1):new THREE.Vector3(3.7,2.7,8.7);camera.position.copy(home);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7b2a8,2));
  for(const [color,intensity,pos] of [[0xffffff,3,[3,5,6]],[0xffffff,.6,[-4,1,2]],[0xffab70,.4,[-2,-3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);scene.add(light);}
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!reduced;controls.enableZoom=false;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=hero?15:40;controls.autoRotate=false;controls.autoRotateSpeed=.35;
  // Wheel stays with the story. Buttons and keyboard controls handle zoom.
  renderer.domElement.style.touchAction='pan-y';
  const presentation=new THREE.Group();presentation.rotation.z=-Math.PI/2+(hero?-.08:0);scene.add(presentation);
  const assembly=new THREE.Group();assembly.rotation.x=Math.PI/2;assembly.scale.setScalar(45);presentation.add(assembly);
  const source=gltf.scene.clone(true);source.updateMatrixWorld(true);
  let originalScreen;source.traverse(n=>{if(n.name==='LCd')originalScreen=n;});
  const positions=originalScreen.geometry.getAttribute('position'),screenPoints=[];
  for(let i=0;i<positions.count;i++)screenPoints.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(originalScreen.matrixWorld));
  const surface=screenSurface(screenPoints);
  const originalRoot=source.children[0];const bounds=new THREE.Box3().setFromObject(source),center=bounds.getCenter(new THREE.Vector3());
  const base=new THREE.Group();base.position.copy(center).multiplyScalar(-1);assembly.add(base);
  const parts=[];
  [...originalRoot.children].forEach((child,i)=>{
    child.updateWorldMatrix(true,true);const matrix=child.matrixWorld.clone();originalRoot.remove(child);matrix.decompose(child.position,child.quaternion,child.scale);base.add(child);
    base.updateWorldMatrix(true,true);
    const worldCenter=new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
    const pivot=base.worldToLocal(worldCenter.clone());
    const mount=new THREE.Group();mount.position.copy(pivot);base.add(mount);mount.add(child);child.position.sub(pivot);
    const destination=base.worldToLocal(new THREE.Vector3(...PART_SLOTS[i]));
    const item={object:mount,home:pivot,delta:destination.sub(pivot),kind:partNames[i],index:i};parts.push(item);
    child.traverse(node=>{if(node.isMesh){node.material=node.material.clone();if(i===1||i===6){node.material.color.set('#ff5a1f');node.material.roughness=.55;node.material.metalness=0;}node.userData.part=item;}});
  });
  // Pivot the side-mounted battery toward the inspection camera as it opens.
  for(const p of parts){p.object.position.copy(p.home).add(p.delta);if(p.index===0)p.object.rotation.z=-Math.PI/2;}
  scene.updateMatrixWorld(true);
  for(const p of parts){p.bounds=new THREE.Box3().setFromObject(p.object);p.object.position.copy(p.home);p.object.rotation.z=0;}
  // The CAD display is blank. Add a procedural Cappy face at its actual screen surface.
  const display=parts.find(p=>p.index===5);
  const faceCanvas=document.createElement('canvas');faceCanvas.width=faceCanvas.height=256;const paint=createFace(faceCanvas);paint('happy');const texture=new THREE.CanvasTexture(faceCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.CircleGeometry(surface.radius,72),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,transparent:true}));face.rotation.set(-Math.PI/2,0,Math.PI/2);face.position.set(surface.x,surface.y,surface.z);base.add(face);const faceHome=face.position.clone();
  let visible=true,exploded=0,selection='all',lastPaint=0,dirty=true;
  function invalidate(){dirty=true;}
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;},{rootMargin:'80px'});observer.observe(host);
  function moveVector(vector,target,duration=.85){
    if(window.gsap&&!reduced)window.gsap.to(vector,{x:target.x,y:target.y,z:target.z,duration,ease:'power2.inOut',overwrite:true,onUpdate:invalidate});
    else{vector.copy(target);invalidate();}
  }
  function moveCamera(kind,amount){
    const view=amount?inspectionView(parts,kind,camera.aspect,camera.fov):{position:home,target:new THREE.Vector3()};
    moveVector(camera.position,view.position);moveVector(controls.target,view.target);
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(!hero&&exploded)moveCamera(selection,exploded);invalidate();}new ResizeObserver(resize).observe(host);resize();
  function focus(kind='all',amount=kind==='all'?0:1){
    const wasExploded=exploded;selection=kind;exploded=amount;
    if(!hero&&(amount||wasExploded))moveCamera(kind,amount);
    parts.forEach(p=>{
      moveVector(p.object.position,p.home.clone().addScaledVector(p.delta,amount));
      if(p.index===0){const z=-Math.PI/2*amount;if(window.gsap&&!reduced)window.gsap.to(p.object.rotation,{z,duration:.85,ease:'power2.inOut',overwrite:true,onUpdate:invalidate});else p.object.rotation.z=z;}
      p.object.traverse(n=>{if(n.isMesh){
        const opacity=!amount||kind==='all'||p.kind===kind?1:.35;
        n.material.transparent=true;n.material.depthWrite=opacity===1;
        if(window.gsap&&!reduced)window.gsap.to(n.material,{opacity,duration:.45,overwrite:true,onUpdate:invalidate});else n.material.opacity=opacity;
      }});
    });
    moveVector(face.position,faceHome.clone().addScaledVector(display.delta,amount));
    const faceOpacity=!amount||kind==='all'||kind==='display'?1:.35;face.material.depthWrite=faceOpacity===1;
    if(window.gsap&&!reduced)window.gsap.to(face.material,{opacity:faceOpacity,duration:.45,overwrite:true,onUpdate:invalidate});else face.material.opacity=faceOpacity;
    invalidate();
  }
  function stopCameraMotion(){if(window.gsap)window.gsap.killTweensOf([camera.position,controls.target]);}
  function reset(){moveCamera('all',0);}
  function zoom(delta){stopCameraMotion();const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()+delta,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.autoRotate=false;controls.update();}
  host.addEventListener('keydown',e=>{if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?.6:-.6);return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))stopCameraMotion();const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);let changed=true;if(e.key==='ArrowLeft')s.theta-=.15;else if(e.key==='ArrowRight')s.theta+=.15;else if(e.key==='ArrowUp')s.phi=Math.max(.15,s.phi-.15);else if(e.key==='ArrowDown')s.phi=Math.min(Math.PI-.15,s.phi+.15);else if(e.key==='Home'){reset();return;}else changed=false;if(changed){e.preventDefault();controls.autoRotate=false;camera.position.setFromSpherical(s).add(controls.target);controls.update();}});
  controls.addEventListener('start',()=>{stopCameraMotion();controls.autoRotate=false;});
  controls.addEventListener('change',invalidate);
  function frame(now){
    if(!visible||document.hidden)return;
    controls.update();
    if(!reduced&&now-lastPaint>70){paint('happy',now,reduced);texture.needsUpdate=true;lastPaint=now;invalidate();}
    if(!dirty)return;
    dirty=false;renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(frame);
  controls.update();renderer.render(scene,camera);dirty=false;host.classList.add('ready');host.setAttribute('aria-busy','false');host.dataset.modelLoaded='true';return {focus,reset,zoom,get exploded(){return exploded},get selection(){return selection}};
}
