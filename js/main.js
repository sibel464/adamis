/* Cunda Adamis — site davranışları */
(async () => {
  "use strict";

  /* ============ İÇERİK ============
     Telefon, saatler, galeri, etkinlikler, yorumlar ve metin düzeltmeleri data/site.json'dadır
     (yönetim paneli: admin.html). Dosya okunamazsa aşağıdaki temel ayarlarla çalışır. */
  const FALLBACK = {
    contact: { phone: "+902663271064", phoneDisplay: "0266 327 10 64", whatsapp: "905070554938", instagram: "", address: "", mapsQuery: "" },
    hours: { open: "09:00", close: "22:30" }, images: {}, rating: null, texts: {}, gallery: [], events: null, reviews: []
  };
  let SITE = FALLBACK;
  try {
    const r = await fetch("data/site.json", { cache: "no-cache" });
    if (r.ok) { const d = await r.json(); SITE = { ...FALLBACK, ...d, contact: { ...FALLBACK.contact, ...(d.contact || {}) }, hours: { ...FALLBACK.hours, ...(d.hours || {}) } }; }
  } catch (e) { /* site.json okunamadı: temel ayarlarla devam */ }

  const hourOf = v => parseInt(String(v || "0").split(":")[0], 10) || 0;
  const OPEN_H = hourOf(SITE.hours.open);
  const CLOSE_H = hourOf(SITE.hours.close) || 24;   // 00:00 = gece yarısı
  const CONFIG = {
    phone: SITE.contact.phone,
    whatsapp: SITE.contact.whatsapp,
    instagram: SITE.contact.instagram,
    menuUrl: "data/menu.json",
    openHour: OPEN_H,
    lastBookingHour: Math.min(23, (CLOSE_H > OPEN_H ? CLOSE_H : 24) - 1)
  };
  const GALLERY = SITE.gallery || [];
  const REVIEWS = SITE.reviews || [];

  // Panelden gizlenen bölümler: bölüm görünmez olur, ona giden bağlantılar kaldırılır
  (SITE.hiddenSections || []).forEach(id => {
    const sec = document.getElementById(id);
    if (sec) sec.style.display = "none";
    document.querySelectorAll(`a[href="#${id}"]`).forEach(a => a.remove());
  });

  /* ============ Yardımcılar ============ */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Görsel: Unsplash kimliği (photo-...) ya da kendi dosya yolunuz (ör. img/menu/pizza.jpg)
  const img = (id, w) => /^photo-/.test(id) ? `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop` : `${id}?w=${w}`;
  const fold = s => String(s).toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, c => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" }[c]));

  let saved = null;
  try { saved = localStorage.getItem("adamis-ev-lang"); } catch (e) { /* storage yok */ }
  // Kayıtlı tercih yoksa: Türkçe tarayıcıya TR, diğerlerine EN
  let lang = saved || ((navigator.language || "tr").toLowerCase().startsWith("tr") ? "tr" : "en");
  const ui = () => window.I18N.ui[lang];
  const t = v => (v && typeof v === "object") ? (v[lang] ?? v.tr) : (v ?? "");

  const waLink = text => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  const openWa = text => window.open(waLink(text), "_blank", "noopener");

  /* ============ Dil ============ */
  Object.entries(SITE.texts || {}).forEach(([key, v]) => {
    if (!v) return;
    if (v.tr) $$(`[data-i18n="${key}"]`).forEach(el => { el.innerHTML = v.tr; });
    if (v.en) window.I18N.en[key] = v.en;
  });
  const trCache = new Map();
  $$("[data-i18n]").forEach(el => trCache.set(el, el.innerHTML));
  $$("[data-i18n-placeholder]").forEach(el => el.dataset.trPlaceholder = el.placeholder);

  function applyLang() {
    const dict = window.I18N.en;
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      el.innerHTML = lang === "en" && dict[key] ? dict[key] : trCache.get(el);
    });
    $$("[data-i18n-placeholder]").forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      el.placeholder = lang === "en" && dict[key] ? dict[key] : el.dataset.trPlaceholder;
    });
    $$(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    try { localStorage.setItem("adamis-ev-lang", lang); } catch (e) { /* storage yok */ }
  }

  $$(".lang button").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    applyLang();
    renderMenu();
    renderToday();
    renderGallery();
    fillGuestOptions();
    updateLiveInfo();
    applySite();
  }));


  /* ============ site.json → sayfa ============ */
  const hoursText = `${SITE.hours.open} – ${SITE.hours.close}`;
  function applySite() {
    const c = SITE.contact;
    $$('[data-bind="phoneDisplay"]').forEach(el => { el.textContent = c.phoneDisplay; });
    $$('a[href^="tel:"]').forEach(a => { a.href = "tel:" + c.phone; });
    if (c.address) $$('[data-bind="address"]').forEach(el => { el.textContent = c.address; });
    $$('[data-bind="hours"]').forEach(el => { el.textContent = hoursText; });
    if (c.mapsQuery) {
      const q = encodeURIComponent(c.mapsQuery);
      $$('[data-maps="dir"]').forEach(a => { a.href = `https://www.google.com/maps/dir/?api=1&destination=${q}`; });
      $$('[data-maps="embed"]').forEach(f => { const src = `https://www.google.com/maps?q=${q}&z=16&output=embed`; if (f.getAttribute("src") !== src) f.src = src; });
    }
    Object.entries(SITE.images || {}).forEach(([key, src]) => {
      $$(`[data-img="${key}"]`).forEach(el => {
        if (el.getAttribute("src") === src || el.dataset.cur === src) return;
        el.dataset.cur = src;
        el.removeAttribute("srcset");
        el.src = /^photo-/.test(src) ? img(src, key === "heroBg" ? 1920 : 1000) : src;
      });
    });
    const r = SITE.rating;
    if (r) {
      $$('[data-bind="ratingScore"]').forEach(el => { el.textContent = r.score; });
      $$('[data-bind="ratingCount"]').forEach(el => { el.textContent = t(r.count); });
      const st = $("#ratingStars");
      if (st) { st.firstElementChild.style.setProperty("--r", r.score); st.setAttribute("aria-label", `5 / ${r.score}`); }
      $$(".rating__sample").forEach(el => { el.hidden = r.showSampleNote === false; });
    }
    renderNotice();
  }

  // Duyuru: giriş bölümünün üstünde küçük bir şerit (ör. "Bu akşam canlı müzik")
  function renderNotice() {
    const an = SITE.announcement, copy = $(".hero__copy");
    let el = $("#siteNotice");
    if (!an || !an.on || !t(an.text) || !copy) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement(an.link ? "a" : "p");
      el.id = "siteNotice"; el.className = "notice";
      if (an.link) { el.href = an.link; if (/^https?:/.test(an.link)) { el.target = "_blank"; el.rel = "noopener"; } }
      copy.prepend(el);
    }
    el.textContent = t(an.text);
  }


  /* ============ Navigasyon ============ */
  const progress = $("#navProgress");
  const nav = $("#nav"), burger = $("#burger"), navMenu = $("#navMenu"), mobileBar = $(".mobile-bar");
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    mobileBar.classList.toggle("is-visible", y > window.innerHeight * 0.5);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const setMenuOpen = open => {
    burger.setAttribute("aria-expanded", String(open));
    navMenu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  };
  burger.addEventListener("click", () => setMenuOpen(burger.getAttribute("aria-expanded") !== "true"));
  $$("a", navMenu).forEach(a => a.addEventListener("click", () => setMenuOpen(false)));
  // Mobil panel açıkken karartılmış arka plana dokunmak menüyü kapatır
  nav.addEventListener("click", e => { if (e.target === nav && document.body.classList.contains("menu-open")) setMenuOpen(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenuOpen(false); });

  // Aktif bölüm vurgusu
  const navLinks = $$(".nav__menu > a:not(.btn)");
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      navLinks.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  navLinks.forEach(a => { const s = $(a.getAttribute("href")); if (s) sectionObserver.observe(s); });

  /* ============ Kaydırınca beliren bölümler ============ */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add("is-visible");
      revealObserver.unobserve(el);
      // belirme bitince gecikmeyi kaldır; yoksa hover efektleri de gecikir
      if (el.style.transitionDelay) setTimeout(() => { el.style.transitionDelay = ""; }, 1500);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  // Yan yana beliren öğeler sırayla (kademeli) gelsin
  const observeReveal = root => $$(".reveal:not(.is-visible)", root).forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains("reveal"));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = Math.min(i, 5) * 90 + "ms";
    revealObserver.observe(el);
  });

  /* ============ Menü ============
     Sayfada: Mutfak / Bar kategori kartları, şefin seçkisi ve arama sonuçları.
     Bir kategoriye dokununca sağdan kayan panel (drawer) açılır; adres #menu/<id> olur,
     tarayıcının geri tuşu paneli kapatır. */
  let MENU = null;
  const state = { q: "", diets: new Set() };
  const DIET_FILTERS = ["vejetaryen", "vegan", "glutensiz", "acili"];
  const app = $("#menuApp"), searchEl = $("#menuSearch");
  const drawer = $("#menuDrawer"), drawerPanel = $(".drawer__panel", drawer), drawerContent = $("#drawerContent");

  const priceFmt = n => new Intl.NumberFormat("tr-TR").format(n) + " " + (MENU.currency || "₺");
  const catById = id => MENU.categories.find(c => c.id === id);
  const sectionOf = c => MENU.sections.find(s => s.id === c.section) || MENU.sections[0];
  const catsIn = s => MENU.categories.filter(c => c.section === s.id);
  const countLabel = n => `${n} ${n === 1 ? ui().item : ui().items}`;

  function shortPrice(it) {
    if (it.priceText) return t(it.priceText);
    if (it.prices) return ui().from(priceFmt(Math.min(...it.prices.map(p => p.price))));
    return it.price != null ? priceFmt(it.price) : "";
  }

  // Ürün kartı: solda fotoğraf, sağda ad / açıklama / fiyat / etiketler
  function itemHTML(it, cat) {
    const tags = (it.tags || []).map(tg => `<span class="tag tag--${tg}">${esc(ui().tags[tg] || tg)}</span>`).join("");
    const single = it.prices ? "" : it.priceText ? esc(t(it.priceText)) : it.price != null ? priceFmt(it.price) : "";
    const prices = it.prices
      ? `<div class="item__prices">${it.prices.map(p => `<span class="item__pchip">${esc(t(p.label))}<b>${priceFmt(p.price)}</b></span>`).join("")}</div>`
      : "";
    const pic = it.image || cat.image;
    const out = it.soldOut ? `<span class="tag tag--out">${esc(ui().soldOut)}</span>` : "";
    return `<article class="item${it.soldOut ? " is-out" : ""}" data-item="${cat.id}:${cat.items.indexOf(it)}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(t(it.name))}">
      <div class="item__media">
        <img src="${img(pic, 220)}&h=220" srcset="${img(pic, 220)}&h=220 1x, ${img(pic, 440)}&h=440 2x" width="110" height="110" loading="lazy" decoding="async" alt="${esc(t(it.name))}">
        ${(it.tags || []).includes("sef") ? `<span class="item__badge" title="${esc(ui().tags.sef)}">✦</span>` : ""}
      </div>
      <div class="item__body">
        <div class="item__top">
          <h4 class="item__name">${esc(t(it.name))}</h4>
          ${single ? `<span class="item__price">${single}</span>` : ""}
        </div>
        ${it.meta ? `<p class="item__meta">${esc(it.meta)}</p>` : ""}
        ${it.desc ? `<p class="item__desc">${esc(t(it.desc))}</p>` : ""}
        ${prices}
        ${tags || out ? `<div class="tags">${out}${tags}</div>` : ""}
      </div>
    </article>`;
  }

  function itemsHTML(items, cat) {
    let html = "", lastGroup = null;
    items.forEach(it => {
      const g = it.group ? t(it.group) : null;
      if (g && g !== lastGroup) { html += `<h5 class="item-group">${esc(g)}</h5>`; lastGroup = g; }
      html += itemHTML(it, cat);
    });
    return `<div class="items">${html}</div>`;
  }

  const matchesDiet = it => [...state.diets].every(d => (it.tags || []).includes(d)
    || (d === "vejetaryen" && (it.tags || []).includes("vegan")));

  function haystack(it, cat) {
    const parts = [it.name, it.desc, it.group, cat.name].flatMap(v => v && typeof v === "object" ? [v.tr, v.en] : [v]);
    parts.push(it.meta, ...(it.tags || []).flatMap(tg => [window.I18N.ui.tr.tags[tg], window.I18N.ui.en.tags[tg]]));
    return fold(parts.filter(Boolean).join(" "));
  }

  const dietChipsHTML = () => `<div class="mfilter" role="group" aria-label="${esc(ui().filter)}">
      <span class="mfilter__label">${esc(ui().filter)}</span>
      ${DIET_FILTERS.map(d => `<button type="button" class="chip" data-diet="${d}" aria-pressed="${state.diets.has(d)}">${esc(ui().tags[d])}</button>`).join("")}
    </div>`;

  /* --- Sayfadaki ana görünüm: bölümler, kategori kartları, şefin seçkisi --- */
  function homeHTML() {
    let n = 0;
    const sections = MENU.sections.map((s, si) => {
      const cats = catsIn(s);
      const cls = `cat-grid${cats.length % 4 && cats.length % 3 === 0 ? " cat-grid--3" : ""}${cats.length % 2 ? " cat-grid--odd" : ""}`;
      return `
      <section class="mhome__section" aria-labelledby="msec-${s.id}">
        <header class="mhome__head">
          <span class="mhome__num">0${si + 1}</span>
          <div>
            <h3 id="msec-${s.id}">${esc(t(s.name))}</h3>
            <p>${esc(t(s.desc))}</p>
          </div>
        </header>
        <div class="${cls}">
          ${cats.map(c => `
            <a class="cat-tile" href="#menu/${c.id}" style="--d:${(n++) * 45}ms">
              <img src="${img(c.image, 500)}&h=620" srcset="${img(c.image, 360)}&h=450 360w, ${img(c.image, 500)}&h=620 500w" sizes="(max-width: 640px) 50vw, 25vw" width="500" height="620" loading="lazy" decoding="async" alt="">
              <span class="cat-tile__body">
                <span class="cat-tile__count">${countLabel(c.items.length)}</span>
                <span class="cat-tile__name">${esc(t(c.name))}</span>
              </span>
              <span class="cat-tile__arrow" aria-hidden="true">→</span>
            </a>`).join("")}
        </div>
      </section>`;
    }).join("");

    return `<div class="mhome">${sections}</div>`;
  }

  /* --- Arama sonuçları (sayfada) --- */
  function searchHTML(q) {
    const words = q.split(/\s+/);
    let count = 0, blocks = "";
    MENU.categories.forEach(cat => {
      const items = cat.items.filter(it => matchesDiet(it) && words.every(w => haystack(it, cat).includes(w)));
      if (!items.length) return;
      count += items.length;
      blocks += `<section class="msearch__block">
        <a class="msearch__cat" href="#menu/${cat.id}">
          <img src="${img(cat.image, 120)}&h=120" width="44" height="44" alt="" loading="lazy">
          <span>${esc(t(cat.name))}</span><span aria-hidden="true">→</span>
        </a>
        ${itemsHTML(items, cat)}
      </section>`;
    });
    return `<div class="msearch">
        <div class="msearch__bar">
          <p>${ui().resultsFor(esc(state.q.trim()), count)}</p>
          <button type="button" class="btn btn--sm btn--insta" data-clear>${esc(ui().clear)}</button>
        </div>
        ${dietChipsHTML()}
        ${blocks || `<p class="menu-empty">${esc(ui().noResults)}</p>`}
      </div>`;
  }

  function renderMenu() {
    if (!MENU) return;
    const q = fold(state.q.trim());
    app.innerHTML = `<div class="mview">${q ? searchHTML(q) : homeHTML()}</div>`;
    if (drawerCat) renderDrawer(drawerCat);
  }

  // Girişteki "Bugün ocakta" kartı: mutfaktan şefin önerileri ve favoriler (tükenmeyenler)
  function renderToday() {
    const list = $("#todayList");
    if (!MENU || !list) return;
    const score = it => ((it.tags || []).includes("sef") ? 2 : 0) + ((it.tags || []).includes("favori") ? 1 : 0);
    const picks = MENU.categories.filter(c => c.section === MENU.sections[0].id)
      .flatMap(c => c.items.filter(it => !it.soldOut && score(it)).map(it => ({ it, c })))
      .sort((a, b) => score(b.it) - score(a.it)).slice(0, 4);
    list.closest(".today-card").hidden = !picks.length;
    list.innerHTML = picks.map(({ it, c }) => `<li><a href="#menu/${c.id}">
        <span class="today-card__name">${esc(t(it.name))}</span><span class="today-card__dots" aria-hidden="true"></span>
        <span class="today-card__price">${esc(shortPrice(it))}</span></a></li>`).join("");
  }


  /* --- Yan panel (drawer) --- */
  let drawerCat = null, drawerPushed = false, drawerReturnFocus = null;

  function renderDrawer(id) {
    const c = catById(id);
    const all = MENU.categories, i = all.indexOf(c);
    const prev = all[i - 1], next = all[i + 1];
    const hasDiet = c.items.some(it => (it.tags || []).some(tg => DIET_FILTERS.includes(tg)));
    const items = hasDiet ? c.items.filter(matchesDiet) : c.items;
    drawerContent.innerHTML = `
      <header class="dhead">
        <div class="dhead__bar">
          <span class="dhead__brand">Adamis · ${esc(ui().menuWord)}</span>
          <button type="button" class="dhead__close" data-drawer-close aria-label="${esc(ui().close)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <nav class="dtabs" aria-label="${esc(ui().categories)}">
          ${MENU.sections.map(s => `<span class="dtabs__sep">${esc(t(s.name))}</span>` +
            catsIn(s).map(k => `<a href="#menu/${k.id}" class="dtabs__chip" data-swap${k.id === c.id ? ' aria-current="page"' : ""}>${esc(t(k.name))}</a>`).join("")
          ).join("")}
        </nav>
      </header>
      <div class="dview">
        <div class="dcover">
          <img src="${img(c.image, 1000)}&h=520" srcset="${img(c.image, 640)}&h=360 640w, ${img(c.image, 1000)}&h=520 1000w" sizes="(max-width: 640px) 100vw, 640px" alt="" decoding="async">
          <div class="dcover__body">
            <span class="dcover__section">${esc(t(sectionOf(c).name))}</span>
            <h3 class="dcover__title" id="drawerTitle">${esc(t(c.name))}</h3>
            ${c.note ? `<p class="dcover__note">${esc(t(c.note))}</p>` : ""}
            <span class="dcover__count">${countLabel(c.items.length)}</span>
          </div>
        </div>
        <div class="dbody">
          ${hasDiet ? dietChipsHTML() : ""}
          ${items.length ? itemsHTML(items, c) : `<p class="menu-empty">${esc(ui().noDiet)}</p>`}
          <p class="dnote">${esc(ui().allergen)}</p>
          <nav class="dpager" aria-label="${esc(ui().categories)}">
            ${prev ? `<a class="dpager__link" href="#menu/${prev.id}" data-swap><small>← ${esc(ui().prev)}</small><span>${esc(t(prev.name))}</span></a>` : "<span></span>"}
            ${next ? `<a class="dpager__link dpager__link--next" href="#menu/${next.id}" data-swap><small>${esc(ui().next)} →</small><span>${esc(t(next.name))}</span></a>` : "<span></span>"}
          </nav>
        </div>
      </div>
      <footer class="dfoot">
        <a href="#rezervasyon" class="btn btn--sunset" data-drawer-book>${esc(ui().bookTable)}</a>
        <a href="#" class="btn btn--wa" data-drawer-wa><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-wa"/></svg>WhatsApp</a>
      </footer>`;

    centerActiveTab();
  }

  function centerActiveTab() {
    const active = $(".dtabs__chip[aria-current]", drawerContent), track = $(".dtabs", drawerContent);
    if (active && track) track.scrollLeft = active.offsetLeft - track.clientWidth / 2 + active.offsetWidth / 2;
  }

  function openDrawer(id, { pushed }) {
    const wasOpen = !!drawerCat;
    drawerCat = id;
    renderDrawer(id);
    drawerPanel.scrollTop = 0;
    if (wasOpen) return;
    drawerPushed = pushed;
    drawerReturnFocus = document.activeElement;
    drawer.hidden = false;
    centerActiveTab(); // panel görünür olunca ölçülebilir
    document.body.classList.add("drawer-open");
    requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add("is-open")));
    setTimeout(() => { const x = $(".dhead__close", drawer); if (x) x.focus({ preventScroll: true }); }, 60);
  }

  function closeDrawerUI() {
    if (!drawerCat) return;
    drawerCat = null;
    drawer.classList.remove("is-open");
    document.body.classList.remove("drawer-open");
    setTimeout(() => { if (!drawerCat) drawer.hidden = true; }, 420);
    if (drawerReturnFocus && document.contains(drawerReturnFocus)) drawerReturnFocus.focus({ preventScroll: true });
  }

  // Kullanıcı kapattığında: panel bir tıklamayla açıldıysa geri git (geçmiş temiz kalsın), yoksa adresi düzelt
  function requestCloseDrawer() {
    const closeHere = () => { history.replaceState(null, "", location.pathname + location.search + "#menu"); closeDrawerUI(); };
    if (!drawerPushed) { closeHere(); return; }
    history.back();
    setTimeout(() => { if (drawerCat) closeHere(); }, 300); // geri adım işe yaramazsa yine de kapat
  }

  function route(fromHashChange) {
    const m = location.hash.match(/^#menu\/([\w-]+)$/);
    if (m && MENU && catById(m[1])) openDrawer(m[1], { pushed: fromHashChange });
    else closeDrawerUI();
  }
  window.addEventListener("hashchange", () => route(true));


  /* --- Ürün detayı (sheet) --- */
  const sheet = $("#itemSheet"), sheetPanel = $(".sheet__panel", sheet), sheetContent = $("#sheetContent");
  let sheetReturnFocus = null, sheetOpen = false;

  function sheetHTML(cat, it) {
    const pic = it.image || cat.image;
    const tags = (it.soldOut ? `<span class="tag tag--out">${esc(ui().soldOut)}</span>` : "")
      + (it.tags || []).map(tg => `<span class="tag tag--${tg}">${esc(ui().tags[tg] || tg)}</span>`).join("");
    const priceBlock = it.prices
      ? `<div class="sheet__prices">${it.prices.map(p => `<div class="sheet__pr"><span>${esc(t(p.label))}</span><b>${priceFmt(p.price)}</b></div>`).join("")}</div>`
      : `<p class="sheet__price">${esc(shortPrice(it))}</p>`;
    const pc = cat.pair && catById(cat.pair);
    let pairHTML = "";
    if (pc) {
      const ranked = [...pc.items].sort((a, b) => {
        const score = x => ((x.tags || []).includes("sef") ? 2 : 0) + ((x.tags || []).includes("favori") ? 1 : 0);
        return score(b) - score(a);
      }).slice(0, 3);
      pairHTML = `<section class="pair">
        <div class="pair__head"><h4>${esc(ui().pairWith)}</h4><a href="#menu/${pc.id}" data-pair-cat>${esc(t(pc.name))} →</a></div>
        <div class="pair__list">
          ${ranked.map(x => `<button type="button" class="pair__item" data-item="${pc.id}:${pc.items.indexOf(x)}">
            <img src="${img(x.image || pc.image, 160)}&h=160" width="64" height="64" alt="" loading="lazy">
            <span><strong>${esc(t(x.name))}</strong><small>${esc(shortPrice(x))}</small></span>
          </button>`).join("")}
        </div>
      </section>`;
    }
    return `
      <div class="sheet__media">
        <img src="${img(pic, 900)}&h=675" srcset="${img(pic, 600)}&h=450 600w, ${img(pic, 900)}&h=675 900w" sizes="(max-width: 640px) 100vw, 560px" alt="${esc(t(it.name))}" decoding="async">
        <span class="sheet__cat">${esc(t(cat.name))}</span>
      </div>
      <div class="sheet__body">
        <h3 class="sheet__title" id="sheetTitle">${esc(t(it.name))}</h3>
        ${it.meta ? `<p class="sheet__meta">${esc(it.meta)}</p>` : ""}
        ${it.desc ? `<p class="sheet__desc">${esc(t(it.desc))}</p>` : ""}
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        ${priceBlock}
        <div class="sheet__actions">
          <a href="#rezervasyon" class="btn btn--sunset" data-sheet-book>${esc(ui().bookTable)}</a>
          <button type="button" class="btn btn--wa" data-sheet-ask><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-wa"/></svg>${esc(ui().askAbout)}</button>
        </div>
        ${pairHTML}
      </div>`;
  }

  let sheetItem = null;
  function openSheet(key) {
    const [cid, idx] = key.split(":");
    const cat = catById(cid), it = cat && cat.items[+idx];
    if (!it) return;
    sheetItem = { cat, it };
    sheetContent.innerHTML = sheetHTML(cat, it);
    sheetPanel.scrollTop = 0;
    if (sheetOpen) return;
    sheetOpen = true;
    sheetReturnFocus = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add("sheet-open");
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("is-open")));
    setTimeout(() => $(".sheet__close", sheet).focus({ preventScroll: true }), 60);
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove("is-open");
    document.body.classList.remove("sheet-open");
    setTimeout(() => { if (!sheetOpen) sheet.hidden = true; }, 380);
    if (sheetReturnFocus && document.contains(sheetReturnFocus)) sheetReturnFocus.focus({ preventScroll: true });
  }

  sheet.addEventListener("click", e => {
    if (e.target.closest("[data-sheet-close]")) { closeSheet(); return; }
    const other = e.target.closest(".pair__item[data-item]");
    if (other) { openSheet(other.dataset.item); return; }
    const pairCat = e.target.closest("[data-pair-cat]");
    if (pairCat) {
      e.preventDefault();
      closeSheet();
      const href = pairCat.getAttribute("href");
      drawerCat ? location.replace(href) : (location.hash = href.slice(1));
      return;
    }
    if (e.target.closest("[data-sheet-ask]")) {
      openWa(`${ui().waHello} ${ui().waInfo(t(sheetItem.it.name))}`);
      return;
    }
    if (e.target.closest("[data-sheet-book]")) {
      e.preventDefault();
      closeSheet();
      if (drawerCat) requestCloseDrawer();
      setTimeout(() => $("#rezervasyon").scrollIntoView({ behavior: "smooth" }), drawerCat ? 450 : 50);
    }
  });
  sheet.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); closeSheet(); return; }
    if (e.key !== "Tab") return;
    const f = $$('a[href], button:not([disabled])', sheetPanel).filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Ürün kartları (panelde ve arama sonuçlarında)
  const onItemActivate = e => {
    const card = e.target.closest(".item[data-item]");
    if (!card) return false;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return false;
    e.preventDefault();
    openSheet(card.dataset.item);
    return true;
  };
  [drawer, app].forEach(root => root.addEventListener("keydown", onItemActivate));

  drawer.addEventListener("click", e => {
    if (onItemActivate(e)) return;
    if (e.target.closest("[data-drawer-close]")) { requestCloseDrawer(); return; }
    const swap = e.target.closest("a[data-swap]");
    if (swap) { e.preventDefault(); location.replace(swap.getAttribute("href")); return; } // geçmişi şişirmeden kategori değiştir
    const chip = e.target.closest("[data-diet]");
    if (chip) {
      const d = chip.dataset.diet;
      state.diets.has(d) ? state.diets.delete(d) : state.diets.add(d);
      const y = drawerPanel.scrollTop;
      renderDrawer(drawerCat);
      drawerPanel.scrollTop = y;
      return;
    }
    if (e.target.closest("[data-drawer-wa]")) {
      e.preventDefault();
      openWa(`${ui().waHello} ${ui().waGeneral}`);
      return;
    }
    if (e.target.closest("[data-drawer-book]")) {
      e.preventDefault();
      requestCloseDrawer();
      setTimeout(() => $("#rezervasyon").scrollIntoView({ behavior: "smooth" }), 450);
    }
  });

  drawer.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); requestCloseDrawer(); return; }
    if (e.key !== "Tab") return;
    // Odak panelin içinde kalsın
    const f = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', drawerPanel).filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Sayfadaki menü: filtre ve arama temizleme
  app.addEventListener("click", e => {
    if (onItemActivate(e)) return;
    const chip = e.target.closest("[data-diet]");
    if (chip) {
      const d = chip.dataset.diet;
      state.diets.has(d) ? state.diets.delete(d) : state.diets.add(d);
      renderMenu();
      return;
    }
    if (e.target.closest("[data-clear]")) {
      state.q = ""; searchEl.value = "";
      renderMenu();
    }
  });

  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = searchEl.value; renderMenu(); }, 150);
  });
  searchEl.addEventListener("keydown", e => {
    if (e.key === "Escape") { searchEl.value = ""; state.q = ""; renderMenu(); }
  });

  fetch(CONFIG.menuUrl, { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      MENU = data;
      // Panelde "gizli" işaretlenen kategori, ürün ve fiks menü sitede görünmez
      MENU.categories = MENU.categories.filter(c => !c.hidden).map(c => ({ ...c, items: c.items.filter(it => !it.hidden) }));
      renderToday();
      renderMenu();
      route(false);
    })
    .catch(() => { app.innerHTML = `<p class="menu-empty">${esc(ui().menuError)}</p>`; });

  /* ============ Galeri + Lightbox ============ */
  const galleryEl = $("#gallery"), lb = $("#lightbox"), lbImg = $("img", lb), lbCap = $("figcaption", lb);
  let lbIndex = 0, lastFocus = null;

  function renderGallery() {
    galleryEl.innerHTML = GALLERY.map((g, i) => {
      const w = 600, h = Math.round(w * g.h / g.w);
      return `<button type="button" class="masonry__item reveal" data-index="${i}" data-caption="${esc(g[lang])}" aria-label="${esc(g[lang])}">
        <img src="${img(g.src, w)}&h=${h}" srcset="${img(g.src, 400)}&h=${Math.round(400 * g.h / g.w)} 400w, ${img(g.src, w)}&h=${h} 600w"
             sizes="(max-width: 640px) 100vw, 33vw" width="${w}" height="${h}" loading="lazy" decoding="async" alt="${esc(g[lang])}">
      </button>`;
    }).join("");
    observeReveal(galleryEl);
  }

  function showLightbox(i) {
    lbIndex = (i + GALLERY.length) % GALLERY.length;
    const g = GALLERY[lbIndex];
    lbImg.src = img(g.src, 1600);
    lbImg.alt = g[lang];
    lbCap.textContent = g[lang];
  }
  function openLightbox(i) {
    lastFocus = document.activeElement;
    showLightbox(i);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    $(".lightbox__close", lb).focus();
  }
  function closeLightbox() {
    lb.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  galleryEl.addEventListener("click", e => {
    const b = e.target.closest(".masonry__item");
    if (b) openLightbox(+b.dataset.index);
  });
  $(".lightbox__close", lb).addEventListener("click", closeLightbox);
  $(".lightbox__arrow--prev", lb).addEventListener("click", () => showLightbox(lbIndex - 1));
  $(".lightbox__arrow--next", lb).addEventListener("click", () => showLightbox(lbIndex + 1));
  lb.addEventListener("click", e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showLightbox(lbIndex - 1);
    if (e.key === "ArrowRight") showLightbox(lbIndex + 1);
  });
  let touchX = null;
  lb.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) showLightbox(lbIndex + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  /* ============ Yorumlar: tek büyük alıntı, kişi seçici, otomatik ilerleme ============ */
  const revStage = $("#reviews"), revPeople = $("#revPeople"), revBar = $("#revBar"), testi = $(".testi");
  let revIndex = 0, revTimer = null;
  const REV_MS = 7000;
  revPeople.innerHTML = REVIEWS.map((r, i) =>
    `<button type="button" class="testi__person" data-rev="${i}" aria-label="${esc(r.name)}" aria-pressed="false">${esc(r.name[0])}</button>`).join("");

  function showReview(i) {
    revIndex = (i + REVIEWS.length) % REVIEWS.length;
    const r = REVIEWS[revIndex];
    revStage.innerHTML = `<figure class="testi__slide">
        <span class="stars" aria-label="${r.rating}/5"><span style="--r:${r.rating}"></span></span>
        <blockquote>${esc(r.text)}</blockquote>
        <figcaption><strong>${esc(r.name)}</strong> · ${esc(r.src)}</figcaption>
      </figure>`;
    $$(".testi__person", revPeople).forEach((b, k) => b.setAttribute("aria-pressed", String(k === revIndex)));
    revBar.style.animation = "none"; void revBar.offsetWidth; revBar.style.animation = "";
  }
  function startRev() { stopRev(); testi.classList.add("is-playing"); revTimer = setInterval(() => showReview(revIndex + 1), REV_MS); }
  function stopRev() { clearInterval(revTimer); revTimer = null; testi.classList.remove("is-playing"); }
  showReview(0);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) startRev();
  revPeople.addEventListener("click", e => { const b = e.target.closest("[data-rev]"); if (b) { showReview(+b.dataset.rev); startRev(); } });
  $("#revPrev").addEventListener("click", () => { showReview(revIndex - 1); startRev(); });
  $("#revNext").addEventListener("click", () => { showReview(revIndex + 1); startRev(); });
  testi.addEventListener("mouseenter", stopRev);
  testi.addEventListener("mouseleave", () => { if (!matchMedia("(prefers-reduced-motion: reduce)").matches) startRev(); });
  let touchRevX = null;
  revStage.addEventListener("touchstart", e => { touchRevX = e.touches[0].clientX; }, { passive: true });
  revStage.addEventListener("touchend", e => {
    if (touchRevX == null) return;
    const dx = e.changedTouches[0].clientX - touchRevX;
    if (Math.abs(dx) > 50) { showReview(revIndex + (dx < 0 ? 1 : -1)); startRev(); }
    touchRevX = null;
  });
  revBar.style.setProperty("--dur", REV_MS + "ms");

  /* ============ Rezervasyon formu ============ */
  const form = $("#reserveForm"), formError = $("#formError");
  const dateInput = form.elements.date, timeSel = form.elements.time, guestSel = form.elements.guests;

  const today = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  dateInput.min = iso(today);
  dateInput.value = iso(today);

  for (let h = CONFIG.openHour; h <= CONFIG.lastBookingHour; h++) {
    ["00", "30"].forEach(m => {
      if (h === CONFIG.lastBookingHour && m === "30") return;
      const v = `${String(h).padStart(2, "0")}:${m}`;
      timeSel.add(new Option(v, v, false, v === "19:30"));
    });
  }
  function fillGuestOptions() {
    const current = guestSel.value || "2";
    guestSel.innerHTML = "";
    [..."123456789".split(""), "10", "10+"].forEach(n => guestSel.add(new Option(ui().guests(n), n, false, n === current)));
  }
  fillGuestOptions();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const f = form.elements;
    const required = [f.name, f.phone, f.date, f.time, f.guests];
    let ok = true;
    required.forEach(el => {
      const bad = !el.value.trim();
      el.classList.toggle("is-invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) {
      formError.textContent = ui().formError;
      formError.hidden = false;
      required.find(el => el.classList.contains("is-invalid")).focus();
      return;
    }
    formError.hidden = true;
    const u = ui();
    const date = new Date(f.date.value + "T00:00").toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const lines = [
      u.waHello,
      u.waReserve,
      "",
      `• ${u.waName}: ${f.name.value.trim()}`,
      `• ${u.waPhone}: ${f.phone.value.trim()}`,
      `• ${u.waDate}: ${date}`,
      `• ${u.waTime}: ${f.time.value}`,
      `• ${u.waGuests}: ${u.guests(f.guests.value)}`
    ];
    if (f.note.value.trim()) lines.push(`• ${u.waNote}: ${f.note.value.trim()}`);
    openWa(lines.join("\n"));
  });
  $$("input, select", form).forEach(el => el.addEventListener("input", () => el.classList.remove("is-invalid")));

  /* ============ WhatsApp / Instagram bağlantıları ============ */
  $$(".js-wa").forEach(a => {
    a.target = "_blank"; a.rel = "noopener";
    a.addEventListener("click", e => { e.preventDefault(); openWa(`${ui().waHello} ${ui().waGeneral}`); });
  });
  $$(".js-insta").forEach(a => { a.href = CONFIG.instagram; });

  /* ============ Gün batımı & açık/kapalı durumu ============
     Gün batımı, Cunda'nın koordinatları için güneş konumu formülüyle hesaplanır (suncalc yöntemi). */
  const CUNDA = { lat: 39.335, lng: 26.66 };
  const TZ = "Europe/Istanbul";

  function sunsetAt(date) {
    const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009, e = rad * 23.4397;
    const lw = rad * -CUNDA.lng, phi = rad * CUNDA.lat;
    const d = date.valueOf() / dayMs - 0.5 + J1970 - J2000;
    const n = Math.round(d - J0 - lw / (2 * Math.PI));
    const ds = J0 + lw / (2 * Math.PI) + n;
    const M = rad * (357.5291 + 0.98560028 * ds);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + Math.PI;
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const w = Math.acos((Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const jset = J2000 + J0 + (w + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    return new Date((jset + 0.5 - J1970) * dayMs);
  }
  const hm = d => d.toLocaleTimeString("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

  function updateLiveInfo() {
    const now = new Date(), u = ui();
    let set = sunsetAt(now), tomorrow = false;
    if (now > set) { set = sunsetAt(new Date(now.getTime() + 864e5)); tomorrow = true; }

    $("#floatSunLabel").textContent = tomorrow ? u.sunTomorrow : u.sunToday;
    $("#floatSunTime").textContent = hm(set);

    // Cunda saati: gün batımından 90 dk önce altın saat, 40 dk sonrasından sabaha kadar gece
    const todaySet = sunsetAt(now), mins = (now - todaySet) / 6e4;
    const istHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
    const phase = mins >= -90 && mins <= 40 ? "golden" : (mins > 40 || istHour < 6) ? "night" : "day";
    document.documentElement.dataset.phase = phase;


    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
    const open = CLOSE_H > OPEN_H ? (hour >= OPEN_H && hour < CLOSE_H) : (hour >= OPEN_H || hour < CLOSE_H);
    const status = $("#openStatus");
    status.classList.toggle("is-open", open);
    status.textContent = open ? u.openNow : u.closedNow(SITE.hours.open);
  }
  updateLiveInfo();
  setInterval(updateLiveInfo, 60 * 1000);

  /* ============ Yüzen rezervasyon butonu + derinlik efekti ============ */
  const floatBook = $("#floatBook");
  const hideFloatFor = new Set();
  const floatObserver = new IntersectionObserver(entries => {
    entries.forEach(en => en.isIntersecting ? hideFloatFor.add(en.target) : hideFloatFor.delete(en.target));
    updateFloat();
  }, { threshold: 0.15 });
  ["#rezervasyon", "#iletisim"].forEach(sel => { const el = $(sel); if (el) floatObserver.observe(el); });
  function updateFloat() {
    floatBook.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.9 && hideFloatFor.size === 0);
  }

  const parallaxEls = $$("[data-parallax]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ticking = false;
  function onScrollFx() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateFloat();
      if (!reduceMotion) {
        const mid = window.innerHeight / 2;
        parallaxEls.forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
          el.style.translate = `0 ${((r.top + r.height / 2 - mid) * -parseFloat(el.dataset.parallax)).toFixed(1)}px`;
        });
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScrollFx, { passive: true });
  onScrollFx();

  /* ============ Giriş: fareyle hafif derinlik ============ */
  const hero = $(".hero");
  if (hero && !reduceMotion) {
    if (matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", e => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width - .5).toFixed(3));
        hero.style.setProperty("--my", ((e.clientY - r.top) / r.height - .5).toFixed(3));
      });
      hero.addEventListener("pointerleave", () => { hero.style.setProperty("--mx", 0); hero.style.setProperty("--my", 0); });
    }
  }

  /* ============ Başlat ============ */
  $("#year").textContent = today.getFullYear();
  applyLang();
  applySite();
  renderGallery();
  observeReveal(document);
})();
