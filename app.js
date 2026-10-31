import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {AfterimagePass} from 'three/addons/postprocessing/AfterimagePass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const mobile=/iPad|iPhone|Android|Mobile/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.userAgent));
const N=mobile?1600:2600;
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
const DPR=Math.min(devicePixelRatio,mobile?1.5:2);renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth,innerHeight);document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,100);cam.position.set(0,0,11);
const comp=new EffectComposer(renderer);comp.addPass(new RenderPass(scene,cam));
const RAW=location.search.includes('raw');const after=new AfterimagePass(.4);if(!RAW)comp.addPass(after);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.5,.25,.3);if(!RAW)comp.addPass(bloom);
comp.addPass(new OutputPass());
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);comp.setSize(innerWidth,innerHeight)});


// ---- each particle is an instanced flying sword: blade + crossguard + light trail ----
const base=new THREE.BufferGeometry();
const L=[],UVv=[],I=[];let vi=0;
function quad(x0,x1,y0,y1,part){L.push(x0,y0,part, x1,y0,part, x1,y1,part, x0,y1,part);UVv.push(-1,0, 1,0, 1,1, -1,1);I.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4}
quad(-.055,.055,-.34,.66,0);   // blade (tip at top)
quad(-.2,.2,-.39,-.31,1);      // crossguard
quad(-.05,.05,0,1,2);          // trail (length set in shader)
base.setAttribute('position',new THREE.Float32BufferAttribute(L,3));base.setAttribute('uv',new THREE.Float32BufferAttribute(UVv,2));base.setIndex(I);
const geo=new THREE.InstancedBufferGeometry();geo.index=base.index;geo.attributes.position=base.attributes.position;geo.attributes.uv=base.attributes.uv;
const idx=new Float32Array(N),rnd=new Float32Array(N*4);for(let i=0;i<N;i++){idx[i]=i;for(let k=0;k<4;k++)rnd[i*4+k]=Math.random()}
geo.setAttribute('aIdx',new THREE.InstancedBufferAttribute(idx,1));geo.setAttribute('aRnd',new THREE.InstancedBufferAttribute(rnd,4));geo.instanceCount=N;
const TRAIL=32;const trailArr=[],trail2=[];for(let i=0;i<TRAIL;i++){trailArr.push(new THREE.Vector2(0,.8));trail2.push(new THREE.Vector2(0,.8))}
const U={uTime:{value:0},uFrom:{value:0},uTo:{value:0},uProg:{value:9},uModeT:{value:0},uN:{value:N},
  uTrail:{value:trailArr},uSpread:{value:1},uSize:{value:.24},uCenter:{value:new THREE.Vector2(0,.8)},uB:{value:.3},uCam:{value:cam.position},uTrail2:{value:trail2},uDual:{value:0},uSide:{value:1},uBT:{value:99},uBType:{value:0},uBF:{value:0},uHand:{value:new THREE.Vector2(0,.8)},uBDir:{value:new THREE.Vector3(1,0,0)}};
