/* =============================================================
 * 前端逻辑：路由 / 首页照片墙 / 沉浸式全屏画廊 / 主题切换 / 移动端菜单
 * ============================================================= */

(function () {
  "use strict";

  const P = window.PORTFOLIO;
  const app = document.getElementById("app");
  const nav = document.querySelector(".nav");
  const rootEl = document.documentElement;
  window.LANG = window.LANG || "zh";
  const I18N = {
    zh: { homeHint:"点击地球上我拍过照的地方，探索每一段旅程", photoTitle:"摄影作品<span class='en'>Photography</span>", videoTitle:"视频剪辑<span class='en'>Video</span>", countryUnit:"国", placeUnit:"地", photoUnit:"张", manage:"管理", clearMgmt:"清空该区管理", hiddenN:"已隐藏", clickShow:"点击显示", catMix:"混剪", catNarr:"剧情剪辑", tabMix:"混剪 Mix", tabNarr:"剧情剪辑 Narrative", videoMeta:"混剪 · 剧情剪辑", emptySoon:"作品即将上线，敬请期待。", videoSoon:"视频即将上线，敬请期待。", cleared:"已清空该区管理设置", dragFirst:"请先点击右上角『管理』，再拖动照片" },
    en: { homeHint:"Click a place on the globe where I've taken photos to explore each journey", photoTitle:"Photography<span class='en'></span>", videoTitle:"Video<span class='en'></span>", countryUnit:"countries", placeUnit:"places", photoUnit:"photos", manage:"Manage", clearMgmt:"Clear", hiddenN:"hidden", clickShow:"show", catMix:"Mix", catNarr:"Narrative", tabMix:"Mix", tabNarr:"Narrative", videoMeta:"Mix · Narrative", emptySoon:"Coming soon. Stay tuned.", videoSoon:"Videos coming soon.", cleared:"Cleared", dragFirst:"Click Manage (top-right), then drag photos" }
  };
  function T(k){ return (I18N[window.LANG] && I18N[window.LANG][k]) || I18N.zh[k] || k; }
  function lan(z, e){ return window.LANG === "en" ? e : z; }

  let current = { view: "home", country: null, region: null, videoCat: "mix" };
  let currentList = [];          // 当前画廊的 [{ photo, region, country }]
  let currentSource = [];        // 当前地区的原始排序
  let homeFilter = "all";
  let currentSort = "default";
  let curRegion = null;          // 当前地区对象（管理用）
  let curCountry = null;
  let curFullList = [];          // 当前地区原始照片（含被隐藏）
  let dragIdx = -1;
  let dragSrc = "";
  let dropTarget = null;   // { src, before }
  let dropZone = null;     // "auto" 或分区索引字符串
  let io = null;
  let curSecActive = -1;  // -1 = 自动（未分区）
  // 一次性纠偏：
  //  - 应用用户最新的分区设置(cover/hidden/sections)，清掉这些地区浏览器里的旧本地覆盖。
  (function resetStaleOverrides() {
    var KEY = "app_reset_v"; var V = "v40-profile-lockers";
    try {
      if (localStorage.getItem(KEY) !== V) {
        ["bangkok","beijing","chaoshan","chengdu","chongqing","chuanxi","emeishan","guangxi","guangzhou","guilin","guizhou","hainan","hamiltonisland","kamakura","kawaguchiko","kyoto","leshan","london","mexicocity","nara","osaka","oxford","phuket","qingdao","setouchi","shanghai","tokyo","vancouver","xinjiang"].forEach(function (slug) {
          ["hide_", "sections_", "order_", "cover_"].forEach(function (p) { localStorage.removeItem(p + slug); });
        });
        localStorage.setItem(KEY, V);
      }
    } catch (e) {}
  })();
  (function loadSort() {
    try { const s = localStorage.getItem("photoSort"); if (s) currentSort = s; } catch (e) {}
  })();

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // 旋转角度是以 src 为 key 的对象；不能复用 lsGet 的数组默认值（数组键会被 JSON.stringify 丢弃）
  function rotGet(slug) {
    try { const v = JSON.parse(localStorage.getItem("rot_" + slug)); return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; }
    catch (e) { return {}; }
  }
  function rotSet(slug, v) { try { localStorage.setItem("rot_" + slug, JSON.stringify(v)); } catch (e) {} }
  function getHidden(slug) { return new Set(lsGet("hide_" + slug)); }
  function setHidden(slug, arr) { lsSet("hide_" + slug, [...arr]); }
  function getCover(slug) { try { return localStorage.getItem("cover_" + slug) || ""; } catch (e) { return ""; } }
  function setCover(slug, src) { try { localStorage.setItem("cover_" + slug, src); } catch (e) {} }
  function getOrder(slug) { return lsGet("order_" + slug); }
  function setOrder(slug, arr) { lsSet("order_" + slug, arr); }
  function clearOrder(slug) { try { localStorage.removeItem("order_" + slug); } catch (e) {} }
  function getSections(slug) { return lsGet("sections_" + slug); }
  function setSections(slug, arr) { lsSet("sections_" + slug, arr); }
  function effSections() {
    if (!curRegion) return [];
    const local = getSections(curRegion.slug);
    return local.length ? local : (curRegion.sections || []);
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const countryBySlug = (s) => P.photography.find((c) => c.slug === s);
  const regionBySlug = (c, s) => c && c.regions.find((r) => r.slug === s);
  const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);
  const pad = (n) => String(n).padStart(2, "0");

  function path(...parts) {
    return "#/" + parts.filter(Boolean).map((p) => encodeURIComponent(p)).join("/");
  }

  /* ---------- 路由 ---------- */
  function parseRoute() {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
    if (parts.length === 0) return { view: "home" };
    const [view, country, region] = parts;
    if (view === "photography") return { view, country: country || null, region: region || null };
    if (view === "video" || view === "about") return { view };
    return { view: "home" };
  }

  /* ---------- 照片集合 ---------- */
  function flatPhotos() {
    const list = [];
    P.photography.forEach((country) => country.regions.forEach((region) => {
      (region.photos || []).forEach((photo) => list.push({ photo, region, country }));
    }));
    return list;
  }
  function filterBy(slug) {
    const all = flatPhotos();
    return slug === "all" ? all : all.filter((x) => x.country.slug === slug);
  }

  function flatRegions() {
    const list = [];
    P.photography.forEach((c) => c.regions.forEach((r) => list.push({ region: r, country: c })));
    return list;
  }
  function filterRegions(slug) {
    const all = flatRegions();
    return slug === "all" ? all : all.filter((x) => x.country.slug === slug);
  }

  function projectCards(list) {
    if (!list.length) {
      return `<div class="empty"><div class="brand-name">Summer Xu</div><p>${T('emptySoon')}</p></div>`;
    }
    return list.map(({ region, country }) => {
      const cover = region.cover || (region.photos[0] && region.photos[0].src) || "";
      const has = !!cover;
      const sub = `${country.country}${region.year ? " · " + region.year : ""}${region.photos.length ? " · " + region.photos.length + " 张" : ""}`;
      return `
        <a class="project" href="${path("photography", country.slug, region.slug)}">
          <div class="project__cover">
            ${has
              ? `<img src="${esc(cover)}" alt="" loading="lazy">`
              : `<span class="project__ph">待更新</span>`}
          </div>
          <div class="project__info">
            <span class="project__name">${esc(region.name)}</span>
            <span class="project__sub">${esc(sub)}</span>
          </div>
        </a>`;
    }).join("");
  }

  function galleryItems(list) {
    currentList = list;
    if (!list.length) {
      return `
        <div class="empty">
          <div class="brand-name">Summer Xu</div>
          <p>${T('emptySoon')}</p>
        </div>`;
    }
    return `
      <div class="mosaic">
        ${(() => { const idx = new Map(list.map((y, j) => [y.photo.src, j])); return list.map((x) => figHTML(x, idx)).join(""); })()}
      </div>`;
  }

  function sortList(list, order) {
    if (order === "custom" && curRegion) {
      const ord = getOrder(curRegion.slug);
      if (ord && ord.length) {
        const have = new Set(list.map((x) => x.photo.src));
        const head = ord.filter((s) => have.has(s)).map((s) => list.find((x) => x.photo.src === s));
        const tail = list.filter((x) => !ord.includes(x.photo.src));
        return [...head, ...tail];
      }
    }
    // 默认：按拍摄时间，同一天内按色调（续接）排列，让相关联照片连在一起
    const tones = window.PHOTO_TONES || {};
    return list.slice().sort((a, b) => {
      const da = a.photo.dtime || a.photo.date || "", db = b.photo.dtime || b.photo.date || "";
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      const c = da.localeCompare(db);
      if (c !== 0) return c;
      const ta = tones[a.photo.src] || [180, 0.5], tb = tones[b.photo.src] || [180, 0.5];
      return (ta[0] - tb[0]) || (tb[1] - ta[1]);
    });
  }

  function dateKey(photo) { return (photo.dtime || photo.date || "").slice(0, 10) || "未注名"; }
  function hueDist(a, b) { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function sizeClass(i) {
    const p = ["sm", "wide", "sm", "tall", "sm", "wide", "sm", "lg"];
    const k = p[i % p.length];
    return k === "lg" ? "sz-lg" : k === "wide" ? "sz-wide" : k === "tall" ? "sz-tall" : "";
  }
  function orientClass(src, rot) {
    const s = window.PHOTO_SIZE && window.PHOTO_SIZE[src];
    if (!s) return "";
    // 被旋转90°/270°的照片，格子方向随实际显示方向翻转（竖→横 / 横→竖）
    let r = s[1] / s[0];
    if ((rot % 360) === 90 || (rot % 360) === 270) r = 1 / r;
    if (r > 1.28) return "is-tall";
    if (r < 0.72) return "is-wide";
    return "";
  }
  function rotVal(src) {
    if (!curRegion) return 0;
    const m = rotGet(curRegion.slug);
    return (m[src] || 0) % 360;
  }
  function figHTML(x, idx) {
    const src = x.photo.src, rot = rotVal(src), oc = orientClass(src, rot);
    return `
      <figure class="gallery__item ${oc}${rot ? " is-rot" : ""}" data-index="${idx.get(src)}" data-src="${esc(src)}" draggable="true">
        <img src="${esc(src)}" alt="" loading="lazy" ${rot ? `style="transform:rotate(${rot}deg)"` : ""}>
        <div class="ia"><button data-act="cover">版头</button><button data-act="hide">隐藏</button><button data-act="assign">分区</button><button data-act="rotate">旋转</button></div>
      </figure>`;
  }
  function dateGroupedHTML(list, idx) {
    const tones = window.PHOTO_TONES || {};
    const blocks = [];
    let i = 0;
    while (i < list.length) {
      const dk = dateKey(list[i].photo), items = [];
      while (i < list.length && dateKey(list[i].photo) === dk) { items.push(list[i]); i++; }
      const sets = []; let cur = [items[0]];
      for (let k = 1; k < items.length; k++) {
        const p = tones[items[k - 1].photo.src] || [180, 0.5], t = tones[items[k].photo.src] || [180, 0.5];
        if (hueDist(p[0], t[0]) > 70) { sets.push(cur); cur = []; }
        cur.push(items[k]);
      }
      sets.push(cur);
      blocks.push({ dk, sets });
    }
    return blocks.map((b, bi) => `
      <section class="date-block">
        <div class="date-block__head"><span class="date-block__n">${pad(bi + 1)}</span><span class="date-block__t">${esc(b.dk)}</span></div>
        <div class="date-block__sets">${b.sets.map((s, si) => `
          <div class="photo-set">
            ${b.sets.length > 1 ? `<div class="photo-set__cap">Set ${pad(si + 1)}</div>` : ""}
            <div class="mosaic">${s.map((x) => figHTML(x, idx)).join("")}</div>
          </div>`).join("")}</div>
      </section>`).join("");
  }
  function catOf(src) { return (window.PHOTO_CATS && window.PHOTO_CATS[src]) || "其他"; }
  function dateGroupedInner(list, idx) {
    const blocks = []; let i = 0;
    while (i < list.length) {
      const dk = dateKey(list[i].photo), items = [];
      while (i < list.length && dateKey(list[i].photo) === dk) { items.push(list[i]); i++; }
      const sorted = sortList(items, "group");  // 日期内按色调
      const clusters = clusterByHash(sorted);   // 再按共同性（场景）聚
      blocks.push(`
        <section class="date-block" data-seczone="auto">
          <div class="date-block__head"><span class="date-block__n">${pad(blocks.length + 1)}</span><span class="date-block__t">${esc(dk)}</span><span class="date-block__meta">${items.length} 张</span></div>
          <div class="date-block__sets"><div class="photo-set"><div class="mosaic">${clusters.flat().map((x) => figHTML(x, idx)).join("")}</div></div></div>
        </section>`);
    }
    return `<div class="gallery-grouped">${blocks.join("")}</div>`;
  }
  function hamming(a, b) {
    let x = BigInt("0x" + a) ^ BigInt("0x" + b); let c = 0;
    while (x) { c += Number(x & 1n); x >>= 1n; }
    return c;
  }
  function clusterByHash(list) {
    const hashes = window.PHOTO_HASH || {};
    const clusters = []; const used = new Array(list.length).fill(false);
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      const cl = [list[i]]; used[i] = true;
      const h0 = hashes[list[i].photo.src];
      for (let j = i + 1; j < list.length; j++) {
        if (used[j]) continue;
        const hj = hashes[list[j].photo.src];
        if (h0 && hj && hamming(h0, hj) < 9) { cl.push(list[j]); used[j] = true; }
      }
      cl.sort((a, b) => (a.photo.dtime || a.photo.date || "").localeCompare(b.photo.dtime || b.photo.date || ""));
      clusters.push(cl);
    }
    clusters.sort((a, b) => (a[0].photo.dtime || a[0].photo.date || "").localeCompare(b[0].photo.dtime || b[0].photo.date || ""));
    return clusters;
  }
  function dateGrouped(list) {
    if (!list.length) return `<div class="empty"><div class="brand-name">Summer Xu</div><p>${T('emptySoon')}</p></div>`;
    const clusters = []; let i = 0;
    while (i < list.length) {
      const dk = dateKey(list[i].photo), items = [];
      while (i < list.length && dateKey(list[i].photo) === dk) { items.push(list[i]); i++; }
      clusters.push(...clusterByHash(sortList(items, "group")));
    }
    const flat = clusters.flat();
    currentList = flat;
    const idx = new Map(flat.map((x, i) => [x.photo.src, i]));
    return dateGroupedInner(flat, idx);
  }
  function galleryGrouped(list) {
    currentList = list;
    if (!list.length) {
      return `<div class="empty"><div class="brand-name">Summer Xu</div><p>${T('emptySoon')}</p></div>`;
    }
    if (currentSort === "custom") return galleryItems(list);
    return dateGrouped(list);
  }
  function galleryMain(list) {
    const secs = effSections();
    if (!secs.length) return galleryGrouped(list);
    currentList = list;
    if (!list.length) {
      return `<div class="empty"><div class="brand-name">Summer Xu</div><p>${T('emptySoon')}</p></div>`;
    }
    const have = new Set(list.map((x) => x.photo.src));
    const idx = new Map(list.map((x, i) => [x.photo.src, i]));
    const used = new Set();
    const blocks = [];
    secs.forEach((s) => {
      const phs = [];
      (s.photos || []).forEach((src) => { if (have.has(src)) { used.add(src); phs.push(list.find((x) => x.photo.src === src)); } });
      blocks.push(`
        <section class="date-block" data-seczone="${blocks.length}">
          <div class="date-block__head"><span class="date-block__n">${pad(blocks.length + 1)}</span><span class="date-block__t">${esc(s.title || "未命名")}</span><span class="date-block__meta">${phs.length} 张</span></div>
          <div class="date-block__sets">${phs.length ? `<div class="photo-set"><div class="mosaic">${phs.map((x) => figHTML(x, idx)).join("")}</div></div>` : `<div class="photo-set__cap">空分区（拖照片到这里）</div>`}</div>
        </section>`);
    });
    const auto = list.filter((x) => !used.has(x.photo.src));
    if (auto.length) {
      blocks.push(`
        <div class="auto-zone" data-seczone="auto">
          <div class="date-block__head"><span class="date-block__n">${pad(blocks.length + 1)}</span><span class="date-block__t">未分区（自动）</span></div>
          ${dateGroupedInner(auto, idx)}
        </div>`);
    }
    return `<div class="gallery-grouped">${blocks.join("")}</div>`;
  }

  function filmFrame(x, idx) {
    const src = x.photo.src, rot = rotVal(src);
    return `
      <figure class="film-frame ${rot ? "is-rot" : ""}" data-index="${idx.get(src)}" data-src="${esc(src)}" draggable="true">
        <img src="${esc(src)}" alt="" loading="lazy" ${rot ? `style="transform:rotate(${rot}deg)"` : ""}>
        <div class="ia"><button data-act="cover">版头</button><button data-act="hide">隐藏</button><button data-act="assign">分区</button><button data-act="rotate">旋转</button></div>
      </figure>`;
  }
  function filmGallery(list) {
    if (!list.length) {
      return `<div class="empty"><div class="brand-name">Summer Xu</div><p>${T('emptySoon')}</p></div>`;
    }
    const secs = effSections();
    const have = new Set(list.map((x) => x.photo.src));
    const strips = []; const flat = [];
    if (secs.length) {
      secs.forEach((s) => {
        const items = list.filter((x) => have.has(x.photo.src) && (s.photos || []).includes(x.photo.src));
        if (items.length) { flat.push(...items); strips.push({ title: s.title || "未命名", items }); }
      });
    } else {
      let i = 0;
      while (i < list.length) {
        const dk = dateKey(list[i].photo), items = [];
        while (i < list.length && dateKey(list[i].photo) === dk) { items.push(list[i]); i++; }
        flat.push(...sortList(items, "group")); strips.push({ title: dk, items: sortList(items, "group") });
      }
    }
    currentList = flat;
    const idx = new Map(flat.map((x, i) => [x.photo.src, i]));
    const strip = (st) => `
      <div class="film-strip">
        <div class="film-strip__head"><span class="film-strip__brand">FUJIFILM 400</span><span class="film-strip__cat">${esc(st.title)} · ${st.items.length} 帧</span></div>
        <div class="film-strip__perf"></div>
        <div class="film-strip__track">${st.items.map((x) => filmFrame(x, idx)).join("")}</div>
        <div class="film-strip__perf"></div>
      </div>`;
    return `<div class="gallery-grouped">${strips.map(strip).join("")}</div>`;
  }

  function regionGalleryHTML() {
    const layout = (curRegion && (curRegion.layout || curCountry.layout)) || "grid";
    const useFilm = layout === "film" && !(curRegion && effSections().length);
    const list = sortList(currentSource, currentSort);
    return useFilm ? filmGallery(list) : galleryMain(list);
  }

  function sectionsBarHTML(slug) {
    const secs = effSections();
    return (
      `<button class="sec-chip ${curSecActive === -1 ? "is-active" : ""}" data-sec="-1">自动</button>` +
      secs.map((s, i) =>
        `<button class="sec-chip ${curSecActive === i ? "is-active" : ""}" data-sec="${i}">${esc(s.title || "未命名")} <span class="sec-chip__x" data-act="renamesec" data-i="${i}">✎</span> <span class="sec-chip__x" data-act="delsec" data-i="${i}">✕</span></button>`).join("") +
      `<button class="sec-chip sec-chip__new" data-act="newsec">＋ 新建分区</button>`
    );
  }
  function updateSectionsBar() {
    const bar = document.getElementById("sectionsBar");
    if (bar && curRegion) bar.innerHTML = sectionsBarHTML(curRegion.slug);
  }

  /* ---------- 回到顶部 ---------- */
  function scrollTop() { window.scrollTo({ top: 0, behavior: "instant" }); }

  function observeItems() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".gallery__item").forEach((el) => el.classList.add("in"));
      return;
    }
    if (io) io.disconnect();
    io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".gallery__item").forEach((el) => io.observe(el));
  }

  function populateToc() {
    const toc = document.getElementById("regionToc");
    const rail = document.getElementById("regionRail");
    const host = document.getElementById("regionGallery");
    const blocks = host ? host.querySelectorAll(".date-block, .film-strip, .auto-zone") : [];
    const items = [];
    blocks.forEach((b, i) => {
      b.id = "toc-" + i;
      let title = "";
      const t = b.querySelector(".date-block__t"); if (t) title = t.textContent.trim();
      if (!title) { const c = b.querySelector(".film-strip__cat"); if (c) { const m = c.textContent.trim().split(" · ")[0]; title = m || ""; } }
      if (!title) title = "分段 " + (i + 1);
      items.push({ id: "toc-" + i, title });
    });
    if (toc) toc.innerHTML = items.length ? `<span class="region-toc__label">本节</span>` + items.map((it) =>
      `<button class="toc-chip" data-tocid="${it.id}">${esc(it.title)}</button>`).join("") : "";
    if (rail) rail.innerHTML = items.length ? items.map((it) =>
      `<button class="rail-item" data-tocid="${it.id}">${esc(it.title)}</button>`).join("") : "";
    document.querySelectorAll("[data-tocid]").forEach((b) => {
      b.addEventListener("click", () => {
        const el = document.getElementById(b.getAttribute("data-tocid"));
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    });
  }

  /* ---------- 视图：首页（照片墙） ---------- */
  function renderHome() {
    const p = P.person;
    return `
      <section class="globe-home">
        <div class="globe-wrap"><canvas id="globeCanvas"></canvas></div>
        <div class="globe-overlay">
          <div class="eyebrow">${esc(p.en)} — Photographer &amp; Filmmaker</div>
          <h1>${esc(p.en)}</h1>
          <div class="zh">${esc(p.name)}</div>
          <p class="gp-hint">${T('homeHint')}</p>
        </div>
        <div class="globe-panel" id="globePanel" hidden></div>
        <div class="globe-side" id="globeSide" hidden></div>
      </section>`;
  }

  function renderChannels() {
    const platforms = [
      { name: "Bilibili", cn: "哔哩哔哩", handle: "Summer Xu", href: "https://space.bilibili.com/25897119", color: "#fb7299", icon: "B", video: "images/social/bilibili.mp4", rate: 0.9 },
      { name: "Xiaohongshu", cn: "小红书", handle: "Summer Xu", href: "https://xhslink.cn/o/3Dbxb5fQph7", color: "#ff2442", icon: "书", video: "images/social/xhs.mp4", rate: 1.15 },
      { name: "Douyin", cn: "抖音", handle: "MintChocolate61", href: "https://v.douyin.com/-KWVa6WelIA/", color: "#161823", icon: "抖", video: "images/social/douyin.mp4", rate: 1.0 }
    ];
    return `
      <section class="home-socials">
        <div class="wrap">
          <div class="home-socials__head">
            <div class="eyebrow">Socials — Follow Me</div>
            <h2>我的频道<span class="en">My Channel</span></h2>
            <p class="lead">手机里的实时画面——我录屏的 B站 · 小红书 · 抖音，像刷手机一样看。</p>
          </div>
          <div class="phone-grid">
            ${platforms.map((pl, i) => `
              <a class="phone" href="${esc(pl.href)}" target="_blank" rel="noopener" style="--c:${esc(pl.color)}">
                <div class="phone__bezel">
                  <div class="phone__screen">
                    <div class="phone__status"><span class="phone__logo">${esc(pl.icon)}</span><span class="phone__brand">${esc(pl.cn)}</span><span class="phone__handle">@${esc(pl.handle)}</span></div>
                    <video class="phone__video" src="${esc(pl.video)}" data-rate="${esc(String(pl.rate))}" autoplay muted loop playsinline preload="auto"></video>
                  </div>
                </div>
                <div class="phone__cta"><span>${esc(pl.cn)} · ${esc(pl.name)}</span><span>直达 ↗</span></div>
              </a>`).join("")}
          </div>
        </div>
      </section>`;
  }

  function renderHomeProjects() {
    const container = document.getElementById("homeProjects");
    if (!container) return;
    container.innerHTML = projectCards(filterRegions(homeFilter));
    document.querySelectorAll("#photoFilters .chip").forEach((c) => {
      c.classList.toggle("is-active", c.getAttribute("data-filter") === homeFilter);
    });
  }

  /* ---------- 视图：摄影（按地区组织，保留备用） ---------- */
  function renderPhotography() {
    if (!current.country) return renderCountries();
    const country = countryBySlug(current.country);
    if (!country) return renderCountries();
    if (!current.region) return renderRegions(country);
    return renderRegionGallery(country, regionBySlug(country, current.region));
  }

  function renderCountries() {
    const p = P.person;
    const totalRegions = sum(P.photography, (c) => c.regions.length);
    return `
      <section class="editor">
        <div class="wrap">
          <div class="editor__grid">
            <aside class="editor__meta">
              <div class="eyebrow">${esc(p.en)} — Photography</div>
              <h1>${T('photoTitle')}</h1>
              <div class="meta-line">${P.photography.length} ${T('countryUnit')} · ${totalRegions} ${T('placeUnit')}</div>
              <p class="lead">${lan('跨越 ' + P.photography.length + ' 个国家的影像档案。选择目的地，进入一段旅程的切片。', 'A photo archive across ' + P.photography.length + ' countries. Pick a destination to enter a slice of a journey.')}</p>
            </aside>
            <div class="roll">
              <div class="roll__list">
                ${P.photography.map((c, i) =>
                  rollItem(i + 1, c.country, c.slug.toUpperCase(), path("photography", c.slug), c.regions.length + " 地")
                ).join("")}
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderRegions(country) {
    const totalPhotos = sum(country.regions, (r) => r.photos.length);
    const p = P.person;
    return `
      <section class="editor">
        <div class="wrap">
          ${tabs(P.photography.map((c) => ({ slug: c.slug, label: c.country })), country.slug, "photography")}
          <div class="editor__grid">
            <aside class="editor__meta">
              <div class="eyebrow">${esc(p.en)} — Travel Journal</div>
              <h1>${esc(country.country)}<span class="en">${esc(country.slug)}</span></h1>
              <div class="meta-line">${country.regions.length} Chapters · ${totalPhotos} EXP</div>
              <p class="lead">${lan(esc(country.country) + ' 的影像章节，' + country.regions.length + ' 个地区。', esc(country.country) + ' — ' + country.regions.length + ' chapters.')}</p>
            </aside>
            <div class="roll">
              <div class="roll__list">
                ${country.regions.map((r, i) =>
                  rollItem(i + 1, r.name, r.en.toUpperCase(), path("photography", country.slug, r.slug), r.photos.length + " 张")
                ).join("")}
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderRegionGallery(country, region) {
    if (!region) return renderRegions(country);
    curSecActive = -1;
    const savedOrd = getOrder(region.slug);
    currentSort = (savedOrd && savedOrd.length) ? "custom" : "group";  // 有手动顺序用自定义，否则按时间分组
    const full = (region.photos || []).map((photo) => ({ photo, region, country }));
    curCountry = country; curRegion = region; curFullList = full;
    const hidden = new Set([...(region.hidden || []), ...getHidden(region.slug)]);
    const visible = full.filter((x) => !hidden.has(x.photo.src));
    currentSource = visible;
    const count = visible.length, allCount = full.length;
    const cover = getCover(region.slug) || region.cover || (visible[0] && visible[0].photo.src) || "";
    const style = region.style || country.style || "default";
    const hiddenList = full.filter((x) => hidden.has(x.photo.src));
    const countryTabs = tabs(P.photography.map((c) => ({ slug: c.slug, label: c.country })), country.slug, "photography");
    const regionTabs = `
      <div class="tabs">
        ${country.regions.map((r) => `
          <a class="tab ${r.slug === region.slug ? "is-active" : ""}" href="${path("photography", country.slug, r.slug)}">${esc(r.name)}</a>
        `).join("")}
      </div>`;
    const galleryHTML = regionGalleryHTML();
    return `
      <section class="region" data-style="${esc(style)}">
        ${location.protocol === "file:" ? `
          <div class="file-hint">
            <span>💡 从文件夹拖照片进分区需要本地服务：双击 <b>启动网站.command</b>，并在浏览器打开 <b>http://localhost:8000</b>；当前是 file:// 打开的，浏览器不允许直接写入。</span>
          </div>` : ""}
        <nav class="column-nav">
          <div class="wrap column-nav__inner">
            ${countryTabs}
            <span class="column-nav__sep">/</span>
            <div class="column-nav__regions">${regionTabs}</div>
          </div>
        </nav>
        <header class="region-hero">
          <div class="region-hero__bg" id="regionHeroBg">
            <img id="regionHeroImg" src="${cover ? esc(cover) : ""}" alt="" loading="eager" class="${cover ? "" : "is-empty"}">
          </div>
          <div class="region-hero__veil"></div>
          <div class="wrap region-hero__inner">
            <div class="eyebrow">${esc(country.country)} · ${esc(region.en)} — Photography</div>
            <h1>${esc(region.name)}<span class="en">${esc(region.en)}</span></h1>
            <p class="lead">${region.description ? esc(region.description) : `${esc(country.country)} · ${esc(region.name)} · ${count} 张`}</p>
            <div class="meta-line">${count} 张${region.year ? " · " + esc(region.year) : ""} · ${esc(country.country)}${allCount !== count ? " · 隐藏 " + (allCount - count) : ""}</div>
          </div>
        </header>
        <div class="wrap region-body">
          <div class="gallery-tools">
            <button class="edit-toggle" id="editToggle" data-act="edit">${T('manage')}</button>
            <button class="edit-toggle" data-act="export">导出设置</button>
            <button class="edit-toggle" data-act="resetorder">恢复顺序</button>
            <button class="edit-toggle" data-act="resetmgmt">${T('clearMgmt')}</button>
          </div>
          <div class="region-toc" id="regionToc"></div>
          <div class="sections-bar" id="sectionsBar">${sectionsBarHTML(region.slug)}</div>
          <div id="regionGallery">${galleryHTML}</div>
          <div class="hidden-strip" id="hiddenStrip">${hiddenList.length ? hiddenStripHtml(hiddenList) : ""}</div>
        </div>
        <div class="region-rail" id="regionRail"></div>
      </section>`;
  }

  function hiddenStripHtml(list) {
    return `
      <div class="hidden-strip__head">${T('hiddenN')} ${list.length} ${T('photoUnit')} · ${T('clickShow')}</div>
      <div class="hidden-strip__items">
        ${list.map(({ photo: ph }) => `
          <div class="hs-item" data-src="${esc(ph.src)}">
            <img src="${esc(ph.src)}" alt="" loading="lazy">
            <button class="hs-show" data-act="show">显示</button>
          </div>`).join("")}
      </div>`;
  }

  // 让“放大后”的浏览顺序 = 页面缩略图的真实显示顺序
  function syncOrderToDom() {
    const g = document.getElementById("regionGallery");
    if (!g) return;
    const figs = Array.from(g.querySelectorAll(".gallery__item, .film-frame"));
    if (!figs.length) return;
    const bySrc = {};
    curFullList.forEach((x) => { if (x && x.photo) bySrc[x.photo.src] = x; });
    const order = [];
    figs.forEach((f) => {
      const src = f.getAttribute("data-src");
      if (src && bySrc[src]) { order.push(bySrc[src]); }
      f.setAttribute("data-index", String(order.length - 1));
    });
    if (order.length) currentList = order;
  }

  function refreshRegion() {
    if (!curRegion) return;
    const hidden = new Set([...(curRegion.hidden || []), ...getHidden(curRegion.slug)]);
    const visible = curFullList.filter((x) => !hidden.has(x.photo.src));
    currentSource = visible;
    const cover = getCover(curRegion.slug) || curRegion.cover || (visible[0] && visible[0].photo.src) || "";
    const himg = document.getElementById("regionHeroImg");
    if (himg) { himg.src = cover; himg.classList.toggle("is-empty", !cover); }
    const g = document.getElementById("regionGallery");
    if (g) g.innerHTML = regionGalleryHTML();
    syncOrderToDom();
    observeItems();
    populateToc();
    document.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-sort") === currentSort));
    const hs = document.getElementById("hiddenStrip");
    const hiddenList = curFullList.filter((x) => hidden.has(x.photo.src));
    if (hs) hs.innerHTML = hiddenList.length ? hiddenStripHtml(hiddenList) : "";
    const meta = document.querySelector(".region-hero__inner .meta-line");
    if (meta) meta.textContent = `${currentSource.length} 张${curRegion.year ? " · " + curRegion.year : ""} · ${curCountry.country}${curFullList.length !== currentSource.length ? " · 隐藏 " + (curFullList.length - currentSource.length) : ""}`;
  }

  function renderRegionGalleryRows() {
    const el = document.getElementById("regionGallery");
    if (!el) return;
    el.innerHTML = regionGalleryHTML();
    syncOrderToDom();
    document.querySelectorAll("[data-sort]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-sort") === currentSort);
    });
  }

  function renderByTone() {
    const el = document.getElementById("regionGallery");
    if (el) el.innerHTML = galleryItems(sortList(currentSource, "tone"));
    syncOrderToDom();
    document.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-sort") === currentSort));
  }

  function showExport() {
    const old = document.getElementById("exportOverlay");
    if (old) old.remove();
    const out = { regions: {} };
    P.photography.forEach((c) => c.regions.forEach((r) => {
      const rec = {};
      const cov = getCover(r.slug);
      const hid = getHidden(r.slug);
      const secs = getSections(r.slug);
      if (cov) rec.cover = cov;
      if (hid.size) rec.hidden = [...hid];
      if (secs.length) rec.sections = secs;
      if (Object.keys(rec).length) out.regions[r.slug] = rec;
    }));
    const json = JSON.stringify(out, null, 2);
    const ov = document.createElement("div");
    ov.className = "export-overlay"; ov.id = "exportOverlay";
    ov.innerHTML = `
      <div class="export-box">
        <div class="export-box__head">导出设置（版头 / 隐藏）<button class="export-close" data-act="exportclose">✕</button></div>
        <textarea class="export-ta" readonly>${json}</textarea>
        <div class="export-foot"><button class="export-copy" data-act="exportcopy">复制</button></div>
      </div>`;
    document.body.appendChild(ov);
  }

  function showAssignPicker(src) {
    const old = document.getElementById("assignPicker");
    if (old) old.remove();
    if (!curRegion) return;
    const secs = effSections();
    const box = document.createElement("div");
    box.id = "assignPicker"; box.className = "assign-picker";
    box.innerHTML = `
      <div class="assign-picker__head">把照片加入分区<button class="ap-x" data-act="assignclose">✕</button></div>
      <div class="assign-picker__list">
        ${secs.length
          ? secs.map((s, i) => `<button class="ap-item" data-secidx="${i}" data-src="${esc(src)}">${esc(s.title)} <em>${(s.photos || []).filter((x) => x !== src).length}</em></button>`).join("")
          : `<div class="ap-empty">还没有分区，点下面“新建分区”</div>`}
        <button class="ap-item ap-new" data-act="picknew" data-src="${esc(src)}">＋ 新建分区</button>
        <button class="ap-item ap-auto" data-act="pickauto" data-src="${esc(src)}">自动（取消分区）</button>
      </div>`;
    document.body.appendChild(box);
  }

  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._x);
    t._x = setTimeout(() => t.classList.remove("show"), 1600);
  }

  /* ---------- 复用片段 ---------- */
  function rollItem(num, title, sub, href, meta) {
    return `
      <a class="roll__item" href="${href}">
        <span class="roll__num">${pad(num)}</span>
        <span class="roll__text">
          <span class="roll__t">${esc(title)}</span>
          <span class="roll__s">${esc(sub)}</span>
        </span>
        ${meta ? `<span class="roll__arrow">${esc(meta)}</span>` : `<span class="roll__arrow">→</span>`}
      </a>`;
  }

  function tabs(items, activeSlug, base) {
    return `
      <div class="tabs">
        ${items.map((it) => `
          <a class="tab ${it.slug === activeSlug ? "is-active" : ""}" href="${path(base, it.slug)}">${esc(it.label)}</a>
        `).join("")}
      </div>`;
  }

  /* ---------- 视图：视频 ---------- */
  function renderVideo() {
    const cat = current.videoCat === "narrative" ? "narrative" : "mix";
    const items = P.video[cat] || [];
    const catLabel = cat === "mix" ? T('catMix') : T('catNarr');
    const p = P.person;
    const tabsHtml = tabs(
      [{ slug: "mix", label: T('tabMix') }, { slug: "narrative", label: T('tabNarr') }],
      cat, "video"
    );
    return `
      <section class="editor">
        <div class="wrap">
          <div class="editor__grid">
            <aside class="editor__meta">
              <div class="eyebrow">${esc(p.en)} — Video</div>
              <h1>${T('videoTitle')}</h1>
              <div class="meta-line">${T('videoMeta')}</div>
              <p class="lead">${lan('在时间与节奏里重述画面。','Retelling stories through time and rhythm.')} ${esc(catLabel)}</p>
            </aside>
            <div class="roll">
              ${tabsHtml}
              ${items.length
                ? `
                <div class="video-grid">
                  ${items.map((v) => `
                    <a class="video-card" href="${esc(v.src)}" target="_blank" rel="noopener">
                      <div class="video-card__frame">
                        ${v.poster
                          ? `<img src="${esc(v.poster)}" alt="${esc(v.title)}" loading="lazy">`
                          : `<div class="ph"><span class="serif" style="font-size:22px;letter-spacing:.2em;color:var(--ink-dim)">${esc(catLabel)}</span></div>`}
                        <span class="play"></span>
                      </div>
                      <div class="video-card__info">
                        <div class="title">${esc(v.title)}</div>
                        ${v.description ? `<div class="desc">${esc(v.description)}</div>` : ""}
                        ${v.year ? `<span class="year">${esc(v.year)}</span>` : ""}
                      </div>
                    </a>`).join("")}
                </div>`
                : `<div class="empty"><div class="brand-name">${cat === "mix" ? "Mix" : "Narrative"}</div><p>${T('videoSoon')}</p></div>`}
            </div>
          </div>
        </div>
      </section>`;
  }

  /* ---------- 视图：关于 ---------- */
  function renderAbout() {
    return `
      <section class="about-embed">
        <iframe id="aboutFrame" src="resume-landing.html?lang=${window.LANG || 'zh'}" title="About me" style="width:100%;height:100%;border:0;display:block"></iframe>
      </section>`;
  }

  /* ---------- 渲染主入口 ---------- */
  function render() {
    const route = parseRoute();
    current = { ...current, ...route };
    if (route.view === "video") {
      current.videoCat = (location.hash || "").split("/").filter(Boolean)[2] || "mix";
    }
    let html = "";
    switch (current.view) {
      case "photography": html = renderPhotography(); break;
      case "video": html = renderVideo(); break;
      case "about": html = renderAbout(); break;
      default: html = renderAbout(); break;
    }
    let style = "default";
    if (route.view === "photography" && route.region) {
      const c = countryBySlug(route.country);
      const r = regionBySlug(c, route.region);
      style = (r && r.style) || (c && c.style) || "default";
    }
    document.body.setAttribute("data-style", style);
    app.innerHTML = html;
    observeItems();
    if (route.view === "photography" && route.region) populateToc();
    if (route.view === "photography" && route.region) syncOrderToDom();
    if (route.view === "about") {
      const lc = document.getElementById("lockerCanvas");
      if (lc && window.Room) { try { window.Room.init(lc); } catch (e) { console.error(e); } }
    }
    if (route.view === "home" && window.Globe && document.getElementById("globeCanvas")) {
      try { window.Globe.init(document.getElementById("globeCanvas")); } catch (err) { console.error(err); }
    }
    syncNav();
    closeMenu();
    scrollTop();
  }

  /* ---------- 导航高亮 / 菜单 ---------- */
  function syncNav() {
    document.querySelectorAll(".nav__links a[data-nav]").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-nav") === current.view);
    });
  }
  function closeMenu() {
    nav.classList.remove("open");
    document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
  }

  function initJournal() {
    const links = Array.from(document.querySelectorAll(".journal-nav a[data-jt]"));
    const secs = Array.from(document.querySelectorAll(".journal-sec"));
    const cards = Array.from(document.querySelectorAll(".journal-card"));
    links.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const el = document.getElementById("journal-" + a.getAttribute("data-jt"));
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    });
    // 卡片滚动进入视口时淡入
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-on"); io.unobserve(en.target); } });
    }, { threshold: 0.14 });
    cards.forEach((c) => io.observe(c));
    // 目录高亮跟随滚动
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && en.target.id.startsWith("journal-")) {
          const k = en.target.id.slice("journal-".length);
          links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("data-jt") === k));
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });
    secs.forEach((s) => io2.observe(s));
  }

  /* ---------- 沉浸式全屏画廊 ---------- */
  let lbIndex = 0;
  function lbContext() {
    const it = currentList[lbIndex];
    if (!it) return { ph: {}, date: "", location: "", camera: "", shot: "" };
    const ph = it.photo, region = it.region, country = it.country;
    const date = (ph && ph.date) || (ph && ph.year) || (region && region.year) || "";
    const location = (ph && ph.location) || (country ? `${country.country} · ${region ? region.name : ""}` : "");
    return { ph, date, location, camera: ph && ph.camera, shot: ph && ph.shot };
  }
  function openLightbox(i) {
    if (!currentList.length) return;
    lbIndex = (i + currentList.length) % currentList.length;
    updateLightbox();
    document.getElementById("lightbox").classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function updateLightbox() {
    const img = document.getElementById("lbImg");
    const foot = document.getElementById("lbFoot");
    const { ph, date, location, camera, shot } = lbContext();
    img.src = ph.src;
    img.alt = "";
    const rt = rotVal(ph.src);
    img.style.transform = rt ? "rotate(" + rt + "deg)" : "";
    foot.innerHTML =
      `<span class="count">${pad(lbIndex + 1)} / ${pad(currentList.length)}</span>` +
      (date ? `<span>Date / <b>${esc(date)}</b></span>` : "") +
      `<span>Location / <b>${esc(location)}</b></span>` +
      (camera ? `<span>Camera / <b>${esc(camera)}</b></span>` : "") +
      (shot ? `<span>${esc(shot)}</span>` : "");
  }
  function closeLightbox() {
    document.getElementById("lightbox").classList.remove("is-open");
    document.body.style.overflow = "";
  }

  /* ---------- 主题切换 ---------- */
  function setTheme(t) {
    rootEl.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) {}
  }
  (function initTheme() {
    let t = null;
    try { t = localStorage.getItem("theme"); } catch (e) {}
    if (t === "light" || t === "dark") setTheme(t);
  })();

  /* ---------- 事件 ---------- */
  document.addEventListener("click", (e) => {
    const sort = e.target.closest("[data-sort]");
    if (sort) {
      currentSort = sort.getAttribute("data-sort");
      try { localStorage.setItem("photoSort", currentSort); } catch (err) {}
      if (currentSort === "tone") renderByTone(); else renderRegionGalleryRows();
      return;
    }

    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.getAttribute("data-act");
      if (a === "edit") {
        const reg = document.querySelector(".region");
        if (reg) reg.classList.toggle("editing");
        return;
      }
      const holder = act.closest(".gallery__item, .hs-item");
      const src = holder && holder.getAttribute("data-src");
      const slug = curRegion && curRegion.slug;
      if (a === "cover" && slug && src) { setCover(slug, src); refreshRegion(); toast("已设为版头"); return; }
      if (a === "hide" && slug && src) { const h = getHidden(slug); h.add(src); setHidden(slug, h); refreshRegion(); return; }
      if (a === "show" && slug && src) { const h = getHidden(slug); h.delete(src); setHidden(slug, h); refreshRegion(); return; }
      if (a === "export") { showExport(); return; }
      if (a === "exportcopy") {
        const ta = document.querySelector(".export-ta");
        if (ta) { ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) {} }
        const btn = e.target.closest(".export-copy");
        if (btn) btn.textContent = "已复制 ✓";
        return;
      }
      if (a === "exportclose") { const o = document.getElementById("exportOverlay"); if (o) o.remove(); return; }
      if (a === "resetorder") {
        if (curRegion) { clearOrder(curRegion.slug); currentSort = "custom"; refreshRegion(); }
        return;
      }
      if (a === "resetmgmt") {
        if (curRegion) {
          ["hide_", "cover_", "order_", "sections_", "rot_"].forEach((p) => { try { localStorage.removeItem(p + curRegion.slug); } catch (e) {} });
          currentSort = "group"; curSecActive = -1;
          updateSectionsBar(); refreshRegion(); toast(T('cleared'));
        }
        return;
      }
      if (a === "rotate" && curRegion) {
        const holder = act.closest(".gallery__item, .film-frame, .hs-item");
        const src = holder && holder.getAttribute("data-src");
        if (src) {
          const store = rotGet(curRegion.slug);
          store[src] = ((store[src] || 0) + 90) % 360;
          rotSet(curRegion.slug, store);
          refreshRegion(); toast("已旋转 90°");
        }
        return;
      }
      if (a === "assignclose") { const o = document.getElementById("assignPicker"); if (o) o.remove(); return; }
      if (a === "picknew" && curRegion) {
        const src = act.getAttribute("data-src");
        const nm = prompt("新建分区名称", `分区 ${effSections().length + 1}`);
        if (src && nm && nm.trim()) {
          const secs = effSections();
          secs.forEach((s) => { s.photos = s.photos.filter((x) => x !== src); });
          secs.push({ title: nm.trim(), photos: [src] }); curSecActive = secs.length - 1;
          setSections(curRegion.slug, secs);
          const o = document.getElementById("assignPicker"); if (o) o.remove();
          updateSectionsBar(); refreshRegion(); toast("已加入「" + nm.trim() + "」");
        }
        return;
      }
      if (a === "pickauto" && curRegion) {
        const src = act.getAttribute("data-src");
        if (src) { const secs = effSections(); secs.forEach((s) => { s.photos = s.photos.filter((x) => x !== src); }); setSections(curRegion.slug, secs); updateSectionsBar(); refreshRegion(); toast("已移回自动"); }
        const o = document.getElementById("assignPicker"); if (o) o.remove();
        return;
      }
      if (a === "renamesec" && curRegion) {
        const i = Number(act.getAttribute("data-i"));
        const secs = effSections();
        if (!isNaN(i) && secs[i]) {
          const nm = prompt("修改分区名称", secs[i].title);
          if (nm && nm.trim()) { secs[i].title = nm.trim(); setSections(curRegion.slug, secs); updateSectionsBar(); refreshRegion(); }
        }
        return;
      }
      if (a === "newsec" && curRegion) {
        const name = prompt("分区名称", `分区 ${effSections().length + 1}`);
        if (name) {
          const secs = effSections(); secs.push({ title: name, photos: [] });
          setSections(curRegion.slug, secs); curSecActive = secs.length - 1;
          updateSectionsBar(); refreshRegion(); toast("已新建分区：" + name);
        }
        return;
      }
      if (a === "delsec" && curRegion) {
        const i = Number(act.getAttribute("data-i"));
        if (!isNaN(i)) {
          const secs = effSections(); secs.splice(i, 1);
          setSections(curRegion.slug, secs); if (curSecActive >= i) curSecActive = Math.min(curSecActive, secs.length - 1);
          updateSectionsBar(); refreshRegion();
        }
        return;
      }
      if (a === "assign" && curRegion) {
        const holder = act.closest(".gallery__item, .film-frame, .hs-item");
        const src = holder && holder.getAttribute("data-src");
        if (src) showAssignPicker(src);
        return;
      }
    }

    const sec = e.target.closest("[data-sec]");
    if (sec) { curSecActive = Number(sec.getAttribute("data-sec")); updateSectionsBar(); return; }

    const secPick = e.target.closest("[data-secidx]");
    if (secPick && curRegion) {
      const src = secPick.getAttribute("data-src");
      const idx = Number(secPick.getAttribute("data-secidx"));
      if (src && !isNaN(idx)) {
        const secs = effSections();
        secs.forEach((s) => { s.photos = s.photos.filter((x) => x !== src); });
        if (secs[idx]) { secs[idx].photos.push(src); curSecActive = idx; }
        setSections(curRegion.slug, secs);
        const o = document.getElementById("assignPicker"); if (o) o.remove();
        updateSectionsBar(); refreshRegion(); toast("已加入「" + (secs[idx] ? secs[idx].title : "分区") + "」");
      }
      return;
    }

    const chip = e.target.closest("#photoFilters .chip");
    if (chip) { homeFilter = chip.getAttribute("data-filter"); renderHomeProjects(); return; }

    const g = e.target.closest(".gallery__item, .film-frame");
    if (g) {
      if (document.querySelector(".region.editing")) {
        const src = g.getAttribute("data-src");
        if (curRegion && src) { setCover(curRegion.slug, src); refreshRegion(); toast("已设为版头"); }
        return;
      }
      openLightbox(Number(g.getAttribute("data-index")));
      return;
    }

    const lb = e.target.closest("[data-lb]");
    if (lb) {
      const d = lb.getAttribute("data-lb");
      if (d === "prev") lbIndex = (lbIndex - 1 + currentList.length) % currentList.length;
      if (d === "next") lbIndex = (lbIndex + 1) % currentList.length;
      updateLightbox();
      return;
    }
    if (e.target.closest("#lbClose")) { closeLightbox(); return; }
    if (e.target.closest("#menuToggle")) {
      const open = nav.classList.toggle("open");
      e.target.closest("#menuToggle").setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (e.target.closest("#backTop")) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (e.target.closest("#themeToggle")) {
      setTheme(rootEl.getAttribute("data-theme") === "dark" ? "light" : "dark");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("lightbox").classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") { lbIndex = (lbIndex - 1 + currentList.length) % currentList.length; updateLightbox(); }
    if (e.key === "ArrowRight") { lbIndex = (lbIndex + 1) % currentList.length; updateLightbox(); }
  });

  function clearDragMarks() {
    document.querySelectorAll(".drag-over,.ins-before,.ins-after").forEach((x) =>
      x.classList.remove("drag-over", "ins-before", "ins-after"));
  }
  document.addEventListener("dragstart", (e) => {
    const inGallery = e.target.closest && e.target.closest("#regionGallery .gallery__item, #regionGallery .film-frame");
    if (!document.querySelector(".region.editing")) {
      // 还没进管理：取消本机默认图片拖拽，并提示
      if (inGallery) { e.preventDefault(); toast(T('dragFirst')); }
      return;
    }
    if (e.target.closest && e.target.closest(".ia")) { e.preventDefault(); return; }
    const item = e.target.closest && e.target.closest("#regionGallery .gallery__item, #regionGallery .film-frame");
    if (!item) return;
    dragSrc = item.getAttribute("data-src");
    dropTarget = null; dropZone = null;
    try {
      // 小尺寸半透明幽灵，跟随鼠标移动，便于看清落点
      const img = item.querySelector("img");
      const c = document.createElement("canvas"); c.width = 64; c.height = 84;
      const g = c.getContext("2d");
      g.globalAlpha = 0.55;
      if (img && img.naturalWidth) {
        const ar = img.naturalWidth / img.naturalHeight || 1;
        g.drawImage(img, 0, 0, ar >= 1 ? 64 : 64 * ar, 84);
      } else { g.fillStyle = "#999"; g.fillRect(0, 0, 64, 84); }
      e.dataTransfer.setDragImage(c, 32, 42);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");
    } catch (err) {}
  });
  document.addEventListener("dragover", (e) => {
    if (!document.querySelector(".region.editing") || !dragSrc) return;
    clearDragMarks();
    const item = e.target.closest && e.target.closest("#regionGallery .gallery__item, #regionGallery .film-frame");
    if (item) {
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const horizontal = !!(item.closest(".film-strip__track"));
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      let before;
      if (horizontal) before = e.clientX < cx;
      else before = (Math.abs(dx) > Math.abs(dy)) ? (dx < 0) : (dy < 0);
      // 靠近中心默认放到目标之后，避免“拖了但没动”
      if (Math.abs(dx) < rect.width * 0.22 && Math.abs(dy) < rect.height * 0.22) before = false;
      item.classList.add(before ? "ins-before" : "ins-after");
      dropTarget = { src: item.getAttribute("data-src"), before };
      dropZone = null;
      return;
    }
    const zone = e.target.closest && e.target.closest("[data-seczone]");
    if (zone) {
      e.preventDefault();
      zone.classList.add("drag-over");
      dropTarget = null;
      dropZone = zone.getAttribute("data-seczone");
      return;
    }
    dropTarget = null; dropZone = null;
  });
  document.addEventListener("drop", (e) => {
    if (!document.querySelector(".region.editing") || !dragSrc || !curRegion) { clearDragMarks(); return; }
    e.preventDefault();
    const slug = curRegion.slug;
    const secs = effSections();
    const removeAll = (src) => secs.forEach((s) => { s.photos = s.photos.filter((x) => x !== src); });

    if (secs.length) {
      if (dropTarget && dropTarget.src && dropTarget.src !== dragSrc) {
        const ti = secs.findIndex((s) => (s.photos || []).includes(dropTarget.src));
        if (ti >= 0) {
          removeAll(dragSrc);
          const arr = secs[ti].photos;
          let idx = arr.indexOf(dropTarget.src);
          if (idx < 0) { arr.push(dragSrc); }
          else { arr.splice(dropTarget.before ? idx : idx + 1, 0, dragSrc); }
          setSections(slug, secs); updateSectionsBar(); refreshRegion(); toast("已移动");
        } else {
          removeAll(dragSrc); setSections(slug, secs); updateSectionsBar(); refreshRegion(); toast("已移回未分区");
        }
      } else if (dropZone !== null) {
        removeAll(dragSrc);
        if (dropZone !== "auto") {
          const zi = Number(dropZone);
          if (!isNaN(zi) && secs[zi]) secs[zi].photos.push(dragSrc);
        }
        setSections(slug, secs); updateSectionsBar(); refreshRegion(); toast("已移动");
      } else {
        // 落在空白处：不改变，避免误以为“乱跑”
      }
    } else {
      // 无分区：在当前列表中精确插到目标前/后
      if (dropTarget && dropTarget.src && dropTarget.src !== dragSrc) {
        const arr = currentList.slice();
        const from = arr.findIndex((x) => x.photo.src === dragSrc);
        const to = arr.findIndex((x) => x.photo.src === dropTarget.src);
        if (from >= 0 && to >= 0) {
          const [m] = arr.splice(from, 1);
          let ins = arr.findIndex((x) => x.photo.src === dropTarget.src);
          if (ins < 0) ins = arr.length;
          if (!dropTarget.before) ins += 1;
          arr.splice(ins, 0, m);
          setOrder(slug, arr.map((x) => x.photo.src));
          currentSort = "custom";
          refreshRegion();
        }
      }
    }
    dragSrc = ""; dropTarget = null; dropZone = null;
    clearDragMarks();
  });
  document.addEventListener("dragend", () => {
    dragSrc = ""; dropTarget = null; dropZone = null;
    clearDragMarks();
  });

  /* 从文件夹直接拖图片到分区（需用 python3 serve.py 并通过 localhost 打开） */
  document.addEventListener("dragover", (e) => {
    if (!document.querySelector(".region.editing")) return;
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    if (!document.querySelector(".region.editing") || !curRegion) return;
    const dt = e.dataTransfer;
    if (!dt || !dt.files || !dt.files.length) return;
    e.preventDefault();
    if (location.protocol === "file:") { toast("请在命令行运行 python3 serve.py，再用 http://localhost:8000 打开"); return; }
    const files = [...dt.files].filter((f) => /image\//i.test(f.type) || /\.(jpe?g|png|heic|tif|tiff|webp)$/i.test(f.name));
    if (!files.length) return;
    const secEl = e.target.closest && e.target.closest("[data-seczone]");
    let section = "";
    if (secEl) { const t = secEl.querySelector(".date-block__t"); if (t) section = t.textContent.trim(); }
    const endpoint = `${location.origin}/api/upload?region=${encodeURIComponent(curRegion.slug)}&country=${encodeURIComponent(curCountry ? curCountry.slug : "")}&section=${encodeURIComponent(section)}`;
    let done = 0, failed = 0;
    files.forEach((f) => {
      const fd = new FormData(); fd.append("file", f, f.name);
      fetch(endpoint, { method: "POST", body: fd })
        .then((r) => r.json()).then((res) => {
          done++;
          if (res && res.ok && res.added) {
            res.added.forEach((a) => {
              const ph = { src: a.src, location: curRegion.name };
              curRegion.photos.push(ph);
              if (curFullList) curFullList.push({ photo: ph, region: curRegion, country: curCountry });
              if (a.size && window.PHOTO_SIZE) window.PHOTO_SIZE[a.src] = a.size;
            });
          } else { failed++; }
          if (done >= files.length) { refreshRegion(); toast(failed ? `已添加 ${files.length - failed} 张，失败 ${failed}` : `已添加 ${files.length} 张`); }
        })
        .catch(() => { done++; failed++; if (done >= files.length) toast("上传失败，请确认用 localhost 打开"); });
    });
  });

  window.addEventListener("hashchange", render);
  window.addEventListener("message", function (ev) { var d = ev.data; if (!d) return; if (d.type === "globe-navigate" && d.country && d.slug) { location.hash = "#/photography/" + d.country + "/" + d.slug; } else if (d.type === "nav" && d.hash) { location.hash = d.hash; } });
  window.__applyLang = function () { render(); };
  render();
})();
