import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFace } from './cappy.js';
import { screenSurface } from './screen-surface.js';
const modelPromise = new GLTFLoader().loadAsync(new URL('./assets/cap.glb',import.meta.url).href);
const partNames=['power','shell','brain','touch','power','display','shell','power','touch'];
export async function makeScene(host,{hero=false}={}) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setClearColor(0,0); renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100);
  const home=hero?new THREE.Vector3(3.2,2.1,7.1):new THREE.Vector3(3.7,2.7,8.7);camera.position.copy(home);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7b2a8,2));
  for(const [color,intensity,pos] of [[0xffffff,3,[3,5,6]],[0xffffff,.6,[-4,1,2]],[0xffab70,.4,[-2,-3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);scene.add(light);}
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enableZoom=false;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=15;controls.autoRotate=false;controls.autoRotateSpeed=.35;
  // Wheel stays with the story. Buttons and keyboard controls handle zoom.
  renderer.domElement.style.touchAction='pan-y';
  const presentation=new THREE.Group();presentation.rotation.z=-Math.PI/2+(hero?-.08:0);scene.add(presentation);
  const assembly=new THREE.Group();assembly.rotation.x=Math.PI/2;assembly.scale.setScalar(45);presentation.add(assembly);
  const gltf=await modelPromise;const source=gltf.scene.clone(true);source.updateMatrixWorld(true);
  let originalScreen;source.traverse(n=>{if(n.name==='LCd')originalScreen=n;});
  const positions=originalScreen.geometry.getAttribute('position'),screenPoints=[];
  for(let i=0;i<positions.count;i++)screenPoints.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(originalScreen.matrixWorld));
  const surface=screenSurface(screenPoints);
  const originalRoot=source.children[0];const bounds=new THREE.Box3().setFromObject(source),center=bounds.getCenter(new THREE.Vector3());
  const base=new THREE.Group();base.position.copy(center).multiplyScalar(-1);assembly.add(base);
  const parts=[];const transforms=[[-.04,-.008,0],[0,-.024,0],[-.018,.017,-.02],[.028,.015,-.02],[-.02,.003,.022],[0,.052,0],[0,.088,0],[.035,.003,.02],[-.025,.016,.018]];
  [...originalRoot.children].forEach((child,i)=>{
    child.updateWorldMatrix(true,true);const matrix=child.matrixWorld.clone();originalRoot.remove(child);matrix.decompose(child.position,child.quaternion,child.scale);base.add(child);
    const item={object:child,home:child.position.clone(),delta:new THREE.Vector3(...transforms[i]),kind:partNames[i],index:i};parts.push(item);
    child.traverse(node=>{if(node.isMesh){node.material=node.material.clone();if(i===1||i===6){node.material.color.set('#ff5a1f');node.material.roughness=.55;node.material.metalness=0;}node.userData.part=item;}});
  });
  // The CAD display is blank. Add a procedural Cappy face at its actual screen surface.
  const display=parts.find(p=>p.index===5);
  const faceCanvas=document.createElement('canvas');faceCanvas.width=faceCanvas.height=256;const paint=createFace(faceCanvas);paint('happy');const texture=new THREE.CanvasTexture(faceCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.CircleGeometry(surface.radius,72),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,transparent:true}));face.rotation.set(-Math.PI/2,0,Math.PI/2);face.position.set(surface.x,surface.y,surface.z);base.add(face);const faceHome=face.position.clone();
  let visible=true,exploded=0,selection='all',lastPaint=0;const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;},{rootMargin:'80px'});observer.observe(host);
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(host);resize();
  function focus(kind='all',amount=kind==='all'?0:1){selection=kind;exploded=amount;if(!hero){const target=amount?new THREE.Vector3(5.8,4.3,11.8):home;camera.position.copy(target);controls.target.set(0,0,amount?1.3:0);controls.update();}parts.forEach(p=>{const target=p.home.clone().addScaledVector(p.delta,amount);if(window.gsap&&!reduced)window.gsap.to(p.object.position,{x:target.x,y:target.y,z:target.z,duration:.85,ease:'power2.inOut',overwrite:true});else p.object.position.copy(target);p.object.traverse(n=>{if(n.isMesh){const opacity=kind==='all'||p.kind===kind?1:.2;n.material.transparent=true;n.material.depthWrite=opacity===1;if(window.gsap&&!reduced)window.gsap.to(n.material,{opacity,duration:.45,overwrite:true});else n.material.opacity=opacity;}});});const dest=faceHome.clone().addScaledVector(display.delta,amount);if(window.gsap&&!reduced)window.gsap.to(face.position,{x:dest.x,y:dest.y,z:dest.z,duration:.85,ease:'power2.inOut',overwrite:true});else face.position.copy(dest);const faceOpacity=kind==='all'||kind==='display'?1:.2;face.material.depthWrite=faceOpacity===1;if(window.gsap&&!reduced)window.gsap.to(face.material,{opacity:faceOpacity,duration:.45,overwrite:true});else face.material.opacity=faceOpacity;}
  function reset(){camera.position.copy(home);controls.target.set(0,0,0);controls.update();}
  function zoom(delta){const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()+delta,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.autoRotate=false;controls.update();}
  host.addEventListener('keydown',e=>{if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?.6:-.6);return;}const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);let changed=true;if(e.key==='ArrowLeft')s.theta-=.15;else if(e.key==='ArrowRight')s.theta+=.15;else if(e.key==='ArrowUp')s.phi=Math.max(.15,s.phi-.15);else if(e.key==='ArrowDown')s.phi=Math.min(Math.PI-.15,s.phi+.15);else if(e.key==='Home'){reset();return;}else changed=false;if(changed){e.preventDefault();controls.autoRotate=false;camera.position.setFromSpherical(s).add(controls.target);controls.update();}});
  controls.addEventListener('start',()=>{controls.autoRotate=false;});
  renderer.setAnimationLoop(now=>{if(!visible||document.hidden)return;controls.update();if(now-lastPaint>70){paint('happy',now,reduced);texture.needsUpdate=true;lastPaint=now;}renderer.render(scene,camera);});
  controls.update();renderer.render(scene,camera);host.classList.add('ready');host.setAttribute('aria-busy','false');host.dataset.modelLoaded='true';return {focus,reset,zoom,get exploded(){return exploded},get selection(){return selection}};
}
