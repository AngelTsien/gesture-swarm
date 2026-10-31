import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

const mobile=/iPad|iPhone|Android|Mobile/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.userAgent));
const N=mobile?6000:12000;
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
renderer.setSize(innerWidth,innerHeight);document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0);
const cam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,100);cam.position.z=10;
const comp=new EffectComposer(renderer);comp.addPass(new RenderPass(scene,cam));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.9,.35,.05);comp.addPass(bloom);
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);comp.setSize(innerWidth,innerHeight)});

// each particle = a short streak (line segment): head + tail
const P=new Float32Array(N*3),V=new Float32Array(N*3),D=new Float32Array(N*3),C=new Float32Array(N*3),TC=new Float32Array(N*3);
const R=new Float32Array(N*4);for(let i=0;i<R.length;i++)R[i]=Math.random();
for(let i=0;i<N*3;i++){P[i]=(Math.random()-.5)*14;D[i]=0}
const pos=new Float32Array(N*6),col=new Float32Array(N*6);
const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('color',new THREE.BufferAttribute(col,3).setUsage(THREE.DynamicDrawUsage));
const mat=new THREE.LineBasicMaterial({vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false});
const lines=new THREE.LineSegments(geo,mat);lines.frustumCulled=false;scene.add(lines);
// glowing heads (points) for density
const pgeo=new THREE.BufferGeometry();pgeo.setAttribute('position',geo.getAttribute('position'));pgeo.setAttribute('color',geo.getAttribute('color'));
const tex=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');const r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'#fff');r.addColorStop(.4,'rgba(255,255,255,.4)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)})();
const pts=new THREE.Points(pgeo,new THREE.PointsMaterial({size:mobile?.05:.035,map:tex,vertexColors:true,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));pts.frustumCulled=false;scene.add(pts);
// big rings for ILY
const ringGroup=new THREE.Group();scene.add(ringGroup);
for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.TorusGeometry(2.2+k*.9,.025,8,160),new THREE.MeshBasicMaterial({color:k==1?0xffcc88:0xffffff,blending:THREE.AdditiveBlending,transparent:true,opacity:0}));m.rotation.x=1.35;m.position.set((k-1)*3.2,3.9-k*.15,-1);ringGroup.add(m)}

const NAMES={palm:'张开手掌',two:'两根手指',fist:'握拳',ily:'我爱你'};
let mode='palm',modeT=0,hand={x:0,y:1.5},handS={x:0,y:1.5};const trail=[];for(let i=0;i<160;i++)trail.push({x:0,y:1.5});
const label=document.getElementById('label');
function setMode(m){label.textContent=NAMES[m];if(m===mode&&modeT>0)return;mode=m;modeT=0;label.textContent=NAMES[m]}
addEventListener('keydown',e=>{const m={1:'palm',2:'two',3:'fist',4:'ily'}[e.key];if(m){hideStart();setMode(m)}});

