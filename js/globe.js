/* 镂空点阵地球：拍过照的省份边界线发光（不显示闪光点） */
(function () {
  "use strict";
  var R = 4;
  var scene, camera, renderer, sphere, markers = [], adminLines = [];
  var radius = R * 2.7, theta = 0.2, phi = 1.35;
  var tgt = new THREE.Vector3(0, 0, 0);
  var dragging = false, lastX = 0, lastY = 0, hover = -1, prevIdx = -1;
  var downMarker = -1, moved = false, downX = 0, downY = 0;
  var goal = null, zoomGoal = null;
  var T = 0;

  function vec(lat, lon, r) {
    var p = (90 - lat) * Math.PI / 180, la = lon * Math.PI / 180;
    return new THREE.Vector3(r * Math.sin(p) * Math.cos(la), r * Math.cos(p), -r * Math.sin(p) * Math.sin(la));
  }
  function camPos() {
    return new THREE.Vector3(
      tgt.x + radius * Math.sin(phi) * Math.cos(theta),
      tgt.y + radius * Math.cos(phi),
      tgt.z + radius * Math.sin(phi) * Math.sin(theta));
  }
  function updateCam() { camera.position.copy(camPos()); camera.lookAt(tgt); }

  function buildSphere() {
    var pts = [];
    for (var lat = -88; lat <= 88; lat += 2.5) {
      for (var lon = -180; lon < 180; lon += 2.5) {
        var v = vec(lat, lon, R); pts.push(v.x, v.y, v.z);
      }
    }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    sphere = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x78d8ff, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(sphere);
    // 国界线（低调蓝）
    var mat = new THREE.LineBasicMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    (window.BORDER_LINES || []).forEach(function (ring) {
      var pts = ring.map(function (ll) { return vec(ll[0], ll[1], R * 1.001); });
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    });
    // 经纬网
    var gridMat = new THREE.LineBasicMaterial({ color: 0x1b3a4d, transparent: true, opacity: 0.4 });
    for (var lon = -180; lon < 180; lon += 20) { scene.add(lineSeg([[-80, lon], [80, lon]], gridMat)); }
    for (var lat = -80; lat <= 80; lat += 20) { scene.add(lineSeg([[lat, -180], [lat, 180]], gridMat)); }
  }
  function lineSeg(twoLL, mat) {
    var from = twoLL[0], to = twoLL[1], pts = [], steps = 48;
    for (var t = 0; t <= steps; t++) {
      var lat = from[0] + (to[0] - from[0]) * t / steps;
      var lon = from[1] + (to[1] - from[1]) * t / steps;
      pts.push(vec(lat, lon, R));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  }
  function buildStars() {
    var n = 900, arr = [];
    for (var i = 0; i < n; i++) { var p = Math.acos(2 * Math.random() - 1), t = Math.random() * Math.PI * 2, r = R * 7 + Math.random() * 16; arr.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xb8c4d2, size: 0.12, sizeAttenuation: true })));
  }
  // 拍过照的省/州边界线（每个 feature 独立材质，便于整块发黄）
  function buildAdmin1() {
    var feats = window.ADMIN1 || [];
    feats.forEach(function (f) {
      var mats = [];
      f.rings.forEach(function (ring) {
        var m = new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
        var pts = ring.map(function (ll) { return vec(ll[0], ll[1], R * 1.004); });
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
        mats.push(m);
      });
      adminLines.push({ mats: mats, feature: f });
    });
  }
  function glowTexture() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function starTexture() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.translate(32, 32); g.fillStyle = "#ffd86b";
    g.beginPath(); for (var i = 0; i < 10; i++) { var r = i % 2 ? 8 : 21, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
    return new THREE.CanvasTexture(c);
  }
  function labelSprite(name) {
    var c = document.createElement("canvas"), g = c.getContext("2d");
    g.font = "600 26px system-ui"; g.textBaseline = "middle"; g.textAlign = "center";
    c.width = Math.ceil(g.measureText(name).width) + 26; c.height = 40;
    g = c.getContext("2d"); g.font = "600 26px system-ui"; g.textBaseline = "middle"; g.textAlign = "center";
    g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.moveTo(11, 2); g.arcTo(c.width, 2, c.width, 38, 11); g.arcTo(c.width, 38, 0, 38, 11); g.arcTo(0, 38, 0, 2, 11); g.arcTo(0, 2, c.width, 2, 11); g.closePath(); g.fill();
    g.fillStyle = "#fff"; g.fillText(name, c.width / 2, 21);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(0.9, 0.45, 1); return s;
  }
  // 标记：不可见的命中点（不显示闪光点），并关联到对应的省/州边界
  function buildMarkers(list) {
    var glow = glowTexture(), st = starTexture();
    list.forEach(function (p) {
      var pos = vec(p.lat, p.lon, R * 1.01);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthTest: false }));
      spr.scale.set(1.2, 1.2, 1); spr.position.copy(pos); scene.add(spr);
      var star = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
      star.scale.set(0.34, 0.34, 1); star.position.copy(pos); scene.add(star);
      var admin = (window.PLACE_ADMIN || {})[p.slug];
      markers.push({ spr: spr, star: star, admin: (admin == null ? -1 : admin), data: p, pos: pos });
    });
  }
  function setAdminGlow(idx, on) {
    if (idx < 0 || !adminLines[idx]) return;
    adminLines[idx].mats.forEach(function (m) { m.color.set(on ? 0xffffc0 : 0xffe066); });
  }

  function flyTo(m) { goal = { t: 0, dur: 1300, rFrom: radius, rTo: R * 1.9, tgtFrom: tgt.clone(), tgtTo: m.pos.clone() }; showPanel(m.data); }
  function showPanel(d) {
    var el = document.getElementById("globePanel"); if (!el) return;
    el.hidden = false;
    el.innerHTML = `<div class="gp__name">${d.name}</div><div class="gp__sub">${d.country.toUpperCase()}</div><a class="gp__go" href="#/photography/${d.country}/${d.slug}">查看该地作品 →</a>`;
  }
  function openPlace(m) {
    flyTo(m);
    try { if (window.parent && window.parent !== window && m && m.data) { window.parent.postMessage({ type: "globe-navigate", country: m.data.country, slug: m.data.slug }, "*"); } } catch (e) {}
    var side = document.getElementById("globeSide"), home = document.querySelector(".globe-home");
    if (!side || !home) return;
    home.classList.add("open"); side.hidden = false;
    var photos = [];
    var P = window.PORTFOLIO;
    if (P) { var c = P.photography.find((x) => x.slug === m.data.country); var r = c && c.regions.find((x) => x.slug === m.data.slug); if (r) photos = r.photos.slice(0, 48); }
    side.innerHTML =
      `<div class="gs-head"><div class="gs-title">${m.data.name}<div class="gs-sub">${m.data.country.toUpperCase()} · ${photos.length} 张</div></div><button class="gs-close" data-gsclose>✕</button></div>` +
      `<div class="gs-grid">${photos.map((ph) => `<a class="gs-item" href="#/photography/${m.data.country}/${m.data.slug}"><img src="${ph.src}" loading="lazy"></a>`).join("")}</div>`;
  }
  function pick(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    var m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    var ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    for (var i = 0; i < markers.length; i++) { if (ray.intersectObject(markers[i].spr).length) return i; }
    return -1;
  }
  function onDown(e) { dragging = true; moved = false; downX = e.clientX; downY = e.clientY; lastX = e.clientX; lastY = e.clientY; downMarker = pick(e); }
  function onMove(e) {
    var i = pick(e);
    if (i !== hover) { setHover(i); }
    if (dragging) { if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true; theta -= (e.clientX - lastX) * 0.004; phi -= (e.clientY - lastY) * 0.004; phi = Math.max(0.15, Math.min(Math.PI - 0.15, phi)); goal = null; lastX = e.clientX; lastY = e.clientY; }
  }
  function setHover(i) {
    if (i >= 0 && markers[i]) setAdminGlow(markers[i].admin, true);
    if (prevIdx >= 0 && markers[prevIdx]) setAdminGlow(markers[prevIdx].admin, false);
    hover = i; prevIdx = i;
    renderer.domElement.style.cursor = i >= 0 ? "pointer" : "grab";
    markers.forEach(function (m, idx) {
      if (idx === i) { if (!m.label) { m.label = labelSprite(m.data.name); m.label.position.copy(m.pos).add(new THREE.Vector3(0, 0.38, 0)); scene.add(m.label); } else m.label.visible = true; }
      else if (m.label) m.label.visible = false;
    });
  }
  function onUp() { dragging = false; if (!moved && downMarker >= 0 && markers[downMarker]) openPlace(markers[downMarker]); downMarker = -1; }
  function onDbl(e) { var i = pick(e); if (i >= 0) openPlace(markers[i]); }
  function onWheel(e) { if (e.ctrlKey) { e.preventDefault(); zoomGoal = Math.max(R * 1.55, Math.min(R * 6, radius * (e.deltaY > 0 ? 1.12 : 0.89))); } }
  function tick() {
    requestAnimationFrame(tick);
    T += 16;
    if (zoomGoal !== null) { radius += (zoomGoal - radius) * 0.14; if (Math.abs(zoomGoal - radius) < 0.02) zoomGoal = null; }
    if (goal) {
      goal.t += 16; var k = Math.min(1, goal.t / goal.dur); var e2 = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      radius = goal.rFrom + (goal.rTo - goal.rFrom) * e2; tgt.lerpVectors(goal.tgtFrom, goal.tgtTo, e2);
      if (k >= 1) goal = null;
    }
    // 所有拍过照省/州边界持续黄色呼吸发光
    adminLines.forEach(function (al, ai) {
      var base = 0.82 + 0.18 * Math.abs(Math.sin(T * 0.007 + ai));
      al.mats.forEach(function (m) { m.opacity = base; });
    });
    // 拍摄地星星轻微闪烁
    markers.forEach(function (m, idx) {
      if (m.star) {
        var k = (hover === idx ? 1.6 : 1) * (1 + 0.2 * Math.sin(T * 0.005 + idx));
        m.star.scale.set(0.34 * k, 0.34 * k, 1);
        m.star.material.opacity = 0.8 + 0.2 * Math.sin(T * 0.005 + idx + 1);
      }
    });
    // 悬停的那块更亮
    if (hover >= 0 && markers[hover] && markers[hover].admin >= 0 && adminLines[markers[hover].admin]) {
      adminLines[markers[hover].admin].mats.forEach(function (m) { m.opacity = 0.94 + 0.06 * Math.abs(Math.sin(T * 0.01)); });
    }
    updateCam(); renderer.render(scene, camera);
  }

  window.Globe = {
    init: function (canvas, list) {
      list = list || (window.GLOBE_PLACES || []);
      scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070b);
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      canvas.style.touchAction = "none";
      canvas.style.overscrollBehavior = "none";
      function size() { var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      size(); window.addEventListener("resize", size);
      buildSphere(); buildAdmin1(); buildStars(); buildMarkers(list); updateCam();
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("dblclick", onDbl);
      tick();
      var p = document.getElementById("globePanel"); if (p) p.hidden = true;
    }
  };
})();
