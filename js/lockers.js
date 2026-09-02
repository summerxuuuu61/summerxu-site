/* 关于我：美式储物柜 3D 场景（Three.js 实时渲染） */
(function () {
  "use strict";
  var W = 1.7, H = 3.0, D = 1.0, GAP = 0.24, BF = 0.11, DT = 0.07;
  var OPEN_IDX = 1, openAngle = 1.95;
  var scene, camera, renderer, raycaster, mouse, doors = [], navParts = [], T = 0;
  var lightBlue = 0x9fc2d6, darkFrame = 0x6e8fa4, inner = 0x8fb2c6;

  function mat(color, metal, rough) {
    return new THREE.MeshStandardMaterial({ color: color, metalness: metal != null ? metal : 0.42, roughness: rough != null ? rough : 0.5 });
  }
  function box(w, h, d, m, x, y, z, group, shadow) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    if (shadow !== false) { mesh.castShadow = true; mesh.receiveShadow = true; }
    (group || scene).add(mesh); return mesh;
  }
  function textTexture(text, bg, fg) {
    var c = document.createElement("canvas"); c.width = 256; c.height = 140;
    var g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, 256, 140);
    g.strokeStyle = "rgba(0,0,0,0.15)"; g.lineWidth = 4; g.strokeRect(4, 4, 248, 132);
    g.fillStyle = fg; g.font = "800 46px system-ui"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 128, 70);
    return new THREE.CanvasTexture(c);
  }

  function buildLocker(cx, isOpen) {
    var grp = new THREE.Group(); grp.position.set(cx, 0, 0); scene.add(grp);
    var bodyM = mat(lightBlue), frameM = mat(darkFrame, 0.5, 0.42);
    // 外壳：后板 / 左右板 / 顶底 / 前边框
    box(W - 0.04, H - 0.04, 0.06, mat(inner), 0, H / 2, -D / 2 + 0.04, grp);          // 背板
    box(0.07, H, D, bodyM, -W / 2 + 0.035, H / 2, 0, grp);                            // 左墙
    box(0.07, H, D, bodyM, W / 2 - 0.035, H / 2, 0, grp);                            // 右墙
    box(W, 0.08, D, bodyM, 0, H - 0.04, 0, grp);                                      // 顶
    box(W, 0.08, D, bodyM, 0, 0.04, 0, grp);                                          // 底
    // 前面边框（竖横条，围出开口）
    box(BF, H, 0.1, frameM, -W / 2 + BF / 2, H / 2, D / 2 - 0.05, grp);
    box(BF, H, 0.1, frameM, W / 2 - BF / 2, H / 2, D / 2 - 0.05, grp);
    box(W, BF, 0.1, frameM, 0, H - BF / 2, D / 2 - 0.05, grp);
    box(W, BF, 0.1, frameM, 0, BF / 2, D / 2 - 0.05, grp);
    var openW = W - 2 * BF, openH = H - 2 * BF;

    if (isOpen) {
      // 内壁
      box(openW, openH, 0.02, mat(inner, 0.3, 0.6), 0, H / 2, -D / 2 + 0.09, grp);
      box(0.02, openH, 0.6, mat(inner, 0.3, 0.6), -openW / 2 + 0.02, H / 2, -D / 2 + 0.35, grp);
      box(0.02, openH, 0.6, mat(inner, 0.3, 0.6), openW / 2 - 0.02, H / 2, -D / 2 + 0.35, grp);
      // 两块隔板 -> 三个储物区
      [H / 3, 2 * H / 3].forEach(function (y) {
        box(openW - 0.04, 0.05, 0.62, mat(lightBlue, 0.45, 0.5), 0, y, -D / 2 + 0.35, grp);
      });
      buildInterior(grp, openW, H);
      // 打开的柜门（独立 Group，右铰链）
      buildDoor(grp, true, openW, openH);
    } else {
      var dg = buildDoor(grp, false, openW, openH);
      // 贴纸 / 置物架装饰
      sticker(grp, -0.35, H * 0.72, "#f4b8c8", "★");
      sticker(grp, 0.3, H * 0.6, "#c9e8ff", "✈");
      sticker(grp, -0.1, H * 0.42, "#ffe08a", "📷");
      box(0.5, 0.03, 0.16, mat(darkFrame, 0.5, 0.4), 0.2, H * 0.48, D / 2 - 0.09, grp);
      box(0.12, 0.16, 0.12, mat(0xd88a5a, 0.2, 0.7), 0.2, H * 0.48 + 0.1, D / 2 - 0.13, grp);
    }
  }
  function sticker(parent, x, y, color, ch) {
    var c = document.createElement("canvas"); c.width = c.height = 128;
    var g = c.getContext("2d"); g.fillStyle = color; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.font = "64px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, 64, 66);
    var tex = new THREE.CanvasTexture(c);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(x, y, D / 2 - 0.085); parent.add(m);
  }
  function buildInterior(parent, openW, H) {
    // 个人物品：相机
    var camM = mat(0x2b2b30, 0.6, 0.35), lensM = mat(0x1a1a1e, 0.7, 0.3);
    box(0.42, 0.26, 0.16, camM, -0.35, H / 3 + 0.18, -D / 2 + 0.35, parent);
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 20), lensM);
    lens.rotation.x = Math.PI / 2; lens.position.set(-0.35, H / 3 + 0.18, -D / 2 + 0.43); lens.castShadow = true; parent.add(lens);
    // 书
    box(0.26, 0.04, 0.2, mat(0xd88a5a, 0.1, 0.7), 0.3, H / 3 + 0.1, -D / 2 + 0.32, parent);
    box(0.24, 0.04, 0.18, mat(0x6ba2c9, 0.1, 0.7), 0.3, H / 3 + 0.16, -D / 2 + 0.32, parent);
    // 胶卷
    var roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 20), mat(0x8a6a3a, 0.4, 0.5));
    roll.rotation.z = Math.PI / 2; roll.position.set(0.42, H / 3 + 0.08, -D / 2 + 0.34); roll.castShadow = true; parent.add(roll);
    // 导航入口卡
    var navs = [["首页", "#f5c94a", "#8a2b2b", "#/"], ["摄影作品", "#8fd0f0", "#12365c", "#/photography"], ["我的频道", "#f0a6c0", "#5c1030", "#/channels"], ["关于我", "#a5e0a5", "#17421b", "#/about"]];
    navs.forEach(function (n, i) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36),
        new THREE.MeshBasicMaterial({ map: textTexture(n[0], n[1], n[2]), transparent: true }));
      var x = (i % 2) === 0 ? -0.3 : 0.3;
      var y = (i < 2) ? H * 0.82 : H * 0.26;
      m.position.set(x, y, -D / 2 + 0.42); m.userData = { nav: n[3] }; parent.add(m); navParts.push(m);
    });
    // 内门挂钩
  }
  function buildDoor(parent, open, openW, openH) {
    var dg = new THREE.Group();
    // 铰链在右侧：门在局部沿 -x 延伸
    dg.position.set(openW / 2, H / 2, D / 2 - 0.06);
    parent.add(dg);
    var doorM = mat(lightBlue), doorM2 = mat(inner, 0.35, 0.55);
    var slab = new THREE.Mesh(new THREE.BoxGeometry(openW, openH, DT),
      [doorM, doorM, doorM, doorM, doorM, doorM]); // 六面材质（简化）
    slab.material = doorM;
    slab.position.set(-openW / 2, 0, 0);
    slab.castShadow = true; slab.receiveShadow = true; dg.add(slab);
    // 外侧面（+z 局部）：把手 + 通风口
    var handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), mat(0xdde3e8, 0.9, 0.2));
    handle.position.set(-openW * 0.25, 0.05, DT / 2 + 0.03); dg.add(handle);
    for (var i = 0; i < 4; i++) {
      var slit = new THREE.Mesh(new THREE.BoxGeometry(openW * 0.5, 0.03, 0.03), mat(0x50646f, 0.4, 0.5));
      slit.position.set(-openW / 2, openH / 2 - 0.14 - i * 0.08, DT / 2 + 0.005); dg.add(slit);
    }
    // 内侧（-z 局部）：挂钩
    for (var j = 0; j < 3; j++) {
      var hook = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.05), mat(0x3a4650, 0.7, 0.35));
      hook.position.set(-openW * 0.3 - j * 0.14, 0.5, -(DT / 2 + 0.02)); dg.add(hook);
    }
    if (open) {
      dg.rotation.y = openAngle; // 打开：内面转向观众
      dg.userData.target = openAngle;
    } else {
      dg.rotation.y = 0; dg.userData.target = 0;
    }
    dg.userData.doorIdx = doors.length;
    doors.push({ group: dg, open: !!open, target: dg.userData.target });
    return dg;
  }

  function onResize() {
    var el = renderer.domElement;
    var w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function tick() {
    requestAnimationFrame(tick); T += 16;
    doors.forEach(function (d) {
      if (Math.abs(d.group.rotation.y - d.target) > 0.001) {
        d.group.rotation.y += (d.target - d.group.rotation.y) * 0.12;
      }
    });
    renderer.render(scene, camera);
  }
  function pick(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    var m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(m, camera);
    var nav = raycaster.intersectObjects(navParts, false);
    if (nav.length) { location.hash = nav[0].object.userData.nav; return; }
    var hit = raycaster.intersectObjects(doors.map(function (d) { return d.group; }), true);
    if (hit.length) {
      var o = hit[0].object; var grp = o; while (grp && !grp.userData.hasOwnProperty("target")) grp = grp.parent;
      while (o && o.userData.doorIdx === undefined) o = o.parent;
      if (o && o.userData.doorIdx !== undefined) {
        var d = doors[o.userData.doorIdx];
        d.open = !d.open; d.target = d.open ? openAngle : 0;
      }
    }
  }

  window.Lockers = {
    init: function (canvas) {
      scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b3440);
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 1.85, 9.2); camera.lookAt(0, 1.6, 0);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      var amb = new THREE.AmbientLight(0xffffff, 0.55); scene.add(amb);
      var hemi = new THREE.HemisphereLight(0xbfd6ff, 0x3a3020, 0.4); scene.add(hemi);
      var key = new THREE.DirectionalLight(0xfff2e0, 1.1);
      key.position.set(6, 9, 6); key.castShadow = true; scene.add(key);
      key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -3;
      // 地面
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x30383f, roughness: 0.9, metalness: 0 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      // 四个储物柜
      var xs = [-1.5, -0.5, 0.5, 1.5].map(function (k) { return k * (W + GAP); });
      xs.forEach(function (cx, i) { buildLocker(cx, i === OPEN_IDX); });
      raycaster = new THREE.Raycaster();
      onResize(); window.addEventListener("resize", onResize);
      canvas.addEventListener("click", pick);
      tick();
    }
  };
})();
