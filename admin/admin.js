/* Panel Meble Grosman
   Zapisuje realizacje prosto w repozytorium strony przez API GitHuba:
   zdjęcia są zmniejszane na telefonie (duże + miniatura), filmy dostają kadr podglądu,
   a każda publikacja to jeden commit (pliki + data/realizacje.json). GitHub Pages
   publikuje zmianę po około minucie. */
(() => {
  "use strict";

  const CFG = Object.assign({
    owner: "", repo: "", branch: "main", passwordSha256: "", maxVideoMB: 50, siteLimitMB: 1000
  }, window.MG_ADMIN || {});

  // Zapasowo: odczyt konta i repozytorium z adresu github.io
  if (!CFG.owner && /\.github\.io$/.test(location.hostname)) CFG.owner = location.hostname.split(".")[0];
  if (!CFG.repo && /\.github\.io$/.test(location.hostname)) CFG.repo = location.pathname.split("/").filter(Boolean)[0] || "";

  const DATA_PATH = "data/realizacje.json";
  const KEY_STORE = "mg-admin-key";
  const SESSION = "mg-admin-ok";
  const CATS = { kuchnie: "Kuchnie", szafy: "Szafy i zabudowy", lazienki: "Łazienki", salon: "Salon", inne: "Inne" };
  const SHORT = { kuchnie: "Kuchnie", szafy: "Szafy", lazienki: "Łazienki", salon: "Salon", inne: "Inne" };
  const FULL_SIDE = 1600;
  const THUMB_SIDE = 640;
  const POSTER_SIDE = 960;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const plural = (n, f) => {
    const a = n % 10, b = n % 100;
    if (n === 1) return f[0];
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return f[1];
    return f[2];
  };
  const mb = (bytes) => (bytes / 1048576).toLocaleString("pl-PL", { maximumFractionDigits: bytes < 10485760 ? 1 : 0 });
  const today = () => new Date().toISOString().slice(0, 10);
  const newId = () => "r" + today().replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8);
  const sitePath = (p) => "../" + p;

  /* ---------- widoki ---------- */
  const views = { login: $("#viewLogin"), key: $("#viewKey"), main: $("#viewMain") };
  const showView = (name) => {
    Object.entries(views).forEach(([k, v]) => { v.hidden = k !== name; });
    $("#logout").hidden = name === "login";
    if (name !== "main") $("#saveBar").hidden = true;
    const first = $("input", views[name]);
    if (first && name !== "main") setTimeout(() => first.focus(), 50);
  };

  /* ---------- klucz z linku konfiguracyjnego: admin/#klucz=... ---------- */
  const hashKey = new URLSearchParams(location.hash.slice(1)).get("klucz");
  if (hashKey) {
    localStorage.setItem(KEY_STORE, hashKey.trim());
    history.replaceState(null, "", location.pathname + location.search);
  }
  const getKey = () => localStorage.getItem(KEY_STORE) || "";

  /* ---------- hasło ---------- */
  const sha256 = async (text) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  };

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = (await sha256($("#password").value)) === CFG.passwordSha256;
    $("#loginError").hidden = ok;
    if (!ok) return;
    sessionStorage.setItem(SESSION, "1");
    $("#password").value = "";
    afterLogin();
  });

  $("#keyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = $("#key").value.trim();
    const err = $("#keyError");
    err.hidden = true;
    if (!key) return;
    try {
      await gh("", {}, key);  // sprawdza, czy klucz widzi repozytorium
      localStorage.setItem(KEY_STORE, key);
      $("#key").value = "";
      showView("main");
      loadItems();
    } catch (ex) {
      err.textContent = friendlyError(ex);
      err.hidden = false;
    }
  });

  $("#logout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION);
    showView("login");
  });

  $("#forgetKey").addEventListener("click", () => {
    if (!confirm("Odłączyć ten telefon? Żeby znowu dodawać zdjęcia, trzeba będzie wpisać klucz dostępu.")) return;
    localStorage.removeItem(KEY_STORE);
    showView("key");
  });

  const afterLogin = () => {
    if (!getKey()) { showView("key"); return; }
    showView("main");
    loadItems();
  };

  /* ---------- API GitHuba ---------- */
  const apiBase = () => `https://api.github.com/repos/${CFG.owner}/${CFG.repo}`;

  const gh = async (path, opts = {}, keyOverride) => {
    const headers = {
      Authorization: `Bearer ${keyOverride || getKey()}`,
      Accept: opts.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(apiBase() + path, { method: opts.method || "GET", headers, body: opts.body, cache: "no-store" });
    } catch (netErr) {
      const e = new Error("network"); e.status = 0; throw e;
    }
    if (!res.ok) {
      const e = new Error("GitHub " + res.status);
      e.status = res.status;
      try { e.detail = (await res.json()).message || ""; } catch (x) { e.detail = ""; }
      throw e;
    }
    if (res.status === 204) return null;
    return opts.raw ? res.text() : res.json();
  };

  // wysyłka dużych plików z postępem (fetch nie raportuje postępu wysyłania)
  const ghUpload = (path, bodyString, onProgress) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiBase() + path);
    xhr.setRequestHeader("Authorization", `Bearer ${getKey()}`);
    xhr.setRequestHeader("Accept", "application/vnd.github+json");
    xhr.setRequestHeader("X-GitHub-Api-Version", "2022-11-28");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable && onProgress) onProgress(ev.loaded / ev.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else {
        const e = new Error("GitHub " + xhr.status); e.status = xhr.status;
        try { e.detail = JSON.parse(xhr.responseText).message || ""; } catch (x) { e.detail = ""; }
        reject(e);
      }
    };
    xhr.onerror = () => { const e = new Error("network"); e.status = 0; reject(e); };
    xhr.send(bodyString);
  });

  const friendlyError = (e) => {
    if (!e || e.status === undefined) return "Coś poszło nie tak. Spróbuj jeszcze raz.";
    if (e.status === 0) return "Brak połączenia z internetem. Sprawdź zasięg i spróbuj jeszcze raz.";
    if (e.status === 401) return "Klucz dostępu jest nieprawidłowy albo wygasł. Poproś o nowy klucz.";
    if (e.status === 403) return "Klucz nie ma uprawnień do zapisu albo GitHub chwilowo blokuje zapytania. Spróbuj za kilka minut.";
    if (e.status === 404) return "Nie znaleziono repozytorium strony. Sprawdź ustawienia w admin/config.js albo uprawnienia klucza.";
    if (e.status === 409 || e.status === 422) return "Ktoś (albo automat) zmienił stronę w tym samym momencie. Spróbuj jeszcze raz.";
    if (e.status === 413) return "Plik jest za duży do wysłania.";
    return `GitHub zwrócił błąd ${e.status}. Spróbuj jeszcze raz za chwilę.`;
  };

  // Base64 bez przepełniania stosu przy dużych plikach
  const bytesToBase64 = (bytes) => {
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  };
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  const textToBase64 = (text) => bytesToBase64(new TextEncoder().encode(text));

  const uploadBlob = async (blob, onProgress) => {
    const content = await blobToBase64(blob);
    const res = await ghUpload("/git/blobs", JSON.stringify({ content, encoding: "base64" }), onProgress);
    return res.sha;
  };

  const readData = async (ref) => {
    try {
      const text = await gh(`/contents/${DATA_PATH}?ref=${encodeURIComponent(ref)}`, { raw: true });
      const data = JSON.parse(text);
      if (!Array.isArray(data.items)) data.items = [];
      return data;
    } catch (e) {
      if (e.status === 404) return { items: [] };
      throw e;
    }
  };

  /* ---------- zmiany jako operacje (łatwo je powtórzyć przy konflikcie) ---------- */
  const applyOps = (data, ops) => {
    const items = (data.items || []).map((x) => Object.assign({}, x));
    ops.forEach((op) => {
      if (op.op === "add") {
        items.unshift(...op.items.map((x) => Object.assign({}, x)));
      } else if (op.op === "update") {
        const it = items.find((x) => x.id === op.id);
        if (it) Object.assign(it, op.fields);
      } else if (op.op === "delete") {
        const i = items.findIndex((x) => x.id === op.id);
        if (i >= 0) items.splice(i, 1);
      } else if (op.op === "move") {
        const i = items.findIndex((x) => x.id === op.id);
        if (i < 0) return;
        const [it] = items.splice(i, 1);
        let j = -1;
        if (op.beforeId) j = items.findIndex((x) => x.id === op.beforeId);
        else if (op.afterId) { j = items.findIndex((x) => x.id === op.afterId); if (j >= 0) j += 1; }
        items.splice(j < 0 ? i : j, 0, it);
      }
    });
    return Object.assign({}, data, { updated: today(), items });
  };

  const ownFiles = (it) => [it.src, it.thumb, it.poster]
    .filter((p, i, arr) => typeof p === "string" && /^(img\/realizacje|video)\//.test(p) && arr.indexOf(p) === i);

  /* Jeden commit: nowe pliki + nowy JSON + usunięte pliki. Przy konflikcie od nowa na świeżym stanie. */
  const commit = async (ops, files, message, onStep) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const ref = await gh(`/git/ref/heads/${encodeURIComponent(CFG.branch)}`);
      const headSha = ref.object.sha;
      const headCommit = await gh(`/git/commits/${headSha}`);
      const current = await readData(headSha);
      const next = applyOps(current, ops);
      const keep = new Set(next.items.flatMap(ownFiles));
      const removed = current.items.flatMap(ownFiles).filter((p) => !keep.has(p));
      if (onStep) onStep();
      const json = await gh("/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: textToBase64(JSON.stringify(next, null, 2) + "\n"), encoding: "base64" })
      });
      const tree = [
        { path: DATA_PATH, mode: "100644", type: "blob", sha: json.sha },
        ...files.map((f) => ({ path: f.path, mode: "100644", type: "blob", sha: f.sha })),
        ...removed.map((p) => ({ path: p, mode: "100644", type: "blob", sha: null }))
      ];
      const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }) });
      const newCommit = await gh("/git/commits", {
        method: "POST",
        body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] })
      });
      try {
        await gh(`/git/refs/heads/${encodeURIComponent(CFG.branch)}`, {
          method: "PATCH",
          body: JSON.stringify({ sha: newCommit.sha, force: false })
        });
        return next;
      } catch (e) {
        if ((e.status === 422 || e.status === 409) && attempt < 3) { await sleep(800 * (attempt + 1)); continue; }
        throw e;
      }
    }
    throw Object.assign(new Error("conflict"), { status: 409 });
  };

  /* ---------- obróbka zdjęć i filmów na telefonie ---------- */
  const WEBP = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  })();
  const IMG_EXT = WEBP ? "webp" : "jpg";

  const encode = (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), WEBP ? "image/webp" : "image/jpeg", quality);
  });

  const decodeImage = async (file) => {
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* zapasowo przez <img> */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };

  // zmniejszanie po połowie daje ostrzejszy wynik niż jeden duży skok
  const scaleTo = (src, sw, sh, maxSide) => {
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    let cur = src, cw = sw, ch = sh;
    while (cw / 2 >= w * 1.5) {
      const c = document.createElement("canvas");
      c.width = Math.round(cw / 2);
      c.height = Math.round(ch / 2);
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(cur, 0, 0, c.width, c.height);
      cur = c; cw = c.width; ch = c.height;
    }
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(cur, 0, 0, w, h);
    return out;
  };

  const averageColor = (canvas) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(canvas, 0, 0, 1, 1);
    const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  };

  const processImage = async (file) => {
    const src = await decodeImage(file);
    const sw = src.width || src.naturalWidth;
    const sh = src.height || src.naturalHeight;
    if (!sw || !sh) throw new Error("decode");
    const full = scaleTo(src, sw, sh, FULL_SIDE);
    const thumb = scaleTo(full, full.width, full.height, THUMB_SIDE);
    const result = {
      full: await encode(full, .84),
      thumb: await encode(thumb, .8),
      w: full.width, h: full.height, tw: thumb.width, th: thumb.height,
      color: averageColor(thumb)
    };
    if (src.close) src.close();
    return result;
  };

  const waitFor = (target, event, ms) => new Promise((resolve, reject) => {
    const t = setTimeout(() => { target.removeEventListener(event, ok); reject(new Error("timeout")); }, ms);
    const ok = () => { clearTimeout(t); resolve(); };
    target.addEventListener(event, ok, { once: true });
  });

  const videoExt = (file) => {
    const byType = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" }[file.type];
    const byName = (file.name.split(".").pop() || "").toLowerCase();
    return byType || (["mp4", "mov", "webm", "m4v"].includes(byName) ? byName : "mp4");
  };

  const processVideo = async (file) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.src = url;
    const out = { poster: null, w: 0, h: 0, duration: 0, color: "#2B2825" };
    try {
      await waitFor(v, "loadedmetadata", 12000);
      out.w = v.videoWidth;
      out.h = v.videoHeight;
      out.duration = isFinite(v.duration) ? Math.round(v.duration) : 0;
      v.currentTime = Math.min(1, (v.duration || 0.3) / 3);
      await waitFor(v, "seeked", 10000);
      const canvas = scaleTo(v, v.videoWidth, v.videoHeight, POSTER_SIDE);
      out.poster = await encode(canvas, .8);
      out.color = averageColor(canvas);
    } catch (e) {
      /* bez kadru podglądu: na stronie będzie ciemny kafelek z przyciskiem play */
    } finally {
      URL.revokeObjectURL(url);
    }
    return out;
  };

  /* ---------- stan ---------- */
  let base = { items: [] };
  let ops = [];
  let drafts = [];
  let editingId = null;
  const localPreview = new Map();   // nowe pliki pokazujemy z telefonu, zanim GitHub Pages je opublikuje
  const view = () => applyOps(base, ops);

  const catOptions = (select, withAll) => {
    select.innerHTML = "";
    if (withAll) select.appendChild(new Option("Wszystkie", "all"));
    Object.entries(CATS).forEach(([k, v]) => select.appendChild(new Option(v, k)));
  };
  catOptions($("#bulkCat"));
  catOptions($("#editCat"));
  catOptions($("#viewCat"), true);
  $("#bulkCat").value = localStorage.getItem("mg-admin-cat") || "kuchnie";

  const notice = (text, isError) => {
    const n = $("#notice");
    n.textContent = text;
    n.classList.toggle("is-error", Boolean(isError));
    n.hidden = !text;
    if (text) n.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const setProgress = (fraction, text) => {
    $("#progress").hidden = fraction == null;
    if (fraction == null) return;
    $("#progressBar").style.width = Math.round(Math.max(0, Math.min(1, fraction)) * 100) + "%";
    $("#progressText").textContent = text;
  };

  const loadItems = async () => {
    $("#stats").textContent = "Wczytuję…";
    try {
      base = await readData(CFG.branch);
      ops = [];
      renderAll();
    } catch (e) {
      $("#stats").textContent = "";
      notice(friendlyError(e), true);
      if (e.status === 401) { localStorage.removeItem(KEY_STORE); showView("key"); }
    }
  };

  /* ---------- lista realizacji ---------- */
  const renderStats = () => {
    const items = view().items;
    const images = items.filter((i) => i.type === "image").length;
    const videos = items.filter((i) => i.type === "video").length;
    const bytes = items.reduce((s, i) => s + (Number(i.bytes) || 0), 0);
    $("#stats").textContent =
      `${images} ${plural(images, ["zdjęcie", "zdjęcia", "zdjęć"])}, ${videos} ${plural(videos, ["film", "filmy", "filmów"])}. ` +
      `Zajęte miejsce: ${mb(bytes)} MB z ok. ${CFG.siteLimitMB} MB.`;
  };

  const thumbSrc = (it) => localPreview.get(it.id) || sitePath(it.type === "video" ? (it.poster || "") : (it.thumb || it.src));

  const renderList = () => {
    const list = $("#itemList");
    const cat = $("#viewCat").value;
    const changed = new Set(ops.filter((o) => o.op !== "add").map((o) => o.id));
    list.innerHTML = "";
    view().items.filter((it) => cat === "all" || it.cat === cat).forEach((it) => {
      const li = el("li");
      const b = el("button", "tile" + (changed.has(it.id) ? " is-changed" : ""));
      b.type = "button";
      b.setAttribute("aria-label", `Edytuj: ${it.title || CATS[it.cat]}`);
      if (it.color) b.style.backgroundColor = it.color;
      if (it.type === "image" || it.poster || localPreview.has(it.id)) {
        const img = el("img");
        img.alt = "";
        img.loading = "lazy";
        img.src = thumbSrc(it);
        b.appendChild(img);
      }
      if (it.type === "video") {
        const p = el("span", "tile__play");
        p.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
        b.appendChild(p);
      }
      b.appendChild(el("span", "tile__cat", SHORT[it.cat] || it.cat));
      if (it.featured) b.appendChild(el("span", "tile__flag", "Duży"));
      b.addEventListener("click", () => openEdit(it.id));
      li.appendChild(b);
      list.appendChild(li);
    });
  };

  const renderSaveBar = () => {
    const n = ops.length;
    $("#saveBar").hidden = n === 0;
    $("#pendingText").textContent = `${n} ${plural(n, ["zmiana", "zmiany", "zmian"])} do zapisania`;
  };

  const renderAll = () => { renderStats(); renderList(); renderSaveBar(); };
  $("#viewCat").addEventListener("change", renderList);

  /* ---------- edycja ---------- */
  const sheet = $("#editSheet");

  const openEdit = (id) => {
    const it = view().items.find((x) => x.id === id);
    if (!it) return;
    editingId = id;
    const media = $("#editMedia");
    media.innerHTML = "";
    if (it.type === "video") {
      const v = el("video");
      v.controls = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.poster = it.poster ? sitePath(it.poster) : "";
      v.src = localPreview.get(it.id + ":video") || sitePath(it.src);
      media.appendChild(v);
    } else {
      const img = el("img");
      img.alt = "";
      img.src = localPreview.get(it.id) || sitePath(it.src);
      media.appendChild(img);
    }
    $("#editTitle").value = it.title || "";
    $("#editCat").value = it.cat;
    $("#editFeatured").checked = Boolean(it.featured);
    sheet.showModal();
  };

  const visibleIds = () => {
    const cat = $("#viewCat").value;
    return view().items.filter((it) => cat === "all" || it.cat === cat).map((x) => x.id);
  };

  $$("[data-move]", sheet).forEach((btn) => btn.addEventListener("click", () => {
    const ids = visibleIds();
    const i = ids.indexOf(editingId);
    if (i < 0) return;
    const to = btn.dataset.move;
    let op = null;
    if (to === "top" && i > 0) op = { op: "move", id: editingId, beforeId: ids[0] };
    if (to === "up" && i > 0) op = { op: "move", id: editingId, beforeId: ids[i - 1] };
    if (to === "down" && i < ids.length - 1) op = { op: "move", id: editingId, afterId: ids[i + 1] };
    if (!op) return;
    ops.push(op);
    renderAll();
  }));

  $("#editForm").addEventListener("submit", () => {
    const it = view().items.find((x) => x.id === editingId);
    if (!it) return;
    const fields = {};
    const title = $("#editTitle").value.trim();
    if (title !== (it.title || "")) fields.title = title;
    if ($("#editCat").value !== it.cat) fields.cat = $("#editCat").value;
    if ($("#editFeatured").checked !== Boolean(it.featured)) fields.featured = $("#editFeatured").checked;
    if (Object.keys(fields).length) { ops.push({ op: "update", id: editingId, fields }); renderAll(); }
  });

  $("#editDelete").addEventListener("click", () => {
    if (!confirm("Usunąć tę realizację ze strony?")) return;
    ops.push({ op: "delete", id: editingId });
    sheet.close();
    renderAll();
  });

  sheet.addEventListener("close", () => {
    const v = $("video", sheet);
    if (v) v.pause();
  });

  $("#discard").addEventListener("click", () => { ops = []; renderAll(); });

  const describeOps = (list) => {
    const added = list.filter((o) => o.op === "add").reduce((s, o) => s + o.items.length, 0);
    const deleted = list.filter((o) => o.op === "delete").length;
    const other = list.length - list.filter((o) => o.op === "add" || o.op === "delete").length;
    const parts = [];
    if (added) parts.push(`dodano ${added}`);
    if (deleted) parts.push(`usunięto ${deleted}`);
    if (other) parts.push(`zmieniono ${other}`);
    return "Panel: " + (parts.join(", ") || "zmiany");
  };

  $("#save").addEventListener("click", async () => {
    const pending = ops.slice();
    $("#save").disabled = true;
    setProgress(.5, "Zapisuję zmiany…");
    try {
      base = await commit(pending, [], describeOps(pending));
      ops = ops.slice(pending.length);
      setProgress(null);
      notice("Zapisane. Zmiany pojawią się na stronie w ciągu 1-2 minut.");
      renderAll();
    } catch (e) {
      setProgress(null);
      notice(friendlyError(e), true);
    } finally {
      $("#save").disabled = false;
    }
  });

  /* ---------- nowe pliki ---------- */
  const removeIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const renderDrafts = () => {
    const box = $("#drafts");
    const list = $("#draftList");
    box.hidden = drafts.length === 0;
    list.innerHTML = "";
    drafts.forEach((d) => {
      const li = el("li", "draft");
      const media = el("div", "draft__media");
      if (d.kind === "video") {
        const v = el("video");
        v.muted = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.preload = "metadata";
        v.src = d.url + "#t=0.5";
        media.appendChild(v);
        media.appendChild(el("span", "draft__badge", "Film"));
      } else {
        const img = el("img");
        img.alt = "";
        img.src = d.url;
        media.appendChild(img);
      }
      li.appendChild(media);

      const f = el("div", "draft__fields");
      const sel = el("select");
      sel.setAttribute("aria-label", "Kategoria");
      catOptions(sel);
      sel.value = d.cat;
      sel.addEventListener("change", () => { d.cat = sel.value; });
      const title = el("input");
      title.type = "text";
      title.maxLength = 160;
      title.placeholder = "Opis, np. Kuchnia w dębie z LED";
      title.setAttribute("aria-label", "Opis");
      title.value = d.title;
      title.addEventListener("input", () => { d.title = title.value; });
      const lab = el("label", "check");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = d.featured;
      cb.addEventListener("change", () => { d.featured = cb.checked; });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(" Duży kafelek"));
      const info = el("p", "draft__info" + (d.error ? " is-error" : ""),
        d.error || (d.kind === "video" ? `Film, ${mb(d.file.size)} MB` : `Zdjęcie, ${mb(d.file.size)} MB, zostanie zmniejszone`));
      f.append(sel, title, lab, info);
      li.appendChild(f);

      const rm = el("button", "draft__remove");
      rm.type = "button";
      rm.setAttribute("aria-label", "Usuń z listy");
      rm.innerHTML = removeIcon;
      rm.addEventListener("click", () => {
        URL.revokeObjectURL(d.url);
        drafts = drafts.filter((x) => x !== d);
        renderDrafts();
      });
      li.appendChild(rm);
      list.appendChild(li);
    });
    const ok = drafts.filter((d) => !d.error).length;
    $("#publish").disabled = ok === 0;
    $("#publish").textContent = ok ? `Opublikuj na stronie (${ok})` : "Opublikuj na stronie";
  };

  $("#files").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    files.forEach((file) => {
      const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name) ? "image" : null;
      if (!kind) return;
      const d = { file, kind, url: URL.createObjectURL(file), cat: $("#bulkCat").value, title: "", featured: false, error: "" };
      if (kind === "video" && file.size > CFG.maxVideoMB * 1048576) {
        d.error = `Film ma ${mb(file.size)} MB, a limit to ${CFG.maxVideoMB} MB. Przytnij go albo nagraj krótszy.`;
      }
      drafts.push(d);
    });
    notice("");
    renderDrafts();
  });

  $("#bulkCat").addEventListener("change", () => {
    const v = $("#bulkCat").value;
    localStorage.setItem("mg-admin-cat", v);
    drafts.forEach((d) => { d.cat = v; });
    renderDrafts();
  });

  $("#publish").addEventListener("click", async () => {
    const todo = drafts.filter((d) => !d.error);
    if (!todo.length) return;
    $("#publish").disabled = true;
    $("#addLabel").style.pointerEvents = "none";
    notice("");
    const files = [];
    const items = [];
    const previews = [];
    const steps = todo.length * 2 + 1;
    let step = 0;
    const tick = (text, partial = 0) => setProgress((step + partial) / steps, text);
    try {
      for (let k = 0; k < todo.length; k++) {
        const d = todo[k];
        const no = `${k + 1} z ${todo.length}`;
        const id = newId();
        const title = d.title.trim();
        if (d.kind === "image") {
          tick(`Przygotowuję zdjęcie ${no}…`);
          let img;
          try { img = await processImage(d.file); }
          catch (e) { throw Object.assign(new Error("decode"), { decode: true, name: d.file.name }); }
          step++;
          const fullPath = `img/realizacje/${id}.${IMG_EXT}`;
          const thumbPath = `img/realizacje/${id}-m.${IMG_EXT}`;
          tick(`Wysyłam zdjęcie ${no}…`);
          files.push({ path: fullPath, sha: await uploadBlob(img.full, (p) => tick(`Wysyłam zdjęcie ${no}…`, p * .7)) });
          files.push({ path: thumbPath, sha: await uploadBlob(img.thumb) });
          step++;
          items.push({
            id, type: "image", cat: d.cat, title, src: fullPath, thumb: thumbPath,
            w: img.w, h: img.h, tw: img.tw, th: img.th, color: img.color,
            featured: d.featured, date: today(), bytes: img.full.size + img.thumb.size
          });
          previews.push([id, URL.createObjectURL(img.thumb)]);
        } else {
          tick(`Przygotowuję film ${no}…`);
          const meta = await processVideo(d.file);
          step++;
          const vPath = `video/${id}.${videoExt(d.file)}`;
          const posterPath = meta.poster ? `img/realizacje/${id}-poster.${IMG_EXT}` : "";
          files.push({
            path: vPath,
            sha: await uploadBlob(d.file, (p) => tick(`Wysyłam film ${no} (${mb(d.file.size)} MB): ${Math.round(p * 100)}%`, p))
          });
          if (meta.poster) files.push({ path: posterPath, sha: await uploadBlob(meta.poster) });
          step++;
          const item = {
            id, type: "video", cat: d.cat, title, src: vPath,
            w: meta.w, h: meta.h, color: meta.color, duration: meta.duration,
            featured: d.featured, date: today(), bytes: d.file.size + (meta.poster ? meta.poster.size : 0)
          };
          if (posterPath) item.poster = posterPath;
          items.push(item);
          if (meta.poster) previews.push([id, URL.createObjectURL(meta.poster)]);
          previews.push([id + ":video", d.url]);
        }
      }
      tick("Zapisuję na stronie…");
      const addOp = { op: "add", items };
      // dodanie zapisujemy razem z ewentualnymi niezapisanymi zmianami
      const pending = ops.slice();
      base = await commit([...pending, addOp], files,
        describeOps([...pending, addOp]));
      ops = ops.slice(pending.length);
      previews.forEach(([k, v]) => localPreview.set(k, v));
      drafts.forEach((d) => { if (d.kind === "image") URL.revokeObjectURL(d.url); });
      drafts = drafts.filter((d) => d.error);
      setProgress(null);
      const imgs = items.filter((i) => i.type === "image").length;
      const vids = items.length - imgs;
      const what = [imgs ? `${imgs} ${plural(imgs, ["zdjęcie", "zdjęcia", "zdjęć"])}` : "", vids ? `${vids} ${plural(vids, ["film", "filmy", "filmów"])}` : ""].filter(Boolean).join(" i ");
      notice(`Gotowe! Dodano ${what}. Na stronie pojawią się w ciągu 1-2 minut.`);
      renderDrafts();
      renderAll();
    } catch (e) {
      setProgress(null);
      if (e.decode) notice(`Nie udało się odczytać zdjęcia ${e.name}. Jeśli to zdjęcie w formacie HEIC, wybierz je jeszcze raz albo zrób zrzut w JPG.`, true);
      else notice(friendlyError(e), true);
    } finally {
      $("#publish").disabled = false;
      $("#addLabel").style.pointerEvents = "";
    }
  });

  // nie zamykaj karty z niezapisanymi zmianami
  window.addEventListener("beforeunload", (e) => {
    if (ops.length || drafts.some((d) => !d.error)) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- start ---------- */
  if (!CFG.owner || !CFG.repo) {
    notice("Brak ustawień repozytorium w admin/config.js.", true);
  }
  if (sessionStorage.getItem(SESSION) === "1") afterLogin();
  else showView("login");
})();
