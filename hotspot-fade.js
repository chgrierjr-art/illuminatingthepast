(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('dev') === '1') return;

  var IDLE_DELAY = 4500;
  var stage = document.getElementById('stage');
  var hotspots = document.getElementById('hs');
  if (!stage || !hotspots) return;

  var style = document.createElement('style');
  style.textContent = [
    'body.view-only.hotspots-idle #hs .hsp { opacity: .12; transition: opacity .5s ease; }',
    'body.view-only.hotspots-idle #hs .hsp:hover,',
    'body.view-only.hotspots-idle #hs .hsp:focus-visible { opacity: 1; }',
    '@media (prefers-reduced-motion: reduce) { body.view-only.hotspots-idle #hs .hsp { transition: none; } }'
  ].join('\n');
  document.head.appendChild(style);

  var timer = null;
  var dragging = false;
  var movedDuringDrag = false;
  var lastX = 0;
  var lastY = 0;
  var wasViewer = false;

  function isViewer() {
    return params.get('dev') !== '1' && document.body.classList.contains('view-only');
  }

  function resetIdleTimer() {
    clearTimeout(timer);
    document.body.classList.remove('hotspots-idle');
    if (!isViewer()) return;
    timer = setTimeout(function () {
      if (isViewer()) document.body.classList.add('hotspots-idle');
    }, IDLE_DELAY);
  }

  stage.addEventListener('pointerdown', function (event) {
    if (event.target.closest('.hsp')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragging = true;
    movedDuringDrag = false;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  stage.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    var dx = event.clientX - lastX;
    var dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      movedDuringDrag = true;
      resetIdleTimer();
    }
  });

  function endDrag() {
    if (dragging && movedDuringDrag) resetIdleTimer();
    dragging = false;
    movedDuringDrag = false;
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', function (event) {
    if (event.deltaY) resetIdleTimer();
  }, { passive: true });

  document.addEventListener('keydown', function (event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(event.key) === -1) return;
    var tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    resetIdleTimer();
  });

  hotspots.addEventListener('click', resetIdleTimer);

  // The app is bootstrapped asynchronously by default-loader.js. Only react to
  // changes in viewer mode so adding/removing the idle class cannot restart the timer.
  new MutationObserver(function () {
    var viewer = isViewer();
    if (viewer !== wasViewer) {
      wasViewer = viewer;
      if (viewer) resetIdleTimer();
      else {
        clearTimeout(timer);
        document.body.classList.remove('hotspots-idle');
      }
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  wasViewer = isViewer();
  if (wasViewer) resetIdleTimer();
})();
