(function(){
'use strict';
var $=function(s){return document.querySelector(s)};
if(!window.THREE){
  document.body.insertAdjacentHTML('beforeend','<p style="padding:24px;color:#fff">The 3D engine could not load. Check your connection and reload.</p>');
  return;
}
var REDUCED=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---------- icons ---------- */
var IC={
  play:'<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  pause:'<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  vol:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11"/>',
  mute:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  fs:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  up:'<path d="M6 15l6-6 6 6"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  img:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  min:'<path d="M6 12h12"/>',
  max:'<path d="M12 6v12M6 12h12"/>',
  lr:'<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  map:'<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  pin:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  home:'<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  expand:'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  save:'<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'
};
function svg(n,s){s=s||18;return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||'')+'</svg>'}
document.querySelectorAll('[data-ic]').forEach(function(e){e.innerHTML=svg(e.dataset.ic)});
$('#cmpH').innerHTML=svg('lr',20);

/* ---------- state ---------- */
var S={projectId:null,name:'Untitled tour',media:new Map(),scenes:[],active:null,mode:'edit',adding:false,addingMarker:false,sel:null,
  playing:true,muted:true,demo:false,railOpen:true,inspOpen:window.innerWidth>900,inspTab:'scene',mapPopoutOpen:false,mapEnlarged:false,
  dial:0,altNames:['Primary','Alternative'],map:null,placing:null,busy:false,pendingMap:false,viewOnly:false,
  startScreen:{enabled:false,imgUrl:null,title:'Welcome to the Tour',desc:''},
  markerPool:[], walkthrough:[], walkthroughActive:false, walkthroughStep:0};

var app=$('#app'),stage=$('#stage'),canvas=$('#gl'),hsBox=$('#hs'),ghost=$('#ghost'),gctx=ghost.getContext('2d');
var uid=function(){return Math.random().toString(36).slice(2,9)};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var D2R=Math.PI/180,R2D=180/Math.PI;
var shortest=function(a){return ((a%360)+540)%360-180};
var ease=function(p){return p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2};
var getScene=function(id){return S.scenes.find(function(s){return s.id===id})};
var curScene=function(){return getScene(S.active)};

function variant(sc){return (S.dial >= 0.5 && sc.v[1]) ? sc.v[1] : sc.v[0]}
function variantIndex(sc){return (S.dial >= 0.5 && sc.v[1]) ? 1 : 0}
function dispMedia(sc){var v=variant(sc);return [v.a?S.media.get(v.a)||null:null,v.b?S.media.get(v.b)||null:null]}
function leadVideo(){
  var sc=curScene();if(!sc)return null;
  var p=dispMedia(sc);
  for(var i=0;i<2;i++)if(p[i]&&p[i].kind==='video'&&p[i].el)return p[i];
  return null;
}
function normScene(sc){
  if(!sc.v){sc.v=[{a:sc.mediaId||null,b:null},null];delete sc.mediaId}
  if(sc.cmp==null)sc.cmp=.5;
  if(!sc.mapPos)sc.mapPos=null;
  if(!sc.hotspots)sc.hotspots=[];
  if(!sc.markers)sc.markers=[];
  return sc;
}

/* ---------- helper utilities for Base64 Export & Import ---------- */
function blobToDataURL(blob){
  return new Promise(function(res, rej){
    if(!blob) return res(null);
    var reader = new FileReader();
    reader.onload = function(){ res(reader.result); };
    reader.onerror = function(e){ rej(e); };
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataUrl){
  if(!dataUrl) return Promise.resolve(null);
  return fetch(dataUrl).then(function(r){ return r.blob(); });
}

/* ---------- three.js engine with continuous alpha blend shader ---------- */
var VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
var FS=[
'uniform sampler2D mapA;uniform sampler2D mapB;',
'uniform vec4 rectA;uniform vec4 rectB;uniform vec4 flags;',
'uniform float split;uniform float splitOn;uniform float altMix;',
'varying vec2 vUv;',
'const vec3 BG=vec3(0.0,0.0,0.0);',
'void main(){',
'   vec2 ua=vUv;vec2 ub=vUv;float ma=1.0;float mb=1.0;',
'   if(flags.z>0.5){ua.x=(ua.x-0.25)*2.0;ma=step(0.0,ua.x)*step(ua.x,1.0);}',
'   if(flags.w>0.5){ub.x=(ub.x-0.25)*2.0;mb=step(0.0,ub.x)*step(ub.x,1.0);}',
'   vec3 ca=texture2D(mapA,ua*rectA.xy+rectA.zw).rgb;',
'   vec3 cb=texture2D(mapB,ub*rectB.xy+rectB.zw).rgb;',
'   ca=mix(BG,ca,ma*flags.x);cb=mix(BG,cb,mb*flags.y);',
'   float useB=mix(altMix, step(split,gl_FragCoord.x), splitOn);',
'   gl_FragColor=vec4(mix(ca,cb,useB),1.0);',
'}'
].join('\n');

var renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
renderer.setClearColor(0x000000);
var maxTex=renderer.capabilities.maxTextureSize||4096;
var scene3=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(75,1,.1,1100);
var geo=new THREE.SphereGeometry(500,72,48);geo.scale(-1,1,1);
var blank=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat);blank.needsUpdate=true;
var U={
  mapA:{value:blank},mapB:{value:blank},
  rectA:{value:new THREE.Vector4(1,1,0,0)},rectB:{value:new THREE.Vector4(1,1,0,0)},
  flags:{value:new THREE.Vector4(0,0,0,0)},split:{value:0},splitOn:{value:0},altMix:{value:0}
};
scene3.add(new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:U,vertexShader:VS,fragmentShader:FS})));

var lon=180,lat=0,fov=75,vlon=0,vlat=0,baseFov=75;
function dirFrom(lo,la,out){var cl=Math.cos(la*D2R);return out.set(cl*Math.cos(lo*D2R),Math.sin(la*D2R),cl*Math.sin(lo*D2R))}
var _d=new THREE.Vector3(),_f=new THREE.Vector3(),_p=new THREE.Vector3();
function updateCamera(){
  lat=clamp(lat,-85,85);
  if(lon>360||lon<-360)lon=lon%360;
  camera.fov=fov;camera.updateProjectionMatrix();
  camera.lookAt(dirFrom(lon,lat,_d));
  camera.updateMatrixWorld();
}
function resize(){
  var w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  renderMap();
}
if(window.ResizeObserver)new ResizeObserver(resize).observe(stage);
window.addEventListener('resize',resize);

