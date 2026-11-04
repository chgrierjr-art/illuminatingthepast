(function () {
  'use strict';

  function isDevWithoutSelectedProject() {
    var params = new URLSearchParams(window.location.search);
    return params.get('dev') === '1' && !params.has('project');
  }

  // In the dev editor, don't let the published default win the app's
  // "first project" fallback. Prefer the most recently edited local project.
  var originalGetAll = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function () {
    var request = originalGetAll.apply(this, arguments);
    if (this.name !== 'projects' || !isDevWithoutSelectedProject()) return request;

    return {
      get result() {
        return (request.result || []).filter(function (project) {
          return project.id !== 'published-default';
        }).sort(function (a, b) {
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
      },
      set onsuccess(handler) {
        request.onsuccess = handler;
      },
      get onsuccess() {
        return request.onsuccess;
      },
      set onerror(handler) {
        request.onerror = handler;
      },
      get onerror() {
        return request.onerror;
      }
    };
  };

  // Preserve uploaded start-screen images as durable data URLs in IndexedDB.
  // The app normally persists only the temporary blob: URL, which breaks on reload.
  var pendingStartImage = false;
  var imageDataByObjectUrl = new Map();
  window.addEventListener('change', function (event) {
    if (event.target && event.target.id === 'fileStartImg') {
      pendingStartImage = true;
      setTimeout(function () { pendingStartImage = false; }, 0);
    }
  }, true);

  var originalCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) {
    var objectUrl = originalCreateObjectURL(blob);
    if (pendingStartImage && blob) {
      pendingStartImage = false;
      var reader = new FileReader();
      reader.onload = function () { imageDataByObjectUrl.set(objectUrl, reader.result); };
      reader.readAsDataURL(blob);
    }
    return objectUrl;
  };

  var originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value) {
    if (this.name === 'projects' && value && value.startScreen) {
      var imageUrl = value.startScreen.imgUrl;
      var durableImage = imageUrl && imageDataByObjectUrl.get(imageUrl);
      if (durableImage) {
        value = Object.assign({}, value, {
          startScreen: Object.assign({}, value.startScreen, { imgUrl: durableImage })
        });
      }
    }
    return originalPut.apply(this, arguments.length > 1 ? [value, arguments[1]] : [value]);
  };

  function openProjectsDb() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open('panoreel_projects', 2);
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function readProject(id) {
    return openProjectsDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var request = db.transaction('projects', 'readonly').objectStore('projects').get(id);
        request.onsuccess = function () { db.close(); resolve(request.result); };
        request.onerror = function () { db.close(); reject(request.error); };
      });
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      if (!blob) return resolve(null);
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('Could not read project media.')); };
      reader.readAsDataURL(blob);
    });
  }

  function downloadProject(projectId) {
    readProject(projectId).then(async function (record) {
      if (!record) throw new Error('Project data not found.');
      var media = await Promise.all((record.media || []).map(async function (item) {
        return {
          id: item.id,
          kind: item.kind,
          name: item.name,
          layout: item.layout,
          projection: item.projection,
          thumb: item.thumb,
          dataUrl: await blobToDataUrl(item.blob)
        };
      }));
      var mapDataUrl = record.map && record.map.blob ? await blobToDataUrl(record.map.blob) : null;
      var startScreen = record.startScreen || {};
      var imageUrl = startScreen.imgUrl || null;
      if (imageUrl && imageUrl.indexOf('blob:') === 0) {
        imageUrl = imageDataByObjectUrl.get(imageUrl) || null;
      }
      var payload = {
        panoreelExport: true,
        version: 1,
        name: record.name,
        dial: record.dial,
        altNames: record.altNames,
        scenes: record.scenes || [],
        markerPool: record.markerPool || [],
        walkthrough: record.walkthrough || [],
        startScreen: {
          enabled: !!startScreen.enabled,
          title: startScreen.title || '',
          desc: startScreen.desc || '',
          imgUrl: imageUrl && imageUrl.indexOf('data:') === 0 ? imageUrl : null
        },
        media: media,
        map: mapDataUrl ? { dataUrl: mapDataUrl, w: record.map.w, h: record.map.h } : null
      };
      var objectUrl = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      var anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = (record.name || 'panoreel_project').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.panoreel';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
      var hint = document.getElementById('hint');
      if (hint) {
        hint.textContent = 'Project exported successfully!';
        hint.hidden = false;
        setTimeout(function () { hint.hidden = true; }, 3600);
      }
    }).catch(function (error) {
      console.error('Panoreel export failed:', error);
      var hint = document.getElementById('hint');
      if (hint) {
        hint.textContent = 'Export failed.';
        hint.hidden = false;
      }
    });
  }

  // Use the current project's IndexedDB record for both export buttons. This
  // includes saved start-screen image data and avoids exporting stale UI state.
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('#exportCurrentBtn, .p-exp');
    if (!button) return;
    var projectId = button.id === 'exportCurrentBtn'
      ? null
      : button.dataset.id;
    if (button.id === 'exportCurrentBtn') {
      var activeItem = document.querySelector('.project-item.active');
      projectId = activeItem && activeItem.dataset.id;
      if (!projectId) {
        // Current project identity is not exposed outside the app closure.
        // The latest edited project is the active record in the editor.
        openProjectsDb().then(function (db) {
          var request = db.transaction('projects', 'readonly').objectStore('projects').getAll();
          request.onsuccess = function () {
            db.close();
            var records = request.result || [];
            var selected = records.find(function (record) { return record.id === 'published-default'; }) ||
              records.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0];
            if (selected) downloadProject(selected.id);
          };
        }).catch(console.error);
      } else {
        downloadProject(projectId);
      }
    } else {
      downloadProject(projectId);
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
})();
