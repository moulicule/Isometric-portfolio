import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {PART_SLOTS,inspectionView} from '../public/projects/cap/assembly-layout.js';
const buffer=fs.readFileSync(new URL('../public/projects/cap/assets/cap.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
scene.updateMatrixWorld(true);
const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-Math.PI/2)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)));
const kinds=['power','shell','brain','touch','power','display','shell','power','touch'];
const parts=scene.children[0].children.map((object,i)=>{
 const points=[];object.traverse(n=>{if(n.isMesh){const attr=n.geometry.attributes.position;for(let j=0;j<attr.count;j++)points.push(new THREE.Vector3().fromBufferAttribute(attr,j).applyMatrix4(n.matrixWorld).applyQuaternion(q).multiplyScalar(45));}});
 const center=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3()),slot=new THREE.Vector3(...PART_SLOTS[i]);
 points.forEach(p=>{p.sub(center);if(i===0)p.applyAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);p.add(slot);});
 return{bounds:new THREE.Box3().setFromPoints(points),kind:kinds[i],name:object.name};
});
for(const kind of ['all','shell','display','brain','touch','power'])for(const aspect of [2.05,1.35,.7]){
 const v=inspectionView(parts,kind,aspect,35),camera=new THREE.PerspectiveCamera(35,aspect,.1,100);camera.position.copy(v.position);camera.lookAt(v.target);camera.updateMatrixWorld();
 const rects=parts.map(p=>{const pts=[];for(const x of [p.bounds.min.x,p.bounds.max.x])for(const y of [p.bounds.min.y,p.bounds.max.y])for(const z of [p.bounds.min.z,p.bounds.max.z])pts.push(new THREE.Vector3(x,y,z).project(camera));return{left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))};});
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,`${kind} / aspect ${aspect}: ${parts[i].name} overlaps ${parts[j].name}`);}
 const framed=rects.filter((_,i)=>['all','shell'].includes(kind)||parts[i].kind===kind);
 assert.ok(framed.every(r=>r.left>=-.95&&r.right<=.95&&r.top>=-.95&&r.bottom<=.95),`${kind} / aspect ${aspect}: clipped active part`);
 if(!['all','shell'].includes(kind)){
  const overview=inspectionView(parts,'all',aspect,35);
  assert.ok(v.position.distanceTo(v.target)<overview.position.distanceTo(overview.target)*.85,`${kind}: chapter should zoom in from the full spread`);
 }
 assert.ok(v.position.distanceTo(v.target)<40,'Inspection camera must fit within the orbit zoom limit');
}

console.log("PASS: CAD parts stay separated; overviews fit the whole assembly and closeups fit every active part at mobile and desktop aspect ratios.");