const tc=new THREE.Color(),ca=new THREE.Color(),cb=new THREE.Color();
let last=performance.now(),time=0;
function step(){
  const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;time+=dt;modeT+=dt;
  handS.x+=(hand.x-handS.x)*.12;handS.y+=(hand.y-handS.y)*.12;
  if(!camOn){hand.x=Math.sin(time*.7)*4;hand.y=1.5+Math.sin(time*1.3)*1.2}
  trail.unshift({x:handS.x,y:handS.y});trail.pop();
  const cx=0,cy=1.4,rot=time*.25;
  let k=mode==='two'?.08:mode==='fist'&&modeT<.35?.25:.06;
  ringGroup.children.forEach((r,i)=>{r.material.opacity+=((mode==='ily'?.9:0)-r.material.opacity)*.05;r.rotation.z=time*(.3+i*.1)});
  for(let i=0;i<N;i++){
    const j=i*3,r0=R[i*4],r1=R[i*4+1],r2=R[i*4+2],r3=R[i*4+3];
    let tx,ty,tz,dx,dy,dz,len;
    if(mode==='palm'){ // dandelion: fibonacci sphere of radial streaks
      const y=1-2*(i+.5)/N,rr=Math.sqrt(1-y*y),th=i*2.39996+rot;
      const R0=1.9+r0*.25;dx=Math.cos(th)*rr;dy=y;dz=Math.sin(th)*rr;
      tx=cx+dx*R0;ty=cy+dy*R0;tz=dz*R0;len=.3+r1*.25;
      if(r2<.5)tc.setRGB(1,.25,.15);else tc.setRGB(.25,1,.3);
    }else if(mode==='two'){ // fish school ribbon following hand trail
      const u=Math.pow(r0,1.3),idx=Math.floor(u*159),p=trail[idx],q=trail[Math.min(159,idx+3)];
      const w=(.15+.9*Math.sin(u*Math.PI))*(.6+.4*Math.sin(time*2+u*9));
      const a=r1*6.283;tx=p.x+(u*7-3.5)*-.0+Math.cos(a)*w*1.4*r2+Math.sin(time*3+r3*9)*.2;
      ty=p.y+Math.sin(a)*w*.8*r2+Math.sin(u*14-time*4)*.25;tz=Math.sin(a*2)*w*r2;
      // spread along x when hand is still so it stays a ribbon
      tx+=(u-.5)*10*(.4+.6*(1-Math.min(1,Math.hypot(p.x-q.x,p.y-q.y)*20)));
      dx=P[j]-tx;dy=P[j+1]-ty;dz=0;const m=Math.hypot(dx,dy)||1;dx=-(V[j]||1)*1;dy=-(V[j+1]);dz=0;len=.25+r2*.2;
      tc.setRGB(.35+.5*r3,1,.25);
    }else if(mode==='fist'){
      const y=1-2*(i+.5)/N,rr=Math.sqrt(1-y*y),th=i*2.39996;
      if(modeT<.35){tx=cx+(r0-.5)*.2;ty=cy+(r1-.5)*.2;tz=0;dx=0;dy=1;dz=0;len=.05}
      else if(modeT<1.2){const R0=4+r0*3;tx=cx+Math.cos(th)*rr*R0;ty=cy+y*R0;tz=Math.sin(th)*rr*R0;dx=tx-cx;dy=ty-cy;dz=tz;const m=Math.hypot(dx,dy,dz);dx/=m;dy/=m;dz/=m;len=.35}
      else{ // swirling vortex globe: spiral flow around axis
        const R0=1.7+r0*.06,sp=time*1.5,phi=th+sp*(1.2-Math.abs(y)),yy=y;
        tx=cx+Math.cos(phi)*rr*R0;ty=cy+yy*R0;tz=Math.sin(phi)*rr*R0;
        // tangent: swirl + slight meridional spiral
        dx=-Math.sin(phi)+ .5*yy*Math.cos(phi);dy=.5*rr;dz=Math.cos(phi)+.5*yy*Math.sin(phi);const m=Math.hypot(dx,dy,dz);dx/=m;dy/=m;dz/=m;len=.25;k=.12}
      tc.setRGB(.75+.25*r2,1,.2+.2*r3);
    }else{ // ILY: crosses/swords flying upward
      const S=60,sid=Math.floor(i/S),e=i%S,sr=Math.abs(Math.sin(sid*12.9898)*43758.5)%1,sr2=Math.abs(Math.sin(sid*78.233)*12543.1)%1;
      const W=13,H=11,sx=(sr-.5)*W,speed=1.5+sr2*2.5,sy=((sr2*H+time*speed)%H)-H/2-1,sz=(sr*7%1-.5)*4;
      const sc=.5+sr*.7;
      if(e<44){tx=sx+(r1-.5)*.04;ty=sy+(e/44-.3)*1.6*sc;tz=sz}else{tx=sx+((e-44)/16-.5)*.6*sc;ty=sy+.3*sc;tz=sz}
      dx=0;dy=-1;dz=0;len=.06+(e<2?.7*sc:0); // trailing flame from blade tip
      if(sid%5===0)tc.setRGB(1,.8,.25);else tc.setRGB(.3,1,.4+.3*sr);
      k=.15;
    }
    const ox=P[j],oy=P[j+1],oz=P[j+2];
    P[j]+=(tx-P[j])*k;P[j+1]+=(ty-P[j+1])*k;P[j+2]+=(tz-P[j+2])*k;
    V[j]=V[j]*.8+(P[j]-ox)*.2/dt*.05;V[j+1]=V[j+1]*.8+(P[j+1]-oy)*.2/dt*.05;V[j+2]=V[j+2]*.8+(P[j+2]-oz)*.2/dt*.05;
    if(mode==='two'){const m=Math.hypot(V[j],V[j+1],V[j+2])||1e-6;dx=-V[j]/m;dy=-V[j+1]/m;dz=-V[j+2]/m;if(m<.02){dx=-1;dy=0;dz=0}}
    D[j]+=(dx*len-D[j])*.15;D[j+1]+=(dy*len-D[j+1])*.15;D[j+2]+=(dz*len-D[j+2])*.15;
    C[j]+=(tc.r-C[j])*.08;C[j+1]+=(tc.g-C[j+1])*.08;C[j+2]+=(tc.b-C[j+2])*.08;
    const o=i*6,b=mode==='ily'?.75:mode==='two'?.35:mode==='fist'?.13:.16;
    pos[o]=P[j];pos[o+1]=P[j+1];pos[o+2]=P[j+2];pos[o+3]=P[j]-D[j];pos[o+4]=P[j+1]-D[j+1];pos[o+5]=P[j+2]-D[j+2];
    col[o]=C[j]*b;col[o+1]=C[j+1]*b;col[o+2]=C[j+2]*b;col[o+3]=C[j]*.02;col[o+4]=C[j+1]*.02;col[o+5]=C[j+2]*.02;
  }
  geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
  lines.rotation.y=mode==='palm'?0:0;
  comp.render();
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// ---- camera + MediaPipe gesture recognizer ----
let camOn=false;const video=document.getElementById('cam');
const startEl=document.getElementById('start'),errEl=document.getElementById('err');
function hideStart(){startEl.style.display='none'}
document.getElementById('nocam').onclick=()=>{hideStart();label.textContent='键盘 1-4 切换'};
document.getElementById('camtoggle').onclick=()=>{video.style.display=video.style.display==='block'?'none':'block'};
document.getElementById('go').onclick=async()=>{
  errEl.textContent='加载中…';
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:640,height:480},audio:false});
    video.srcObject=stream;await video.play();video.style.display='block';
    const {GestureRecognizer,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const fs=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    const opts=d=>({baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',delegate:d},runningMode:'VIDEO',numHands:1});
    let rec;try{rec=await GestureRecognizer.createFromOptions(fs,opts('GPU'))}catch(e){rec=await GestureRecognizer.createFromOptions(fs,opts('CPU'))}
    hideStart();camOn=true;label.textContent='举起手';
    let cand=null,cnt=0,lt=-1;
    const loop=()=>{
      if(video.currentTime!==lt){lt=video.currentTime;
        const r=rec.recognizeForVideo(video,performance.now());
        if(r.landmarks&&r.landmarks[0]){const lm=r.landmarks[0],p=lm[9];
          const hh=Math.tan(Math.PI/6)*10,hw=hh*cam.aspect;hand.x=(.5-p.x)*2*hw;hand.y=(.5-p.y)*2*hh;
          const g=classify(r.gestures[0]&&r.gestures[0][0],lm);
          if(g){if(g===cand)cnt++;else{cand=g;cnt=1}if(cnt>=4)setMode(g)}}
      }
      requestAnimationFrame(loop)};loop();
  }catch(e){errEl.textContent='摄像头/模型启动失败：'+e.message+'（可用键盘 1-4）'}
};
function classify(top,lm){
  const map={Open_Palm:'palm',Victory:'two',Closed_Fist:'fist',ILoveYou:'ily'};
  if(top&&top.score>.55&&map[top.categoryName])return map[top.categoryName];
  // fallback from landmarks: finger extended if tip farther from wrist than pip
  const w=lm[0],d=(a)=>Math.hypot(a.x-w.x,a.y-w.y),ext=f=>d(lm[f])>d(lm[f-2])*1.1;
  const I=ext(8),M=ext(12),Rr=ext(16),Pk=ext(20),T=Math.hypot(lm[4].x-lm[17].x,lm[4].y-lm[17].y)>Math.hypot(lm[2].x-lm[17].x,lm[2].y-lm[17].y)*1.1;
  if(I&&M&&Rr&&Pk)return'palm';if(I&&M&&!Rr&&!Pk)return'two';if(I&&Pk&&!M&&!Rr&&T)return'ily';if(!I&&!M&&!Rr&&!Pk)return'fist';return null;
}
