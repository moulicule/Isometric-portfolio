// Behaviour ported from the supplied main.cpp. This drives simulated advertisements.
export const THRESHOLDS = { angryEnter: -73, angryExit: -78, rageEnter: -55, rageExit: -62, debounce: 1000, timeout: 1500, sleepy: 30000, sleep: 60000, wake: 7500 };
export function firstTier(rssi) { return rssi >= -55 ? 'rage' : rssi >= -73 ? 'angry' : 'curious'; }
export function nextTier(tier, rssi) {
  if (tier === 'rage') return rssi < -62 ? (rssi < -78 ? 'curious' : 'angry') : 'rage';
  if (tier === 'angry') return rssi >= -55 ? 'rage' : rssi < -78 ? 'curious' : 'angry';
  return firstTier(rssi);
}
export const HAPTICS = { curious: [120], angry: [75,65,75], rage: [60,40,60,40,90] };
export class CappyEngine {
  constructor(now = 0) { this.emotion = 'happy'; this.lastActivity = now; this.lastPacket = -Infinity; this.active = false; this.tier = 'curious'; this.filtered = -100; this.changedAt = 0; this.dazedUntil = 0; this.idleOffset = 0; }
  idle(ms, now) { this.lastPacket = -Infinity; this.active = false; this.lastActivity = now; this.idleOffset = ms; this.dazedUntil = 0; }
  wake(now) { if (!['sleepy','sleeping'].includes(this.emotion)) return false; this.dazedUntil = now + THRESHOLDS.wake; this.lastActivity = now; this.idleOffset = 0; this.emotion = 'dazed'; return true; }
  update(signal, rssi, now, immediate = false) {
    let buzz = null;
    if (signal) { this.lastPacket = now; this.raw = rssi; }
    if (this.dazedUntil > now) return { emotion: this.emotion = 'dazed', buzz };
    if (this.dazedUntil) { this.dazedUntil = 0; return { emotion: this.emotion = 'happy', buzz }; }
    if (now - this.lastPacket < THRESHOLDS.timeout) {
      this.idleOffset = 0; this.lastActivity = this.lastPacket;
      if (!this.active) { this.filtered = this.raw; this.tier = firstTier(this.filtered); this.changedAt = now; buzz = this.tier; }
      else {
        // Drag gestures use immediate input; normal firmware interpretation keeps smoothing.
        this.filtered = immediate ? this.raw : this.filtered * .65 + this.raw * .35;
        if (immediate || now - this.changedAt >= THRESHOLDS.debounce) {
          const next = nextTier(this.tier, this.filtered);
          if (next !== this.tier) {
            if (next === 'rage' || (next === 'angry' && this.tier === 'curious')) buzz = next;
            this.tier = next; this.changedAt = now;
          }
        }
      }
      this.active = true; this.emotion = this.tier;
    } else {
      this.active = false; this.tier = 'curious'; this.filtered = -100;
      const idle = now - this.lastActivity + this.idleOffset;
      this.emotion = idle >= 60000 ? 'sleeping' : idle >= 30000 ? 'sleepy' : 'happy';
    }
    return { emotion: this.emotion, buzz };
  }
}
const shapes = {
  happy: [[84,134,32,64,-5],[156,134,32,64,-5]],
  curious: [[124,144,26,50,-30],[172,152,22,50,-30]],
  angry: [[82,126,30,60,45],[158,126,30,60,-45]],
  rage: [[85,122,28,58,40],[155,122,28,58,-40]],
  sleepy: [[80,102,52,22,0],[160,102,52,22,0]],
  sleeping: [[76,92,64,8,0],[164,92,64,8,0]],
  dazed: [[80,108,48,22,-3],[160,108,48,22,3]]
};
const colors = {happy:'#f9faf4',curious:'#ffe34d',angry:'#ff3434',rage:'#610000',sleepy:'#f9faf4',sleeping:'#f9faf4',dazed:'#f9faf4'};
export function createFace(canvas) {
  const ctx=canvas.getContext('2d'); let current=shapes.happy.map(p=>[...p]);
  return (emotion='happy',now=0,reduced=false) => {
    const target=shapes[emotion] || shapes.happy; const scale=canvas.width/240;
    ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle=emotion==='rage'?'#ba3636':'#090c0b';ctx.fillRect(0,0,240,240);
    const blink=!reduced && !['sleeping','rage'].includes(emotion) && now%4200>4020 ? .12:1;
    const breath=reduced?0:Math.sin(now/950)*1.1;
    current.forEach((eye,i)=>{
      eye.forEach((_,j)=>eye[j]+=(target[i][j]-eye[j])*(reduced?1:.16));
      const shake=emotion==='rage'&&!reduced?Math.sin(now*.055)*1.5:0;
      ctx.save();ctx.translate(eye[0]+shake,eye[1]+breath);ctx.rotate(-eye[4]*Math.PI/180);ctx.fillStyle=colors[emotion];
      ctx.beginPath();ctx.roundRect(-eye[2]/2,-eye[3]*blink/2,eye[2],Math.max(3,eye[3]*blink),Math.min(eye[2],eye[3]*blink)/2);ctx.fill();ctx.restore();
    });
    if(emotion==='sleeping'){ctx.fillStyle='#e2e7da';ctx.font='15px monospace';ctx.fillText('z',155,65-(reduced?0:Math.sin(now/800)*4));ctx.font='10px monospace';ctx.fillText('z',176,46);}
  };
}
