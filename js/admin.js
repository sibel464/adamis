/* Cunda Adamis — yönetim paneli
   İçerik data/menu.json ve data/site.json dosyalarındadır. Panel bu dosyaları GitHub API ile okur ve
   "Kaydet ve yayınla"da tek bir commit olarak geri yazar; GitHub Pages siteyi 1–2 dakikada günceller.
   Giriş: yalnızca bu depoya "Contents: Read and write" izni olan bir GitHub erişim anahtarı (fine-grained token). */
(() => {
  "use strict";

  const DEFAULT_REPO = "sibel464/adamis";
  const BRANCH = "main";
  const KEY_TOKEN = "adamis-ev-admin-token", KEY_REPO = "adamis-ev-admin-repo";

  const TAGS = { favori: "Favori", vejetaryen: "Vejetaryen", vegan: "Vegan", acili: "Acılı", glutensiz: "Glutensiz", sef: "Şefin Önerisi" };
  const SHAPES = [["4:3", "Yatay"], ["3:2", "Geniş"], ["1:1", "Kare"], ["4:5", "Dikey"], ["3:4", "Uzun dikey"]];

  // Metinler sekmesinde düzenlenebilen alanlar (anahtarlar index.html'deki data-i18n değerleridir)
  const TEXT_GROUPS = [
    ["Giriş", [["hero.eyebrow", "Üst satır"], ["hero.title", "Başlık", 1], ["hero.lead", "Alt metin", 2]]],
    ["Hikâyemiz", [["story.title", "Başlık", 1], ["story.p1", "1. paragraf", 2], ["story.p2", "2. paragraf", 2], ["story.sign", "İmza"], ["story.badge", "Rozet (1890 altı)"],
      ["feat.1.t", "Öne çıkan 1 – başlık"], ["feat.1.d", "Öne çıkan 1 – metin"], ["feat.2.t", "Öne çıkan 2 – başlık"], ["feat.2.d", "Öne çıkan 2 – metin"],
      ["feat.3.t", "Öne çıkan 3 – başlık"], ["feat.3.d", "Öne çıkan 3 – metin"]]],
    ["Bir Adamis günü", [["eve.title", "Başlık", 1], ["eve.lead", "Alt metin"], ["eve.1.time", "1. adım zamanı"], ["eve.1.t", "1. adım"], ["eve.1.d", "1. adım metni"], ["eve.2.time", "2. adım zamanı"], ["eve.2.t", "2. adım"], ["eve.2.d", "2. adım metni"],
      ["eve.3.t", "3. adım"], ["eve.3.d", "3. adım metni"], ["eve.4.time", "4. adım zamanı"], ["eve.4.t", "4. adım"], ["eve.4.d", "4. adım metni"]]],
    ["Menü", [["menu.title", "Başlık"], ["menu.lead", "Alt metin", 2], ["menu.allergen", "Alerjen notu"]]],
    ["Etkinlikler", [["events.title", "Başlık", 1], ["events.lead", "Alt metin"]]],
    ["Rezervasyon", [["res.title", "Başlık", 1], ["res.p", "Metin", 2]]],
    ["İletişim & Footer", [["c.title", "İletişim başlığı", 1], ["foot.slogan", "Footer sloganı"]]]
  ];
  const IMAGE_SLOTS = [
    ["hero", "Giriş (tabak) fotoğrafı", "Kare, yemeğin üstten çekimi olursa en iyisi; en az 1000 px"],
    ["story", "Hikâye – kemerli fotoğraf", "Taş ev / mekân; yatay veya dikey"],
    ["storyInset", "Hikâye – küçük yuvarlak", "Kare olursa en iyisi"]
  ];

  const S = {
    token: "", repo: DEFAULT_REPO, menu: null, site: null,
    pending: new Map(),        // yeni yüklenen görseller: yol → { base64, url }
    previews: new Map(),       // yayımlanana dek önizleme için
    dirty: { menu: false, site: false },
    defaults: { tr: {}, en: {} },
    tab: "genel", cat: 0, openItem: null, q: "", saving: false
  };

  /* ---------- küçük yardımcılar ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "gorsel";
  const biGet = (v, l) => v && typeof v === "object" ? (v[l] ?? "") : (v ?? "");
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  function toast(msg, kind = "") {
    const el = h("div", { class: `toast ${kind}` }, msg);
    $("#toasts").append(el);
    setTimeout(() => el.classList.add("out"), kind === "error" ? 7000 : 4200);
    setTimeout(() => el.remove(), kind === "error" ? 7600 : 4800);
  }

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const r = await fetch("https://api.github.com" + path, {
      ...opts,
      headers: { Authorization: `Bearer ${S.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}) }
    });
    if (!r.ok) {
      let m = r.statusText;
      try { m = (await r.json()).message || m; } catch (e) { /* gövde yok */ }
      const err = new Error(m); err.status = r.status; throw err;
    }
    return r.status === 204 ? null : r.json();
  }
  const b64ToUtf8 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), c => c.charCodeAt(0)));
  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  async function readJson(path) {
    const d = await gh(`/repos/${S.repo}/contents/${path}?ref=${BRANCH}`);
    return JSON.parse(b64ToUtf8(d.content));
  }
  // Tüm değişiklikleri tek commit olarak yazar (Git Data API)
  async function commitFiles(files, message) {
    const ref = await gh(`/repos/${S.repo}/git/ref/heads/${BRANCH}`);
    const base = await gh(`/repos/${S.repo}/git/commits/${ref.object.sha}`);
    const tree = [];
    for (const f of files) {
      const blob = await gh(`/repos/${S.repo}/git/blobs`, { method: "POST", body: JSON.stringify({ content: f.base64, encoding: "base64" }) });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const newTree = await gh(`/repos/${S.repo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
    const commit = await gh(`/repos/${S.repo}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
    await gh(`/repos/${S.repo}/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
    return commit;
  }
  const errText = e => e.status === 401 ? "Anahtar geçersiz veya süresi dolmuş. Yeni bir anahtarla tekrar giriş yapın."
    : (e.status === 403 || e.status === 404) ? "Bu anahtarın depoya erişim/yazma izni yok. Anahtarı oluştururken bu depoyu seçip “Contents: Read and write” izni verin."
    : (e.message || "Beklenmeyen bir hata oluştu.");

  /* ---------- görseller ---------- */
  function imgUrl(src, w = 400) {
    if (!src) return "";
    if (S.pending.has(src)) return S.pending.get(src).url;
    if (S.previews.has(src)) return S.previews.get(src);
    if (/^photo-/.test(src)) return `https://images.unsplash.com/${src}?w=${w}&q=60&auto=format&fit=crop`;
    return src; // sitedeki dosya (img/...) veya tam adres
  }
  function thumb(src, cls = "thumb") {
    const el = h("img", { class: cls, src: imgUrl(src), alt: "", loading: "lazy" });
    // Yeni yüklenen bir dosya sitede henüz yayımlanmadıysa depodan göster
    el.addEventListener("error", () => {
      if (!/^(photo-|https?:|blob:)/.test(src) && !el.dataset.retry) { el.dataset.retry = 1; el.src = `https://raw.githubusercontent.com/${S.repo}/${BRANCH}/${src}`; }
    }, { once: false });
    return el;
  }
  function pickFiles(multiple) {
    return new Promise(resolve => {
      const inp = h("input", { type: "file", accept: "image/*", multiple: multiple || null, style: "display:none" });
      inp.addEventListener("change", () => { resolve([...inp.files]); inp.remove(); });
      document.body.append(inp);
      inp.click();
    });
  }
  // Fotoğrafı tarayıcıda küçültür (JPEG) ve kaydedilmek üzere bekletir
  async function prepareImage(file, maxW, folder) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxW / bmp.width);
    const w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
    const cv = h("canvas"); cv.width = w; cv.height = hgt;
    cv.getContext("2d").drawImage(bmp, 0, 0, w, hgt);
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.82));
    const base64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    const path = `${folder}/${Date.now().toString(36)}-${slug(file.name.replace(/\.[^.]+$/, ""))}.jpg`;
    S.pending.set(path, { base64, url: URL.createObjectURL(blob) });
    return { path, w, h: hgt };
  }

  /* ---------- form parçaları ---------- */
  function markDirty(which) { S.dirty[which] = true; renderSaveBar(); }

  function field(label, get, set, { type = "text", area = 0, hint, which = "site", placeholder, step } = {}) {
    const input = area
      ? h("textarea", { rows: area === 1 ? 2 : 4, placeholder })
      : h("input", { type, placeholder, step });
    input.value = get() ?? "";
    input.addEventListener("input", () => { set(type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value); markDirty(which); });
    return h("label", { class: "f" }, h("span", { class: "f__l" }, label), input, hint ? h("small", { class: "f__h" }, hint) : null);
  }
  // İki dilli alan: { tr, en }
  function biField(label, obj, key, { area = 0, which = "site", hint, transform } = {}) {
    const tf = transform || { in: v => v, out: v => v };
    const mk = lang => {
      const input = area ? h("textarea", { rows: area === 1 ? 2 : 4 }) : h("input", { type: "text" });
      input.value = tf.in(biGet(obj[key], lang));
      input.addEventListener("input", () => {
        const cur = obj[key] && typeof obj[key] === "object" ? obj[key] : { tr: obj[key] ?? "", en: obj[key] ?? "" };
        cur[lang] = tf.out(input.value);
        obj[key] = cur;
        markDirty(which);
      });
      return h("div", { class: "bi__col" }, h("span", { class: `lang lang--${lang}` }, lang.toUpperCase()), input);
    };
    return h("div", { class: "f" }, h("span", { class: "f__l" }, label), h("div", { class: "bi" }, mk("tr"), mk("en")), hint ? h("small", { class: "f__h" }, hint) : null);
  }
  function biPair(label, obj, { which = "site" } = {}) {
    const mk = lang => {
      const input = h("input", { type: "text" }); input.value = obj[lang] || "";
      input.addEventListener("input", () => { obj[lang] = input.value; markDirty(which); });
      return h("div", { class: "bi__col" }, h("span", { class: `lang lang--${lang}` }, lang.toUpperCase()), input);
    };
    return h("div", { class: "f" }, h("span", { class: "f__l" }, label), h("div", { class: "bi" }, mk("tr"), mk("en")));
  }
  function imageField(label, get, set, { which = "site", maxW = 1600, folder = "img/uploads", hint } = {}) {
    const wrap = h("div", { class: "f imgf" });
    const draw = () => {
      wrap.replaceChildren(
        h("span", { class: "f__l" }, label),
        h("div", { class: "imgf__row" },
          thumb(get(), "imgf__thumb"),
          h("div", { class: "imgf__ctl" },
            h("button", { type: "button", class: "btn btn--sm", onclick: async () => {
              const [file] = await pickFiles(false);
              if (!file) return;
              const r = await prepareImage(file, maxW, folder);
              set(r.path, r); markDirty(which); draw();
            } }, "📷 Fotoğraf yükle"),
            h("details", { class: "imgf__adv" }, h("summary", {}, "Bağlantı ile değiştir"),
              (() => { const i = h("input", { type: "text", placeholder: "Unsplash kimliği (photo-…) veya https://…" }); i.value = get() || "";
                i.addEventListener("change", () => { set(i.value.trim()); markDirty(which); draw(); }); return i; })()),
            hint ? h("small", { class: "f__h" }, hint) : null))
      );
    };
    draw();
    return wrap;
  }
  const rowTools = (arr, i, rerender, which, { del = "Silinsin mi?" } = {}) => h("div", { class: "tools" },
    h("button", { type: "button", class: "ibtn", title: "Yukarı", onclick: () => { move(arr, i, -1); markDirty(which); rerender(); } }, "↑"),
    h("button", { type: "button", class: "ibtn", title: "Aşağı", onclick: () => { move(arr, i, 1); markDirty(which); rerender(); } }, "↓"),
    h("button", { type: "button", class: "ibtn ibtn--del", title: "Sil", onclick: () => { if (confirm(del)) { arr.splice(i, 1); markDirty(which); rerender(); } } }, "🗑"));
  function checkbox(label, get, set, which = "site") {
    const cb = h("input", { type: "checkbox" }); cb.checked = !!get();
    cb.addEventListener("change", () => { set(cb.checked); markDirty(which); });
    return h("label", { class: "check" }, cb, " ", label);
  }
  const card = (title, ...kids) => h("section", { class: "card" }, title ? h("h3", { class: "card__t" }, title) : null, ...kids);

  // *vurgu* ↔ <em>vurgu</em>
  const emTransform = {
    in: html => { const d = document.createElement("div"); d.innerHTML = String(html).replace(/<em>/g, "*").replace(/<\/em>/g, "*"); return d.textContent; },
    out: text => text.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])).replace(/\*([^*]+)\*/g, "<em>$1</em>")
  };

  /* ---------- sekmeler ---------- */
  const TABS = [
    ["genel", "🏠", "Genel bilgiler"], ["gorseller", "🖼️", "Ana fotoğraflar"], ["metinler", "✍️", "Metinler"],
    ["menu", "🍽️", "Menü"], ["fiks", "🍲", "Fiks menü"], ["galeri", "📸", "Galeri"],
    ["etkinlik", "🎶", "Etkinlikler"], ["yorum", "⭐", "Yorumlar"], ["ayarlar", "📣", "Duyuru & bölümler"]
  ];
  // Sitede gizlenebilen bölümler (index.html'deki id'ler)
  const SECTIONS = [["hikaye", "Hikâyemiz"], ["aksam", "Bir Adamis günü (etkinlikler dahil)"], ["etkinlikler", "Etkinlikler"],
    ["galeri", "Galeri"], ["yorumlar", "Yorumlar"]];

  function tabGenel() {
    const c = S.site.contact, hr = S.site.hours;
    return [
      card("İletişim",
        h("div", { class: "grid2" },
          field("Telefon (arama için)", () => c.phone, v => c.phone = v, { hint: "Ülke koduyla: +902663271965" }),
          field("Telefon (sitede görünen)", () => c.phoneDisplay, v => c.phoneDisplay = v, { hint: "Örn. 0266 327 19 65" }),
          field("WhatsApp numarası", () => c.whatsapp, v => c.whatsapp = v.replace(/\D/g, ""), { hint: "Sadece rakam, 90 ile başlar: 905xxxxxxxxx" }),
          field("Instagram adresi", () => c.instagram, v => c.instagram = v, { hint: "https://www.instagram.com/…" })),
        field("Adres", () => c.address, v => c.address = v),
        field("Harita arama metni", () => c.mapsQuery, v => c.mapsQuery = v, { hint: "Google Haritalar'da mekânı bulan metin. Yol tarifi ve harita bunu kullanır." })),
      card("Çalışma saatleri",
        h("div", { class: "grid2" },
          field("Açılış", () => hr.open, v => hr.open = v, { type: "time" }),
          field("Kapanış", () => hr.close, v => hr.close = v, { type: "time", hint: "Gece yarısı için 00:00" })),
        h("p", { class: "muted" }, "Sitedeki saatler, “Şu an açık/kapalı” durumu ve rezervasyon saat seçenekleri buna göre ayarlanır."))
    ];
  }

  function tabGorseller() {
    const im = S.site.images = S.site.images || {};
    return [card("Sitedeki ana fotoğraflar",
      h("p", { class: "muted" }, "Yüklediğiniz fotoğraflar otomatik olarak küçültülür. Kaydettikten sonra sitede 1–2 dakikada görünür."),
      ...IMAGE_SLOTS.map(([key, label, hint]) => imageField(label, () => im[key], v => { im[key] = v; }, { hint, maxW: key === "hero" ? 2200 : 1400, folder: "img/site" })))];
  }

  function tabMetinler() {
    const texts = S.site.texts = S.site.texts || {};
    const intro = card(null, h("p", { class: "muted" },
      "Sitedeki yazıları buradan değiştirebilirsiniz. Turuncu italik vurgu için kelimeyi yıldız içine alın: ", h("code", {}, "*zeytinyağlı*"), ". Boş bırakılan alan sitedeki varsayılan metne döner."));
    const groups = TEXT_GROUPS.map(([title, keys]) => card(title, ...keys.map(([key, label, area]) => {
      const proxy = { v: { tr: texts[key]?.tr ?? S.defaults.tr[key] ?? "", en: texts[key]?.en ?? S.defaults.en[key] ?? "" } };
      const el = biField(label, proxy, "v", { area: area || 0, transform: emTransform });
      el.addEventListener("input", () => {
        const tr = proxy.v.tr, en = proxy.v.en;
        const o = {};
        if (tr && tr !== S.defaults.tr[key]) o.tr = tr;
        if (en && en !== S.defaults.en[key]) o.en = en;
        if (Object.keys(o).length) texts[key] = o; else delete texts[key];
      });
      return el;
    })));
    return [intro, ...groups];
  }

  /* --- Menü --- */
  function priceSummary(it) {
    if (it.priceText) return biGet(it.priceText, "tr");
    if (it.prices) return it.prices.map(p => `${biGet(p.label, "tr")} ${p.price}₺`).join(" · ");
    return it.price != null ? `${it.price} ₺` : "—";
  }
  function itemEditor(cat, it, rerender) {
    const W = "menu";
    const mode = it.prices ? "multi" : it.priceText ? "text" : "single";
    const priceBox = h("div", { class: "pricebox" });
    const drawPrice = () => {
      const m = it.prices ? "multi" : it.priceText ? "text" : "single";
      const kids = [];
      if (m === "single") kids.push(field("Fiyat (₺)", () => it.price, v => it.price = v, { type: "number", which: W, step: "1" }));
      if (m === "text") kids.push(biField("Fiyat yerine yazı", it, "priceText", { which: W, hint: "Örn. Sorunuz / Ask us" }));
      if (m === "multi") {
        it.prices.forEach((p, i) => kids.push(h("div", { class: "prow" },
          biField(`Seçenek ${i + 1}`, p, "label", { which: W }),
          field("₺", () => p.price, v => p.price = v, { type: "number", which: W }),
          h("button", { type: "button", class: "ibtn ibtn--del", title: "Seçeneği sil", onclick: () => { it.prices.splice(i, 1); if (!it.prices.length) { delete it.prices; it.price = 0; } markDirty(W); drawPrice(); } }, "🗑"))));
        kids.push(h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { it.prices.push({ label: { tr: "", en: "" }, price: 0 }); markDirty(W); drawPrice(); } }, "+ Fiyat seçeneği"));
      }
      priceBox.replaceChildren(...kids);
    };
    const sel = h("select", { onchange: () => {
      const v = sel.value;
      const old = it.price ?? (it.prices && it.prices[0] && it.prices[0].price) ?? 0;
      delete it.price; delete it.prices; delete it.priceText;
      if (v === "single") it.price = old;
      if (v === "multi") it.prices = [{ label: { tr: "Kadeh", en: "Glass" }, price: old }, { label: { tr: "Şişe", en: "Bottle" }, price: 0 }];
      if (v === "text") it.priceText = { tr: "Sorunuz", en: "Ask us" };
      markDirty(W); drawPrice();
    } }, h("option", { value: "single" }, "Tek fiyat"), h("option", { value: "multi" }, "Seçenekli (kadeh / şişe / duble…)"), h("option", { value: "text" }, "Fiyat yerine yazı"));
    sel.value = mode;
    drawPrice();

    const tags = h("div", { class: "tags" }, ...Object.entries(TAGS).map(([k, label]) => {
      const cb = h("input", { type: "checkbox" }); cb.checked = (it.tags || []).includes(k);
      cb.addEventListener("change", () => {
        const set = new Set(it.tags || []); cb.checked ? set.add(k) : set.delete(k);
        it.tags = [...set]; if (!it.tags.length) delete it.tags; markDirty(W);
      });
      return h("label", { class: "tagc" }, cb, label);
    }));

    const M = S.menu;
    const moveSel = h("select", { onchange: () => {
      const to = M.categories.find(c => c.id === moveSel.value);
      if (!to || to === cat) return;
      cat.items.splice(cat.items.indexOf(it), 1); to.items.push(it);
      S.cat = M.categories.indexOf(to); S.openItem = to.items.length - 1; markDirty(W); render();
      toast(`“${biGet(it.name, "tr")}” → ${biGet(to.name, "tr")} kategorisine taşındı.`);
    } }, ...M.categories.map(c => h("option", { value: c.id }, biGet(c.name, "tr"))));
    moveSel.value = cat.id;

    return h("div", { class: "item__ed" },
      h("div", { class: "flags" },
        checkbox("Bugün yok / tükendi (sitede soluk görünür)", () => it.soldOut, v => { if (v) it.soldOut = true; else delete it.soldOut; rerender(); }, W),
        checkbox("Sitede gizle", () => it.hidden, v => { if (v) it.hidden = true; else delete it.hidden; rerender(); }, W)),
      h("div", { class: "item__grid" },
        imageField("Ürün fotoğrafı", () => it.image, v => { it.image = v; }, { which: W, maxW: 1000, folder: "img/menu", hint: "Kare kırpılmış görünür" }),
        h("div", {},
          biField("Ürün adı", it, "name", { which: W }),
          biField("Açıklama", it, "desc", { which: W, area: 1 }))),
      h("div", { class: "f" }, h("span", { class: "f__l" }, "Fiyat türü"), sel),
      priceBox,
      h("div", { class: "f" }, h("span", { class: "f__l" }, "Etiketler"), tags),
      h("details", { class: "adv" }, h("summary", {}, "Diğer alanlar"),
        field("Küçük bilgi satırı (ör. üzüm · bölge)", () => it.meta, v => { if (v) it.meta = v; else delete it.meta; }, { which: W }),
        biField("Alt başlık (ör. Beyaz, Kırmızı, İmza Kokteyller)", it, "group", { which: W, hint: "Aynı alt başlıktaki ürünler menüde gruplanır." }),
        h("div", { class: "grid2" },
          h("label", { class: "f" }, h("span", { class: "f__l" }, "Başka kategoriye taşı"), moveSel),
          h("div", { class: "f" }, h("span", { class: "f__l" }, "Kopya"),
            h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => {
              const copy = clone(it); copy.name = { tr: biGet(it.name, "tr") + " (kopya)", en: biGet(it.name, "en") };
              cat.items.splice(cat.items.indexOf(it) + 1, 0, copy); S.openItem = cat.items.indexOf(copy); markDirty(W); render();
            } }, "⧉ Bu ürünü kopyala")))));
  }

  const itemFlags = it => [it.hidden ? h("span", { class: "flag flag--hidden" }, "Gizli") : null, it.soldOut ? h("span", { class: "flag flag--out" }, "Bugün yok") : null];

  // Menü sekmesinde arama: tüm kategorilerde ürün bulur
  function menuSearch(q) {
    const f = s => String(s || "").toLocaleLowerCase("tr");
    const hits = [];
    S.menu.categories.forEach((c, ci) => c.items.forEach((it, ii) => {
      if ([biGet(it.name, "tr"), biGet(it.name, "en"), biGet(it.desc, "tr"), biGet(c.name, "tr")].some(v => f(v).includes(f(q)))) hits.push({ c, ci, it, ii });
    }));
    return card(`“${q}” için ${hits.length} sonuç`, hits.length ? h("div", { class: "items" }, ...hits.map(({ c, ci, it, ii }) =>
      h("article", { class: "irow" }, h("div", { class: "irow__head" },
        h("button", { type: "button", class: "irow__main", onclick: () => { S.cat = ci; S.openItem = ii; S.q = ""; render(); } },
          thumb(it.image || c.image, "irow__img"),
          h("span", { class: "irow__txt" }, h("strong", {}, biGet(it.name, "tr") || "(adsız ürün)"), h("small", {}, `${biGet(c.name, "tr")} · ${priceSummary(it)}`)),
          ...itemFlags(it), h("span", { class: "irow__chev" }, "✎")))))) : h("p", { class: "muted" }, "Eşleşen ürün yok."));
  }

  function sectionsCard() {
    const M = S.menu, W = "menu";
    return h("details", { class: "card secs" }, h("summary", { class: "card__t" }, `Menü bölümleri (${M.sections.map(x => biGet(x.name, "tr")).join(", ")})`),
      h("p", { class: "muted" }, "Kategoriler bu bölümler altında gruplanır (ör. Mutfak, Bar)."),
      h("div", { class: "stack" }, ...M.sections.map((sec, i) => h("article", { class: "ecard" },
        biField("Bölüm adı", sec, "name", { which: W }),
        biField("Kısa açıklama", sec, "desc", { which: W }),
        h("div", { class: "tools" },
          h("button", { type: "button", class: "ibtn", title: "Yukarı", onclick: () => { move(M.sections, i, -1); markDirty(W); render(); } }, "↑"),
          h("button", { type: "button", class: "ibtn", title: "Aşağı", onclick: () => { move(M.sections, i, 1); markDirty(W); render(); } }, "↓"),
          h("button", { type: "button", class: "ibtn ibtn--del", title: "Sil", onclick: () => {
            const n = M.categories.filter(c => c.section === sec.id).length;
            if (n) { alert(`Bu bölümde ${n} kategori var. Önce kategorileri başka bölüme taşıyın veya silin.`); return; }
            if (M.sections.length < 2) { alert("En az bir bölüm kalmalı."); return; }
            if (confirm("Bölüm silinsin mi?")) { M.sections.splice(i, 1); markDirty(W); render(); }
          } }, "🗑"))))),
      h("button", { type: "button", class: "btn btn--add", onclick: () => {
        M.sections.push({ id: "bolum-" + Date.now().toString(36), name: { tr: "Yeni bölüm", en: "New section" }, desc: { tr: "", en: "" } }); markDirty(W); render();
      } }, "+ Bölüm ekle"));
  }

  function tabMenu() {
    const M = S.menu, W = "menu";
    if (S.cat >= M.categories.length) S.cat = 0;
    const cat = M.categories[S.cat];
    const rerender = () => render();
    const search = h("input", { type: "search", class: "msearch", placeholder: "🔍 Ürün ara (tüm menüde)…", value: S.q });
    search.addEventListener("input", () => {
      S.q = search.value; render();
      const el = $(".msearch"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
    if (S.q.trim()) return [search, menuSearch(S.q.trim())];
    const chips = h("div", { class: "catbar" },
      ...M.sections.map(sec => [
        h("span", { class: "catbar__sec" }, biGet(sec.name, "tr")),
        ...M.categories.map((c, i) => c.section === sec.id ? h("button", { type: "button", class: `catchip ${i === S.cat ? "is-on" : ""} ${c.hidden ? "is-hidden" : ""}`, title: c.hidden ? "Sitede gizli" : null, onclick: () => { S.cat = i; S.openItem = null; render(); } }, biGet(c.name, "tr"), h("small", {}, c.items.length)) : null)
      ]),
      h("button", { type: "button", class: "catchip catchip--add", onclick: () => {
        M.categories.push({ id: "kategori-" + Date.now().toString(36), section: cat ? cat.section : "mutfak", image: cat ? cat.image : "", name: { tr: "Yeni kategori", en: "New category" }, items: [] });
        S.cat = M.categories.length - 1; markDirty(W); render();
      } }, "+ Kategori"));
    if (!cat) return [chips];

    const catCard = card("Kategori: " + biGet(cat.name, "tr"),
      h("div", { class: "item__grid" },
        imageField("Kapak fotoğrafı", () => cat.image, v => { cat.image = v; }, { which: W, maxW: 1400, folder: "img/menu" }),
        h("div", {},
          biField("Kategori adı", cat, "name", { which: W }),
          biField("Not (isteğe bağlı)", cat, "note", { which: W }),
          checkbox("Bu kategoriyi sitede gizle", () => cat.hidden, v => { if (v) cat.hidden = true; else delete cat.hidden; render(); }, W),
          h("div", { class: "grid2" },
            h("label", { class: "f" }, h("span", { class: "f__l" }, "Bölüm"),
              (() => { const s = h("select", { onchange: () => { cat.section = s.value; markDirty(W); render(); } }, ...M.sections.map(x => h("option", { value: x.id }, biGet(x.name, "tr")))); s.value = cat.section; return s; })()),
            h("label", { class: "f" }, h("span", { class: "f__l" }, "“Yanına yakışır” kategorisi"),
              (() => { const s = h("select", { onchange: () => { if (s.value) cat.pair = s.value; else delete cat.pair; markDirty(W); } }, h("option", { value: "" }, "— yok —"), ...M.categories.filter(x => x !== cat).map(x => h("option", { value: x.id }, biGet(x.name, "tr")))); s.value = cat.pair || ""; return s; })())))),
      h("div", { class: "tools tools--wide" },
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { move(M.categories, S.cat, -1); S.cat = Math.max(0, S.cat - 1); markDirty(W); render(); } }, "← Sola taşı"),
        h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { move(M.categories, S.cat, 1); S.cat = Math.min(M.categories.length - 1, S.cat + 1); markDirty(W); render(); } }, "Sağa taşı →"),
        h("button", { type: "button", class: "btn btn--danger btn--sm", onclick: () => {
          if (!confirm(`“${biGet(cat.name, "tr")}” kategorisi ve içindeki ${cat.items.length} ürün silinsin mi?`)) return;
          M.categories.splice(S.cat, 1); M.categories.forEach(x => { if (x.pair === cat.id) delete x.pair; });
          S.cat = 0; markDirty(W); render();
        } }, "Kategoriyi sil")));

    const list = h("div", { class: "items" }, ...cat.items.map((it, i) => {
      const open = S.openItem === i;
      return h("article", { class: `irow ${open ? "is-open" : ""}` },
        h("div", { class: "irow__head" },
          h("button", { type: "button", class: "irow__main", onclick: () => { S.openItem = open ? null : i; render(); } },
            thumb(it.image || cat.image, "irow__img"),
            h("span", { class: "irow__txt" }, h("strong", {}, biGet(it.name, "tr") || "(adsız ürün)"), h("small", {}, priceSummary(it))),
            ...itemFlags(it),
            h("span", { class: "irow__chev" }, open ? "▲" : "✎")),
          h("button", { type: "button", class: `ibtn ibtn--out ${it.soldOut ? "is-on" : ""}`, title: it.soldOut ? "Tekrar satışa aç" : "Bugün yok olarak işaretle",
            onclick: () => { if (it.soldOut) delete it.soldOut; else it.soldOut = true; markDirty(W); render(); } }, "⦸"),
          rowTools(cat.items, i, () => { S.openItem = null; rerender(); }, W, { del: `“${biGet(it.name, "tr")}” silinsin mi?` })),
        open ? itemEditor(cat, it, rerender) : null);
    }));
    const add = h("button", { type: "button", class: "btn btn--add", onclick: () => {
      cat.items.push({ name: { tr: "", en: "" }, desc: { tr: "", en: "" }, price: 0, image: "" });
      S.openItem = cat.items.length - 1; markDirty(W); render();
      setTimeout(() => { const el = document.querySelector(".irow.is-open input"); if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }, 50);
    } }, "+ Ürün ekle");
    return [search, chips, catCard, card(`Ürünler (${cat.items.length})`, list, add), sectionsCard()];
  }

  function tabFiks() {
    const sm = S.menu.setMenu = S.menu.setMenu || { title: { tr: "", en: "" }, desc: { tr: "", en: "" }, items: [], price: 0, per: { tr: "kişi başı", en: "per person" } };
    const W = "menu";
    return [card("Fiks menü (Adamis Ev Sofrası)",
      checkbox("Fiks menüyü sitede gizle", () => sm.hidden, v => { if (v) sm.hidden = true; else delete sm.hidden; }, W),
      biField("Başlık", sm, "title", { which: W }),
      biField("Açıklama", sm, "desc", { which: W, area: 1 }),
      h("div", { class: "grid2" },
        field("Fiyat (₺)", () => sm.price, v => sm.price = v, { type: "number", which: W }),
        biField("Fiyat notu", sm, "per", { which: W })),
      h("div", { class: "f" }, h("span", { class: "f__l" }, "Menüde neler var?"),
        h("div", { class: "stack" }, ...sm.items.map((x, i) => {
          const holder = { v: x };
          const row = h("div", { class: "prow" }, biField(`${i + 1}.`, holder, "v", { which: W }), rowTools(sm.items, i, render, W));
          row.addEventListener("input", () => { sm.items[i] = holder.v; });
          return row;
        }))),
      h("button", { type: "button", class: "btn btn--add", onclick: () => { sm.items.push({ tr: "", en: "" }); markDirty(W); render(); } }, "+ Satır ekle"))];
  }

  function tabGaleri() {
    const G = S.site.gallery = S.site.gallery || [];
    const shapeOf = g => { const r = g.w / g.h; let best = SHAPES[0]; let d = 9; SHAPES.forEach(sh => { const [a, b] = sh[0].split(":").map(Number); const dd = Math.abs(a / b - r); if (dd < d) { d = dd; best = sh; } }); return best[0]; };
    const grid = h("div", { class: "ggrid" }, ...G.map((g, i) => h("article", { class: "gcard" },
      h("div", { class: "gcard__img" }, thumb(g.src, "")),
      h("div", { class: "gcard__body" },
        h("button", { type: "button", class: "btn btn--sm btn--ghost", onclick: async () => {
          const [file] = await pickFiles(false); if (!file) return;
          const r = await prepareImage(file, 1600, "img/gallery"); g.src = r.path; g.w = r.w; g.h = r.h; markDirty("site"); render();
        } }, "Fotoğrafı değiştir"),
        biPair("Açıklama", g),
        h("label", { class: "f" }, h("span", { class: "f__l" }, "Biçim"),
          (() => { const s = h("select", { onchange: () => { const [a, b] = s.value.split(":").map(Number); g.w = a; g.h = b; markDirty("site"); } }, ...SHAPES.map(([v, l]) => h("option", { value: v }, `${l} (${v})`))); s.value = shapeOf(g); return s; })()),
        rowTools(G, i, render, "site", { del: "Bu fotoğraf galeriden kaldırılsın mı?" })))));
    return [card(`Galeri (${G.length} fotoğraf)`,
      h("p", { class: "muted" }, "Sıralama sitedeki sıralamadır. Birden fazla fotoğrafı aynı anda yükleyebilirsiniz."),
      h("button", { type: "button", class: "btn btn--add", onclick: async () => {
        const files = await pickFiles(true);
        for (const f of files) { const r = await prepareImage(f, 1600, "img/gallery"); G.push({ src: r.path, w: r.w, h: r.h, tr: "", en: "" }); }
        if (files.length) { markDirty("site"); render(); toast(`${files.length} fotoğraf eklendi. Açıklamalarını yazıp kaydedin.`); }
      } }, "+ Fotoğraf yükle"),
      grid)];
  }

  function tabEtkinlik() {
    const E = S.site.events = S.site.events || [];
    return [card(`Etkinlikler (${E.length})`,
      h("div", { class: "stack" }, ...E.map((ev, i) => h("article", { class: "ecard" },
        h("div", { class: "item__grid" },
          imageField("Fotoğraf", () => ev.image, v => { ev.image = v; }, { maxW: 1200, folder: "img/events" }),
          h("div", {},
            biField("Zaman / kapsam", ev, "when", { hint: "Örn. Cuma & Cumartesi · 21:00" }),
            biField("Başlık", ev, "title"),
            biField("Açıklama", ev, "desc", { area: 1 }))),
        rowTools(E, i, render, "site", { del: "Bu etkinlik silinsin mi?" })))),
      h("button", { type: "button", class: "btn btn--add", onclick: () => { E.push({ image: "", when: { tr: "", en: "" }, title: { tr: "", en: "" }, desc: { tr: "", en: "" } }); markDirty("site"); render(); } }, "+ Etkinlik ekle"))];
  }

  function tabYorum() {
    const R = S.site.reviews = S.site.reviews || [];
    const rt = S.site.rating = S.site.rating || { score: "", count: { tr: "", en: "" }, showSampleNote: true };
    const sample = h("input", { type: "checkbox" }); sample.checked = rt.showSampleNote !== false;
    sample.addEventListener("change", () => { rt.showSampleNote = sample.checked; markDirty("site"); });
    return [
      card("Puan özeti",
        h("div", { class: "grid2" },
          field("Puan", () => rt.score, v => rt.score = v, { hint: "Örn. 4.7" }),
          biField("Yorum sayısı yazısı", rt, "count")),
        h("label", { class: "check" }, sample, " “Örnek içerik” notunu göster (gerçek yorumları girince kapatın)")),
      card(`Yorumlar (${R.length})`,
        h("div", { class: "stack" }, ...R.map((r, i) => h("article", { class: "ecard" },
          h("div", { class: "grid3" },
            field("İsim", () => r.name, v => r.name = v),
            field("Kaynak", () => r.src, v => r.src = v, { hint: "Örn. Google" }),
            h("label", { class: "f" }, h("span", { class: "f__l" }, "Yıldız"),
              (() => { const s = h("select", { onchange: () => { r.rating = Number(s.value); markDirty("site"); } }, ...[5, 4, 3, 2, 1].map(n => h("option", { value: n }, "★".repeat(n)))); s.value = r.rating || 5; return s; })())),
          field("Yorum", () => r.text, v => r.text = v, { area: 2 }),
          rowTools(R, i, render, "site", { del: "Bu yorum silinsin mi?" })))),
        h("button", { type: "button", class: "btn btn--add", onclick: () => { R.push({ name: "", src: "Google", rating: 5, text: "" }); markDirty("site"); render(); } }, "+ Yorum ekle"))
    ];
  }

  function tabAyarlar() {
    const an = S.site.announcement = S.site.announcement || { on: false, text: { tr: "", en: "" }, link: "" };
    const hidden = S.site.hiddenSections = S.site.hiddenSections || [];
    return [
      card("Duyuru şeridi",
        h("p", { class: "muted" }, "Açılış sayfasında başlığın üstünde turuncu bir şerit olarak görünür. Ör. “Bu Cuma canlı müzik!” veya “Bugün özel etkinlik nedeniyle 18:00'de kapalıyız”."),
        checkbox("Duyuruyu göster", () => an.on, v => { an.on = v; }),
        biField("Duyuru metni", an, "text"),
        field("Bağlantı (isteğe bağlı)", () => an.link, v => an.link = v.trim(), { placeholder: "#etkinlikler, #menu veya https://…", hint: "Şeride tıklayınca gidilecek yer. Boş bırakılabilir." })),
      card("Sitede görünen bölümler",
        h("p", { class: "muted" }, "İşareti kaldırdığınız bölüm sitede gizlenir, menüdeki bağlantısı da kalkar. Silinmez; istediğiniz zaman geri açabilirsiniz."),
        ...SECTIONS.map(([id, label]) => checkbox(label, () => !hidden.includes(id), v => {
          const i = hidden.indexOf(id);
          if (v && i >= 0) hidden.splice(i, 1);
          if (!v && i < 0) hidden.push(id);
        })))
    ];
  }

  const TAB_RENDER = { ayarlar: tabAyarlar, genel: tabGenel, gorseller: tabGorseller, metinler: tabMetinler, menu: tabMenu, fiks: tabFiks, galeri: tabGaleri, etkinlik: tabEtkinlik, yorum: tabYorum };

  /* ---------- ekranlar ---------- */
  function renderLogin(msg) {
    const tok = h("input", { type: "password", placeholder: "github_pat_…", autocomplete: "off" });
    const repo = h("input", { type: "text", value: S.repo });
    const remember = h("input", { type: "checkbox" }); remember.checked = true;
    const err = h("p", { class: "login__err" }, msg || "");
    const go = async e => {
      e.preventDefault();
      S.token = tok.value.trim(); S.repo = repo.value.trim() || DEFAULT_REPO;
      if (!S.token) { err.textContent = "Anahtarı yapıştırın."; return; }
      err.textContent = "Kontrol ediliyor…";
      try {
        await gh(`/repos/${S.repo}`);
        try {
          (remember.checked ? localStorage : sessionStorage).setItem(KEY_TOKEN, S.token);
          localStorage.setItem(KEY_REPO, S.repo);
        } catch (x) { /* depolama yok */ }
        await loadData();
      } catch (x) { err.textContent = errText(x); }
    };
    $("#app").replaceChildren(h("div", { class: "login" },
      h("form", { class: "login__box", onsubmit: go },
        h("div", { class: "brand" }, h("span", { class: "brand__mark" }), h("span", {}, "Adamis ", h("em", {}, "Yönetim"))),
        h("p", { class: "muted" }, "Menü, galeri, etkinlikler, yorumlar ve site bilgilerini buradan düzenleyebilirsiniz."),
        h("label", { class: "f" }, h("span", { class: "f__l" }, "GitHub erişim anahtarı"), tok),
        h("details", { class: "help" }, h("summary", {}, "Anahtarı nasıl alırım? (bir kez yapılır)"),
          h("ol", {},
            h("li", {}, "GitHub'a girin ve ", h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "yeni anahtar sayfasını"), " açın."),
            h("li", {}, "Ad: “Adamis yönetim”. Süre: istediğiniz kadar (ör. 1 yıl)."),
            h("li", {}, "Repository access → ", h("b", {}, "Only select repositories"), " → ", h("b", {}, S.repo.split("/")[1]), " deposunu seçin."),
            h("li", {}, "Permissions → Repository permissions → ", h("b", {}, "Contents: Read and write"), "."),
            h("li", {}, "“Generate token”a basın, çıkan anahtarı kopyalayıp buraya yapıştırın.")),
          h("p", { class: "muted" }, "Anahtar yalnızca bu cihazda saklanır ve yalnızca bu depoyu düzenleyebilir. Kimseyle paylaşmayın.")),
        h("details", { class: "help" }, h("summary", {}, "Gelişmiş"), h("label", { class: "f" }, h("span", { class: "f__l" }, "Depo"), repo)),
        h("label", { class: "check" }, remember, " Bu cihazda beni hatırla"),
        err,
        h("button", { type: "submit", class: "btn btn--sunset btn--block" }, "Giriş yap"),
        h("a", { class: "login__back", href: "./" }, "← Siteye dön"))));
  }

  async function loadData() {
    $("#app").replaceChildren(h("p", { class: "boot" }, "İçerik yükleniyor…"));
    const [menu, site, html] = await Promise.all([
      readJson("data/menu.json"),
      readJson("data/site.json").catch(e => { if (e.status === 404) return { contact: {}, hours: { open: "14:00", close: "00:00" }, texts: {}, gallery: [], events: [], reviews: [] }; throw e; }),
      fetch("index.html", { cache: "no-cache" }).then(r => r.text()).catch(() => "")
    ]);
    S.menu = menu; S.site = site;
    S.site.contact = S.site.contact || {}; S.site.hours = S.site.hours || { open: "14:00", close: "00:00" };
    // Metinlerin varsayılanları: TR sayfadan, EN çeviri dosyasından
    if (html) new DOMParser().parseFromString(html, "text/html").querySelectorAll("[data-i18n]").forEach(el => { S.defaults.tr[el.dataset.i18n] = el.innerHTML.trim(); });
    S.defaults.en = { ...((window.I18N && window.I18N.en) || {}) };
    S.dirty = { menu: false, site: false };
    renderApp();
  }

  function renderApp() {
    $("#app").replaceChildren(
      h("header", { class: "top" },
        h("div", { class: "brand" }, h("span", { class: "brand__mark" }), h("span", {}, "Adamis ", h("em", {}, "Yönetim"))),
        h("div", { class: "top__r" },
          h("a", { class: "btn btn--ghost-l btn--sm", href: "./", target: "_blank", rel: "noopener" }, "Siteyi aç ↗"),
          h("button", { type: "button", class: "btn btn--ghost-l btn--sm", onclick: logout }, "Çıkış"))),
      h("div", { class: "layout" },
        h("nav", { class: "side", "aria-label": "Bölümler" }, ...TABS.map(([id, ic, label]) =>
          h("button", { type: "button", class: `side__b ${S.tab === id ? "is-on" : ""}`, "data-tab": id, onclick: () => { S.tab = id; S.openItem = null; render(); window.scrollTo(0, 0); } },
            h("span", { class: "side__i" }, ic), label))),
        h("main", { class: "main", id: "main" })),
      h("div", { class: "savebar", id: "savebar" }));
    render();
  }

  function render() {
    const main = $("#main"); if (!main) return;
    document.querySelectorAll(".side__b").forEach(b => b.classList.toggle("is-on", b.dataset.tab === S.tab));
    const [, , label] = TABS.find(x => x[0] === S.tab);
    main.replaceChildren(h("h2", { class: "main__t" }, label), ...TAB_RENDER[S.tab]());
    renderSaveBar();
  }

  function renderSaveBar() {
    const bar = $("#savebar"); if (!bar) return;
    const dirty = S.dirty.menu || S.dirty.site || S.pending.size > 0;
    bar.classList.toggle("is-on", dirty || S.saving);
    bar.replaceChildren(
      h("span", { class: "savebar__msg" }, S.saving ? "Kaydediliyor…" : "Kaydedilmemiş değişiklikler var"),
      h("button", { type: "button", class: "btn btn--ghost-l btn--sm", disabled: S.saving || null, onclick: async () => { if (confirm("Kaydedilmemiş değişiklikler silinsin mi?")) { S.pending.clear(); await loadData(); } } }, "Vazgeç"),
      h("button", { type: "button", class: "btn btn--sunset", disabled: S.saving || null, onclick: save }, S.saving ? "Yayınlanıyor…" : "Kaydet ve yayınla"));
  }

  async function save() {
    if (S.saving) return;
    S.saving = true; renderSaveBar();
    try {
      const files = [], parts = [];
      if (S.dirty.menu) { files.push({ path: "data/menu.json", base64: utf8ToB64(JSON.stringify(S.menu, null, 2) + "\n") }); parts.push("menü"); }
      if (S.dirty.site || S.pending.size) { files.push({ path: "data/site.json", base64: utf8ToB64(JSON.stringify(S.site, null, 2) + "\n") }); parts.push("site bilgileri"); }
      // Yalnızca hâlâ kullanılan yeni görselleri gönder
      const used = JSON.stringify(S.menu) + JSON.stringify(S.site);
      for (const [path, p] of S.pending) if (used.includes(path)) files.push({ path, base64: p.base64 });
      const imgCount = files.filter(f => f.path.startsWith("img/")).length;
      if (imgCount) parts.push(`${imgCount} görsel`);
      if (!files.length) { S.saving = false; renderSaveBar(); return; }
      await commitFiles(files, `Yönetim paneli: ${parts.join(", ")} güncellendi`);
      for (const [path, p] of S.pending) S.previews.set(path, p.url);
      S.pending.clear();
      S.dirty = { menu: false, site: false };
      toast("Yayınlandı! Site 1–2 dakika içinde güncellenir.", "ok");
    } catch (e) {
      toast("Kaydedilemedi: " + errText(e), "error");
      if (e.status === 401) { S.saving = false; logout(true); return; }
    }
    S.saving = false; renderSaveBar();
  }

  function logout(expired) {
    if (!expired && (S.dirty.menu || S.dirty.site || S.pending.size) && !confirm("Kaydedilmemiş değişiklikler kaybolacak. Çıkılsın mı?")) return;
    try { localStorage.removeItem(KEY_TOKEN); sessionStorage.removeItem(KEY_TOKEN); } catch (e) { /* depolama yok */ }
    S.token = ""; S.pending.clear(); S.dirty = { menu: false, site: false };
    renderLogin(expired === true ? "Oturum sona erdi, lütfen tekrar giriş yapın." : "");
  }

  window.addEventListener("beforeunload", e => {
    if (S.dirty.menu || S.dirty.site || S.pending.size) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- başlat ---------- */
  try {
    S.token = localStorage.getItem(KEY_TOKEN) || sessionStorage.getItem(KEY_TOKEN) || "";
    S.repo = localStorage.getItem(KEY_REPO) || DEFAULT_REPO;
  } catch (e) { /* depolama yok */ }
  if (S.token) loadData().catch(e => renderLogin(errText(e)));
  else renderLogin();
})();