const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
vertexShader:/*glsl*/`
uniform float uTime,uFrom,uTo,uProg,uModeT,uN,uSpread,uSize;uniform vec2 uTrail[${TRAIL}];uniform vec2 uCenter;uniform vec3 uCam;uniform vec2 uTrail2[${TRAIL}];uniform float uDual,uSide,uBT,uBType,uBF;uniform vec2 uHand;uniform vec3 uBDir;
attribute float aIdx;attribute vec4 aRnd;varying vec3 vCol;varying float vA;varying vec2 vUv;varying float vPart;
#define PI 3.14159265
float h(float n){return fract(sin(n)*43758.5453);}
vec3 flow(vec3 p,float t){return vec3(sin(p.y*1.7+t*.5)+sin(p.z*2.3-t*.3),sin(p.z*1.5+t*.4)+sin(p.x*2.1+t*.6),sin(p.x*1.3-t*.45)+sin(p.y*1.9+t*.35));}
vec3 C,D;float T,S;
vec3 green(float k){return mix(vec3(.2,1.,.45),vec3(1.,.82,.25),k);}
vec3 trailAt(float u){float f=clamp(u,0.,1.)*${TRAIL-1}.,i0=floor(f);return vec3(mix(uTrail[int(i0)],uTrail[int(min(i0+1.,${TRAIL-1}.))],f-i0),0.);}
vec3 trail2At(float u){float f=clamp(u,0.,1.)*${TRAIL-1}.,i0=floor(f);return vec3(mix(uTrail2[int(i0)],uTrail2[int(min(i0+1.,${TRAIL-1}.))],f-i0),0.);}
vec3 shape(float m,float mt){
  vec3 c=vec3(uCenter,0.);vec4 r=aRnd;S=1.;
  if(m<.5){ // open palm: uneven dandelion
    float y=r.y*2.-1.,rr=sqrt(max(0.,1.-y*y)),th=r.x*6.2831+uTime*.1;
    D=normalize(vec3(cos(th)*rr,y,sin(th)*rr)+(vec3(h(aIdx*.71),h(aIdx*.53),h(aIdx*.91))-.5)*.35);
    float n=sin(D.x*3.1+uTime*.4)*sin(D.y*2.7-uTime*.3)*sin(D.z*3.3+1.);
    float rad=1.25+n*.35+pow(h(aIdx*2.3),2.)*.9;           // uneven radius, some long spikes
    if(h(aIdx*5.1)<.04)rad*=1.6+h(aIdx*7.)*.8;             // stragglers
    C=green(r.w*.6);T=.1+h(aIdx*3.3)*.25;S=.55+pow(h(aIdx*4.4),2.)*1.1;
    return c+D*rad+flow(D*2.+r.xyz*4.,uTime*(.5+r.w))*.06;
  }else if(m<1.5){ // two fingers: loose voluminous school of swords swirling around the hand path
    float u=pow(r.x,1.2);bool sec=uDual>.5&&h(aIdx*2.2)<.5;vec3 p=sec?trail2At(u):trailAt(u),p2=sec?trail2At(u+.04):trailAt(u+.04);vec3 tg=p-p2;
    tg+=vec3(-.06*uSpread,0.,0.);
    vec3 ax=normalize(tg+vec3(1e-4,0.,0.));vec3 n1=normalize(cross(ax,vec3(0.,0.,1.)+vec3(.0,.001,0.)));vec3 n2=cross(ax,n1);
    float w=(.6+1.5*sin(u*PI))*(.8+.2*sin(uTime*1.3+u*7.));float sp=.7+r.w*.9;
    float an=r.y*6.2831+uTime*sp*(h(aIdx*.9)<.5?1.:-.7);float rad=w*(.2+.8*sqrt(r.z))*(.8+.4*sin(uTime*.9+r.x*20.));
    vec3 o=(n1*cos(an)+n2*sin(an))*rad;
    o+=flow(vec3(u*4.,r.y*3.,r.z*3.),uTime*.8)*.18;
    o.x+=(u-.5)*7.5*uSpread*(1.-.7*uDual);
    D=normalize(ax*1.6+(-n1*sin(an)+n2*cos(an))*.9);
    C=green(r.w*.6);T=.5+h(aIdx*2.9)*.9;S=.7+pow(h(aIdx*4.1),2.)*1.4;if(h(aIdx*5.7)<.05)o*=1.8;return p+o;
  }else if(m<2.5){ // fist: implode, burst, then a swirling globe of swords
    float y=r.y*2.-1.,rr=sqrt(max(0.,1.-y*y));
    float phi=r.x*6.2831+uTime*(.8+.6*h(aIdx*1.9))*(1.25-abs(y));
    float gr=1.7*(.82+.3*h(aIdx*3.7))+sin(phi*3.+y*4.+uTime*.7)*.12;
    if(h(aIdx*5.3)<.05)gr*=1.3+h(aIdx*6.1)*.5;
    vec3 gl=vec3(cos(phi)*rr,y,sin(phi)*rr)*gr+flow(vec3(phi,y*3.,r.z*5.),uTime*(.6+r.w))*.07;
    float t=mt,s;
    if(t<.28){float e=t/.28;s=1.-.97*e*e;}
    else if(t<.9){float e=(t-.28)/.62;s=.03+3.2*(1.-pow(1.-e,3.));}
    else{float e=clamp((t-.9)/1.3,0.,1.);e=e*e*(3.-2.*e);s=mix(3.23,1.,e);}
    float sc=s>1.?1.+(s-1.)*(.6+.8*r.z):s;
    vec3 tang=vec3(-sin(phi),.0,cos(phi))+(vec3(h(aIdx*.3),h(aIdx*.6),h(aIdx*.8))-.5)*.9;vec3 rd=normalize(gl);
    D=normalize(mix(tang+vec3(0.,.35*sign(y+.001),0.),rd,smoothstep(.28,.5,t)*(1.-smoothstep(.9,1.6,t))));
    C=green(.35+r.y*.65);T=.15+h(aIdx*2.9)*.3;S=.5+pow(h(aIdx*4.1),2.)*1.1;return c+gl*sc;
  }else if(m<3.5){ // I-love-you: the sword field — swords stand upright and fly upward with light trails
    float W=13.,H=11.+h(aIdx*.4)*4.;float z=-5.+r.z*7.;float sp=.9+pow(r.w,2.)*4.;
    float y=mod(r.y*H+uTime*sp,H)-H*.5-.6;
    D=normalize(vec3(sin(uTime*.7+r.x*30.)*.12+(h(aIdx*.8)-.5)*.2,1.,0.));C=h(aIdx*.37)<.4?vec3(1.,.72,.12):mix(vec3(.1,1.,.35),vec3(.45,1.,.4),r.w);
    T=1.4+r.w*1.8;S=h(aIdx*1.7)<.72?0.:1.6+pow(h(aIdx*4.1),1.5)*3.4;return vec3((r.x-.5)*W*(1.+(-z)*.08)+sin(uTime*(.3+r.w)+r.y*40.)*.35,y,z);
  }else if(m<4.5){ // 升剑: column / spire rising above the hand
    float hgt=pow(r.y,.8)*4.5;float an=r.x*6.2831+uTime*(1.+r.w)+hgt*1.3;float rad=(.15+.75*(1.-hgt/4.8))*sqrt(r.z)+.05;
    if(h(aIdx*5.9)<.05)rad*=2.5;
    D=normalize(vec3(-sin(an)*.25,1.,cos(an)*.25));C=green(.2+r.w*.8);T=.6+r.w;S=.6+pow(h(aIdx*4.1),2.)*1.2;
    return vec3(uHand,0.)+vec3(cos(an)*rad,hgt-.3+sin(uTime*2.+r.x*20.)*.08,sin(an)*rad);
  }else if(m<5.5){ // 横飞: swords stream horizontally from the hand
    float L=12.;float d=mod(r.x*L+uTime*(3.+r.w*5.),L);float spread=.12+d*.09;
    D=vec3(uSide,sin(uTime+r.y*9.)*.05,0.);C=green(r.y*.7);T=.8+r.w*1.5;S=.6+pow(h(aIdx*4.1),2.)*1.3;
    return vec3(uHand.x+uSide*d,uHand.y+(r.y-.5)*2.*spread+sin(d*1.3-uTime*3.+r.z*6.)*.15,(r.z-.5)*2.*spread);
  }else{ // L 阵: a loose rotating ring/frame of swords
    float an=r.x*6.2831+uTime*(.5+.2*h(aIdx*.7));float R=2.3+(r.y-.5)*.5+sin(an*5.+uTime)*.12;
    vec3 q=vec3(cos(an)*R,sin(an)*R,(r.z-.5)*.5);float ct=cos(.5),st=sin(.5);q=vec3(q.x,q.y*ct-q.z*st,q.y*st+q.z*ct);
    D=normalize(vec3(-sin(an),cos(an)*ct,cos(an)*st)+(vec3(h(aIdx*.3),h(aIdx*.6),0.)-.5)*.4);
    C=mix(vec3(.3,1.,.6),vec3(1.,.85,.4),step(.7,r.w));T=.4+r.w*.6;S=.6+pow(h(aIdx*4.1),2.)*1.2;
    return c+q;
  }
}
void main(){
  vec3 a=shape(uFrom,9.);vec3 cf=C,df=D;float tf=T,sf=S;
  vec3 b=shape(uTo,uModeT);
  float p=clamp((uProg-h(aIdx*9.1)*.8)/(.8+h(aIdx*3.9)*.8),0.,1.);float e=p<.5?4.*p*p*p:1.-pow(-2.*p+2.,3.)/2.;
  vec3 P=mix(a,b,e);vec3 sw=flow(P*.8+aRnd.xyz*2.,uTime)*(.9*sin(PI*e));P+=sw+flow(P*1.3+aRnd.xyz*9.,uTime*(.4+aRnd.w*.6)+aRnd.w*6.)*.06;
  vec3 dir=normalize(mix(df,D,e)+sw*.4+(vec3(h(aIdx*1.1),h(aIdx*1.3),h(aIdx*1.7))-.5)*.25+1e-4);
  float bsel=step(h(aIdx*8.8),uBF);float age=uBT-h(aIdx*4.7)*.3;
  if(bsel>.5&&age>0.&&age<1.9){
    float env=1.-smoothstep(1.1,1.9,age);vec3 bd;vec3 jit=vec3(h(aIdx*2.1),h(aIdx*2.7),h(aIdx*3.1))-.5;float spd=h(aIdx*5.3);
    if(uBType<.5){bd=normalize(uBDir+jit*.3);P=mix(P,vec3(uHand,0.)+jit*.5+bd*age*(9.+spd*9.),env);}
    else if(uBType<1.5){bd=normalize(uBDir+jit*.55);P+=bd*pow(age,1.3)*(6.+spd*7.)*env;}
    else{bd=normalize(normalize(P-vec3(uCenter,0.)+jit*.3)+vec3(0.,0.,1.2));P+=bd*pow(age,1.2)*(7.+spd*7.)*env;}
    dir=normalize(mix(dir,bd,env));
  }
  vCol=mix(cf,C,e);float tl=mix(tf,T,e),sc=mix(sf,S,e)*uSize;
  vec3 view=normalize(uCam-P);vec3 X=normalize(cross(dir,view)+1e-5);
  vec3 lp=position;vPart=lp.z;vUv=uv;
  float ly=lp.z>1.5?-.34-lp.y*tl:lp.y;
  vec3 W=P+(X*lp.x+dir*ly)*sc;
  vA=.45+1.1*pow(h(aIdx*6.6),2.);gl_Position=projectionMatrix*viewMatrix*vec4(W,1.);
}`,
fragmentShader:/*glsl*/`
uniform float uB;varying vec3 vCol;varying float vA;varying vec2 vUv;varying float vPart;
void main(){float ax=abs(vUv.x),a;vec3 col=vCol;
 if(vPart<.5){float hw=1.-smoothstep(.62,1.,vUv.y);a=smoothstep(hw,hw*.2,ax);col=mix(vCol,vec3(1.),.45*(1.-ax));}
 else if(vPart<1.5){a=(1.-pow(ax,6.))*.8;}
 else{a=pow(1.-vUv.y,2.)*(1.-ax)*.55;}
 gl_FragColor=vec4(col*a*uB*vA,1.);}`});
