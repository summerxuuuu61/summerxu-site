/* 关于我：包豪斯 3D 小屋（精细灯光/材质/结构，含 Bloom） */
(function () {
  "use strict";
  var scene, camera, renderer, composer, bloomPass, raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
  var dist = 17, theta = 0.8, phi = 0.95, gDist = dist, gTheta = theta, gPhi = phi, dragging = false, lx = 0, ly = 0, moved = false, sx = 0, sy = 0;
  var clickables = [], lampSpot = null, lampBulbMat = null, lampOn = false, mapCanvas, bloomObjs = [];
  var social = { bilibili: "https://space.bilibili.com/25897119", xiaohongshu: "https://xhslink.cn/o/3Dbxb5fQph7", douyin: "https://v.douyin.com/-KWVa6WelIA/" };
  var tools = [["达芬奇", "#7d5ba8"], ["PR", "#3a3a44"], ["剪映", "#1fba9e"], ["PS", "#1b6bb8"], ["ChatGPT", "#10a37f"], ["WPS", "#e04a3a"]];
  function clickable(m, a) { m.userData.clickAction = a; clickables.push(m); return m; }
  function box(w, h, d, m, x, y, z) { var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh; }
  function tex(w, h, draw) { var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return new THREE.CanvasTexture(c); }
  function loadImgTex(url) { var t = new THREE.CanvasTexture(); var im = new Image(); im.onload = function () { var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); t.image = c; t.needsUpdate = true; }; im.src = url; return t; }
  function loadGlb(url, pos, size, rot, onHit, hideFns, screenTex, face) { if (!THREE.GLTFLoader) return; try { new THREE.GLTFLoader().load(url, function (gltf) { var m = gltf.scene, bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), mx = Math.max(sz.x, sz.y, sz.z) || 1, s = size / mx; m.scale.setScalar(s); m.position.set(-c.x * s, -c.y * s, -c.z * s); m.traverse(function (o) { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material) o.material.side = THREE.DoubleSide; } }); var grp = new THREE.Group(); grp.add(m); if (rot) grp.rotation.set(rot[0], rot[1], rot[2]); grp.position.set(pos[0], pos[1] + sz.y * s / 2, pos[2]); if (face) { var dd = new THREE.Vector3(face[0], face[1], face[2]).normalize(); grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dd); } scene.add(grp); if (screenTex) { grp.updateMatrixWorld(true); var zF = sz.z * s / 2, zz = zF; try { var ori = new THREE.Vector3(0, 0, zF + 2).applyMatrix4(grp.matrixWorld); var sd = new THREE.Vector3(0, 0, -1).transformDirection(grp.matrixWorld).normalize(); var rcc = new THREE.Raycaster(); rcc.set(ori, sd); var hh = rcc.intersectObject(m, true); if (hh.length) { zz = grp.worldToLocal(hh[0].point.clone()).z; if (zz > zF + 0.2 || zz < -zF) zz = zF; } } catch (e) { zz = zF; } var scr = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * s * 0.92, sz.y * s * 0.92), new THREE.MeshBasicMaterial({ map: screenTex, color: 0xffffff })); scr.position.set(0, 0, zz + 0.012); grp.add(scr); } var hit = new THREE.Mesh(new THREE.BoxGeometry(sz.x * s, sz.y * s, sz.z * s), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); grp.add(hit); if (onHit) clickable(hit, onHit); if (hideFns) hideFns.forEach(function (f) { try { f(); } catch (e) {} }); }, undefined, function () { }); } catch (e) { } }
  function std(c, r, mt) { return new THREE.MeshStandardMaterial({ color: c, roughness: r != null ? r : 0.6, metalness: mt != null ? mt : 0.05 }); }
  function brite(c) { var m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); bloomObjs.push(m); return m; }
  function popup(html) { var old = document.getElementById("roomModal"); if (old) old.remove(); var d = document.createElement("div"); d.id = "roomModal"; d.className = "room-modal"; d.innerHTML = "<div class='room-modal__box'><div class='room-modal__close' style='position:absolute;top:10px;right:12px;cursor:pointer;font-size:22px;line-height:1'>×</div>" + html + "</div>"; d.addEventListener("click", function (e) { if (e.target.classList.contains("room-modal") || e.target.closest(".room-modal__close")) d.remove(); }); document.body.appendChild(d); }

  function woodFloor() {
    var c = document.createElement("canvas"); c.width = 1024; c.height = 512; var g = c.getContext("2d");
    g.fillStyle = "#c9a87c"; g.fillRect(0, 0, 1024, 512);
    for (var p = 0; p < 16; p++) { g.fillStyle = "rgba(150,110,70," + (0.04 + Math.random() * 0.13) + ")"; g.fillRect(0, p * 32, 1024, 32); }
    for (var i = 0; i < 140; i++) { g.strokeStyle = "rgba(150,110,70," + (0.12 + Math.random() * 0.2) + ")"; g.lineWidth = 1 + Math.random(); g.beginPath(); var yy = Math.random() * 512; g.moveTo(0, yy); g.bezierCurveTo(340, yy + (Math.random() * 24 - 12), 680, yy + (Math.random() * 24 - 12), 1024, yy); g.stroke(); }
    g.strokeStyle = "rgba(80,52,30,0.55)"; g.lineWidth = 3; for (var q = 0; q <= 16; q++) { g.beginPath(); g.moveTo(0, q * 32); g.lineTo(1024, q * 32); g.stroke(); }
    for (var rr = 0; rr < 16; rr++) { var sx = (rr % 2 ? 341 : 682); g.strokeStyle = "rgba(80,52,30,0.4)"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, rr * 32); g.lineTo(sx, (rr + 1) * 32); g.stroke(); }
    var color = new THREE.CanvasTexture(c); color.wrapS = color.wrapT = THREE.RepeatWrapping; color.repeat.set(1, 1);
    var n = document.createElement("canvas"); n.width = 128; n.height = 128; var ng = n.getContext("2d"); ng.fillStyle = "#808080"; ng.fillRect(0, 0, 128, 128); ng.strokeStyle = "#666"; ng.lineWidth = 3; for (var j = 0; j < 4; j++) { var xx = j * 32; ng.beginPath(); ng.moveTo(xx, 0); ng.lineTo(xx, 128); ng.stroke(); } ng.strokeStyle = "#666"; ng.lineWidth = 1; for (var jj = 0; jj < 16; jj++) { var yy2 = jj * 8; ng.beginPath(); ng.moveTo(0, yy2); ng.lineTo(128, yy2); ng.stroke(); }
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshStandardMaterial({ map: color, normalMap: new THREE.CanvasTexture(n), roughness: 0.45, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  }
  function blockWall() {
    var geo = new THREE.BoxGeometry(0.75, 0.75, 0.12), colors = { blu: 0x5a9bd8, grn: 0x6fbe7a, org: 0xe89a52, yel: 0xe6cf57, red: 0xd86a63 };
    function blk(c, x, y, z, rot) { var m = new THREE.Mesh(geo, std(colors[c], 0.6)); m.position.set(x, y, z); if (rot) m.rotation.y = rot; m.castShadow = true; scene.add(m); }
    blk("blu", -8.0, 4.70, -6.7); blk("grn", -8.0, 3.92, -6.7); blk("org", -8.0, 3.14, -6.7); blk("grn", -8.0, 2.36, -6.7);
    blk("blu", 8.0, 4.70, -6.7); blk("yel", 8.0, 3.92, -6.7); blk("red", 8.0, 3.14, -6.7); blk("yel", 8.0, 2.36, -6.7);
    blk("blu", -8.7, 4.70, -0.38, Math.PI / 2); blk("grn", -8.7, 3.92, -0.38, Math.PI / 2); blk("org", -8.7, 3.14, -0.38, Math.PI / 2); blk("org", -8.7, 2.36, -0.38, Math.PI / 2);
    blk("yel", 8.7, 4.70, -0.38, -Math.PI / 2); blk("blu", 8.7, 3.92, -0.38, -Math.PI / 2); blk("yel", 8.7, 3.14, -0.38, -Math.PI / 2); blk("blu", 8.7, 2.36, -0.38, -Math.PI / 2);
  }
  function proj(lat, lon, W, H) { return { x: (180 - lon) / 360 * W, y: (90 - lat) / 180 * H }; }
  function map() {
    var W = 1600, H = 700; mapCanvas = document.createElement("canvas"); mapCanvas.width = W; mapCanvas.height = H; var g = mapCanvas.getContext("2d");
    g.fillStyle = "#f2e7d2"; g.fillRect(0, 0, W, H); g.strokeStyle = "#c9ad7f"; g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round";
    (window.BORDER_LINES || []).forEach(function (ring) { g.beginPath(); ring.forEach(function (ll, i) { var p = proj(ll[0], ll[1], W, H); if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }); g.stroke(); });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.0), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(mapCanvas), roughness: 0.85 })); plane.position.set(0, 3, -6.9); scene.add(plane);
    var mp = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); mp.position.set(0, 3, -6.88); clickable(mp, function () { var pins = (window.GLOBE_PLACES || []).map(function (pl) { var p = proj(pl.lat, pl.lon, W, H); return "<a href='#/photography/" + pl.country + "/" + pl.slug + "' title='" + pl.name + "' style='position:absolute;left:" + (p.x / W * 100) + "%;top:" + (p.y / H * 100) + "%;transform:translate(-50%,-50%);width:15px;height:15px;border-radius:50%;background:#e04a3a;border:2px solid #fff;box-shadow:0 0 6px rgba(224,74,58,0.9)'></a>"; }).join(""); popup("<h2>世界地图</h2><div style='position:relative;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px #eee'><img src='" + mapCanvas.toDataURL() + "' style='width:100%;display:block'/>" + pins + "</div><p style='margin-top:10px'>点击红色图钉，一键跳转到对应地方的摄影作品。</p>"); }); scene.add(mp);
    (window.GLOBE_PLACES || []).forEach(function (pl) { var p = proj(pl.lat, pl.lon, W, H), x = (p.x / W - 0.5) * 16, y = 3 + (0.5 - p.y / H) * 5.0; var pin = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), new THREE.MeshStandardMaterial({ color: 0xd64a44, emissive: 0xd63a34, emissiveIntensity: 0.6, roughness: 0.6 })); pin.position.set(x, y, -6.86); clickable(pin, function () { location.hash = "#/photography/" + pl.country + "/" + pl.slug; }); scene.add(pin); });
    // 圆角霓虹灯带
    var grp = new THREE.Group(), m = brite(0xffe9bd), w = 16, h = 5.0, t = 0.14, r = 0.28;
    [[0, h / 2 - r, w - 2 * r, t], [0, -(h / 2 - r), w - 2 * r, t], [w / 2 - r, 0, t, h - 2 * r], [-(w / 2 - r), 0, t, h - 2 * r]].forEach(function (s) { var mm = new THREE.Mesh(new THREE.BoxGeometry(s[2], s[3], 0.06), m); mm.position.set(s[0], s[1], 0); grp.add(mm); });
    [[w / 2 - r, h / 2 - r], [-(w / 2 - r), h / 2 - r], [w / 2 - r, -(h / 2 - r)], [-(w / 2 - r), -(h / 2 - r)]].forEach(function (c) { var sp = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), m); sp.position.set(c[0], c[1], 0); grp.add(sp); });
    grp.position.set(0, 3, -6.8); scene.add(grp);
  }
  function carpet() {
    var s = 512, c = document.createElement("canvas"); c.width = c.height = s; var g = c.getContext("2d"); g.fillStyle = "#1e5f33"; g.fillRect(0, 0, s, s);
    for (var i = 0; i < 16000; i++) { g.fillStyle = "rgba(30,86,45," + (0.4 + Math.random() * 0.3) + ")"; g.fillRect(Math.random() * s, Math.random() * s, 2, 5); }
    g.font = "bold 78px Arial"; g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("WET GRASS", s * 0.5, s * 0.78);
    var color = new THREE.CanvasTexture(c);
    var dc = document.createElement("canvas"); dc.width = dc.height = s; var dg = dc.getContext("2d"); dg.fillStyle = "#808080"; dg.fillRect(0, 0, s, s); for (var j = 0; j < 16000; j++) { dg.fillStyle = "rgba(150,150,150," + (0.3 + Math.random() * 0.2) + ")"; dg.fillRect(Math.random() * s, Math.random() * s, 2, 4); } dg.font = "bold 78px Arial"; dg.fillStyle = "#fff"; dg.textAlign = "center"; dg.textBaseline = "middle"; dg.fillText("WET GRASS", s * 0.5, s * 0.78); var disp = new THREE.CanvasTexture(dc);
    var carpet = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 6.2, 80, 64), new THREE.MeshStandardMaterial({ map: color, displacementMap: disp, displacementScale: 0.09, normalMap: disp, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.95 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, 0); carpet.receiveShadow = true; scene.add(carpet);
  }
  function woodTex(base, line) { var c = document.createElement("canvas"); c.width = 512; c.height = 512; var g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 512, 512); g.strokeStyle = line; g.lineWidth = 2; for (var i = 0; i < 16; i++) { var y = i * 32; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); } return new THREE.CanvasTexture(c); }
  function desk() { var dt = woodTex("#b07a4a", "#9c683c"); box(3.3, 0.12, 1.8, new THREE.MeshStandardMaterial({ map: dt, roughness: 0.45 }), 0, 2.40, 0); var legM = std(0x19191b, 0.4, 0.5); [-1.55, 1.55].forEach(function (x) { box(0.12, 2.26, 2.0, legM, x, 1.2, 0); }); }
  function cameraItem() { var m = std(0x18181a, 0.4, 0.5), silver = std(0xc9cdd0, 0.25, 0.9); box(0.52, 0.32, 0.26, m, -1.4, 2.47, 0.08); var r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 24), silver); r1.rotation.x = Math.PI / 2; r1.position.set(-1.18, 2.5, 0.23); r1.castShadow = true; scene.add(r1); var glass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), new THREE.MeshStandardMaterial({ color: 0x223, roughness: 0.1, metalness: 0.9 })); glass.position.set(-1.18, 2.5, 0.30); glass.rotation.y = 0; scene.add(glass); box(0.16, 0.12, 0.08, m, -1.4, 2.67, 0.08); }
  function glbItem(path, size, pos, color, on) {
    function fb() { if (on) { var b = box(size * 0.9, size * 0.5, size * 0.6, std(color, 0.3, 0.45), pos[0], pos[1], pos[2]); on(b, b); } }
    if (THREE.GLTFLoader) { try { new THREE.GLTFLoader().load(path, function (gltf) {
      var m = gltf.scene; var bb = new THREE.Box3().setFromObject(m); var c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), mx = Math.max(sz.x, sz.y, sz.z) || 1, s = size / mx;
      m.scale.setScalar(s); m.position.set(pos[0] - c.x * s, pos[1] - c.y * s, pos[2] - c.z * s);
      m.traverse(function (o) { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(m);
      var hit = new THREE.Mesh(new THREE.BoxGeometry(sz.x * s, sz.y * s, sz.z * s), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); hit.position.copy(m.position); scene.add(hit);
      if (on) on(m, hit);
    }, undefined, fb); } catch (e) { fb(); } } else fb();
  }
  function stlItem(key, size, pos, color, on, rotY) {
    function fb() { var b = box(size * 0.95, size * 0.55, size * 0.65, std(color, 0.4, 0.5), pos[0], pos[1], pos[2]); if (on) on(b, b); return b; }
    var b64 = (window.MODELS_B64 || {})[key];
    if (THREE.STLLoader && b64) { try {
      var bin = atob(b64), geo = new THREE.STLLoader().parse(bin);
      if (!geo.attributes.position || geo.attributes.position.count === 0) { fb(); return; }
      geo.computeVertexNormals(); geo.computeBoundingBox();
      var c = geo.boundingBox.getCenter(new THREE.Vector3()), sz = geo.boundingBox.getSize(new THREE.Vector3()), mx = Math.max(sz.x, sz.y, sz.z), s = size / mx;
      var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide })); m.scale.setScalar(s); m.position.set(pos[0] - c.x * s, pos[1] - c.y * s, pos[2] - c.z * s); if (rotY) m.rotation.y = rotY; m.castShadow = m.receiveShadow = true; scene.add(m);
      var hit = new THREE.Mesh(new THREE.BoxGeometry(size * sz.x / mx, size * sz.y / mx, size * sz.z / mx), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); hit.position.copy(m.position); scene.add(hit);
      if (on) on(m, hit);
    } catch (e) { fb(); } } else fb();
  }
  function ipadItem() { var open = function (m, hit) { clickable(hit, function () { popup("<h2>iPad · B站页面</h2><a class='room-modal__go' target='_blank' rel='noopener' href='" + social.bilibili + "'>打开B站主页 ↗</a>"); }); }; stlItem("ipad", 1.1, [-0.9, 2.55, 0.04], 0xabb3bc, open); }
  function ballLamp() { var m = std(0x19191b, 0.4, 0.5); box(0.16, 0.05, 0.16, m, -0.72, 2.48, -0.20); var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), m); rod.position.set(-0.72, 2.58, -0.20); scene.add(rod); var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 20), new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffedc4, emissiveIntensity: 1.2 })); bulb.position.set(-0.72, 2.70, -0.20); scene.add(bulb); var pl = new THREE.PointLight(0xffedc4, 0.5, 2.5); pl.position.set(-0.72, 2.73, -0.20); scene.add(pl); }
  function macItem() { box(0.95, 0.05, 0.58, std(0xd8dce0, 0.35, 0.7), 0, 2.46, 0); var kb = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), std(0x202024, 0.4)); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 2.47, 0.08); scene.add(kb); var scr = box(0.95, 0.56, 0.05, std(0x0e1014, 0.4), 0, 2.80, -0.28); scr.rotation.x = -0.56; var face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), new THREE.MeshBasicMaterial({ map: tex(1000, 480, function (g) { g.fillStyle = "#0d0d12"; g.fillRect(0, 0, 1000, 480); g.fillStyle = "#fff"; g.font = "700 34px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("我熟练掌握的工具", 500, 44); tools.forEach(function (t, i) { var x = 160 + (i % 3) * 340, y = 180 + Math.floor(i / 3) * 210; g.fillStyle = t[1]; g.fillRect(x - 130, y - 90, 260, 180); g.fillStyle = "#fff"; g.font = "800 60px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t[0] === "PR" ? "Pr" : t[0].charAt(0), x, y - 30); g.font = "700 28px system-ui"; g.fillText(t[0], x, y + 42); }); }) })); face.position.set(0, 2.80, -0.27); face.rotation.x = -0.56; scene.add(face); clickable(face, function () { popup("<h2>Mac · 我熟练掌握的工具</h2><div style='display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:18px'>" + tools.map(function (t) { return "<div style='text-align:center;min-width:64px'><div style='width:54px;height:54px;border-radius:12px;background:" + t[1] + ";color:#fff;display:grid;place-items:center;font-weight:800;margin:0 auto 6px'>" + t[0].charAt(0) + "</div><div style='font-size:12px'>" + t[0] + "</div></div>"; }).join("") + "</div>"); }); }
  function phoneItem() { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10), std(0x19191b, 0.4, 0.5)); st.position.set(0.72, 2.36, 0.10); scene.add(st); var open = function (m, hit) { clickable(hit, function () { popup("<h2>手机 · 小红书 / 抖音</h2><p>小红书粉丝 1521</p><a class='room-modal__go' target='_blank' rel='noopener' href='" + social.xiaohongshu + "'>小红书主页 ↗</a><a class='room-modal__go' target='_blank' rel='noopener' href='" + social.douyin + "'>抖音主页 ↗</a>"); }); }; stlItem("phone", 0.5, [1.05, 2.6, 0.10], 0x9aa2ab, open); }
  function lampItem() { var dark = std(0x1a1a1c, 0.5, 0.5), green = std(0x2f8a5f, 0.3, 0.35); box(0.28, 0.06, 0.28, dark, 2.05, 2.47, -0.08); var neck = box(0.05, 0.34, 0.05, dark, 2.05, 2.66, -0.08); neck.rotation.z = 0.2; var shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.22, 20, 1, true), green); shade.position.set(1.92, 2.9, -0.08); shade.rotation.z = 1.05; shade.castShadow = true; scene.add(shade); var top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20), green); top.position.set(1.92, 3.01, -0.08); scene.add(top); lampBulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2ce, emissive: 0xfff0c0, emissiveIntensity: 0, roughness: 0.5 }); var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), lampBulbMat); bulb.position.set(1.92, 2.88, -0.08); scene.add(bulb); lampSpot = new THREE.SpotLight(0xffe2b0, 0, 4, 0.55, 0.5, 1); lampSpot.position.set(1.92, 2.9, -0.08); lampSpot.target.position.set(1.9, 2.0, 0.0); scene.add(lampSpot); scene.add(lampSpot.target); clickable(shade, function () { lampOn = !lampOn; lampSpot.intensity = lampOn ? 8 : 0; lampBulbMat.emissiveIntensity = lampOn ? 1.3 : 0; }); }
  function leftScreen() { var scr = box(0.12, 4.8, 6.4, std(0x1a1a1d, 0.85, 0.1), -8.72, 3, -1.6); clickable(scr, function () { popup("<h2>个人简历</h2><div style='display:flex;flex-wrap:wrap;gap:10px;margin-top:16px'>" + ["视频剪辑", "后期调色", "平面设计", "AI辅助创作", "自媒体运营"].map(function (t) { return "<span style='background:#eef2ff;padding:6px 12px;border-radius:6px'>" + t + "</span>"; }).join("") + "</div>"); }); }
  function photoWall() { for (var r = 0; r < 2; r++) for (var c = 0; c < 6; c++) { var y = r === 0 ? 4.65 : 3.65; var grp = new THREE.Group(); var frame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.92, 0.06), std(0xe9dfc9, 0.7)); var ph = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.8), new THREE.MeshStandardMaterial({ map: tex(24, 32, function (g) { g.fillStyle = "#7f8785"; g.fillRect(0, 0, 24, 32); g.fillStyle = "#59625f"; g.fillRect(2, 2, 20, 28); }) , roughness: 0.8 })); ph.position.z = 0.036; grp.add(frame); grp.add(ph); grp.rotation.y = -Math.PI / 2; grp.position.set(8.79, y, -4.9 + c * 0.5); scene.add(grp); } }
  function cabinet() {
    var m = new THREE.MeshStandardMaterial({ map: woodTex("#8a6a44", "#73552f"), roughness: 0.6 }), x0 = 8.0, z0 = -1.80, D = 0.9, H = 1.9, W = 2.4;
    box(0.06, H, W, m, 8.44, 0.9, z0); // 背板
    box(D, 0.06, W, m, x0, 1.87, z0); box(D, 0.06, W, m, x0, 0.03, z0); // 顶底
    box(D, H, 0.06, m, x0, 0.9, z0 - W / 2 + 0.03); box(D, H, 0.06, m, x0, 0.9, z0 + W / 2 - 0.03); // 两侧
    [0.62, 1.25].forEach(function (y) { box(D - 0.08, 0.05, W - 0.12, m, x0, y, z0); });
    box(D - 0.08, H - 0.12, 0.05, m, x0, 0.9, z0); // 竖隔板
    [[0xd5443b, 8.15, 2.36, -2.9, 0.3], [0x2a2a34, 8.25, 2.34, -1.7, 0.26], [0xf2b63a, 8.1, 2.32, -0.8, 0.2], [0x3a7bd5, 7.85, 0.9, -3.0, 0.16], [0x9b59c9, 8.1, 0.95, -2.5, 0.14], [0x33aa44, 7.95, 0.4, -1.7, 0.16], [0xff7722, 8.3, 0.42, -2.8, 0.13]].forEach(function (l) { box(l[4], l[4], l[4], std(l[0], 0.5), l[1], l[2], l[3]); });
  }
  function deskArea() {
    var TOP = 2.07; // 桌面顶面(再抬高0.8m后桌面中心y=1.99 + 半厚0.08)
    var wood = new THREE.MeshStandardMaterial({ color: 0xb07a45, roughness: 0.5 });
    var silver = new THREE.MeshStandardMaterial({ color: 0xc7cdd2, metalness: 0.85, roughness: 0.25 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5, metalness: 0.4 });
    // 胡桃木实木圆角厚桌面
    var wc = document.createElement("canvas"); wc.width = 512; wc.height = 512; var wg = wc.getContext("2d");
    wg.fillStyle = "#4a3626"; wg.fillRect(0, 0, 512, 512);
    for (var gr = 0; gr < 44; gr++) { wg.strokeStyle = "rgba(56,38,24,0.5)"; wg.lineWidth = 1 + Math.random() * 2; wg.beginPath(); var yy = Math.random() * 512; wg.moveTo(0, yy); wg.bezierCurveTo(170, yy + (Math.random() * 30 - 15), 340, yy + (Math.random() * 30 - 15), 512, yy); wg.stroke(); }
    var walnutMap = new THREE.CanvasTexture(wc); walnutMap.wrapS = walnutMap.wrapT = THREE.RepeatWrapping; walnutMap.repeat.set(0.2, 0.2);
    var walnut = new THREE.MeshStandardMaterial({ map: walnutMap, roughness: 0.52, metalness: 0.02 });
    function roundedSlab(w, d, r, t) {
      var sh = new THREE.Shape(); var x = -w / 2, y = -d / 2;
      sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
      sh.lineTo(x + w, y + d - r); sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
      sh.lineTo(x + r, y + d); sh.quadraticCurveTo(x, y + d, x, y + d - r);
      sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
      var g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelSegments: 3, bevelSize: r * 0.4, bevelThickness: t * 0.2, curveSegments: 16 });
      g.rotateX(Math.PI / 2); return new THREE.Mesh(g, walnut);
    }
    var deskTop = roundedSlab(5.2, 2.4, 0.16, 0.17); deskTop.position.set(0, TOP, 0); deskTop.castShadow = deskTop.receiveShadow = true; scene.add(deskTop);
    // 黑色双立柱电动升降桌腿：每根立柱前后两根方管腿（共4条腿），无多余横撑
    var bc = document.createElement("canvas"); bc.width = 64; bc.height = 64; var bg2 = bc.getContext("2d"); bg2.fillStyle = "#3c4044"; bg2.fillRect(0, 0, 64, 64); for (var li = 0; li < 220; li++) { bg2.strokeStyle = "rgba(255,255,255," + (Math.random() * 0.16) + ")"; bg2.lineWidth = 0.5; bg2.beginPath(); var by2 = Math.random() * 64; bg2.moveTo(0, by2); bg2.lineTo(64, by2); bg2.stroke(); } var brushedT = new THREE.CanvasTexture(bc); brushedT.wrapS = brushedT.wrapT = THREE.RepeatWrapping; brushedT.repeat.set(3, 3); var blackM = new THREE.MeshStandardMaterial({ color: 0x3c4044, metalness: 0.9, roughness: 0.32, map: brushedT });
    var deskBottom = TOP - 0.17;
    [-2.35, 2.35].forEach(function (x) {
      box(0.20, 0.05, 0.9, blackM, x, 0.025, 0); // 底部脚条
      box(0.30, 0.06, 1.0, blackM, x, deskBottom - 0.03, 0); // 顶部托板
      [-0.42, 0.42].forEach(function (z) { box(0.14, deskBottom, 0.14, blackM, x, deskBottom / 2, z); }); // 前后两腿
      box(0.18, deskBottom * 0.42, 0.24, blackM, x, deskBottom * 0.28, 0); // 升降立柱外罩（伸缩机构）
    });
    // 右侧升降按键控制面板（悬挂于桌面右下）
    box(0.05, 0.30, 0.22, new THREE.MeshStandardMaterial({ color: 0x0e0e11, roughness: 0.5 }), 2.24, TOP - 0.28, 0);
    for (var bi = 0; bi < 4; bi++) { var btn = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 12), std(0x3a3a40, 0.5, 0.6)); btn.rotation.z = Math.PI / 2; btn.position.set(2.19, TOP - 0.18 - bi * 0.05, 0); scene.add(btn); }

    var TOOLS = [
      { name: "达芬奇", bg: "#233a51", fg: "#fff", glyph: "DR", path: "M17.621 0 5.977.004c-1.37 0-2.756.345-3.762 1.11a4.925 4.925 0 0 0-1.61 2.003C.233 3.93 0 5.02 0 5.951l.012 12.2c.002 1.604.479 3.057 1.461 4.112.984 1.056 2.462 1.683 4.331 1.691L16.856 24c1.26.005 3.095-.036 4.303-.714 1.075-.605 2.025-1.556 2.497-2.984.278-.84.345-2.084.344-3.147l-.021-11.13c-.002-.888-.15-2.023-.547-2.934-.425-.976-1.181-1.815-2.322-2.425C20.353.26 19.123 0 17.622 0zm0 .93c1.378 0 2.538.295 3.04.565.977.523 1.544 1.166 1.889 1.96.315.721.47 1.793.473 2.572l.018 11.13c.002 1.013-.097 2.257-.298 2.86-.396 1.202-1.146 1.946-2.063 2.462-.814.457-2.612.593-3.82.588l-11.05-.044c-1.657-.007-2.832-.534-3.626-1.386-.792-.851-1.212-2.06-1.212-3.485L.999 5.95c0-.829.196-1.827.474-2.437.345-.757.75-1.207 1.365-1.674C3.585 1.27 4.868.97 6.08.97zm-5.66 3.423c-1.976.089-3.204 1.658-3.214 3.29.019 1.443 1.635 3.481 2.884 4.53.12.099.154.109.33.18.062.025.198-.047.327-.135.36-.245.993-.947 1.648-1.738a7.67 7.67 0 0 0 1.031-1.683c.409-.89.261-1.599.235-1.888a3.983 3.983 0 0 0-.99-1.692 3.36 3.36 0 0 0-2.251-.864zm4.172 7.922a10.185 10.185 0 0 0-3.244.61c-.15.058-.26.1-.374.17-.057.036-.11.135-.105.292.017.433.29 1.278.624 2.27.384 1.135 1.066 2.27 1.844 2.74a3.23 3.23 0 0 0 2.53.342c.832-.243 1.595-.868 1.962-1.546.986-1.818.19-3.548-1.121-4.417-.447-.296-1.133-.445-1.89-.46-.074 0-.15-.002-.226-.001zm-8.432.038a6.201 6.201 0 0 0-.752.047c-.596.078-.932.273-1.29.51a3.177 3.177 0 0 0-1.365 1.979c-.075.552-.086 1.053.033 1.507.433 1.389 1.326 2.222 2.847 2.452.636.028 1.37-.063 1.99-.45 1.269-.782 2.08-3.17 2.412-4.742.053-.176.035-.357-.013-.42-.005-.067-.044-.113-.19-.183-.398-.192-1.32-.417-2.375-.6a7.68 7.68 0 0 0-1.297-.1z" },
      { name: "PR", bg: "#001a33", fg: "#fff", glyph: "Pr" },
      { name: "剪映", bg: "#0f0f12", fg: "#14c19a", glyph: "剪" },
      { name: "PS", bg: "#001e36", fg: "#fff", glyph: "Ps" },
      { name: "ChatGPT", bg: "#0d0d12", fg: "#10a37f", glyph: "◎" },
      { name: "WPS", bg: "#e04a3a", fg: "#fff", glyph: "W" }
    ];
    function drawToolIcon(g, cx, cy, s, t) {
      var r = s * 0.5, rad = r * 0.22;
      g.fillStyle = t.bg; g.beginPath();
      g.moveTo(cx - r + rad, cy - r); g.arcTo(cx + r, cy - r, cx + r, cy + r, rad); g.arcTo(cx + r, cy + r, cx - r, cy + r, rad); g.arcTo(cx - r, cy + r, cx - r, cy - r, rad); g.arcTo(cx - r, cy - r, cx + r, cy - r, rad); g.closePath(); g.fill();
      g.fillStyle = t.fg; g.textAlign = "center"; g.textBaseline = "middle";
      if (t.path) { try { var p = new Path2D(t.path), sc = s * 0.72 / 24; g.save(); g.translate(cx, cy); g.scale(sc, sc); g.translate(-12, -12); g.fill(p); g.restore(); } catch (e) { g.font = "900 " + (s * 0.4) + "px system-ui"; g.fillText(t.glyph, cx, cy); } }
      else if (t.glyph === "◎") { g.strokeStyle = t.fg; g.lineWidth = s * 0.08; g.beginPath(); for (var a = 0; a < 6; a++) { var ang = a * Math.PI / 3, px = Math.cos(ang), py = Math.sin(ang); g.arc(cx + px * s * 0.2, cy + py * s * 0.2, s * 0.11, 0, Math.PI * 2); } g.stroke(); }
      else { g.font = "900 " + (s * 0.4) + "px system-ui"; g.fillText(t.glyph, cx, cy); }
    }
    function iconURL(t) { var c = document.createElement("canvas"); c.width = c.height = 96; var g = c.getContext("2d"); drawToolIcon(g, 48, 48, 56, t); return c.toDataURL(); }

    // MacBook 笔记本（居中）—— 打开状态，屏幕显示六工具
    function toolsPopup() { popup("<h2>Mac · 我熟练掌握的工具</h2><div style='display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:18px'>" + TOOLS.map(function (t) { return "<div style='text-align:center;min-width:70px'><img src='" + iconURL(t) + "' style='width:56px;height:56px;border-radius:12px;display:block;margin:0 auto 6px'/><div style='font-size:12px;color:#888'>" + t.name + "</div></div>"; }).join("") + "</div>"); }
    var macBase = box(1.34, 0.025, 0.92, silver, 0, TOP + 0.012, 0.10); // 机身底座
    var macKbFace = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.70), new THREE.MeshBasicMaterial({ map: tex(560, 320, function (g) { g.fillStyle = "#e2e5e9"; g.fillRect(0, 0, 560, 320); g.fillStyle = "#1a1c20"; g.fillRect(26, 8, 508, 224); g.fillStyle = "#34373d"; for (var r = 0; r < 5; r++) for (var c = 0; c < 12; c++) { var w = (c === 0 && (r === 0 || r === 4)) ? 66 : 40; g.fillRect(34 + c * 41, 16 + r * 42, w, 32); } g.fillStyle = "#cfd2d6"; g.fillRect(126, 250, 308, 54); }) }));
    macKbFace.rotation.x = -Math.PI / 2; macKbFace.position.set(0, TOP + 0.03, 0.28); scene.add(macKbFace);
    var macTex = tex(900, 560, function (g) {
      g.fillStyle = "#0d0d12"; g.fillRect(0, 0, 900, 560);
      g.fillStyle = "#f2f2f7"; g.font = "700 30px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("我熟练掌握的工具", 450, 44);
      TOOLS.forEach(function (t, i) { var col = i % 3, row = Math.floor(i / 3), cx = 170 + col * 280, cy = 200 + row * 190; drawToolIcon(g, cx, cy, 130, t); g.fillStyle = "#c9c9d0"; g.font = "600 21px system-ui"; g.fillText(t.name, cx, cy + 90); });
    });
    var macScreen = box(1.30, 0.82, 0.03, std(0x2a2a2e, 0.5, 0.6), 0, TOP + 0.46, -0.34); macScreen.rotation.x = -0.36;
    var macLid = box(1.30, 0.84, 0.02, std(0xc8ccd0, 0.4, 0.7), 0, TOP + 0.47, -0.357); macLid.rotation.x = -0.36;
    var macFace = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.78), new THREE.MeshBasicMaterial({ map: macTex })); macFace.position.set(0, TOP + 0.46, -0.32); macFace.rotation.x = -0.36; scene.add(macFace);
    clickable(macFace, toolsPopup);

    // 妙控键盘 + iPad —— 整体一起旋转（右前四分之三倾斜）
    var magicGrp = new THREE.Group();
    var mkBase = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.64), silver); mkBase.position.set(0, 0.025, 0.16); mkBase.castShadow = mkBase.receiveShadow = true; magicGrp.add(mkBase);
    var kbFace = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.56), new THREE.MeshBasicMaterial({ map: tex(520, 340, function (g) { g.fillStyle = "#f0f1f3"; g.fillRect(0, 0, 520, 340); g.fillStyle = "#d3d7db"; for (var r = 0; r < 5; r++) for (var c = 0; c < 12; c++) g.fillRect(10 + c * 40, 12 + r * 42, 34, 30); g.fillStyle = "#f0f1f3"; g.fillRect(10, 5 * 42 + 12, 320, 30); }) }));
    kbFace.rotation.x = -Math.PI / 2; kbFace.position.set(0, 0.055, 0.16); magicGrp.add(kbFace);
    var biliSRC = (window.ROOM_MEDIA && window.ROOM_MEDIA.bili) || "images/room/bilibili.png";
    var biliTex = loadImgTex(biliSRC);
    var ipadB = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.02), dark); ipadB.position.set(0, 0.40, -0.04); ipadB.rotation.x = -0.12; ipadB.castShadow = ipadB.receiveShadow = true; magicGrp.add(ipadB);
    var ipadFace = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.55), new THREE.MeshBasicMaterial({ map: biliTex, color: 0xffffff })); ipadFace.position.set(0, 0.40, -0.028); ipadFace.rotation.x = -0.12; magicGrp.add(ipadFace);
    magicGrp.position.set(-1.5, TOP, 0.10); magicGrp.rotation.set(0, 0.75, 0); scene.add(magicGrp);
    function biliPopup() { popup("<h2>iPad · B站主页</h2><img src='" + biliSRC + "' style='width:100%;max-height:480px;object-fit:contain;background:#0f0f0f;border-radius:10px;margin-top:12px'/><a class='room-modal__go' target='_blank' rel='noopener' href='" + social.bilibili + "'>打开B站主页 ↗</a>"); }
    clickable(ipadFace, biliPopup);

    // 手机（小红书截图）—— 后移并右前四分之三倾斜
    box(0.16, 0.03, 0.15, silver, 1.5, TOP + 0.015, 0.14);
    box(0.04, 0.18, 0.04, dark, 1.5, TOP + 0.09, 0.10);
    var xhsSRC = (window.ROOM_MEDIA && window.ROOM_MEDIA.xhs) || "images/room/xhs.png";
    var xhsTex = loadImgTex(xhsSRC);
    var phGrp = new THREE.Group();
    var phB = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.56, 0.03), new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.4, metalness: 0.5 })); phB.castShadow = true; phGrp.add(phB);
    var phFace = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.52), new THREE.MeshBasicMaterial({ map: xhsTex, color: 0xffffff })); phFace.position.z = 0.017; phGrp.add(phFace);
    phGrp.position.set(1.5, TOP + 0.42, 0.14); phGrp.rotation.set(-0.12, -0.75, 0); scene.add(phGrp);
    function xhsPopup() { popup("<h2>手机 · 小红书</h2><video src='images/social/xhs.mp4' controls playsinline loop style='width:100%;max-height:480px;object-fit:contain;background:#0f0f0f;border-radius:10px;margin-top:12px'></video><p>小红书粉丝 1521</p><a class='room-modal__go' target='_blank' rel='noopener' href='" + social.xiaohongshu + "'>小红书主页 ↗</a>"); }
    clickable(phFace, xhsPopup);

    // 包豪斯球形台灯（点击开/关）
    var lampBase = box(0.26, 0.04, 0.26, dark, 2.0, TOP + 0.02, 0.1);
    var lampStem = box(0.03, 0.2, 0.03, dark, 2.0, TOP + 0.14, 0.1);
    var lampM = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffedc4, emissiveIntensity: 0, roughness: 0.5 });
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 22), lampM); ball.position.set(2.0, TOP + 0.30, 0.1); ball.castShadow = true; scene.add(ball);
    var beam = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.32, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(2.0, TOP + 0.14, 0.1); scene.add(beam);
    var lig = new THREE.PointLight(0xffdd88, 0, 3); lig.position.set(2.0, TOP + 0.25, 0.1); scene.add(lig);
    var on = false;
    clickable(ball, function () { on = !on; lig.intensity = on ? 1.8 : 0; beam.material.opacity = on ? 0.35 : 0; lampM.emissiveIntensity = on ? 1.1 : 0; lampM.color.set(on ? 0xfff0c8 : 0xfff3d6); });
  }
  function buildRoom() { woodFloor(); var wallM = std(0xf7f2e9, 0.85); var back = box(18, 6, 0.12, wallM, 0, 3, -7); back.receiveShadow = true; var left = box(0.12, 6, 14, wallM, -9, 3, 0); left.receiveShadow = true; var right = box(0.12, 6, 14, wallM, 9, 3, 0); right.receiveShadow = true; blockWall(); map(); carpet(); leftScreen(); photoWall(); deskArea(); }

  window.Room = { init: function (canvas) {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9e0d0);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;
    camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200); camera.position.set(19, 18, 23); camera.lookAt(0, 2.3, 0);
    scene.add(new THREE.AmbientLight(0xfff2dc, 0.62));
    var dir = new THREE.DirectionalLight(0xfff0dd, 0.68); dir.position.set(7, 12, 9); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); dir.shadow.radius = 4; dir.shadow.camera.left = -11; dir.shadow.camera.right = 11; dir.shadow.camera.top = 11; dir.shadow.camera.bottom = -8; scene.add(dir);
    // 地图中间灯光已去掉
    buildRoom();
    function size() { var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); }
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) { composer = new THREE.EffectComposer(renderer); composer.addPass(new THREE.RenderPass(scene, camera)); bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(1600, 900), 0.4, 0.5, 0.9); composer.addPass(bloomPass); }
    canvas.addEventListener("pointerdown", function (e) { dragging = true; moved = false; lx = e.clientX; ly = e.clientY; sx = e.clientX; sy = e.clientY; });
    window.addEventListener("pointermove", function (e) { if (dragging) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 6) moved = true; gTheta -= (e.clientX - lx) * 0.005; gPhi = Math.max(0.3, Math.min(1.45, gPhi - (e.clientY - ly) * 0.005)); lx = e.clientX; ly = e.clientY; } });
    window.addEventListener("pointerup", function (e) { dragging = false; if (moved) return; var rect = canvas.getBoundingClientRect(); mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(mouse, camera); var hits = raycaster.intersectObjects(clickables, false); if (hits.length && hits[0].object.userData.clickAction) hits[0].object.userData.clickAction(); });
    canvas.addEventListener("wheel", function (e) { e.preventDefault(); gDist = Math.max(9, Math.min(45, gDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    size(); window.addEventListener("resize", size);
    (function loop() { requestAnimationFrame(loop); dist += (gDist - dist) * 0.12; theta += (gTheta - theta) * 0.12; phi += (gPhi - phi) * 0.12; camera.position.set(dist * Math.sin(phi) * Math.cos(theta), dist * Math.cos(phi), dist * Math.sin(phi) * Math.sin(theta)); camera.lookAt(0, 2.3, 0); if (composer) composer.render(); else renderer.render(scene, camera); })();
  } };
})();