/* ---------- media loading ---------- */
var demoTimers=[];
var vstore=$('#vstore');
function makeVideoEl(src,stream){
  var v=document.createElement('video');
  v.loop=true;v.muted=true;v.playsInline=true;v.preload='auto';
  v.setAttribute('playsinline','');v.setAttribute('muted','');
  if(stream)v.srcObject=stream;else v.src=src;
  vstore.appendChild(v);
  return v;
}
function isReady(m){
  if(!m||!m.el)return false;
  return m.kind==='photo'?(m.el.complete&&m.el.naturalWidth>0):m.el.readyState>=2;
}
function getTexture(m){
  if(m.tex)return m.tex;
  var t;
  if(m.canvas){t=new THREE.CanvasTexture(m.canvas);t.minFilter=THREE.LinearFilter;t.generateMipmaps=false}
  else if(m.kind==='video'){t=new THREE.VideoTexture(m.el);t.minFilter=THREE.LinearFilter;t.generateMipmaps=false}
  else{
    var im=m.el,w=im.naturalWidth,h=im.naturalHeight;
    if(Math.max(w,h)>maxTex){
      var k=maxTex/Math.max(w,h),c=document.createElement('canvas');
      c.width=Math.floor(w*k);c.height=Math.floor(h*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      t=new THREE.CanvasTexture(c);
    }else t=new THREE.Texture(im);
    t.needsUpdate=true;
  }
  t.magFilter=THREE.LinearFilter;
  m.tex=t;return t;
}
var PROJECTIONS={eq360:'Equirectangular 360',eq180:'Equirectangular 180'};
var LAYOUTS={mono:'Monoscopic (single image)',tb:'Stereo top-bottom (use top eye)',sbs:'Stereo side-by-side (use left eye)'};
function setRect(vec,m){
  var l=m.layout||'mono';
  if(l==='tb')vec.set(1,.5,0,.5);else if(l==='sbs')vec.set(.5,1,0,0);else vec.set(1,1,0,0);
}

function refreshMap(){
  var sc=curScene();
  if(!sc){
    U.flags.value.set(0,0,0,0);
    return;
  }

  var mA=null, mB=null;
  var vActive=variant(sc);

  if(vActive.a && vActive.b){
    mA=S.media.get(vActive.a)||null;
    mB=S.media.get(vActive.b)||null;
    U.splitOn.value=1.0;
  } else if(sc.v[0] && sc.v[1] && sc.v[0].a && sc.v[1].a){
    mA=S.media.get(sc.v[0].a)||null;
    mB=S.media.get(sc.v[1].a)||null;
    U.splitOn.value=0.0;
  } else {
    mA=S.media.get(vActive.a)||null;
    mB=null;
    U.splitOn.value=0.0;
  }

  U.altMix.value = S.dial;

  var pair=[mA,mB], pend=false, fl=[0,0,0,0];
  [0,1].forEach(function(i){
    var m=pair[i],ok=!!(m&&isReady(m)),key=i?'B':'A';
    if(m&&!ok)pend=true;
    U['map'+key].value=ok?getTexture(m):blank;
    if(ok)setRect(U['rect'+key].value,m);
    fl[i]=ok?1:0;fl[2+i]=(ok&&m.projection==='eq180')?1:0;
  });
  U.flags.value.set(fl[0],fl[1],fl[2],fl[3]);
  S.pendingMap=pend;
}

function onMediaError(m){
  if(m._dead)return;
  if(!m._retried&&m.blob&&m.blob.size<250*1024*1024){
    m._retried=true;
    var fr=new FileReader();
    fr.onload=function(){
      if(m.url&&m.url.indexOf('blob:')===0)URL.revokeObjectURL(m.url);
      m.url=fr.result;m.el.src=m.url;
      if(m.kind==='video'){m.el.load();if(S.playing)m.el.play().catch(function(){})}
    };
    fr.onerror=function(){reportFail(m)};
    fr.readAsDataURL(m.blob);
    return;
  }
  reportFail(m);
}
function reportFail(m){
  m._dead=true;
  var why=m.kind==='video'?'Cannot decode video. Re-export as H.264 MP4/WebM.':'Could not read image.';
  toast('Could not open "'+m.name+'". '+why,8000);
}
function checkAspect(m){
  if(!m.w||!m.h)return;
  var r=m.w/m.h;
  if(r<1.3)m.layout='tb';
  else if(r>3)m.layout='sbs';
  else m.layout='mono';
  refreshMap();renderInsp();save();
}
function thumbFrom(m,el){
  try{
    var c=document.createElement('canvas');c.width=192;c.height=96;
    var sw=el.videoWidth||el.naturalWidth,sh=el.videoHeight||el.naturalHeight;
    if(m.layout==='tb')sh=sh/2;else if(m.layout==='sbs')sw=sw/2;
    c.getContext('2d').drawImage(el,0,0,sw,sh,0,0,192,96);
    m.thumb=c.toDataURL('image/jpeg',.7);
    renderRail();save();
  }catch(e){}
}
function loadMedia(m){
  if(m.kind==='photo'){
    var im=new Image();im.decoding='async';
    im.onload=function(){m.w=im.naturalWidth;m.h=im.naturalHeight;if(m._fresh){checkAspect(m);m._fresh=false}if(!m.thumb)thumbFrom(m,im)};
    im.onerror=function(){onMediaError(m)};
    im.src=m.url;m.el=im;
  }else{
    var v=makeVideoEl(m.url);m.el=v;
    v.addEventListener('loadedmetadata',function(){m.w=v.videoWidth;m.h=v.videoHeight;if(m._fresh){checkAspect(m);m._fresh=false}});
    v.addEventListener('loadeddata',function(){if(!m.thumb)thumbFrom(m,v)},{once:true});
    v.addEventListener('error',function(){onMediaError(m)});
    if(S.playing)v.play().catch(function(){});
  }
}
function dropMedia(m){
  try{if(m.el&&m.el.pause)m.el.pause()}catch(e){}
  if(m.el&&m.el.remove)m.el.remove();
  if(m.tex)m.tex.dispose();
  if(m.url&&m.url.indexOf('blob:')===0)URL.revokeObjectURL(m.url);
  S.media.delete(m.id);
}
function gcMedia(){
  var used=new Set();
  S.scenes.forEach(function(s){s.v.forEach(function(v){if(v){if(v.a)used.add(v.a);if(v.b)used.add(v.b)}})});
  Array.from(S.media.values()).forEach(function(m){if(!used.has(m.id))dropMedia(m)});
}
function videos(){return Array.from(S.media.values()).filter(function(m){return m.kind==='video'&&m.el})}
function kindOf(f){
  if(/^video\//.test(f.type))return 'video';
  if(/^image\//.test(f.type))return 'photo';
  var x=(f.name.split('.').pop()||'').toLowerCase();
  if(['mp4','m4v','mov','webm','mkv','ogv'].indexOf(x)>-1)return 'video';
  if(['jpg','jpeg','png','webp','avif','gif','bmp'].indexOf(x)>-1)return 'photo';
  return null;
}
function addMedia(f){
  var m={id:uid(),kind:kindOf(f),name:f.name.replace(/\.[^.]+$/,''),blob:f,url:URL.createObjectURL(f),_fresh:true,layout:'mono',projection:'eq360'};
  S.media.set(m.id,m);loadMedia(m);return m;
}

/* ---------- playback ---------- */
function playAll(){S.playing=true;videos().forEach(function(m){m.el.play().catch(function(){})})}
function pauseAll(){S.playing=false;videos().forEach(function(m){m.el.pause()})}
function applyAudio(){
  var a=leadVideo();
  videos().forEach(function(m){m.el.muted=!(m===a&&!S.muted)});
}
function seekAll(frac){
  var a=leadVideo();if(!a||!isFinite(a.el.duration))return;
  var t=frac*a.el.duration;
  videos().forEach(function(m){
    var d=m.el.duration;if(!isFinite(d)||!d)return;
    try{m.el.currentTime=Math.min(t%d,d-.05)}catch(e){}
  });
}

/* ---------- transitions & camera ---------- */
var navTok=0,snapReq=null;
function snapshot(){
  return new Promise(function(res){
    var done=false;
    function fin(v){if(!done){done=true;snapReq=null;res(v)}}
    snapReq=fin;
    setTimeout(function(){fin(false)},250);
  });
}
function fadeGhost(ms,scale){
  ghost.style.transition='none';ghost.style.opacity='1';ghost.style.transform='scale(1)';
  void ghost.offsetWidth;
  ghost.style.transition='opacity '+ms+'ms ease,transform '+ms+'ms ease';
  ghost.style.opacity='0';ghost.style.transform='scale('+(scale||1.05)+')';
}
function tween(ms,fn,tok){
  return new Promise(function(res){
    var t0=performance.now();
    (function step(){
      var p=Math.min(1,(performance.now()-t0)/ms);
      fn(p);
      if(tok!==navTok && tok!==undefined){res(false);return}
      if(p<1)requestAnimationFrame(step);else res(true);
    })();
  });
}
function goTo(id,o){
  o=o||{};
  var sc=getScene(id);if(!sc||id===S.active)return;
  var tok=++navTok;
  if(o.instant||!S.active||REDUCED){S.busy=false;applyScene(sc);return}
  if(!S.busy)baseFov=fov;
  S.busy=true;
  var l0=lon,a0=lat,f0=baseFov,hs=o.hs;
  hsBox.classList.add('quiet');
  var p1=hs?tween(430,function(p){var e=ease(p);lon=l0+shortest(hs.lon-l0)*e;lat=a0+(hs.lat-a0)*e;fov=f0*(1-.18*e)},tok):Promise.resolve(true);
  p1.then(function(ok){if(!ok||tok!==navTok)return false;return snapshot()}).then(function(ok){
    if(tok!==navTok)return;
    applyScene(sc,{baseFov:f0});
    if(ok)fadeGhost(760,1.1);
    var target=sc.view?sc.view.fov:f0;
    fov=target*.9;
    return tween(950,function(p){fov=target*(.9+.1*ease(p))},tok).then(function(done){if(done){S.busy=false;fov=target}});
  });
}
function applyScene(sc,o){
  o=o||{};
  S.active=sc.id;S.sel=null;S.placing=null;cancelAdd(true);cancelAddMarker(true);
  if(sc.view){lon=sc.view.lon;lat=sc.view.lat;fov=sc.view.fov;vlon=vlat=0}
  else if(o.baseFov)fov=o.baseFov;
  refreshMap();applyAudio();
  buildHotspotsAndMarkers();renderRail();renderInsp();renderMap();layout();
  hsBox.classList.remove('quiet');
}

/* ---------- continuous alternate scene slider logic ---------- */
function setDial(v){
  S.dial = clamp(v, 0, 1);
  var slider = $('#dialSlider');
  if(slider && document.activeElement !== slider) slider.value = S.dial;
  refreshMap();
  save();
}

function renderDial(){
  $('#dialL').textContent = S.altNames[0] || 'Primary';
  $('#dialR').textContent = S.altNames[1] || 'Alternative';
  var slider = $('#dialSlider');
  if(slider && document.activeElement !== slider) slider.value = S.dial;
}

$('#dialSlider').addEventListener('input', function(e){
  setDial(parseFloat(e.target.value));
});

/* ---------- hotspots & markers UI & dragging ---------- */
var hsEls=new Map();
var dragItem=null;

function buildHotspotsAndMarkers(){
  hsBox.innerHTML='';hsEls.clear();
  var sc=curScene();if(!sc)return;

  (sc.hotspots||[]).forEach(function(h){
    var t=getScene(h.target);if(!t)return;
    var b=document.createElement('button');
    b.className='hsp'+(h.id===S.sel?' sel':'');
    var descHtml=h.desc?'<span class="desc">'+esc(h.desc)+'</span>':'';
    b.innerHTML='<span class="dot">'+svg('up',20)+'</span><div class="card-hover"><span class="nm">'+esc(t.name)+'</span>'+descHtml+'</div>';
    b.setAttribute('aria-label','Go to '+t.name);
    b._h=h;b._kind='hotspot';
    
    attachDragHandler(b, h);

    b.addEventListener('click',function(e){
      if(b._dragged){b._dragged=false;return}
      e.stopPropagation();
      if(S.mode==='view'){goTo(h.target,{hs:h})}
      else if(!S.viewOnly){S.sel=h.id;markSel();renderInsp()}
    });
    b.addEventListener('dblclick',function(e){e.stopPropagation();goTo(h.target,{hs:h})});
    b.addEventListener('mouseenter',function(){pinHot(h.target,true)});
    b.addEventListener('mouseleave',function(){pinHot(h.target,false)});
    hsBox.appendChild(b);hsEls.set(h.id,b);
  });

  (sc.markers||[]).forEach(function(m){
    var poolItem = S.markerPool.find(p => p.id === m.poolId) || m;
    var name = poolItem.name || m.name || 'Marker';
    var desc = poolItem.desc || m.desc || '';

    var b=document.createElement('button');
    b.className='mrk'+(m.id===S.sel?' sel':'');
    var descHtml=desc?'<span class="desc-drop">'+esc(desc)+'</span>':'<span class="desc-drop">No description provided.</span>';
    b.innerHTML='<span class="dot">'+svg('pin',16)+'</span><div class="card-hover"><span class="nm">'+esc(name)+'</span><span class="sub">click for details</span>'+descHtml+'</div>';
    b.setAttribute('aria-label','Marker: '+name);
    b._h=m;b._kind='marker';

    attachDragHandler(b, m);

    b.addEventListener('click',function(e){
      if(b._dragged){b._dragged=false;return}
      e.stopPropagation();
      b.classList.toggle('open');
      if(S.mode==='edit' && !S.viewOnly){S.sel=m.id;markSel();renderInsp()}
    });
    hsBox.appendChild(b);hsEls.set(m.id,b);
  });
}

function attachDragHandler(el, item){
  el.addEventListener('pointerdown', function(e){
    e.stopPropagation();
    if(S.mode !== 'edit' || S.viewOnly) return;
    if(e.button !== 0) return;
    try{el.setPointerCapture(e.pointerId)}catch(_){}
    dragItem = {el: el, item: item, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId};
  });
}

stage.addEventListener('pointermove', function(e){
  if(!dragItem || dragItem.id !== e.pointerId) return;
  var dx = Math.abs(e.clientX - dragItem.x), dy = Math.abs(e.clientY - dragItem.y);
  if(dx + dy > 4) dragItem.moved = true;

  if(dragItem.moved){
    dragItem.el._dragged = true;
    var r = canvas.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    var ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    var v = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    dragItem.item.lon = Math.atan2(v.z, v.x) * R2D;
    dragItem.item.lat = Math.asin(clamp(v.y, -1, 1)) * R2D;
    updateHotspots();
  }
});

function endItemDrag(e){
  if(!dragItem || dragItem.id !== e.pointerId) return;
  var d = dragItem; dragItem = null;
  if(d.moved){
    save();
    renderInsp();
  }
}
stage.addEventListener('pointerup', endItemDrag);
stage.addEventListener('pointercancel', endItemDrag);

function markSel(){
  hsEls.forEach(function(el,id){el.classList.toggle('sel',id===S.sel)});
}
function pinHot(target,on){
  var mapPins=$('#mapPins');if(!mapPins)return;
  mapPins.querySelectorAll('.pin').forEach(function(p){p.classList.toggle('hot',on&&p.dataset.id===target)});
}
function updateHotspots(){
  if(!hsEls.size)return;
  camera.getWorldDirection(_f);
  var w=stage.clientWidth,h=stage.clientHeight;
  hsEls.forEach(function(el){
    var o=el._h;dirFrom(o.lon,o.lat,_p);
    if(_p.dot(_f)<.05){el.style.visibility='hidden';return}
    _p.multiplyScalar(400).project(camera);
    var x=(_p.x*.5+.5)*w,y=(-_p.y*.5+.5)*h;
    if(x<-80||x>w+80||y<-80||y>h+80){el.style.visibility='hidden';return}
    el.style.visibility='visible';
    el.style.transform='translate('+(x-19).toFixed(1)+'px,'+(y-19).toFixed(1)+'px)';
  });
}

function placeHotspot(cx,cy){
  if(S.viewOnly)return;
  var sc=curScene();if(!sc)return;
  var others=S.scenes.filter(function(s){return s.id!==sc.id});
  if(!others.length){cancelAdd();toast('Add a second scene first, then link to it.');return}
  var r=canvas.getBoundingClientRect();
  var nx=((cx-r.left)/r.width)*2-1,ny=-((cy-r.top)/r.height)*2+1;
  var v=new THREE.Vector3(nx,ny,.5).unproject(camera).sub(camera.position).normalize();
  var h={id:uid(),lon:Math.atan2(v.z,v.x)*R2D,lat:Math.asin(clamp(v.y,-1,1))*R2D,target:others[0].id,desc:''};
  if(!sc.hotspots)sc.hotspots=[];
  sc.hotspots.push(h);S.sel=h.id;S.adding=false;S.inspOpen=true;
  buildHotspotsAndMarkers();renderInsp();renderMap();layout();hideHint();save();
  toast('Hotspot placed. Set destination in settings.');
}

function placeMarker(cx,cy){
  if(S.viewOnly)return;
  var sc=curScene();if(!sc)return;
  var r=canvas.getBoundingClientRect();
  var nx=((cx-r.left)/r.width)*2-1,ny=-((cy-r.top)/r.height)*2+1;
  var v=new THREE.Vector3(nx,ny,.5).unproject(camera).sub(camera.position).normalize();
  
  var poolId = uid();
  var pItem = {id: poolId, name: 'Point of Interest', desc: ''};
  S.markerPool.push(pItem);

  var m={id:uid(), poolId: poolId, lon:Math.atan2(v.z,v.x)*R2D, lat:Math.asin(clamp(v.y,-1,1))*R2D};
  if(!sc.markers)sc.markers=[];
  sc.markers.push(m);S.sel=m.id;S.addingMarker=false;S.inspOpen=true;
  buildHotspotsAndMarkers();renderInsp();layout();hideHint();save();
  toast('Marker placed & added to pool. Edit details in inspector.');
}

function cancelAdd(silent){if(!S.adding)return;S.adding=false;layout();hideHint();renderInsp()}
function cancelAddMarker(silent){if(!S.addingMarker)return;S.addingMarker=false;layout();hideHint();renderInsp()}

/* ---------- interaction ---------- */
var ptrs=new Map(),drag=null,pinch=0;
function pdist(){var a=Array.from(ptrs.values());return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
stage.addEventListener('pointerdown',function(e){
  if(S.busy)return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  try{stage.setPointerCapture(e.pointerId)}catch(_){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){drag={x:e.clientX,y:e.clientY,t:performance.now(),moved:0};vlon=vlat=0;stage.classList.add('dragging')}
  else if(ptrs.size===2){pinch=pdist();drag=null}
});
stage.addEventListener('pointermove',function(e){
  var p=ptrs.get(e.pointerId);if(!p)return;
  if(ptrs.size===2){
    p.x=e.clientX;p.y=e.clientY;
    var d=pdist();if(pinch>0){fov=clamp(fov*pinch/d,35,100)}pinch=d;return;
  }
  if(!drag)return;
  var dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  var k=fov/stage.clientHeight;
  lon-=dx*k;lat+=dy*k;vlon=-dx*k;vlat=dy*k;drag.moved+=Math.abs(dx)+Math.abs(dy);
});
function endPtr(e){
  if(!ptrs.has(e.pointerId))return;
  var wasDrag=drag;ptrs.delete(e.pointerId);
  if(ptrs.size===0){
    stage.classList.remove('dragging');
    if(wasDrag&&e.type==='pointerup'&&wasDrag.moved<6&&performance.now()-wasDrag.t<500){
      if(S.adding&&S.mode==='edit'&&!S.viewOnly)placeHotspot(e.clientX,e.clientY);
      else if(S.addingMarker&&S.mode==='edit'&&!S.viewOnly)placeMarker(e.clientX,e.clientY);
      vlon=vlat=0;
    }
    drag=null;pinch=0;
  }else if(ptrs.size===1){
    var r=Array.from(ptrs.values())[0];drag={x:r.x,y:r.y,t:performance.now(),moved:99};pinch=0;
  }
}
stage.addEventListener('pointerup',endPtr);
stage.addEventListener('pointercancel',endPtr);
stage.addEventListener('wheel',function(e){e.preventDefault();if(S.busy)return;fov=clamp(fov+e.deltaY*.05,35,100)},{passive:false});
document.addEventListener('keydown',function(e){
  var t=e.target,tag=t&&t.tagName;
  if(e.key==='Escape'){
    if(S.adding){cancelAdd();return}
    if(S.addingMarker){cancelAddMarker();return}
    if(S.placing){S.placing=null;renderMap();hideHint();renderInsp();return}
  }
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||(t&&t.id==='cmpH'))return;
  if(e.key==='ArrowLeft'){lon-=4;e.preventDefault()}
  else if(e.key==='ArrowRight'){lon+=4;e.preventDefault()}
  else if(e.key==='ArrowUp'){lat+=4;e.preventDefault()}
  else if(e.key==='ArrowDown'){lat-=4;e.preventDefault()}
  else if(e.key===' '&&tag!=='BUTTON'&&videos().length){e.preventDefault();S.playing?pauseAll():playAll()}
});

/* ---------- compare slider ---------- */
var cmpEl=$('#cmp'),cmpH=$('#cmpH'),cmpDrag=false,cmpKey='';
function cmpScene(){var sc=curScene();if(!sc)return null;var v=variant(sc);return (v.a&&v.b)?sc:null}
function updateCmp(){
  var sc=cmpScene();
  if(!sc){if(cmpKey!==''){cmpKey='';cmpEl.hidden=true;$('#ctagL').hidden=true;$('#ctagR').hidden=true}return}
  var f=sc.cmp==null?.5:sc.cmp;
  U.split.value=f*canvas.width;
  var pair=dispMedia(sc),key=f.toFixed(4)+'|'+sc.id+'|'+S.dial+'|'+(pair[0]?pair[0].name:'')+'|'+(pair[1]?pair[1].name:'');
  if(key===cmpKey)return;
  cmpKey=key;
  cmpEl.hidden=false;cmpEl.style.left=(f*100)+'%';
  cmpH.setAttribute('aria-valuenow',Math.round(f*100));
  var l=$('#ctagL'),r=$('#ctagR');
  l.hidden=r.hidden=false;
  l.textContent='1 · '+(pair[0]?pair[0].name:'');r.textContent='2 · '+(pair[1]?pair[1].name:'');
}
cmpH.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();try{cmpH.setPointerCapture(e.pointerId)}catch(_){}cmpDrag=true});
cmpH.addEventListener('pointermove',function(e){
  if(!cmpDrag)return;
  var sc=curScene();if(!sc)return;
  var r=stage.getBoundingClientRect();
  sc.cmp=clamp((e.clientX-r.left)/r.width,.03,.97);
});
function cmpEnd(){if(cmpDrag){cmpDrag=false;save()}}
cmpH.addEventListener('pointerup',cmpEnd);
cmpH.addEventListener('pointercancel',cmpEnd);
cmpH.addEventListener('keydown',function(e){
  var sc=curScene();if(!sc)return;
  if(e.key==='ArrowLeft'){sc.cmp=clamp((sc.cmp==null?.5:sc.cmp)-.03,.03,.97);e.preventDefault()}
  else if(e.key==='ArrowRight'){sc.cmp=clamp((sc.cmp==null?.5:sc.cmp)+.03,.03,.97);e.preventDefault()}
});
cmpH.addEventListener('keyup',function(){save()});

/* ---------- scene rail with reorder functionality ---------- */
function renderRail(){
  $('#railList').innerHTML=S.scenes.map(function(sc, idx){
    var v=variant(sc),m=v.a?S.media.get(v.a):null;
    var th=m&&m.thumb?'<img alt="" src="'+m.thumb+'">':'<span class="ph"></span>';
    var tag=(m?(m.kind==='video'?'360 video':'360 photo'):'')+(v.b?' + 2nd':'');
    return '<div class="sc'+(sc.id===S.active?' on':'')+'" data-id="'+sc.id+'">'+th+
      (sc.v[1]?'<span class="chip">ALT</span>':'')+
      '<span class="nm">'+esc(sc.name)+'</span><span class="tag">'+tag+'</span>'+
      '<div class="sc-order">'+
      '<button class="sc-up" data-id="'+sc.id+'" title="Move Up">▲</button>'+
      '<button class="sc-dn" data-id="'+sc.id+'" title="Move Down">▼</button>'+
      '</div></div>';
  }).join('');
}

$('#railList').addEventListener('click',function(e){
  var upBtn=e.target.closest('.sc-up');
  var dnBtn=e.target.closest('.sc-dn');
  if(upBtn){
    e.stopPropagation();
    moveScene(upBtn.dataset.id, -1);
    return;
  }
  if(dnBtn){
    e.stopPropagation();
    moveScene(dnBtn.dataset.id, 1);
    return;
  }
  var b=e.target.closest('.sc');if(b)goTo(b.dataset.id);
});

function moveScene(id, dir){
  var idx = S.scenes.findIndex(function(s){return s.id === id});
  if(idx < 0) return;
  var targetIdx = idx + dir;
  if(targetIdx < 0 || targetIdx >= S.scenes.length) return;
  
  var temp = S.scenes[idx];
  S.scenes[idx] = S.scenes[targetIdx];
  S.scenes[targetIdx] = temp;
  
  renderRail();
  renderInsp();
  save();
}

/* ---------- Tabbed Inspector Panel ---------- */
$('#inspTabs').addEventListener('click', function(e){
  var btn = e.target.closest('.insp-tab-btn');
  if(!btn) return;
  document.querySelectorAll('.insp-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.inspTab = btn.dataset.tab;
  renderInsp();
});

function mediaOptions(selId,allowNone){
  var o=allowNone?'<option value=""'+(!selId?' selected':'')+'>None</option>':'';
  S.media.forEach(function(m){o+='<option value="'+m.id+'"'+(m.id===selId?' selected':'')+'>'+esc(m.name)+' ('+(m.kind==='video'?'video':'photo')+')</option>'});
  return o;
}
function optList(map,sel){return Object.keys(map).map(function(k){return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+map[k]+'</option>'}).join('')}
function slotBlock(slot,label,selId){
  var K=slot.toUpperCase(),m=selId?S.media.get(selId):null;
  var h='<div class="slot"><div class="slot-h"><label class="l" for="sel'+K+'">'+label+'</label><button class="btn sm slotImp" data-slot="'+slot+'">Import</button></div>'+
    '<select id="sel'+K+'" class="fld" data-slot="'+slot+'">'+mediaOptions(selId,slot==='b')+'</select>';
  if(m){
    h+='<div class="two"><label for="proj'+K+'">Projection<select id="proj'+K+'" class="fld" data-slot="'+slot+'">'+optList(PROJECTIONS,m.projection||'eq360')+'</select></label>'+
       '<label for="lay'+K+'">Layout<select id="lay'+K+'" class="fld" data-slot="'+slot+'">'+optList(LAYOUTS,m.layout||'mono')+'</select></label></div>';
  }
  return h+'</div>';
}

function renderInsp(){
  var el=$('#inspBody');
  if(S.viewOnly){el.innerHTML='';return}
  if(S.inspTab === 'walkthrough'){
    renderWalkthroughInsp(el);
    return;
  }
  if(S.inspTab === 'markers'){
    renderMarkerPoolInsp(el);
    return;
  }

  /* Scene Settings Tab */
  var sc=curScene();
  if(!sc){el.innerHTML='<div class="sec"><p class="empty-h">Import a scene to edit its settings.</p></div>';return}
  var others=S.scenes.filter(function(s){return s.id!==sc.id});
  var vi=variantIndex(sc),v=sc.v[vi];

  var hsRows=(sc.hotspots||[]).map(function(h){
    var opts=others.map(function(o){return '<option value="'+o.id+'"'+(o.id===h.target?' selected':'')+'>'+esc(o.name)+'</option>'}).join('');
    return '<div class="hrow'+(h.id===S.sel?' sel':'')+'" data-id="'+h.id+'">'+
      '<div class="hrow-top"><button class="mini hgo" aria-label="Focus hotspot">'+svg('eye',16)+'</button>'+
      '<select class="fld hT" aria-label="Destination scene">'+opts+'</select>'+
      '<button class="mini hdel" aria-label="Delete hotspot">'+svg('x',16)+'</button></div>'+
      '<input class="fld hDesc" placeholder="Description (optional)" value="'+esc(h.desc||'')+'">'+
      '</div>';
  }).join('');

  var poolOpts = S.markerPool.map(p => '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');

  var mrkRows=(sc.markers||[]).map(function(m){
    var pItem = S.markerPool.find(p => p.id === m.poolId) || {name: m.name||'Marker', desc: m.desc||''};
    return '<div class="hrow'+(m.id===S.sel?' sel':'')+'" data-id="'+m.id+'">'+
      '<div class="hrow-top"><button class="mini mgo" aria-label="Focus marker">'+svg('eye',16)+'</button>'+
      '<input class="fld mName" placeholder="Marker Name" value="'+esc(pItem.name)+'">' +
      '<button class="mini mdel" aria-label="Delete marker">'+svg('x',16)+'</button></div>'+
      '<input class="fld mDesc" placeholder="Marker Details / Description" value="'+esc(pItem.desc)+'">'+
      '</div>';
  }).join('');

  var vw=sc.view?('yaw '+Math.round(((sc.view.lon%360)+360)%360)+'°   pitch '+Math.round(sc.view.lat)+'°'):'Keeps current view';
  var hasAlt=S.scenes.some(function(s){return s.v[1]});

  var startScreenSec='<div class="sec"><span class="l">Start Screen Menu</span>'+
    '<div class="row" style="margin-bottom:8px;"><label><input type="checkbox" id="startEnable" '+(S.startScreen.enabled?'checked':'')+'> Enable Start Screen</label></div>'+
    '<input id="startTitleInp" class="fld" style="margin-bottom:6px;" placeholder="Start Menu Title" value="'+esc(S.startScreen.title)+'">'+
    '<textarea id="startDescInp" class="fld" style="margin-bottom:6px;height:60px;" placeholder="Start Menu Description">'+esc(S.startScreen.desc)+'</textarea>'+
    '<div class="row"><button class="btn sm" id="uploadStartImgBtn">Upload Menu Image</button>'+(S.startScreen.imgUrl?'<button class="btn sm danger" id="rmStartImgBtn">Remove Image</button>':'')+'</div>'+
    '</div>';

  var altSec=sc.v[1]
    ?'<div class="sec"><span class="l">Alternative scene</span><div class="row"><span class="badge">Paired</span><button class="btn danger sm" id="rmAlt">Remove alternative</button></div></div>'
    :'<div class="sec"><span class="l">Alternative scene</span><button class="btn primary" id="mkAlt">Create alternative scene</button></div>';

  var editing=(sc.v[1])?'<span class="badge">Editing: '+esc(S.altNames[vi])+'</span>':'';

  var mapSec=S.map
    ?'<div class="sec"><span class="l">Overhead Map Position</span><div class="row"><button class="btn sm primary" id="placePin" aria-pressed="'+(S.placing===sc.id)+'">'+(sc.mapPos?'Move Pin':'Place on Map')+'</button>'+(sc.mapPos?'<button class="btn sm" id="clearPin">Remove Pin</button>':'')+'</div></div>'
    :'<div class="sec"><span class="l">Overhead Map Position</span><p class="empty-h">Open Overhead Map panel to add a floorplan.</p></div>';

  var addFromPoolSec = S.markerPool.length
    ? '<div class="row" style="margin-top:6px"><select id="addPoolSelect" class="fld" style="flex:1"><option value="">Select pooled marker...</option>'+poolOpts+'</select><button class="btn sm primary" id="addFromPoolBtn">Add to Scene</button></div>'
    : '';

  var tourSec='<div class="sec">'+(hasAlt?'<span class="l">Dial labels</span><div class="two" style="margin:0 0 12px"><input id="altN0" class="fld" maxlength="18" value="'+esc(S.altNames[0])+'"><input id="altN1" class="fld" maxlength="18" value="'+esc(S.altNames[1])+'"></div>':'')+
    '<div class="row"><button class="btn" id="exportCurrentBtn">Export Project File</button><button class="btn danger" id="delScene">Delete scene</button><button class="btn danger" id="resetTour">Start over</button></div></div>';

  el.innerHTML=
    (S.demo?'<div class="sec"><p class="empty-h">This is an example tour. Importing your own file replaces it.</p></div>':'')+
    startScreenSec+
    '<div class="sec"><label class="l" for="scName">Scene name</label><input id="scName" class="fld" maxlength="60" value="'+esc(sc.name)+'"></div>'+
    '<div class="sec"><div class="sec-h"><span class="l">Sources</span>'+editing+'</div>'+
      slotBlock('a','1 · Left of slider',v.a)+slotBlock('b','2 · Right of slider',v.b)+
    '</div>'+
    altSec+
    '<div class="sec"><span class="l">Start view</span><div class="row"><button class="btn" id="setView">Use current view</button><span class="mono">'+vw+'</span></div></div>'+
    mapSec+
    '<div class="sec"><div class="sec-h"><span class="l">Hotspots (Navigation)</span><button class="btn primary sm" id="addHs" aria-pressed="'+S.adding+'">'+(S.adding?'Cancel':'Add Hotspot')+'</button></div>'+
      (hsRows||'<p class="empty-h">Hotspots link to other scenes.</p>')+'</div>'+
    '<div class="sec"><div class="sec-h"><span class="l">Scene Markers</span><button class="btn primary sm" id="addMrk" aria-pressed="'+S.addingMarker+'">'+(S.addingMarker?'Cancel':'Add Marker')+'</button></div>'+
      (mrkRows||'<p class="empty-h">Markers highlight details to look at.</p>')+addFromPoolSec+'</div>'+
    tourSec;
}

/* ---------- Walkthrough Editor Tab Rendering ---------- */
function renderWalkthroughInsp(el){
  var stepsHtml = S.walkthrough.map((step, idx) => {
    var sc = getScene(step.sceneId);
    var sceneName = sc ? sc.name : 'Select Scene';
    var scOpts = S.scenes.map(s => `<option value="${s.id}" ${s.id === step.sceneId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

    var poolOpts = '<option value="">None</option>' + S.markerPool.map(p => `<option value="${p.id}" ${p.id === step.markerId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

    return `
      <div class="wt-step-card" data-step-id="${step.id}">
        <div class="wt-step-h">
          <span class="wt-step-title">Step ${idx + 1}: ${esc(sceneName)}</span>
          <div class="wt-step-actions">
            <button class="mini wt-up" title="Move Up">▲</button>
            <button class="mini wt-dn" title="Move Down">▼</button>
            <button class="mini wt-del" title="Delete Step">${svg('x',14)}</button>
          </div>
        </div>
        <div class="slot">
          <label class="l">Target Scene</label>
          <select class="fld wt-scene-select">${scOpts}</select>
        </div>
        <div class="two">
          <label>Start Angle (Yaw)
            <div class="row"><input class="fld wt-start-lon" type="number" value="${Math.round(step.startLon||0)}"><button class="btn sm wt-cap-start">Capture</button></div>
          </label>
          <label>End Angle (Yaw)
            <div class="row"><input class="fld wt-end-lon" type="number" value="${Math.round(step.endLon||0)}"><button class="btn sm wt-cap-end">Capture</button></div>
          </label>
        </div>
        <div class="two" style="margin-top:8px">
          <label>Pan Duration (sec)
            <input class="fld wt-pan-dur" type="number" step="0.5" min="0" value="${step.panDuration}">
          </label>
          <label>Pause Duration (sec)
            <input class="fld wt-pause-dur" type="number" step="0.5" min="0" value="${step.pauseDuration}">
          </label>
        </div>
        <div class="slot" style="margin-top:8px">
          <label class="l">Trigger Pooled Marker</label>
          <select class="fld wt-marker-select">${poolOpts}</select>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="sec">
      <div class="sec-h">
        <span class="l">Guided Walkthrough Path</span>
        <button class="btn primary sm" id="addWtStepBtn">+ Add Step</button>
      </div>
      <p class="note" style="margin-bottom:12px">Define keyframed sequence paths, camera panning, hold durations, and marker popups.</p>
      ${stepsHtml || '<p class="empty-h">No steps created yet. Click "+ Add Step" to build a walkthrough.</p>'}
      ${S.walkthrough.length ? '<div class="row" style="margin-top:12px"><button class="btn primary" id="testWalkthroughBtn">Preview Walkthrough</button></div>' : ''}
    </div>
  `;
}

/* ---------- Marker Pool Tab Rendering ---------- */
function renderMarkerPoolInsp(el){
  var rows = S.markerPool.map(m => {
    return `
      <div class="hrow" data-pool-id="${m.id}">
        <div class="hrow-top">
          <input class="fld pool-name" placeholder="Marker Title" value="${esc(m.name)}">
          <button class="mini pool-del" title="Delete from Pool">${svg('x',16)}</button>
        </div>
        <input class="fld pool-desc" placeholder="Global Description / Details" value="${esc(m.desc)}">
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="sec">
      <div class="sec-h">
        <span class="l">Global Marker Pool</span>
        <button class="btn primary sm" id="addPoolMarkerBtn">+ New Marker</button>
      </div>
      <p class="note" style="margin-bottom:12px">Manage all POI markers across the tour for reuse and automated walkthroughs.</p>
      ${rows || '<p class="empty-h">Marker pool is currently empty.</p>'}
    </div>
  `;
}

var insp=$('#inspBody'),slotTarget=null;
insp.addEventListener('input',function(e){
  if(S.viewOnly)return;
  var sc=curScene();
  var t=e.target;

  if(t.id==='scName'&&sc){
    sc.name=t.value||'Untitled scene';renderRail();renderMap();save();
  }else if(t.id==='altN0'||t.id==='altN1'){
    var i=t.id==='altN0'?0:1;S.altNames[i]=t.value||(i?'Alternative':'Primary');renderDial();save();
  }else if(t.id==='startTitleInp'){
    S.startScreen.title=t.value;save();
  }else if(t.id==='startDescInp'){
    S.startScreen.desc=t.value;save();
  }else if(t.classList.contains('hDesc')){
    var row=t.closest('.hrow'),h=sc.hotspots.find(function(x){return x.id===row.dataset.id});
    if(h){h.desc=t.value;buildHotspotsAndMarkers();save()}
  }else if(t.classList.contains('mName') || t.classList.contains('mDesc')){
    var row=t.closest('.hrow'),m=sc.markers.find(function(x){return x.id===row.dataset.id});
    if(m && m.poolId){
      var pItem = S.markerPool.find(p => p.id === m.poolId);
      if(pItem){
        if(t.classList.contains('mName')) pItem.name = t.value;
        if(t.classList.contains('mDesc')) pItem.desc = t.value;
        buildHotspotsAndMarkers();save();
      }
    }
  }else if(t.classList.contains('pool-name') || t.classList.contains('pool-desc')){
    var row=t.closest('.hrow'), pItem=S.markerPool.find(p => p.id === row.dataset.poolId);
    if(pItem){
      if(t.classList.contains('pool-name')) pItem.name = t.value;
      if(t.classList.contains('pool-desc')) pItem.desc = t.value;
      buildHotspotsAndMarkers();save();
    }
  }else if(t.closest('.wt-step-card')){
    var card = t.closest('.wt-step-card');
    var step = S.walkthrough.find(s => s.id === card.dataset.stepId);
    if(step){
      if(t.classList.contains('wt-start-lon')) step.startLon = parseFloat(t.value)||0;
      if(t.classList.contains('wt-end-lon')) step.endLon = parseFloat(t.value)||0;
      if(t.classList.contains('wt-pan-dur')) step.panDuration = parseFloat(t.value)||0;
      if(t.classList.contains('wt-pause-dur')) step.pauseDuration = parseFloat(t.value)||0;
      save();
    }
  }
});

insp.addEventListener('change',function(e){
  if(S.viewOnly)return;
  var sc=curScene();
  var t=e.target;
  if(t.id==='startEnable'){
    S.startScreen.enabled=t.checked;save();
  }else if(sc && (t.id==='selA'||t.id==='selB')){
    var v=sc.v[variantIndex(sc)];v[t.dataset.slot]=t.value||null;
    gcMedia();refreshMap();applyAudio();renderRail();renderInsp();save();
  }else if(t.classList.contains('hT') && sc){
    var row=t.closest('.hrow'),h=sc.hotspots.find(function(x){return x.id===row.dataset.id});
    if(h){h.target=t.value;buildHotspotsAndMarkers();renderMap();save()}
  }else if(t.classList.contains('wt-scene-select')){
    var card = t.closest('.wt-step-card');
    var step = S.walkthrough.find(s => s.id === card.dataset.stepId);
    if(step){ step.sceneId = t.value; renderInsp(); save(); }
  }else if(t.classList.contains('wt-marker-select')){
    var card = t.closest('.wt-step-card');
    var step = S.walkthrough.find(s => s.id === card.dataset.stepId);
    if(step){ step.markerId = t.value; save(); }
  }
});

function arm(btn,label,fn){
  if(btn.dataset.armed){clearTimeout(btn._t);btn.dataset.armed='';fn();return}
  var old=btn.textContent;btn.dataset.armed='1';btn.textContent=label;
  btn._t=setTimeout(function(){btn.dataset.armed='';btn.textContent=old},3000);
}

insp.addEventListener('click',function(e){
  if(S.viewOnly)return;
  var sc=curScene();
  var t=e.target.closest('button');if(!t)return;
  if(t.id==='uploadStartImgBtn'){$('#fileStartImg').click()}
  else if(t.id==='rmStartImgBtn'){S.startScreen.imgUrl=null;renderInsp();save()}
  else if(t.id==='setView'&&sc){sc.view={lon:lon,lat:lat,fov:fov};renderInsp();save();toast('Start view saved.')}
  else if(t.classList.contains('slotImp')&&sc){slotTarget={sceneId:sc.id,variant:variantIndex(sc),slot:t.dataset.slot};$('#fileSlot').click()}
  else if(t.id==='mkAlt'&&sc){
    var p=sc.v[0];sc.v[1]={a:p.a,b:p.b};
    setDial(1);slotTarget={sceneId:sc.id,variant:1,slot:'a'};$('#fileSlot').click();
    layout();save();
  }
  else if(t.id==='rmAlt'&&sc){arm(t,'Confirm remove',function(){
    sc.v[1]=null;if(!S.scenes.some(function(s){return s.v[1]}))S.dial=0;
    gcMedia();refreshMap();applyAudio();renderRail();renderInsp();renderDial();layout();save();
  })}
  else if(t.id==='placePin'&&sc){
    if(S.placing===sc.id){S.placing=null;hideHint()}
    else{S.placing=sc.id;S.mapPopoutOpen=true;showHint('Click Overhead Map to place "'+sc.name+'". Press Esc to cancel.')}
    renderMap();renderInsp();layout();
  }
  else if(t.id==='clearPin'&&sc){sc.mapPos=null;renderMap();renderInsp();save()}
  else if(t.id==='addHs'){
    if(S.adding){cancelAdd();return}
    if(S.scenes.length<2){toast('Add a second scene first, then link to it.');return}
    cancelAddMarker();S.adding=true;layout();renderInsp();showHint('Click scene to place Hotspot. Press Esc to cancel.');
  }
  else if(t.id==='addMrk'){
    if(S.addingMarker){cancelAddMarker();return}
    cancelAdd();S.addingMarker=true;layout();renderInsp();showHint('Click scene to place Marker. Press Esc to cancel.');
  }
  else if(t.id==='addFromPoolBtn'&&sc){
    var poolSel = $('#addPoolSelect');
    if(poolSel && poolSel.value){
      var pId = poolSel.value;
      var m = {id: uid(), poolId: pId, lon: lon, lat: lat};
      sc.markers.push(m);
      buildHotspotsAndMarkers(); renderInsp(); save();
    }
  }
  else if(t.classList.contains('hgo')&&sc){
    var h=sc.hotspots.find(function(x){return x.id===t.closest('.hrow').dataset.id});
    if(h){lon=h.lon;lat=h.lat;vlon=vlat=0;S.sel=h.id;markSel()}
  }
  else if(t.classList.contains('hdel')&&sc){
    var id=t.closest('.hrow').dataset.id;
    sc.hotspots=sc.hotspots.filter(function(x){return x.id!==id});
    if(S.sel===id)S.sel=null;buildHotspotsAndMarkers();renderInsp();renderMap();save();
  }
  else if(t.classList.contains('mgo')&&sc){
    var m=sc.markers.find(function(x){return x.id===t.closest('.hrow').dataset.id});
    if(m){lon=m.lon;lat=m.lat;vlon=vlat=0;S.sel=m.id;markSel()}
  }
  else if(t.classList.contains('mdel')&&sc){
    var id=t.closest('.hrow').dataset.id;
    sc.markers=sc.markers.filter(function(x){return x.id!==id});
    if(S.sel===id)S.sel=null;buildHotspotsAndMarkers();renderInsp();save();
  }
  else if(t.id==='addPoolMarkerBtn'){
    S.markerPool.push({id: uid(), name: 'New POI Marker', desc: ''});
    renderInsp(); save();
  }
  else if(t.classList.contains('pool-del')){
    var pId = t.closest('.hrow').dataset.poolId;
    S.markerPool = S.markerPool.filter(p => p.id !== pId);
    renderInsp(); save();
  }
  else if(t.id==='addWtStepBtn'){
    var curId = S.scenes.length ? (sc ? sc.id : S.scenes[0].id) : '';
    S.walkthrough.push({
      id: uid(), sceneId: curId, startLon: lon, endLon: lon + 90, panDuration: 5, pauseDuration: 3, markerId: ''
    });
    renderInsp(); save();
  }
  else if(t.classList.contains('wt-cap-start')){
    var step = S.walkthrough.find(s => s.id === t.closest('.wt-step-card').dataset.stepId);
    if(step){ step.startLon = Math.round(lon); renderInsp(); save(); }
  }
  else if(t.classList.contains('wt-cap-end')){
    var step = S.walkthrough.find(s => s.id === t.closest('.wt-step-card').dataset.stepId);
    if(step){ step.endLon = Math.round(lon); renderInsp(); save(); }
  }
  else if(t.classList.contains('wt-del')){
    var stepId = t.closest('.wt-step-card').dataset.stepId;
    S.walkthrough = S.walkthrough.filter(s => s.id !== stepId);
    renderInsp(); save();
  }
  else if(t.classList.contains('wt-up') || t.classList.contains('wt-dn')){
    var stepId = t.closest('.wt-step-card').dataset.stepId;
    var idx = S.walkthrough.findIndex(s => s.id === stepId);
    var dir = t.classList.contains('wt-up') ? -1 : 1;
    if(idx + dir >= 0 && idx + dir < S.walkthrough.length){
      var tmp = S.walkthrough[idx];
      S.walkthrough[idx] = S.walkthrough[idx+dir];
      S.walkthrough[idx+dir] = tmp;
      renderInsp(); save();
    }
  }
  else if(t.id==='testWalkthroughBtn'){
    startWalkthrough();
  }
  else if(t.id==='exportCurrentBtn'){ exportProject(S.projectId); }
  else if(t.id==='delScene'){arm(t,'Confirm delete',deleteScene)}
  else if(t.id==='resetTour'){arm(t,'Confirm clear all',function(){resetTour(false)})}
});

$('#fileStartImg').addEventListener('change',function(){
  var f=$('#fileStartImg').files&&$('#fileStartImg').files[0];$('#fileStartImg').value='';
  if(!f)return;
  var url=URL.createObjectURL(f);
  S.startScreen.imgUrl=url;renderInsp();save();
});

function deleteScene(){
  var sc=curScene();if(!sc)return;
  var i=S.scenes.indexOf(sc);
  S.scenes.splice(i,1);
  S.scenes.forEach(function(s){
    s.hotspots=(s.hotspots||[]).filter(function(h){return h.target!==sc.id});
  });
  if(!S.scenes.some(function(s){return s.v[1]}))S.dial=0;
  gcMedia();S.active=null;navTok++;S.busy=false;
  var next=S.scenes[Math.min(i,S.scenes.length-1)];
  if(next)applyScene(next);
  else{refreshMap();buildHotspotsAndMarkers();renderRail();renderInsp();renderMap();renderDial();layout()}
  save();
}

function resetTour(keepMap){
  stopDemo();
  Array.from(S.media.values()).forEach(dropMedia);
  S.scenes=[];S.markerPool=[];S.walkthrough=[];S.active=null;S.demo=false;S.name='Untitled tour';S.sel=null;S.dial=0;S.altNames=['Primary','Alternative'];S.placing=null;navTok++;S.busy=false;
  S.startScreen={enabled:false,imgUrl:null,title:'Welcome to the Tour',desc:''};
  if(!(keepMap&&S.map&&!S.map.demo)){
    if(S.map&&S.map.url&&S.map.url.indexOf('blob:')===0)URL.revokeObjectURL(S.map.url);
    S.map=null;
  }
  $('#tourName').value=S.name;
  refreshMap();buildHotspotsAndMarkers();renderRail();renderInsp();renderMap();renderDial();layout();
  if(!S.map)dbDel();
}

/* ---------- Walkthrough Tour Playback Engine ---------- */
var wtTimer = null;

async function startWalkthrough(){
  if(!S.walkthrough.length){ toast('No walkthrough sequence built.'); return; }
  S.walkthroughActive = true;
  S.walkthroughStep = 0;
  $('#walkthroughHud').hidden = false;
  runWalkthroughStep(0);
}

function stopWalkthrough(){
  S.walkthroughActive = false;
  if(wtTimer) clearTimeout(wtTimer);
  $('#walkthroughHud').hidden = true;
  toast('Switched to free exploration mode.');
}

$('#hudExploreBtn').onclick = function(){
  stopWalkthrough();
};

async function runWalkthroughStep(idx){
  if(!S.walkthroughActive) return;
  if(idx >= S.walkthrough.length){
    toast('Walkthrough tour finished!');
    stopWalkthrough();
    return;
  }

  S.walkthroughStep = idx;
  var step = S.walkthrough[idx];
  $('#wtStepLabel').textContent = `Step ${idx + 1} of ${S.walkthrough.length}`;

  var sc = getScene(step.sceneId);
  if(sc && sc.id !== S.active){
    applyScene(sc);
  }

  lon = step.startLon || 0;
  lat = 0;
  vlon = vlat = 0;

  var durMs = (step.panDuration || 4) * 1000;
  var startL = lon, endL = step.endLon || (lon + 90);

  await tween(durMs, function(p){
    if(!S.walkthroughActive) return;
    var e = ease(p);
    lon = startL + (endL - startL) * e;
  });

  if(!S.walkthroughActive) return;

  if(step.markerId){
    hsEls.forEach((el) => {
      if(el._kind === 'marker' && el._h && el._h.poolId === step.markerId){
        el.classList.add('open');
      }
    });
  }

  var pauseMs = (step.pauseDuration || 2) * 1000;
  wtTimer = setTimeout(() => {
    if(!S.walkthroughActive) return;
    hsEls.forEach(el => el.classList.remove('open'));
    runWalkthroughStep(idx + 1);
  }, pauseMs);
}

/* ---------- overhead map popout drawer with responsive image scaling ---------- */
var mapBox=$('#mapBox'),mapImg=$('#mapImg'),mapPins=$('#mapPins'),mapLines=$('#mapLines'),coneEl=null,coneKey=0;

function renderMap(){
  var popout=$('#mapPopout');
  popout.hidden=!S.mapPopoutOpen;
  popout.classList.toggle('enlarged', S.mapEnlarged);
  if(!S.mapPopoutOpen)return;

  var has=!!S.map;
  $('#mapReplace').hidden=!has || S.mode!=='edit' || S.viewOnly;
  mapBox.hidden=!has;$('#mapEmpty').hidden=has||S.mode!=='edit'||S.viewOnly;
  if(!has){coneEl=null;return}

  if(mapImg.getAttribute('src')!==S.map.url)mapImg.src=S.map.url;

  var bodyEl=$('#mapBody');
  var maxW=Math.max(100, bodyEl.clientWidth - 20);
  var maxH=Math.max(100, bodyEl.clientHeight - 20);
  var ar=(S.map.w&&S.map.h)?S.map.w/S.map.h:1.5;

  if(!S.mapEnlarged){
    maxH=Math.min(maxH, 220);
  }

  var w=maxW, h=w/ar;
  if(h > maxH){
    h = maxH;
    w = h * ar;
  }

  mapBox.style.width=Math.floor(w)+'px';
  mapBox.style.height=Math.floor(h)+'px';
  mapBox.classList.toggle('placing',!!S.placing);

  var cur=curScene(),links=new Set(cur?(cur.hotspots||[]).map(function(x){return x.target}):[]);
  var lines='';
  if(cur&&cur.mapPos){
    links.forEach(function(id){
      var t=getScene(id);
      if(t&&t.mapPos)lines+='<line x1="'+cur.mapPos.x*100+'" y1="'+cur.mapPos.y*100+'" x2="'+t.mapPos.x*100+'" y2="'+t.mapPos.y*100+'"/>';
    });
  }
  mapLines.innerHTML=lines;
  mapPins.innerHTML='';coneEl=null;

  S.scenes.forEach(function(sc){
    if(!sc.mapPos)return;
    var b=document.createElement('button');
    b.className='pin'+(sc.id===S.active?' cur':'')+(links.has(sc.id)?' link':'');
    b.dataset.id=sc.id;
    b.style.left=(sc.mapPos.x*100)+'%';b.style.top=(sc.mapPos.y*100)+'%';
    b.setAttribute('aria-label',sc.id===S.active?'Current: '+sc.name:'Go to '+sc.name);
    b.innerHTML='<i></i><span class="nm">'+esc(sc.name)+'</span>';
    if(sc.id===S.active){var c=document.createElement('div');c.className='cone';b.insertBefore(c,b.firstChild);coneEl=c;coneKey=NaN}
    mapPins.appendChild(b);
  });
}

$('#mapPopoutBtn').onclick=function(){
  S.mapPopoutOpen=!S.mapPopoutOpen;
  renderMap();
  $('#mapPopoutBtn').setAttribute('aria-pressed',S.mapPopoutOpen);
};
$('#mapEnlargeBtn').onclick=function(){
  S.mapEnlarged=!S.mapEnlarged;
  renderMap();
};
$('#mapClose').onclick=function(){
  S.mapPopoutOpen=false;
  renderMap();
  $('#mapPopoutBtn').setAttribute('aria-pressed',false);
};
$('#mapReplace').onclick=$('#mapAdd').onclick=function(){if(!S.viewOnly)$('#fileMap').click()};

var pinDrag=null;
mapPins.addEventListener('pointerdown',function(e){
  var b=e.target.closest('.pin');if(!b)return;
  e.stopPropagation();
  var sc=getScene(b.dataset.id);if(!sc)return;
  try{b.setPointerCapture(e.pointerId)}catch(_){}
  pinDrag={el:b,sc:sc,x:e.clientX,y:e.clientY,moved:false,id:e.pointerId};
});
mapPins.addEventListener('pointermove',function(e){
  if(!pinDrag||pinDrag.id!==e.pointerId)return;
  if(Math.abs(e.clientX-pinDrag.x)+Math.abs(e.clientY-pinDrag.y)>4)pinDrag.moved=true;
  if(pinDrag.moved&&S.mode==='edit'&&!S.viewOnly){
    var r=mapBox.getBoundingClientRect();
    var x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1);
    pinDrag.sc.mapPos={x:x,y:y};
    pinDrag.el.style.left=(x*100)+'%';pinDrag.el.style.top=(y*100)+'%';
  }
});
function pinEnd(e){
  if(!pinDrag||pinDrag.id!==e.pointerId)return;
  var d=pinDrag;pinDrag=null;
  if(d.moved&&S.mode==='edit'&&!S.viewOnly){renderMap();save();return}
  if(e.type!=='pointerup')return;
  var cur=curScene(),hs=null;
  if(cur)hs=(cur.hotspots||[]).find(function(h){return h.target===d.sc.id})||null;
  goTo(d.sc.id,{hs:hs});
}
mapPins.addEventListener('pointerup',pinEnd);
mapPins.addEventListener('pointercancel',pinEnd);
mapBox.addEventListener('click',function(e){
  if(!S.placing||S.viewOnly||e.target.closest('.pin'))return;
  var sc=getScene(S.placing);if(!sc)return;
  var r=mapBox.getBoundingClientRect();
  sc.mapPos={x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)};
  S.placing=null;hideHint();renderMap();renderInsp();save();
});
function updateCone(){
  if(!coneEl)return;
  var a=Math.round((lon-180)*2)/2;
  if(a===coneKey)return;coneKey=a;
  coneEl.style.transform='rotate('+a+'deg)';
}
$('#fileMap').addEventListener('change',function(){
  var f=$('#fileMap').files&&$('#fileMap').files[0];$('#fileMap').value='';
  if(!f)return;
  var url=URL.createObjectURL(f),im=new Image();
  im.onload=function(){
    if(S.map&&S.map.url&&S.map.url.indexOf('blob:')===0)URL.revokeObjectURL(S.map.url);
    S.map={blob:f,url:url,w:im.naturalWidth,h:im.naturalHeight,demo:false};
    renderMap();renderInsp();layout();save();
  };
  im.src=url;
});

/* ---------- Export, Import & Server Save ---------- */
function exportProject(projectId){
  toast('Packaging project for export...');
  dbGetRawProjectRecord(projectId).then(async function(rec){
    if(!rec){ toast('Project data not found.'); return; }
    
    var mediaPromises = (rec.media||[]).map(async function(m){
      var dataUrl = await blobToDataURL(m.blob);
      return {
        id: m.id, kind: m.kind, name: m.name, layout: m.layout, projection: m.projection, thumb: m.thumb, dataUrl: dataUrl
      };
    });

    var mediaList = await Promise.all(mediaPromises);
    var mapDataUrl = (rec.map && rec.map.blob) ? await blobToDataURL(rec.map.blob) : null;
    var startImgDataUrl = (S.startScreen && S.startScreen.imgUrl && S.startScreen.imgUrl.startsWith('data:')) ? S.startScreen.imgUrl : null;

    var exportPayload = {
      panoreelExport: true,
      version: 1,
      name: rec.name,
      dial: rec.dial,
      altNames: rec.altNames,
      scenes: rec.scenes,
      markerPool: rec.markerPool || [],
      walkthrough: rec.walkthrough || [],
      startScreen: {
        enabled: rec.startScreen ? rec.startScreen.enabled : false,
        title: rec.startScreen ? rec.startScreen.title : '',
        desc: rec.startScreen ? rec.startScreen.desc : '',
        imgUrl: startImgDataUrl
      },
      media: mediaList,
      map: mapDataUrl ? { dataUrl: mapDataUrl, w: rec.map.w, h: rec.map.h } : null
    };

    var jsonStr = JSON.stringify(exportPayload);
    var blob = new Blob([jsonStr], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (rec.name || 'panoreel_project').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.panoreel';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Project exported successfully!');
  }).catch(function(err){
    console.error(err);
    toast('Export failed.');
  });
}

function saveNow(){
  toast('Saving project for public viewing...');
  save();

  if(!S.projectId) S.projectId = uid();
  dbGetRawProjectRecord(S.projectId).then(async function(rec){
    if(!rec) return;
    try {
      var mediaPromises = (rec.media||[]).map(async function(m){
        var dataUrl = await blobToDataURL(m.blob);
        return { id: m.id, kind: m.kind, name: m.name, layout: m.layout, projection: m.projection, thumb: m.thumb, dataUrl: dataUrl };
      });
      var mediaList = await Promise.all(mediaPromises);
      var mapDataUrl = (rec.map && rec.map.blob) ? await blobToDataURL(rec.map.blob) : null;

      var payload = {
        projectId: S.projectId,
        name: S.name,
        updatedAt: Date.now(),
        dial: S.dial,
        altNames: S.altNames,
        scenes: S.scenes,
        markerPool: S.markerPool,
        walkthrough: S.walkthrough,
        startScreen: S.startScreen,
        media: mediaList,
        map: mapDataUrl ? { dataUrl: mapDataUrl, w: rec.map.w, h: rec.map.h } : null
      };

      fetch('/api/save-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(res){
        if(res.ok) toast('Project saved to server for public viewing!');
        else toast('Saved locally! (Server endpoint unavailable)');
      }).catch(function(){
        toast('Saved project locally for public viewing!');
      });
    } catch(e) {
      toast('Saved project locally!');
    }
  });
}

$('#saveBtn').onclick = function(){ saveNow(); };

function importProjectFile(file){
  if(!file) return;
  toast('Importing project file...');
  var reader = new FileReader();
  reader.onload = async function(e){
    try{
      var data = JSON.parse(e.target.result);
      if(!data.panoreelExport){
        toast('Invalid Panoreel project file.');
        return;
      }
      var newId = uid();
      var mediaPromises = (data.media||[]).map(async function(m){
        var blob = await dataURLToBlob(m.dataUrl);
        return {
          id: m.id, kind: m.kind, name: m.name, layout: m.layout||'mono',
          projection: m.projection||'eq360', thumb: m.thumb||null, blob: blob
        };
      });

      var mediaList = await Promise.all(mediaPromises);
      var mapBlob = data.map && data.map.dataUrl ? await dataURLToBlob(data.map.dataUrl) : null;

      var rec = {
        id: newId,
        name: (data.name || 'Imported Tour') + ' (Imported)',
        updatedAt: Date.now(),
        dial: data.dial || 0,
        altNames: data.altNames || ['Primary', 'Alternative'],
        scenes: data.scenes || [],
        markerPool: data.markerPool || [],
        walkthrough: data.walkthrough || [],
        startScreen: data.startScreen || {enabled:false, title:'Welcome to the Tour', desc:''},
        media: mediaList,
        map: mapBlob ? { blob: mapBlob, w: data.map.w, h: data.map.h } : null
      };

      await dbSaveRawProjectRecord(rec);
      await dbLoadProject(newId);
      renderProjectsList();
      toast('Project imported successfully!');
    }catch(err){
      console.error(err);
      toast('Failed to parse or import project file.');
    }
  };
  reader.readAsText(file);
}

$('#importProjectBtn').onclick = function(){
  $('#importProjectInput').click();
};

$('#importProjectInput').addEventListener('change', function(){
  var f = $('#importProjectInput').files && $('#importProjectInput').files[0];
  $('#importProjectInput').value = '';
  if(f) importProjectFile(f);
});

/* ---------- Projects Home Modal & Persistence ---------- */
$('#homeBtn').onclick = function(){
  renderProjectsList();
  $('#homeModal').hidden = false;
};
$('#closeHomeBtn').onclick = function(){
  $('#homeModal').hidden = true;
};

$('#newProjectBtn').onclick = function(){
  $('#homeModal').hidden = true;
  S.projectId = uid();
  resetTour(false);
  save();
};

function renderProjectsList(){
  dbGetAllProjects().then(function(projects){
    var listEl = $('#projectsList');
    if(!projects.length){
      listEl.innerHTML = '<p class="empty-h">No saved projects found. Create a new project to get started.</p>';
      return;
    }
    listEl.innerHTML = projects.map(function(p){
      var active = p.id === S.projectId;
      var dateStr = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '';
      return '<div class="project-item'+(active?' active':'')+'" data-id="'+p.id+'">'+
        '<div class="p-info"><span class="p-title">'+esc(p.name || 'Untitled project')+'</span>'+
        '<span class="p-meta">'+(p.sceneCount||0)+' scene(s) · '+dateStr+'</span></div>'+
        '<div class="p-actions">'+
        '<button class="btn sm p-load" data-id="'+p.id+'">'+(active?'Current':'Open')+'</button>'+
        '<button class="btn sm p-exp" data-id="'+p.id+'">Export</button>'+
        '<button class="btn sm danger p-del" data-id="'+p.id+'">Delete</button>'+
        '</div></div>';
    }).join('');
  });
}

$('#projectsList').addEventListener('click', function(e){
  var loadBtn = e.target.closest('.p-load');
  var expBtn = e.target.closest('.p-exp');
  var delBtn = e.target.closest('.p-del');
  var item = e.target.closest('.project-item');

  if(expBtn){
    e.stopPropagation();
    exportProject(expBtn.dataset.id);
    return;
  }

  if(delBtn){
    e.stopPropagation();
    var id = delBtn.dataset.id;
    dbDeleteProject(id).then(function(){
      if(id === S.projectId){
        S.projectId = uid();
        resetTour(false);
      }
      renderProjectsList();
    });
    return;
  }

  if(loadBtn || item){
    var id = (loadBtn || item).dataset.id;
    if(id === S.projectId){
      $('#homeModal').hidden = true;
      return;
    }
    dbLoadProject(id).then(function(){
      $('#homeModal').hidden = true;
    });
  }
});

/* ---------- layout, dial & top bar ---------- */
function layout(){
  if(S.viewOnly){
    S.mode='view';
    S.inspOpen=false;
    document.body.classList.add('view-only');
  }

  var hasAlt=S.scenes.some(function(s){return s.v[1]});
  var inspShown=S.mode==='edit'&&S.inspOpen&&!S.viewOnly;
  
  app.classList.toggle('edit',S.mode==='edit'&&!S.viewOnly);
  app.classList.toggle('rail-open',S.railOpen);
  app.classList.toggle('insp-open',S.inspOpen&&!S.viewOnly);
  app.classList.toggle('adding',S.adding&&!S.viewOnly);
  app.classList.toggle('adding-marker',S.addingMarker&&!S.viewOnly);
  app.classList.toggle('side-on',inspShown);
  
  $('#mEdit').setAttribute('aria-pressed',S.mode==='edit');
  $('#mView').setAttribute('aria-pressed',S.mode==='view');
  $('#railBtn').setAttribute('aria-pressed',S.railOpen);
  $('#inspBtn').setAttribute('aria-pressed',S.inspOpen);
  $('#inspWrap').hidden=S.mode!=='edit'||S.viewOnly;
  $('#dial').hidden=!hasAlt;
  $('#empty').hidden=S.scenes.length>0||S.viewOnly;
  
  renderDial();renderMap();
}

$('#mEdit').onclick=function(){
  if(S.viewOnly)return;
  S.mode='edit';S.railOpen=true;S.inspOpen=window.innerWidth>900||S.inspOpen;
  stopWalkthrough();
  $('#startScreen').hidden=true;layout();
};
$('#mView').onclick=function(){
  S.mode='view';cancelAdd();cancelAddMarker();S.placing=null;S.sel=null;markSel();S.railOpen=false;layout();
  showStartScreen();
};

function showStartScreen(){
  var st=$('#startScreen');
  $('#startTitle').textContent=S.startScreen.title||'Welcome to the Tour';
  $('#startDesc').textContent=S.startScreen.desc||'Choose how you would like to experience this tour.';
  var imgWrap=$('#startImgWrap'),img=$('#startImg');
  if(S.startScreen.imgUrl){img.src=S.startScreen.imgUrl;imgWrap.hidden=false}
  else{imgWrap.hidden=true}
  st.hidden=false;
}

$('#startWalkthroughTourBtn').onclick=function(){
  $('#startScreen').hidden=true;
  startWalkthrough();
};
$('#startExploreTourBtn').onclick=function(){
  $('#startScreen').hidden=true;
  stopWalkthrough();
};

/* Share modal controls */
function buildShareUrl(){
  var base = window.location.origin + window.location.pathname;
  return base + '?mode=view&project=' + (S.projectId || 'default');
}

$('#shareBtn').onclick=function(){
  var modal=$('#shareModal');
  $('#shareUrl').value=buildShareUrl();
  modal.hidden=false;
};
$('#closeShareBtn').onclick=function(){$('#shareModal').hidden=true};
$('#copyShareBtn').onclick=function(){
  navigator.clipboard.writeText(buildShareUrl()).then(function(){
    toast('Presentation link copied!');
  });
};
$('#nativeShareBtn').onclick=function(){
  if(navigator.share){
    navigator.share({title:S.name,url:buildShareUrl()}).catch(function(){});
  }else{
    toast('Web Share API is not supported on this browser.');
  }
};

$('#railBtn').onclick=function(){S.railOpen=!S.railOpen;layout()};
$('#inspBtn').onclick=function(){if(!S.viewOnly){S.inspOpen=!S.inspOpen;layout()}};
$('#fsBtn').onclick=function(){
  try{
    if(document.fullscreenElement)document.exitFullscreen();
    else{var p=app.requestFullscreen&&app.requestFullscreen();if(p&&p.catch)p.catch(function(){})}
  }catch(e){}
};
$('#tourName').addEventListener('input',function(e){if(!S.viewOnly){S.name=e.target.value||'Untitled tour';save()}});

var fmt=function(t){if(!isFinite(t))return'--:--';var m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')};
var playBtn=$('#playBtn'),muteBtn=$('#muteBtn'),seek=$('#seek'),tm=$('#tm'),lastUI='';
function updateVC(){
  var m=leadVideo(),isV=!!m;
  app.classList.toggle('has-vc',isV);
  if(!isV)return;
  var el=m.el,live=!isFinite(el.duration);
  var key=(S.playing?'p':'x')+(S.muted?'m':'u')+(live?'l':'f');
  if(key!==lastUI){
    lastUI=key;
    playBtn.innerHTML=svg(S.playing?'pause':'play',20);
    muteBtn.innerHTML=svg(S.muted?'mute':'vol',20);
    seek.disabled=live;
  }
  tm.textContent=live?'live example':fmt(el.currentTime)+' / '+fmt(el.duration);
  if(!live&&document.activeElement!==seek)seek.value=Math.round(el.currentTime/el.duration*1000)||0;
}
playBtn.onclick=function(){S.playing?pauseAll():playAll();lastUI=''};
muteBtn.onclick=function(){S.muted=!S.muted;applyAudio();lastUI=''};
seek.addEventListener('input',function(){seekAll(seek.value/1000)});

var hintT;
function showHint(msg){var h=$('#hint');h.textContent=msg;h.hidden=false;clearTimeout(hintT)}
function hideHint(){$('#hint').hidden=true}
function toast(msg,ms){showHint(msg);clearTimeout(hintT);hintT=setTimeout(hideHint,ms||3600)}

/* ---------- import ---------- */
var fileIn=$('#file');
$('#importBtn').onclick=$('#emptyImport').onclick=function(){if(!S.viewOnly)fileIn.click()};
fileIn.addEventListener('change',function(){handleFiles(fileIn.files);fileIn.value=''});
$('#fileSlot').addEventListener('change',function(){
  var inp=$('#fileSlot'),f=inp.files&&inp.files[0];inp.value='';
  var t=slotTarget;slotTarget=null;
  if(!f||!t||S.viewOnly)return;
  if(!kindOf(f)){toast('Choose a JPEG, PNG, MP4 or WebM file.');return}
  var sc=getScene(t.sceneId);if(!sc||!sc.v[t.variant])return;
  var m=addMedia(f);
  sc.v[t.variant][t.slot]=m.id;
  gcMedia();refreshMap();applyAudio();renderRail();renderInsp();save();
});

var dropEl=$('#drop'),dropT;
function hasFiles(e){return !S.viewOnly && !!(e.dataTransfer&&Array.prototype.indexOf.call(e.dataTransfer.types||[],'Files')>-1)}
function hideDrop(){clearTimeout(dropT);dropEl.hidden=true}
window.addEventListener('dragover',function(e){
  if(!hasFiles(e))return;
  e.preventDefault();dropEl.hidden=false;
  clearTimeout(dropT);dropT=setTimeout(hideDrop,700);
});
window.addEventListener('dragleave',function(e){if(!e.relatedTarget)hideDrop()});
window.addEventListener('dragend',hideDrop);
window.addEventListener('drop',function(e){
  e.preventDefault();hideDrop();
  if(hasFiles(e))handleFiles(e.dataTransfer.files);
});

function handleFiles(list){
  if(S.viewOnly)return;
  var files=Array.from(list).filter(function(f){return kindOf(f)});
  if(!files.length){toast('Choose a JPEG, PNG, MP4 or WebM file.');return}
  if(S.demo){resetTour(true)}
  var first=null;
  files.forEach(function(f){
    var m=addMedia(f);
    var sc={id:uid(),name:m.name,v:[{a:m.id,b:null},null],hotspots:[],markers:[],view:null,mapPos:null,cmp:.5};
    S.scenes.push(sc);if(!first)first=sc;
  });
  renderRail();layout();
  if(first)goTo(first.id,{instant:true});
  toast(files.length+(files.length>1?' scenes added.':' scene added.'));
  save();
}

/* ---------- multi-project IndexedDB persistence ---------- */
function dbOpen(){
  return new Promise(function(res,rej){
    try{
      var r=indexedDB.open('panoreel_projects',2);
      r.onupgradeneeded=function(){
        var db = r.result;
        if(!db.objectStoreNames.contains('projects')){
          db.createObjectStore('projects', {keyPath: 'id'});
        }
      };
      r.onsuccess=function(){res(r.result)};
      r.onerror=function(){rej(r.error)};
    }catch(e){rej(e)}
  });
}

function dbGetAllProjects(){
  return dbOpen().then(function(db){
    return new Promise(function(res,rej){
      var q = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      q.onsuccess = function(){
        res((q.result||[]).map(function(p){
          return {id: p.id, name: p.name, sceneCount: (p.scenes||[]).length, updatedAt: p.updatedAt};
        }));
      };
      q.onerror = function(){ rej(q.error); };
    });
  }).catch(function(){ return []; });
}

function dbGetRawProjectRecord(id){
  return dbOpen().then(function(db){
    return new Promise(function(res,rej){
      var q = db.transaction('projects', 'readonly').objectStore('projects').get(id);
      q.onsuccess = function(){ res(q.result); };
      q.onerror = function(){ rej(q.error); };
    });
  });
}

function dbSaveRawProjectRecord(rec){
  return dbOpen().then(function(db){
    return new Promise(function(res,rej){
      var q = db.transaction('projects', 'readwrite').objectStore('projects').put(rec);
      q.onsuccess = function(){ res(); };
      q.onerror = function(){ rej(q.error); };
    });
  });
}

function dbDeleteProject(id){
  return dbOpen().then(function(db){
    return new Promise(function(res,rej){
      var q = db.transaction('projects', 'readwrite').objectStore('projects').delete(id);
      q.onsuccess = function(){ res(); };
      q.onerror = function(){ rej(q.error); };
    });
  });
}

function dbLoadProject(id){
  return dbGetRawProjectRecord(id).then(function(rec){
    if(!rec) throw new Error('Project not found');
    
    S.projectId = rec.id;
    S.name = rec.name || 'Untitled tour';
    $('#tourName').value = S.name;
    S.dial = rec.dial || 0;
    S.altNames = rec.altNames || ['Primary', 'Alternative'];
    if(rec.startScreen) S.startScreen = rec.startScreen;
    S.markerPool = rec.markerPool || [];
    S.walkthrough = rec.walkthrough || [];

    Array.from(S.media.values()).forEach(dropMedia);
    S.media.clear();

    (rec.media||[]).forEach(function(r){
      var m={id:r.id,kind:r.kind,name:r.name,blob:r.blob,thumb:r.thumb,layout:r.layout||'mono',projection:r.projection||'eq360',url:URL.createObjectURL(r.blob)};
      S.media.set(m.id,m);loadMedia(m);
    });

    S.scenes = (rec.scenes||[]).map(normScene);
    if(!S.scenes.some(function(s){return s.v[1]})) S.dial = 0;
    if(rec.map && rec.map.blob) S.map = {blob:rec.map.blob, url:URL.createObjectURL(rec.map.blob), w:rec.map.w, h:rec.map.h, demo:false};
    
    var first = S.scenes[0];
    renderRail(); layout();
    if(first) goTo(first.id, {instant:true});
  });
}

function dbDel(){
  if(S.projectId) dbDeleteProject(S.projectId);
}

var saveT;
function save(){
  if(S.demo||S.viewOnly)return;
  clearTimeout(saveT);saveT=setTimeout(function(){
    if(!S.projectId) S.projectId = uid();
    var rec={
      id: S.projectId,
      name: S.name,
      updatedAt: Date.now(),
      active: S.active,
      dial: S.dial,
      altNames: S.altNames,
      scenes: S.scenes,
      markerPool: S.markerPool,
      walkthrough: S.walkthrough,
      startScreen: S.startScreen,
      media: Array.from(S.media.values()).map(function(m){
        return {id:m.id,kind:m.kind,name:m.name,blob:m.blob,thumb:m.thumb||null,layout:m.layout||'mono',projection:m.projection||'eq360'};
      }),
      map: (S.map&&S.map.blob)?{blob:S.map.blob,w:S.map.w,h:S.map.h}:null
    };
    dbSaveRawProjectRecord(rec);
  },500);
}

/* ---------- example tour ---------- */
function stopDemo(){demoTimers.forEach(clearInterval);demoTimers=[]}
function drawDemo(ctx,W,H,t,p,label,doors,stamp){
  var k=W/2048;
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,p.s0);g.addColorStop(.5,p.s1);g.addColorStop(.5,p.f0);g.addColorStop(1,p.f1);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=p.grid;ctx.lineWidth=2;ctx.beginPath();
  var i,j;
  for(i=0;i<=48;i++){var x=i*W/48;ctx.moveTo(x,H/2);ctx.lineTo(x,H)}
  for(j=1;j<=8;j++){var y=H/2+Math.pow(j/8,1.7)*H/2;ctx.moveTo(0,y);ctx.lineTo(W,y)}
  ctx.stroke();
  ctx.textAlign='center';ctx.fillStyle=p.ink;
  ctx.font='600 '+Math.round(92*k)+'px "Instrument Sans",system-ui,sans-serif';ctx.fillText(label,W/2,150*k);
}
function createDemo(){
  S.demo=true;S.projectId=uid();S.name='Example tour';$('#tourName').value=S.name;S.altNames=['Day','Night'];
  var PAL={
    Atrium:{day:{s0:'#000',s1:'#112233',f0:'#050a0f',f1:'#000',grid:'rgba(82,177,216,.3)',accent:'#52b1d8',ink:'#ffffff'},
            night:{s0:'#000',s1:'#031018',f0:'#020508',f1:'#000',grid:'rgba(82,177,216,.2)',accent:'#52b1d8',ink:'#ffffff'}}
  };
  var id=uid();
  var W=1600,H=800;
  var c=document.createElement('canvas');c.width=W;c.height=H;
  drawDemo(c.getContext('2d'),W,H,null,PAL.Atrium.day,'DEMO SCENE',[],'0:00');
  var im=new Image();im.src=c.toDataURL('image/jpeg',.9);
  var m={id:uid(),name:'Atrium',demo:true,w:W,h:H,kind:'photo',el:im,url:im.src,layout:'mono',projection:'eq360'};
  S.media.set(m.id,m);
  
  var poolId = uid();
  S.markerPool = [{id: poolId, name: 'Feature Specimen', desc: 'This marker provides details without shifting your view.'}];

  S.scenes.push({id:id,name:'Atrium',v:[{a:m.id,b:null},null],view:null,mapPos:null,cmp:.5,hotspots:[],markers:[{id:uid(),poolId:poolId,lon:180,lat:0}]});
  
  S.walkthrough = [{
    id: uid(), sceneId: id, startLon: 180, endLon: 270, panDuration: 5, pauseDuration: 3, markerId: poolId
  }];
}

/* ---------- render loop ---------- */
function frame(){
  requestAnimationFrame(frame);
  if(!drag&&ptrs.size===0&&!S.busy&&(vlon||vlat)){
    lon+=vlon;lat+=vlat;vlon*=.92;vlat*=.92;
    if(Math.abs(vlon)<.002)vlon=0;if(Math.abs(vlat)<.002)vlat=0;
  }
  var sc=curScene();
  if(sc){
    if(S.pendingMap)refreshMap();
    dispMedia(sc).forEach(function(m){
      if(m)m._seen=performance.now();
      if(m&&m.kind==='video'&&m.tex&&m.el.readyState>=2&&(m.demo?m._dirty:m.el.currentTime!==m._lt)){m._lt=m.el.currentTime;m._dirty=false;m.tex.needsUpdate=true}
    });
  }
  updateCmp();updateCamera();renderer.render(scene3,camera);
  if(snapReq){ghost.width=canvas.width;ghost.height=canvas.height;gctx.drawImage(canvas,0,0);snapReq(true)}
  updateHotspots();updateVC();updateCone();
}

/* ---------- boot ---------- */
function boot(){
  var params = new URLSearchParams(window.location.search);
  var reqProject = params.get('project');
  if(params.get('mode') === 'view' || params.get('view') === '1' || window.location.hash === '#view'){
    S.viewOnly = true;
    S.mode = 'view';
    S.railOpen = false;
  }

  resize();layout();renderRail();renderInsp();frame();

  dbGetAllProjects().then(function(projects){
    if(projects.length){
      var targetId = (reqProject && projects.some(p => p.id === reqProject)) ? reqProject : projects[0].id;
      dbLoadProject(targetId).then(function(){
        if(S.viewOnly){
          showStartScreen();
        }
      });
    }else{
      startDemo();
    }
  }).catch(startDemo);
}

function startDemo(){
  if(S.scenes.length)return;
  createDemo();renderRail();layout();goTo(S.scenes[0].id,{instant:true});
  if(S.viewOnly){
    showStartScreen();
  }
}
boot();
})();