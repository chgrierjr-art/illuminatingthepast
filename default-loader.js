(function () {
  'use strict';

  var loading = document.createElement('div');
  loading.setAttribute('role', 'status');
  loading.textContent = 'Loading the published tour…';
  loading.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#080b0f;color:#fff;font:16px system-ui,sans-serif';
  document.body.appendChild(loading);

  function isDevPath() {
    return /(?:^|\/)dev\/?$/.test(window.location.pathname);
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      var request;
      try {
        request = indexedDB.open('panoreel_projects', 2);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function saveProject(record) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction('projects', 'readwrite');
        transaction.objectStore('projects').put(record);
        transaction.oncomplete = function () { db.close(); resolve(); };
        transaction.onerror = function () { db.close(); reject(transaction.error); };
        transaction.onabort = function () { db.close(); reject(transaction.error); };
      });
    });
  }

  function dataUrlToBlob(dataUrl) {
    return dataUrl ? fetch(dataUrl).then(function (response) {
      if (!response.ok) throw new Error('Unable to decode embedded project media.');
      return response.blob();
    }) : Promise.resolve(null);
  }

  async function prepareDefaultProject(data) {
    if (!data || !data.panoreelExport) {
      throw new Error('The published default file is not a valid Panoreel project.');
    }

    var media = await Promise.all((data.media || []).map(async function (item) {
      return {
        id: item.id,
        kind: item.kind,
        name: item.name,
        layout: item.layout || 'mono',
        projection: item.projection || 'eq360',
        thumb: item.thumb || null,
        blob: await dataUrlToBlob(item.dataUrl)
      };
    }));
    var mapBlob = data.map && data.map.dataUrl ? await dataUrlToBlob(data.map.dataUrl) : null;

    return {
      id: 'published-default',
      name: data.name || 'Published Tour',
      updatedAt: Date.now(),
      active: data.scenes && data.scenes[0] ? data.scenes[0].id : null,
      dial: data.dial || 0,
      altNames: data.altNames || ['Primary', 'Alternative'],
      scenes: data.scenes || [],
      markerPool: data.markerPool || [],
      walkthrough: data.walkthrough || [],
      startScreen: data.startScreen || { enabled: false, title: 'Welcome to the Tour', desc: '' },
      media: media,
      map: mapBlob ? { blob: mapBlob, w: data.map.w, h: data.map.h } : null
    };
  }

  function configureStartupUrl() {
    var params = new URLSearchParams(window.location.search);
    var isEditorPath = isDevPath();
    var explicitView = params.get('mode') === 'view' || params.get('view') === '1' || window.location.hash === '#view';
    var editorRequested = params.get('mode') === 'edit' || (isEditorPath && !explicitView);

    if (!params.has('project') && !editorRequested) {
      params.set('project', 'published-default');
    }
    if (!params.has('mode') && params.get('view') !== '1' && window.location.hash !== '#view') {
      params.set('mode', editorRequested ? 'edit' : 'view');
    }

    var query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    return params.get('project') === 'published-default';
  }

  async function loadPublishedDefault() {
    if (!configureStartupUrl()) return;

    var response = await fetch(new URL('./default.panoreel', document.baseURI), { cache: 'no-cache' });
    if (!response.ok) throw new Error('Could not fetch default.panoreel (' + response.status + ').');
    var projectData = JSON.parse(await response.text());
    var record = await prepareDefaultProject(projectData);
    await saveProject(record);
  }

  function cleanDefaultPresentationUrl() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('project') !== 'published-default' || params.get('mode') !== 'view') return;

    params.delete('project');
    params.delete('mode');
    var query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
  }

  function startApp() {
    loading.remove();
    var appScript = document.createElement('script');
    appScript.src = new URL('./script.js', document.baseURI).href;
    appScript.onload = cleanDefaultPresentationUrl;
    appScript.onerror = function () {
      document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;z-index:100000;inset:auto 16px 16px;padding:12px;background:#300;color:#fff">The Panoreel app could not be loaded. Please reload the page.</p>');
    };
    document.body.appendChild(appScript);
  }

  loadPublishedDefault().catch(function (error) {
    console.error('Unable to load the published default Panoreel tour:', error);
  }).finally(startApp);
})();