const pts=new THREE.Mesh(geo,mat);pts.frustumCulled=false;scene.add(pts);
// halo rings for 我爱你
const rings=new THREE.Group();scene.add(rings);
const ringTex=(()=>{const c=document.createElement('canvas');c.width=512;c.height=64;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,64);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,512,64);return new THREE.CanvasTexture(c)})();
[[-.6,4.6,-1,3.6,0xfff4e0],[-.4,4.75,-1,2.7,0xffd59a]].forEach(([x,y,z,R,c])=>{const m=new THREE.Mesh(new THREE.RingGeometry(R-.14,R+.14,220,1),new THREE.MeshBasicMaterial({color:c,map:ringTex,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.x=-1.38;rings.add(m)});
const EFFECTS=['蒲公英','剑鱼群','剑球漩涡','万剑升空','升剑','横飞','L 阵'];const NAMES=EFFECTS;
const BURSTS=['剑指发射','飞剑出鞘','冲击波','横扫'];
const GNAMES=['张开手掌','两根手指（剑指）','握拳','我爱你','食指朝上','剑指横指','L 手势','快速剑指','向前甩手','双掌前推','挥臂横扫'];
const DEFMAP=['0','1','2','3','4','5','6','b0','b1','b2','b3'];
const label=document.getElementById('label');let pending=null;
function showLabel(t){label.classList.remove('on');setTimeout(()=>{label.textContent=t;label.classList.add('on')},250)}
function setMode(m){
  if(m===U.uTo.value){pending=null;return}
  if(U.uProg.value<1.2){pending=m;return}   // let the current morph finish: never snap
  U.uFrom.value=U.uTo.value;U.uTo.value=m;U.uProg.value=0;U.uModeT.value=0;pending=null;showLabel(EFFECTS[m]);
}
function burst(b,dir){if(U.uBT.value<.75)return;const T=[0,1,2,1][b];U.uBType.value=T;U.uBF.value=b==2?1:b==0?.35:.6;U.uBDir.value.copy(dir||new THREE.Vector3(0,.1,1));U.uBT.value=0;showLabel(BURSTS[b])}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();const m={1:0,2:1,3:2,4:3,5:4,6:5,7:6}[k];hideStart();
  if(m!==undefined){setMode(m);return}
  const sx=Math.random()<.5?-1:1;
  if(k==='q')burst(0,new THREE.Vector3(sx,.35,.2));if(k==='w')burst(1,new THREE.Vector3(0,.1,1));if(k==='e')burst(2);if(k==='r')burst(3,new THREE.Vector3(sx,0,0));
  if(k==='s')U.uSide.value*=-1;if(k==='d'){simDual=!simDual;showLabel(simDual?'双手剑指':'单手剑指')}});
let simDual=false;

// One-Euro filter for the hand
class OneEuro{constructor(mc=.8,b=.02){this.mc=mc;this.b=b;this.x=null;this.dx=0}
  a(c,dt){const t=1/(2*Math.PI*c);return 1/(1+t/dt)}
  f(v,dt){if(this.x===null){this.x=v;return v}const d=(v-this.x)/dt;this.dx+=this.a(1,dt)*(d-this.dx);
    const c=this.mc+this.b*Math.abs(this.dx);this.x+=this.a(c,dt)*(v-this.x);return this.x}}
const fx=new OneEuro(),fy=new OneEuro();let rawHand={x:0,y:.8},hand={x:0,y:.8},camOn=false,raw2=null,hand2={x:0,y:.8},dualT=0;const fx2=new OneEuro(),fy2=new OneEuro();
let last=performance.now(),tick=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000)||.016;last=now;
  U.uTime.value+=dt;U.uProg.value+=dt;U.uModeT.value+=dt;
  if(pending!==null&&U.uProg.value>=1.2)setMode(pending);
  if(!camOn){const t=U.uTime.value;rawHand.x=Math.sin(t*.45)*3.6;rawHand.y=.8+Math.sin(t*.9)*1.1}
  hand.x=fx.f(rawHand.x,dt);hand.y=fy.f(rawHand.y,dt);U.uHand.value.set(hand.x,hand.y);U.uBT.value+=dt;
  if(!camOn){const t=U.uTime.value;raw2=simDual?{x:-rawHand.x*.8,y:.8+Math.cos(t*.8)*1.2}:null}
  if(raw2){hand2.x=fx2.f(raw2.x,dt);hand2.y=fy2.f(raw2.y,dt)}
  U.uDual.value+=(((raw2&&(camOn?dualT>0:simDual))?1:0)-U.uDual.value)*.06;
  trail2[0].lerp(new THREE.Vector2(hand2.x,hand2.y),.25);for(let i=1;i<TRAIL;i++)trail2[i].lerp(trail2[i-1],.32);
  // smoothed trail (spring-follow chain)
  trailArr[0].lerp(new THREE.Vector2(hand.x,hand.y),.25);
  for(let i=1;i<TRAIL;i++)trailArr[i].lerp(trailArr[i-1],.32);
  const L=trailArr[0].distanceTo(trailArr[TRAIL-1]);U.uSpread.value+=((L<1.5?1:Math.max(0,1-(L-1.5)/2))-U.uSpread.value)*.03;
  rings.children.forEach((r,i)=>{r.material.opacity+=(((U.uTo.value===3&&U.uProg.value>.8)?.95:0)-r.material.opacity)*.04;r.rotation.z=U.uTime.value*(i?-.2:.15);const t=U.uTime.value;r.rotation.x=-1.38+Math.sin(t*.7+i*2)*.05;r.rotation.y=Math.sin(t*.5+i)*.06;r.position.y=(i?4.75:4.6)+Math.sin(t*.9+i*1.7)*.08;r.scale.setScalar(1+Math.sin(t*1.1+i)*.03)});comp.render(dt);tick++;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);window.__fps=()=>tick;

