import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {AfterimagePass} from 'three/addons/postprocessing/AfterimagePass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const mobile=/iPad|iPhone|Android|Mobile/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.userAgent));
const N=mobile?20000:56000;
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
const DPR=Math.min(devicePixelRatio,mobile?1.5:2);renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth,innerHeight);document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,100);cam.position.set(0,0,11);
const comp=new EffectComposer(renderer);comp.addPass(new RenderPass(scene,cam));
const after=new AfterimagePass(.7);comp.addPass(after);
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.85,.45,.12);comp.addPass(bloom);
comp.addPass(new OutputPass());
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);comp.setSize(innerWidth,innerHeight)});

const idx=new Float32Array(N),rnd=new Float32Array(N*4),pos=new Float32Array(N*3);
for(let i=0;i<N;i++){idx[i]=i;for(let k=0;k<4;k++)rnd[i*4+k]=Math.random()}
const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
geo.setAttribute('aIdx',new THREE.BufferAttribute(idx,1));
geo.setAttribute('aRnd',new THREE.BufferAttribute(rnd,4));
const TRAIL=32;const trailArr=[];for(let i=0;i<TRAIL;i++)trailArr.push(new THREE.Vector2(0,.8));
const U={uTime:{value:0},uFrom:{value:0},uTo:{value:0},uProg:{value:9},uModeT:{value:0},uN:{value:N},
  uTrail:{value:trailArr},uSpread:{value:1},uSize:{value:(mobile?30:24)*DPR},uCenter:{value:new THREE.Vector2(0,.8)},uB:{value:mobile?.42:.24}};
