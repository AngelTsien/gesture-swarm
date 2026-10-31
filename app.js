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
  uTrail:{value:trailArr},uSpread:{value:1},uSize:{value:.24},uCenter:{value:new THREE.Vector2(0,.8)},uB:{value:.3},uCam:{value:cam.position},uTrail2:{value:trail2},uDual:{value:0},uSide:{value:1},uBT:{value:99},uBType:{value:0},uBF:{value:0},uHand:{value:new THREE.Vector2(0,.8)},uBDir:{value:new THREE.Vector3(1,0,0)},uScale:{value:1}};
U.uFrom.value=0;U.uTo.value=0;U.uModeT.value=9;U.uScale.value=0;
const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
vertexShader:/*glsl*/`
uniform float uTime,uFrom,uTo,uProg,uModeT,uN,uSpread,uSize;uniform vec2 uTrail[${TRAIL}];uniform vec2 uCenter;uniform vec3 uCam;uniform vec2 uTrail2[${TRAIL}];uniform float uDual,uSide,uBT,uBType,uBF;uniform vec2 uHand;uniform vec3 uBDir;uniform float uScale;
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
    float y=r.y*2.-1.,rr=sqrt(max(0.,1.-y*y)),th=r.x*6.2831+uTime*.22;
    D=normalize(vec3(cos(th)*rr,y,sin(th)*rr)+(vec3(h(aIdx*.71),h(aIdx*.53),h(aIdx*.91))-.5)*.35);
    float n=sin(D.x*3.1+uTime*.4)*sin(D.y*2.7-uTime*.3)*sin(D.z*3.3+1.);
    float rad=(1.25+n*.35+pow(h(aIdx*2.3),2.)*.9)*(1.+.06*sin(uTime*1.6+r.z*.8));           // uneven radius, some long spikes
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
  float p=clamp((uProg-h(aIdx*9.1)*.2)/(.3+h(aIdx*3.9)*.25),0.,1.);float e=p<.5?4.*p*p*p:1.-pow(-2.*p+2.,3.)/2.;
  vec3 P=mix(a,b,e);float zs=mix(uScale,1.,step(2.5,uTo)*step(uTo,3.5));P=vec3(uCenter,0.)+(P-vec3(uCenter,0.))*zs;vec3 sw=flow(P*.8+aRnd.xyz*2.,uTime)*(.9*sin(PI*e));P+=sw+flow(P*1.3+aRnd.xyz*9.,uTime*(.4+aRnd.w*.6)+aRnd.w*6.)*.06;
  vec3 dir=normalize(mix(df,D,e)+sw*.4+(vec3(h(aIdx*1.1),h(aIdx*1.3),h(aIdx*1.7))-.5)*.25+1e-4);
  float bsel=step(h(aIdx*8.8),uBF);float age=uBT-h(aIdx*4.7)*.3;
  if(bsel>.5&&age>0.&&age<1.9){
    float env=1.-smoothstep(1.1,1.9,age);vec3 bd;vec3 jit=vec3(h(aIdx*2.1),h(aIdx*2.7),h(aIdx*3.1))-.5;float spd=h(aIdx*5.3);
    if(uBType<.5){bd=normalize(uBDir+jit*.3);P=mix(P,vec3(uHand,0.)+jit*.5+bd*age*(9.+spd*9.),env);}
    else if(uBType<1.5){bd=normalize(uBDir+jit*.55);P+=bd*pow(age,1.3)*(6.+spd*7.)*env;}
    else if(uBType>2.5){bd=normalize(P-vec3(uCenter,0.)+jit*.6);bd.z*=.4;P+=bd*pow(age,.8)*(6.+spd*8.)*env;}
    else{bd=normalize(normalize(P-vec3(uCenter,0.)+jit*.3)+vec3(0.,0.,1.2));P+=bd*pow(age,1.2)*(7.+spd*7.)*env;}
    dir=normalize(mix(dir,bd,env));
  }
  vCol=mix(cf,C,e);float tl=mix(tf,T,e),sc=mix(sf,S,e)*uSize*(.6+.4*zs)*smoothstep(.02,.25,zs);
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
const BURSTS=['剑指发射','飞剑出鞘','冲击波','横扫','爆发'];let zoomT=1,zoomLab=1;
function setZoom(z){zoomT=Math.max(.45,Math.min(2.4,z));if(Math.abs(zoomT-zoomLab)>.12){showLabel(zoomT>zoomLab?'放大':'缩小');zoomLab=zoomT}}
const GNAMES=['张开手掌','两根手指（剑指）','握拳','我爱你','食指朝上','剑指横指','L 手势','快速剑指','向前甩手','双掌前推','挥臂横扫','双手拉开/合拢','捏合缩放','握拳→张开'];
const DEFMAP=['0','1','2','3','4','5','6','b0','b1','b2','b3','z','z','b4'];
const label=document.getElementById('label');let pending=null;
function showLabel(t){label.classList.remove('on');setTimeout(()=>{label.textContent=t;label.classList.add('on')},250)}
function setMode(m){
  if(m===U.uTo.value){pending=null;return}
  if(U.uProg.value<.5){pending=m;return}   // let the current morph finish: never snap
  U.uFrom.value=U.uTo.value;U.uTo.value=m;U.uProg.value=0;U.uModeT.value=0;pending=null;showLabel(EFFECTS[m]);
}
function burst(b,dir){if(U.uBT.value<.6)return;const T=[0,1,2,1,3][b];U.uBType.value=T;U.uBF.value=b==2||b==4?1:b==0?.35:.6;U.uBDir.value.copy(dir||new THREE.Vector3(0,.1,1));U.uBT.value=0;showLabel(BURSTS[b])}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();hideStart();if(k==='o'){open=true;showLabel('展开')}if(k==='f'){open=false;showLabel('收剑')}});
let simDual=false;

// One-Euro filter for the hand
class OneEuro{constructor(mc=1.2,b=.08){this.mc=mc;this.b=b;this.x=null;this.dx=0}
  a(c,dt){const t=1/(2*Math.PI*c);return 1/(1+t/dt)}
  f(v,dt){if(this.x===null){this.x=v;return v}const d=(v-this.x)/dt;this.dx+=this.a(1,dt)*(d-this.dx);
    const c=this.mc+this.b*Math.abs(this.dx);this.x+=this.a(c,dt)*(v-this.x);return this.x}}
const fx=new OneEuro(),fy=new OneEuro();let rawHand={x:0,y:.8},hand={x:0,y:.8},camOn=false,raw2=null,hand2={x:0,y:.8},dualT=0;const fx2=new OneEuro(),fy2=new OneEuro();
let last=performance.now(),tick=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000)||.016;last=now;
  U.uTime.value+=dt;U.uProg.value+=dt;U.uModeT.value+=dt;
  if(pending!==null&&U.uProg.value>=.5)setMode(pending);
  hand.x=fx.f(rawHand.x,dt);hand.y=fy.f(rawHand.y,dt);U.uHand.value.set(hand.x,hand.y);U.uCenter.value.lerp(new THREE.Vector2(rawHand.x,rawHand.y),.15);U.uModeT.value=Math.max(U.uModeT.value,9);U.uBT.value+=dt;{const tgt=open?1:0,rate=open?1/.4:1/.3;const v=U.uScale.value;U.uScale.value=tgt>v?Math.min(tgt,v+rate*dt):Math.max(tgt,v-rate*dt);U.uScale.value=U.uScale.value;}
  if(!camOn){const t=U.uTime.value;raw2=simDual?{x:-rawHand.x*.8,y:.8+Math.cos(t*.8)*1.2}:null}
  if(raw2){hand2.x=fx2.f(raw2.x,dt);hand2.y=fy2.f(raw2.y,dt)}
  U.uDual.value+=(((raw2&&(camOn?dualT>0:simDual))?1:0)-U.uDual.value)*.06;
  trail2[0].lerp(new THREE.Vector2(hand2.x,hand2.y),.25);for(let i=1;i<TRAIL;i++)trail2[i].lerp(trail2[i-1],.32);
  // smoothed trail (spring-follow chain)
  trailArr[0].lerp(new THREE.Vector2(hand.x,hand.y),.45);
  for(let i=1;i<TRAIL;i++)trailArr[i].lerp(trailArr[i-1],.45);
  const L=trailArr[0].distanceTo(trailArr[TRAIL-1]);U.uSpread.value+=((L<1.5?1:Math.max(0,1-(L-1.5)/2))-U.uSpread.value)*.03;
  rings.children.forEach((r,i)=>{r.material.opacity+=(((U.uTo.value===3&&U.uProg.value>.8)?.95:0)-r.material.opacity)*.04;r.rotation.z=U.uTime.value*(i?-.2:.15);const t=U.uTime.value;r.rotation.x=-1.38+Math.sin(t*.7+i*2)*.05;r.rotation.y=Math.sin(t*.5+i)*.06;r.position.y=(i?4.75:4.6)+Math.sin(t*.9+i*1.7)*.08;r.scale.setScalar(1+Math.sin(t*1.1+i)*.03)});comp.render(dt);tick++;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);window.__fps=()=>tick;

// ---- camera + MediaPipe ----
const video=document.getElementById('cam'),startEl=document.getElementById('start'),errEl=document.getElementById('err');
function hideStart(){startEl.classList.add('hide');if(!label.textContent)showLabel(EFFECTS[U.uTo.value])}
document.getElementById('nocam').onclick=()=>{hideStart()};
document.getElementById('camtoggle').onclick=()=>video.classList.toggle('on');
let open=false,cand=null,cnt=0,miss=0;
// one hand: {x,y,state:'open'|'fist'|null}. Only OPEN and FIST change state, after 8 consistent frames (~250ms).
function processHands(hands){
  const h=hands[0];
  if(!h){if(++miss>=8&&open){open=false;showLabel('收剑')}cand=null;cnt=0;return}
  miss=0;rawHand.x=h.x;rawHand.y=h.y;
  if(!h.state){cand=null;cnt=0;return}
  if(h.state===cand)cnt++;else{cand=h.state;cnt=1}
  if(cnt===8){const o=cand==='open';if(o!==open){open=o;showLabel(o?'展开':'收剑')}}
}
window.__sim=processHands;window.__c=()=>[U.uCenter.value.x,U.uCenter.value.y,U.uScale.value,open];
document.getElementById('go').onclick=async()=>{
  errEl.textContent='正在启动…';
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:640,height:480},audio:false});
    video.srcObject=stream;await video.play();video.classList.add('on');
    const V='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const {HandLandmarker,FilesetResolver}=await import(V+'/vision_bundle.mjs');
    const fs=await FilesetResolver.forVisionTasks(V+'/wasm');
    const o=d=>({baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:d},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minTrackingConfidence:.5});
    let rec;try{rec=await HandLandmarker.createFromOptions(fs,o('GPU'))}catch(e){rec=await HandLandmarker.createFromOptions(fs,o('CPU'))}
    hideStart();camOn=true;showLabel('举起手');let lt=-1;
    const hh=Math.tan(55/2*Math.PI/180)*11;
    const loop=()=>{
      if(video.readyState>=2&&video.currentTime!==lt){lt=video.currentTime;
        const r=rec.detectForVideo(video,performance.now());const hw=hh*cam.aspect;
        let best=-1,bs=-1;(r.landmarks||[]).forEach((lm,i)=>{const sc=r.handedness&&r.handedness[i]?r.handedness[i][0].score:(r.handednesses&&r.handednesses[i]?r.handednesses[i][0].score:.5);if(sc>bs){bs=sc;best=i}});
        if(best<0)processHands([]);else{const lm=r.landmarks[best],p=lm[9],w=lm[0],d=k=>Math.hypot(lm[k].x-w.x,lm[k].y-w.y);
          const ext=[8,12,16,20].map(k=>d(k)>d(k-2)*1.15),curl=[8,12,16,20].map(k=>d(k)<d(k-2)*1.0);
          const state=ext.every(Boolean)?'open':curl.every(Boolean)?'fist':null;
          processHands([{x:(.5-p.x)*2*hh*cam.aspect*.85,y:(.5-p.y)*2*hh*.85,state}])}
      }
      requestAnimationFrame(loop)};loop();
  }catch(e){errEl.textContent='摄像头启动失败：'+e.message}
};