// ---- camera + MediaPipe ----
const video=document.getElementById('cam'),startEl=document.getElementById('start'),errEl=document.getElementById('err');
function hideStart(){startEl.classList.add('hide');if(!label.textContent)showLabel(EFFECTS[U.uTo.value])}
document.getElementById('nocam').onclick=()=>{hideStart()};
document.getElementById('camtoggle').onclick=()=>video.classList.toggle('on');
const HS={};  // per-hand motion state
document.getElementById('go').onclick=async()=>{
  errEl.textContent='正在启动…';
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:640,height:480},audio:false});
    video.srcObject=stream;await video.play();video.classList.add('on');
    const V='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const {GestureRecognizer,FilesetResolver}=await import(V+'/vision_bundle.mjs');
    const fs=await FilesetResolver.forVisionTasks(V+'/wasm');
    const o=d=>({baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',delegate:d},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minTrackingConfidence:.4});
    let rec;try{rec=await GestureRecognizer.createFromOptions(fs,o('GPU'))}catch(e){rec=await GestureRecognizer.createFromOptions(fs,o('CPU'))}
    hideStart();camOn=true;showLabel('举起手');
    let cand=null,cnt=0,lt=-1,lastG=null;
    const loop=()=>{
      if(video.readyState>=2&&video.currentTime!==lt){lt=video.currentTime;const now=performance.now();
        const r=rec.recognizeForVideo(video,now);const hands=[];
        const hh=Math.tan(55/2*Math.PI/180)*11,hw=hh*cam.aspect;
        (r.landmarks||[]).forEach((lm,i)=>{
          const key=(r.handednesses&&r.handednesses[i]&&r.handednesses[i][0].categoryName)||('h'+i);
          const p=lm[9],x=(.5-p.x)*2*hw*.85,y=(.5-p.y)*2*hh*.85,size=Math.hypot(lm[0].x-lm[9].x,lm[0].y-lm[9].y);
          let st=HS[key];if(!st)st=HS[key]={x,y,size,t:now,vx:0,vy:0,vz:0};
          const dt=Math.max(.016,(now-st.t)/1000);
          st.vx+=((x-st.x)/dt-st.vx)*.5;st.vy+=((y-st.y)/dt-st.vy)*.5;st.vz+=(((size-st.size)/dt)/size-st.vz)*.5;
          st.x=x;st.y=y;st.size=size;st.t=now;
          const c=classify(r.gestures[i]&&r.gestures[i][0],lm);
          hands.push({x,y,st,g:c.g,side:c.side});
        });
        dualT=hands.length===2&&hands.every(h=>h.g===1||h.g===5)?1:0;
        if(hands.length){
          const A=hands[0];rawHand.x=A.x;rawHand.y=A.y;raw2=hands[1]?{x:hands[1].x,y:hands[1].y}:null;
          U.uCenter.value.lerp(new THREE.Vector2(rawHand.x*.25,.8+rawHand.y*.15),.04);
          // dynamic gestures (velocity based)
          let dyn=null;
          if(hands.length===2&&hands.every(h=>h.g===0&&h.st.vz>1.1))dyn=[9];
          if(!dyn)for(const h of hands){const sp=Math.hypot(h.st.vx,h.st.vy);
            if((h.g===1||h.g===5)&&sp>8){dyn=[7,new THREE.Vector3(h.st.vx,h.st.vy,sp*.15).normalize(),h];break}
            if(h.g!==0&&h.st.vz>1.6){dyn=[8,new THREE.Vector3(0,.1,1),h];break}
            if(Math.abs(h.st.vx)>12&&Math.abs(h.st.vx)>2*Math.abs(h.st.vy)){dyn=[10,new THREE.Vector3(Math.sign(h.st.vx),0,0),h];break}}
          if(dyn){if(dyn[2]){U.uHand.value.set(dyn[2].x,dyn[2].y)}onGesture(dyn[0],{dir:dyn[1]})}
          // static gestures (debounced); ILY with either hand wins
          const pick=hands.find(h=>h.g===3)||hands.find(h=>h.g!==null);
          if(pick){if(pick.side)U.uSide.value=pick.side;const g=pick.g;if(g===cand)cnt++;else{cand=g;cnt=1}if(cnt>=4&&g!==lastG){lastG=g;onGesture(g)}}
        }
      }
      requestAnimationFrame(loop)};loop();
  }catch(e){errEl.textContent='摄像头启动失败：'+e.message+'（可用键盘）'}
};
function classify(top,lm){
  const w=lm[0],d=a=>Math.hypot(a.x-w.x,a.y-w.y),ext=f=>d(lm[f])>d(lm[f-2])*1.1;
  const I=ext(8),M=ext(12),R=ext(16),P=ext(20),T=Math.hypot(lm[4].x-lm[17].x,lm[4].y-lm[17].y)>Math.hypot(lm[2].x-lm[17].x,lm[2].y-lm[17].y)*1.15;
  const ix=lm[8].x-lm[5].x,iy=lm[8].y-lm[5].y,tx=lm[4].x-lm[2].x,ty=lm[4].y-lm[2].y;
  const cosA=(ix*tx+iy*ty)/(Math.hypot(ix,iy)*Math.hypot(tx,ty)+1e-6);
  const name=top&&top.score>.55?top.categoryName:'';
  if(name==='ILoveYou'||(I&&P&&!M&&!R&&T))return{g:3};
  if(I&&T&&!M&&!R&&!P&&cosA<.45)return{g:6};                                  // L shape
  if((name==='Victory'||(I&&M&&!R&&!P))){if(Math.abs(ix)>1.3*Math.abs(iy))return{g:5,side:ix>0?-1:1};return{g:1}}
  if(name==='Pointing_Up'||(I&&!M&&!R&&!P&&-iy>1.5*Math.abs(ix)))return{g:4};
  if(name==='Open_Palm'||(I&&M&&R&&P))return{g:0};
  if(name==='Closed_Fist'||(!I&&!M&&!R&&!P))return{g:2};
  return{g:null};
}
// ---- gesture -> effect mapping (user configurable) ----
let MAP;try{MAP=JSON.parse(localStorage.getItem('gs_map'))}catch(e){}
if(!Array.isArray(MAP))MAP=[];MAP=DEFMAP.map((d,i)=>MAP[i]!=null?MAP[i]:d);
function onGesture(g,ctx){const v=MAP[g];if(v==='off')return;let val=v;
  if(v==='r'){const pool=g>=7?['b0','b1','b2','b3']:['0','1','2','3','4','5','6'].filter(x=>+x!==U.uTo.value);val=pool[Math.floor(Math.random()*pool.length)]}
  if(val[0]==='b'){const b=+val[1];let dir=ctx&&ctx.dir;if(!dir)dir=[new THREE.Vector3(1,.3,.2),new THREE.Vector3(0,.1,1),null,new THREE.Vector3(1,0,0)][b];burst(b,dir)}
  else{setMode(+val);showLabel(GNAMES[g].replace(/（.*）/,'')+' · '+EFFECTS[+val])}}
window.onGesture=onGesture;
const gear=document.getElementById('gear'),panel=document.getElementById('panel');
const OPTS=EFFECTS.map((e,i)=>`<option value="${i}">${e}</option>`).join('')+BURSTS.map((b,i)=>`<option value="b${i}">${b}</option>`).join('')+'<option value="r">随机</option><option value="off">关闭</option>';
panel.innerHTML='<div class="ph">手势设置</div>'+GNAMES.map((n,g)=>`<label>${n}<select data-g="${g}">${OPTS}</select></label>`).join('')+'<button id="reset" class="ghost">恢复默认</button>';
const syncSel=()=>panel.querySelectorAll('select').forEach(sel=>{sel.value=MAP[sel.dataset.g]});syncSel();
panel.querySelectorAll('select').forEach(sel=>sel.onchange=()=>{MAP[sel.dataset.g]=sel.value;localStorage.setItem('gs_map',JSON.stringify(MAP))});
document.getElementById('reset').onclick=()=>{MAP=DEFMAP.slice();localStorage.setItem('gs_map',JSON.stringify(MAP));syncSel()};
gear.onclick=e=>{e.stopPropagation();panel.classList.toggle('on')};
addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&e.target!==gear)panel.classList.remove('on')});