const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
vertexShader:/*glsl*/`
uniform float uTime,uFrom,uTo,uProg,uModeT,uN,uSpread,uSize;uniform vec2 uTrail[${TRAIL}];uniform vec2 uCenter;
attribute float aIdx;attribute vec4 aRnd;varying vec3 vCol;varying float vA;
#define PI 3.14159265
float h(float n){return fract(sin(n)*43758.5453);}
vec3 flow(vec3 p,float t){return vec3(sin(p.y*1.7+t*.5)+sin(p.z*2.3-t*.3),sin(p.z*1.5+t*.4)+sin(p.x*2.1+t*.6),sin(p.x*1.3-t*.45)+sin(p.y*1.9+t*.35));}
vec3 C;
vec3 shape(float m,float mt){
  vec3 c=vec3(uCenter,0.);vec4 r=aRnd;
  if(m<.5){ // dandelion
    float sp=floor(aIdx/14.),k=mod(aIdx,14.)/2.,S=floor(uN/14.);
    float y=1.-2.*(sp+.5)/S,rr=sqrt(max(0.,1.-y*y)),th=sp*2.399963+uTime*.12;
    vec3 d=vec3(cos(th)*rr,y,sin(th)*rr);
    float rad=(1.25+k*.11+r.x*.03)*(1.+.025*sin(uTime*1.4+y*3.));
    C=mix(vec3(.18,.75,.62),vec3(1.,.82,.55),k/6.);vA=.55+k*.06;
    return c+d*rad;
  }else if(m<1.5){ // ribbon / fish school
    float u=pow(r.x,1.15),f=u*${TRAIL-1}.,i0=floor(f);
    vec2 a=uTrail[int(i0)],b=uTrail[int(min(i0+1.,${TRAIL-1}.))];vec2 p=mix(a,b,f-i0);
    float w=(.12+.75*sin(u*PI))*(.75+.25*sin(uTime*1.7+u*8.));
    float an=r.y*6.2831+uTime*.6;float rr=sqrt(r.z);
    vec3 o=vec3(cos(an)*w*rr*.9,sin(an)*w*rr*.38+sin(u*11.-uTime*2.6)*.22,sin(an)*w*rr*.9);
    o.x+=(u-.5)*7.*uSpread;
    C=mix(vec3(.15,.85,.55),vec3(.8,1.,.45),u);vA=.6;
    return vec3(p,0.)+o;
  }else if(m<2.5){ // fist: implode, burst, swirling globe
    float g=floor(aIdx/6.),k=mod(aIdx,6.),G=floor(uN/6.);
    float y=1.-2.*(g+.5)/G,rr=sqrt(max(0.,1.-y*y));
    float phi=g*2.399963+uTime*1.1*(1.25-abs(y))+k*.045;
    vec3 gl=vec3(cos(phi)*rr,y,sin(phi)*rr)*1.75;
    float t=mt,s;
    if(t<.28){float e=t/.28;s=1.-.97*e*e;}
    else if(t<.9){float e=(t-.28)/.62;s=.03+3.2*(1.-pow(1.-e,3.));}
    else{float e=clamp((t-.9)/1.3,0.,1.);e=e*e*(3.-2.*e);s=mix(3.23,1.,e);}
    float sc=s>1.?1.+(s-1.)*(.6+.8*r.z):s;
    C=mix(vec3(.62,.95,.35),vec3(1.,.86,.5),k/5.*.6+r.w*.4);vA=.5+k*.08;
    return c+gl*sc;
  }else{ // ILY: rising swords + halo rings
    if(r.w<.13){float j=floor(r.z*3.);float an=r.x*6.2831+uTime*(.25+j*.07);float R=2.+j*.75;
      C=mix(vec3(1.,.93,.8),vec3(1.,.75,.45),j*.5);vA=2.2;
      return vec3((j-1.)*2.8+cos(an)*R,3.6+sin(an)*R*.16-j*.1,-1.5+sin(an)*R*.5);}
    float PS=floor(uN/180.);float g=floor(aIdx/PS),k=mod(aIdx,PS)/PS*48.;float a1=h(g*1.37),a2=h(g*7.91),a3=h(g*3.13);
    float W=14.,H=12.,sx=(a1-.5)*W,sz=(a3-.5)*5.,sc=.6+a3*.8;
    float sy=mod(a2*H+uTime*(1.2+a2*1.8),H)-H*.5-.5;
    vec3 p=k<36.?vec3(sx,sy+(k/36.-.3)*1.7*sc,sz):vec3(sx+((k-36.)/12.-.5)*.65*sc,sy+.32*sc,sz);
    C=mod(g,5.)<1.?vec3(1.,.82,.45):mix(vec3(.25,.95,.6),vec3(.7,1.,.55),a1);vA=k<36.?1.-k/60.:.9;
    return p;
  }
}
void main(){
  vec3 cf,ct;float af,at;
  vec3 a=shape(uFrom,9.);cf=C;af=vA;
  vec3 b=shape(uTo,uModeT);ct=C;at=vA;
  float p=clamp((uProg-aRnd.z*.55)/1.15,0.,1.);float e=p<.5?4.*p*p*p:1.-pow(-2.*p+2.,3.)/2.;
  vec3 P=mix(a,b,e);
  P+=flow(P*.8+aRnd.xyz*2.,uTime)*(.9*sin(PI*e));      // curl-like sweep during morph
  P+=flow(P*1.3,uTime*.6+aRnd.w*6.)*.018;                  // always-alive drift
  vCol=mix(cf,ct,e);vA=mix(af,at,e);
  vec4 mv=modelViewMatrix*vec4(P,1.);gl_Position=projectionMatrix*mv;
  gl_PointSize=uSize*(.45+aRnd.w*.6)/-mv.z;
}`,
fragmentShader:/*glsl*/`
uniform float uB;varying vec3 vCol;varying float vA;
void main(){vec2 d=gl_PointCoord-.5;float r2=dot(d,d)*4.;if(r2>1.)discard;
float a=exp(-r2*4.)*.9+ (1.-r2)*.1;gl_FragColor=vec4(vCol*a*vA*uB,1.);}`});
const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;scene.add(pts);

const NAMES=['张开手掌','两根手指','握拳','我爱你'];const ID={palm:0,two:1,fist:2,ily:3};
const label=document.getElementById('label');let pending=null;
function showLabel(t){label.classList.remove('on');setTimeout(()=>{label.textContent=t;label.classList.add('on')},250)}
function setMode(m){
  if(m===U.uTo.value){pending=null;return}
  if(U.uProg.value<1.2){pending=m;return}   // let the current morph finish: never snap
  U.uFrom.value=U.uTo.value;U.uTo.value=m;U.uProg.value=0;U.uModeT.value=0;pending=null;showLabel(NAMES[m]);
}
addEventListener('keydown',e=>{const m={1:0,2:1,3:2,4:3}[e.key];if(m!==undefined){hideStart();setMode(m)}});

// One-Euro filter for the hand
class OneEuro{constructor(mc=.8,b=.02){this.mc=mc;this.b=b;this.x=null;this.dx=0}
  a(c,dt){const t=1/(2*Math.PI*c);return 1/(1+t/dt)}
  f(v,dt){if(this.x===null){this.x=v;return v}const d=(v-this.x)/dt;this.dx+=this.a(1,dt)*(d-this.dx);
    const c=this.mc+this.b*Math.abs(this.dx);this.x+=this.a(c,dt)*(v-this.x);return this.x}}
