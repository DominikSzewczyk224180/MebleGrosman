/* Panel Meble Grosman
   Zdjęcia są zmniejszane na telefonie (duże 1600 px + miniatura 640 px), filmy dostają kadr podglądu,
   a potem trafiają na serwer SEOHOST przez API (adres w js/config.js).
   Zmiany są od razu widoczne na stronie dla wszystkich. */
(() => {
  "use strict";

  const API = String(window.MG_API || "").replace(/\/?$/, "/");
  const TOKEN_KEY = "mg-admin-token";
  let maxVideoMB = 50;
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
  const plural = (n, f) => {
    const a = n % 10, b = n % 100;
    if (n === 1) return f[0];
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return f[1];
    return f[2];
  };
  const mb = (bytes) => (bytes / 1048576).toLocaleString("pl-PL", { maximumFractionDigits: bytes < 10485760 ? 1 : 0 });
  const today = () => new Date().toISOString().slice(0, 10);
  const newId = () => "r" + today().replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8);

  /* ---------- widoki i logowanie ---------- */
  const views = { login: $("#viewLogin"), main: $("#viewMain") };
  const showView = (name) => {
    Object.entries(views).forEach(([k, v]) => { v.hidden = k !== name; });
    $("#logout").hidden = name === "login";
    if (name === "login") setTimeout(() => $("#password").focus(), 50);
  };

  /* ---------- API serwera ---------- */
  const getToken = () => {
    const t = localStorage.getItem(TOKEN_KEY) || "";
    const exp = parseInt(t.split(".")[0], 10);
    return exp && exp * 1000 > Date.now() ? t : "";
  };

  const apiError = (status, message) => Object.assign(new Error(message || "Błąd serwera."), { status });

  const api = async (file, body) => {
    let res;
    try {
      res = await fetch(API + file, {
        method: body ? "POST" : "GET",
        headers: Object.assign({ "X-MG-Token": getToken() }, body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store"
      });
    } catch (e) {
      throw apiError(0, "Brak połączenia z serwerem. Sprawdź internet i spróbuj jeszcze raz.");
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw apiError(res.status, data && data.error);
    return data;
  };

  // wysyłka pliku z postępem (fetch nie podaje postępu wysyłania)
  const uploadFile = (blob, name, kind, onProgress) => new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", blob, name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API + "upload.php");
    xhr.setRequestHeader("X-MG-Token", getToken());
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable && onProgress) onProgress(ev.loaded / ev.total); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
      if (xhr.status >= 200 && xhr.status < 300 && data && data.path) resolve(data.path);
      else reject(apiError(xhr.status, (data && data.error) || (xhr.status === 413 ? "Plik jest za duży dla serwera." : "Nie udało się wysłać pliku.")));
    };
    xhr.onerror = () => reject(apiError(0, "Brak połączenia z serwerem. Sprawdź internet i spróbuj jeszcze raz."));
    xhr.send(fd);
  });

  // wygasła sesja: wracamy do logowania z komunikatem
  const handleAuth = (e) => {
    if (e && e.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      showView("login");
      $("#loginError").textContent = "Sesja wygasła. Zaloguj się ponownie.";
      $("#loginError").hidden = false;
      return true;
    }
    return false;
  };

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#loginError");
    err.hidden = true;
    const btn = $("#loginForm button");
    btn.disabled = true;
    try {
      const res = await api("login.php", { password: $("#password").value });
      localStorage.setItem(TOKEN_KEY, res.token);
      if (res.maxVideoMB) maxVideoMB = res.maxVideoMB;
      $("#password").value = "";
      showView("main");
      loadItems();
    } catch (ex) {
      err.textContent = ex.message || "Nie udało się zalogować.";
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  $("#logout").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    showView("login");
  });

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
  let drafts = [];
  let editingId = null;

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

  let toastTimer = null;
  const toast = (text) => {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  };

  const setProgress = (fraction, text) => {
    $("#progress").hidden = fraction == null;
    if (fraction == null) return;
    $("#progressBar").style.width = Math.round(Math.max(0, Math.min(1, fraction)) * 100) + "%";
    $("#progressText").textContent = text;
  };

  // ścieżka do pokazania w panelu: plik z serwera (media/...) albo ze strony (img/...)
  const mediaUrl = (path) => {
    if (!path) return "";
    if (/^media\//.test(path)) return API + path;
    return "../" + path;
  };

  const loadItems = async () => {
    $("#stats").textContent = "Wczytuję…";
    try {
      base = await api("realizacje.php");
      if (!Array.isArray(base.items)) base.items = [];
      renderAll();
    } catch (e) {
      $("#stats").textContent = "";
      if (!handleAuth(e)) notice(e.message || "Nie udało się wczytać realizacji. Odśwież stronę.", true);
    }
  };

  // każda zmiana od razu trafia na serwer; serwer zwraca aktualną listę
  const save = async (ops, message) => {
    try {
      base = await api("zapisz.php", { ops });
      renderAll();
      if (message) toast(message);
      return true;
    } catch (e) {
      if (!handleAuth(e)) notice(e.message || "Nie udało się zapisać. Spróbuj jeszcze raz.", true);
      return false;
    }
  };

  /* ---------- lista realizacji ---------- */
  const renderStats = () => {
    const items = base.items;
    const images = items.filter((i) => i.type === "image").length;
    const videos = items.filter((i) => i.type === "video").length;
    $("#stats").textContent =
      `${images} ${plural(images, ["zdjęcie", "zdjęcia", "zdjęć"])} i ${videos} ${plural(videos, ["film", "filmy", "filmów"])} na stronie.`;
  };

  const arrow = (dir) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${dir < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // przesuwa realizację o jedno miejsce w obrębie aktualnie widocznej listy
  const moveBy = async (id, dir) => {
    const ids = visibleIds();
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const op = dir < 0 ? { op: "move", id, beforeId: ids[j] } : { op: "move", id, afterId: ids[j] };
    if (!(await save([op]))) return;
    const moved = $(`.tile[data-id="${id}"]`);
    if (moved) {
      moved.classList.add("is-moved");
      const btn = moved.parentElement.querySelector(dir < 0 ? "[data-dir='-1']" : "[data-dir='1']");
      (btn && !btn.disabled ? btn : moved).focus({ preventScroll: true });
    }
  };

  const renderList = () => {
    const list = $("#itemList");
    const cat = $("#viewCat").value;
    const visible = base.items.filter((it) => cat === "all" || it.cat === cat);
    list.innerHTML = "";
    visible.forEach((it, idx) => {
      const li = el("li");
      const b = el("button", "tile");
      b.type = "button";
      b.dataset.id = it.id;
      b.setAttribute("aria-label", `Edytuj: ${it.title || CATS[it.cat]}`);
      if (it.color) b.style.backgroundColor = it.color;
      const thumb = mediaUrl(it.type === "video" ? it.poster : (it.thumb || it.src));
      if (thumb) {
        const img = el("img");
        img.alt = "";
        img.loading = "lazy";
        img.src = thumb;
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

      const moves = el("div", "tile__moves");
      [-1, 1].forEach((dir) => {
        const m = el("button", "tile__move");
        m.type = "button";
        m.dataset.dir = String(dir);
        m.innerHTML = arrow(dir);
        m.setAttribute("aria-label", dir < 0 ? "Przesuń wcześniej" : "Przesuń dalej");
        m.disabled = dir < 0 ? idx === 0 : idx === visible.length - 1;
        m.addEventListener("click", (e) => { e.stopPropagation(); moveBy(it.id, dir); });
        moves.appendChild(m);
      });
      li.appendChild(moves);
      list.appendChild(li);
    });
  };

  const renderAll = () => { renderStats(); renderList(); };
  $("#viewCat").addEventListener("change", renderList);

  /* ---------- edycja ---------- */
  const sheet = $("#editSheet");

  const openEdit = (id) => {
    const it = base.items.find((x) => x.id === id);
    if (!it) return;
    editingId = id;
    const media = $("#editMedia");
    media.innerHTML = "";
    if (it.type === "video") {
      const v = el("video");
      v.controls = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.preload = "metadata";
      v.poster = mediaUrl(it.poster);
      v.src = mediaUrl(it.src);
      media.appendChild(v);
    } else {
      const img = el("img");
      img.alt = "";
      img.src = mediaUrl(it.src);
      media.appendChild(img);
    }
    $("#editTitle").value = it.title || "";
    $("#editCat").value = it.cat;
    $("#editFeatured").checked = Boolean(it.featured);
    sheet.showModal();
  };

  const visibleIds = () => {
    const cat = $("#viewCat").value;
    return base.items.filter((it) => cat === "all" || it.cat === cat).map((x) => x.id);
  };

  $$("[data-move]", sheet).forEach((btn) => btn.addEventListener("click", async () => {
    const ids = visibleIds();
    const i = ids.indexOf(editingId);
    if (i < 0) return;
    const to = btn.dataset.move;
    let op = null;
    if (to === "top" && i > 0) op = { op: "move", id: editingId, beforeId: ids[0] };
    if (to === "up" && i > 0) op = { op: "move", id: editingId, beforeId: ids[i - 1] };
    if (to === "down" && i < ids.length - 1) op = { op: "move", id: editingId, afterId: ids[i + 1] };
    if (op) await save([op], "Kolejność zapisana");
  }));

  $("#editForm").addEventListener("submit", async () => {
    const it = base.items.find((x) => x.id === editingId);
    if (!it) return;
    const fields = {};
    const title = $("#editTitle").value.trim();
    if (title !== (it.title || "")) fields.title = title;
    if ($("#editCat").value !== it.cat) fields.cat = $("#editCat").value;
    if ($("#editFeatured").checked !== Boolean(it.featured)) fields.featured = $("#editFeatured").checked;
    if (Object.keys(fields).length) await save([{ op: "update", id: editingId, fields }], "Zapisano");
  });

  $("#editDelete").addEventListener("click", async () => {
    if (!confirm("Usunąć tę realizację ze strony?")) return;
    const it = base.items.find((x) => x.id === editingId);
    sheet.close();
    if (!it) return;
    await save([{ op: "delete", id: editingId }], "Usunięto");   // serwer usuwa też pliki
  });

  sheet.addEventListener("close", () => {
    const v = $("video", sheet);
    if (v) v.pause();
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
      title.placeholder = "Opis (nieobowiązkowy)";
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
    $("#publish").textContent = ok ? `Dodaj na stronę (${ok})` : "Dodaj na stronę";
  };

  $("#files").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    files.forEach((file) => {
      const kind = file.type.startsWith("video/") ? "video"
        : (file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) ? "image" : null;
      if (!kind) return;
      const d = { file, kind, url: URL.createObjectURL(file), cat: $("#bulkCat").value, title: "", featured: false, error: "" };
      if (kind === "video" && file.size > maxVideoMB * 1048576) {
        d.error = `Film ma ${mb(file.size)} MB, a limit to ${maxVideoMB} MB. Przytnij go albo nagraj krótszy.`;
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
    const items = [];
    try {
      for (let k = 0; k < todo.length; k++) {
        const d = todo[k];
        const no = `${k + 1} z ${todo.length}`;
        const id = newId();
        const title = d.title.trim();
        const step = (part, text) => setProgress((k + part) / todo.length, text);
        if (d.kind === "image") {
          step(0, `Przygotowuję zdjęcie ${no}…`);
          let img;
          try { img = await processImage(d.file); }
          catch (e) { throw Object.assign(new Error("decode"), { decode: true, name: d.file.name }); }
          const full = await uploadFile(img.full, `${id}.${IMG_EXT}`, "image", (p) => step(.1 + p * .7, `Wysyłam zdjęcie ${no}…`));
          const thumb = await uploadFile(img.thumb, `${id}-m.${IMG_EXT}`, "image", (p) => step(.8 + p * .2, `Wysyłam zdjęcie ${no}…`));
          items.push({
            id, type: "image", cat: d.cat, title, src: full, thumb,
            w: img.w, h: img.h, tw: img.tw, th: img.th, color: img.color,
            featured: d.featured, date: today(), bytes: img.full.size + img.thumb.size
          });
        } else {
          step(0, `Przygotowuję film ${no}…`);
          const meta = await processVideo(d.file);
          const vPath = await uploadFile(d.file, `${id}.${videoExt(d.file)}`, "video",
            (p) => step(.05 + p * .9, `Wysyłam film ${no} (${mb(d.file.size)} MB): ${Math.round(p * 100)}%`));
          const item = {
            id, type: "video", cat: d.cat, title, src: vPath,
            w: meta.w, h: meta.h, color: meta.color, duration: meta.duration,
            featured: d.featured, date: today(), bytes: d.file.size
          };
          if (meta.poster) {
            item.poster = await uploadFile(meta.poster, `${id}-poster.${IMG_EXT}`, "image");
            item.bytes += meta.poster.size;
          }
          items.push(item);
        }
      }
      setProgress(1, "Zapisuję…");
      base = await api("zapisz.php", { ops: [{ op: "add", items }] });
      renderAll();
      drafts.forEach((d) => URL.revokeObjectURL(d.url));
      drafts = drafts.filter((d) => d.error);
      setProgress(null);
      const imgs = items.filter((i) => i.type === "image").length;
      const vids = items.length - imgs;
      const what = [imgs ? `${imgs} ${plural(imgs, ["zdjęcie", "zdjęcia", "zdjęć"])}` : "", vids ? `${vids} ${plural(vids, ["film", "filmy", "filmów"])}` : ""].filter(Boolean).join(" i ");
      notice(`Gotowe! Dodano ${what}. Są już widoczne na stronie.`);
      renderDrafts();
    } catch (e) {
      setProgress(null);
      if (handleAuth(e)) return;
      if (e.decode) notice(`Nie udało się odczytać zdjęcia ${e.name}. Jeśli to zdjęcie w formacie HEIC, wybierz je jeszcze raz albo zapisz jako JPG.`, true);
      else notice(e.message || "Nie udało się zapisać. Spróbuj jeszcze raz.", true);
    } finally {
      $("#publish").disabled = false;
      $("#addLabel").style.pointerEvents = "";
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (drafts.some((d) => !d.error)) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- start ---------- */
  if (!API) notice("Brak adresu serwera w js/config.js.", true);
  if (getToken()) { showView("main"); loadItems(); }
  else showView("login");
})();
