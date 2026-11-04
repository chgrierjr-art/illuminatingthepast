(function(){
'use strict';
var $=function(s){return document.querySelector(s)};
if(!window.THREE){
  document.body.insertAdjacentHTML('beforeend','<p style="padding:24px;color:#fff">The 3D engine could not load. Check your connection and reload.</p>');
  return;
}
var REDUCED=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var DEV_MODE=new URLSearchParams(window.location.search).get('dev')==='1';