const fx=new OneEuro(),fy=new OneEuro();let rawHand={x:0,y:.8},hand={x:0,y:.8},camOn=false;
let last=performance.now(),tick=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000)||.016;last=now;
  U.uTime.value+=dt;U.uProg.value+=dt;U.uModeT.value+=dt;
  if(pending!==null&&U.uProg.value>=1.2)setMode(pending);
  if(!camOn){const t=U.uTime.value;rawHand.x=Math.sin(t*.45)*3.6;rawHand.y=.8+Math.sin(t*.9)*1.1}
  hand.x=fx.f(rawHand.x,dt);hand.y=fy.f(rawHand.y,dt);
  // smoothed trail (spring-follow chain)
  trailArr[0].lerp(new THREE.Vector2(hand.x,hand.y),.25);
  for(let i=1;i<TRAIL;i++)trailArr[i].lerp(trailArr[i-1],.32);
  const L=trailArr[0].distanceTo(trailArr[TRAIL-1]);U.uSpread.value+=((L<1.5?1:Math.max(0,1-(L-1.5)/2))-U.uSpread.value)*.03;
  comp.render(dt);tick++;requestAnimationFrame(frame);
}
requestAnimationFrame(frame);window.__fps=()=>tick;

// ---- camera + MediaPipe ----
const video=document.getElementById('cam'),startEl=document.getElementById('start'),errEl=document.getElementById('err');
function hideStart(){startEl.classList.add('hide');if(!label.textContent)showLabel(NAMES[U.uTo.value])}
document.getElementById('nocam').onclick=()=>{hideStart()};
document.getElementById('camtoggle').onclick=()=>video.classList.toggle('on');
document.getElementById('go').onclick=async()=>{
  errEl.textContent='正在启动…';
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:640,height:480},audio:false});
    video.srcObject=stream;await video.play();video.classList.add('on');
    const V='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const {GestureRecognizer,FilesetResolver}=await import(V+'/vision_bundle.mjs');
    const fs=await FilesetResolver.forVisionTasks(V+'/wasm');
    const o=d=>({baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',delegate:d},runningMode:'VIDEO',numHands:1});
    let rec;try{rec=await GestureRecognizer.createFromOptions(fs,o('GPU'))}catch(e){rec=await GestureRecognizer.createFromOptions(fs,o('CPU'))}
    hideStart();camOn=true;showLabel('举起手');
    let cand=null,cnt=0,lt=-1;
    const loop=()=>{
      if(video.readyState>=2&&video.currentTime!==lt){lt=video.currentTime;
        const r=rec.recognizeForVideo(video,performance.now());
        if(r.landmarks&&r.landmarks[0]){const lm=r.landmarks[0],p=lm[9];
          const hh=Math.tan(55/2*Math.PI/180)*11,hw=hh*cam.aspect;rawHand.x=(.5-p.x)*2*hw*.85;rawHand.y=(.5-p.y)*2*hh*.85;
          U.uCenter.value.lerp(new THREE.Vector2(rawHand.x*.25,.8+rawHand.y*.15),.04);
          const g=classify(r.gestures[0]&&r.gestures[0][0],lm);
          if(g!==null){if(g===cand)cnt++;else{cand=g;cnt=1}if(cnt>=5)setMode(g)}}
      }
      requestAnimationFrame(loop)};loop();
  }catch(e){errEl.textContent='摄像头启动失败：'+e.message+'（可用键盘 1-4）'}
};
function classify(top,lm){
  const map={Open_Palm:0,Victory:1,Closed_Fist:2,ILoveYou:3};
  if(top&&top.score>.55&&map[top.categoryName]!==undefined)return map[top.categoryName];
  const w=lm[0],d=a=>Math.hypot(a.x-w.x,a.y-w.y),ext=f=>d(lm[f])>d(lm[f-2])*1.1;
  const I=ext(8),M=ext(12),R=ext(16),P=ext(20),T=Math.hypot(lm[4].x-lm[17].x,lm[4].y-lm[17].y)>Math.hypot(lm[2].x-lm[17].x,lm[2].y-lm[17].y)*1.1;
  if(I&&M&&R&&P)return 0;if(I&&M&&!R&&!P)return 1;if(I&&P&&!M&&!R&&T)return 3;if(!I&&!M&&!R&&!P)return 2;return null;
}
