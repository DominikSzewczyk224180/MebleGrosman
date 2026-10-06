/* Meble Grosman: interakcje strony */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  const plural = (n, forms) => {
    const n10 = n % 10, n100 = n % 100;
    if (n === 1) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  };

  const PLAY_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';

  /* ---------- Header ---------- */
  const top = $("#naglowek");
  const onScroll = () => top.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = $("#burger");
  const nav = $("#nav");
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Zamknij menu" : "Otwórz menu");
  };
  burger.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));

  // logo: płynny powrót na samą górę strony głównej (bez JS link po prostu ją przeładuje)
  $(".brand").addEventListener("click", (e) => {
    e.preventDefault();
    setMenu(false);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  });
  $$("a", nav).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // podświetlenie aktualnej sekcji w menu
  const navLinks = $$("a", nav);
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + en.target.id));
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => io.observe(s));
  }

  /* ---------- Hero: rysunek kuchni i kolory frontów ----------
     Rysowanie, montaż i LED to czyste CSS. Tu tylko wybór koloru frontów:
     po intro kolory zmieniają się same, dopóki ktoś nie kliknie próbki. */
  const kitchen = $("#kitchen");
  const frontName = $("#frontName");
  const swatchBox = $("#swatches");
  const fronts = [
    { name: "Kaszmir", front: "#D8CEC1", handle: "#1F1D1B", tone: "light" },
    { name: "Biały mat", front: "#F3F1EC", handle: "#1F1D1B", tone: "light" },
    { name: "Szary", front: "#A9ADAD", handle: "#1F1D1B", tone: "light" },
    { name: "Turkus", front: "#1F9A97", handle: "#ECE8E1", tone: "dark" },
    { name: "Czarny mat", front: "#2C2B2A", handle: "#B9B4AC", tone: "dark" }
  ];
  let frontIndex = 0;
  let autoTimer = null;
  let userPicked = false;
  let heroHover = false;
  let heroVisible = true;

  const setFront = (i) => {
    frontIndex = (i + fronts.length) % fronts.length;
    const f = fronts[frontIndex];
    kitchen.style.setProperty("--front", f.front);
    kitchen.style.setProperty("--handle", f.handle);
    kitchen.dataset.tone = f.tone;
    frontName.textContent = f.name;
    $$(".swatch", swatchBox).forEach((b, k) => b.setAttribute("aria-pressed", String(k === frontIndex)));
  };

  fronts.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.setProperty("--c", f.front);
    b.setAttribute("aria-label", `Fronty: ${f.name}`);
    b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", () => {
      userPicked = true;
      clearInterval(autoTimer);
      setFront(i);
    });
    swatchBox.appendChild(b);
  });
  setFront(0);

  // pokaz kolorów: startuje po zakończeniu rysowania, zatrzymuje się po kliknięciu
  if (!reduceMotion) {
    setTimeout(() => {
      if (userPicked) return;
      autoTimer = setInterval(() => {
        if (!userPicked && !heroHover && heroVisible && !document.hidden) setFront(frontIndex + 1);
      }, 3200);
    }, 4600);
  }
  const heroVisual = $(".hero__visual");
  heroVisual.addEventListener("mouseenter", () => { heroHover = true; });
  heroVisual.addEventListener("mouseleave", () => { heroHover = false; });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(kitchen);
  }

  /* ---------- Lightbox (galeria, posty z Facebooka, filmy) ---------- */
  const lightbox = (() => {
    const box = $("#lightbox");
    const img = $("#lbImg");
    const cap = $("#lbCap");
    const count = $("#lbCount");
    const link = $("#lbLink");
    const prev = $("#lbPrev");
    const next = $("#lbNext");
    const supported = typeof box.showModal === "function";
    let video = null;
    let items = [];
    let index = 0;
    let lastFocus = null;

    const stopVideo = () => {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.hidden = true;
    };

    const show = (i) => {
      index = (i + items.length) % items.length;
      const it = items[index];
      stopVideo();
      if (it.video) {
        if (!video) {
          video = document.createElement("video");
          video.controls = true;
          video.playsInline = true;
          video.setAttribute("playsinline", "");
          video.preload = "metadata";
          img.after(video);
        }
        img.hidden = true;
        video.hidden = false;
        video.poster = it.poster || "";
        video.src = it.video;
        video.play().catch(() => { /* przeglądarka czeka na kliknięcie play */ });
      } else {
        img.hidden = false;
        img.classList.toggle("is-square", Boolean(it.square));
        img.src = it.src;
        img.alt = it.alt || "";
        img.style.animation = "none";
        void img.offsetWidth;
        img.style.animation = "";
      }
      cap.textContent = it.caption || "";
      count.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : "";
      if (it.link) { link.href = it.link; link.hidden = false; } else { link.hidden = true; }
      const single = items.length < 2;
      prev.style.visibility = single ? "hidden" : "";
      next.style.visibility = single ? "hidden" : "";
      // wczytaj tylko sąsiednie zdjęcia, nie całą galerię
      [index + 1, index - 1].forEach((k) => {
        const n = items[(k + items.length) % items.length];
        if (n && n.src && !n.video) { const pre = new Image(); pre.src = n.src; }
      });
    };

    const open = (list, i = 0) => {
      if (!list.length) return;
      if (!supported) { window.open(list[i].video || list[i].src, "_blank", "noopener"); return; }
      items = list;
      lastFocus = document.activeElement;
      show(Math.max(0, i));
      box.showModal();
    };

    $("#lbClose").addEventListener("click", () => box.close());
    prev.addEventListener("click", () => show(index - 1));
    next.addEventListener("click", () => show(index + 1));
    box.addEventListener("close", () => { stopVideo(); if (lastFocus) lastFocus.focus(); });
    box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
    box.addEventListener("keydown", (e) => {
      if (items.length < 2) return;
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });

    let sx = null;
    box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (sx === null || items.length < 2) { sx = null; return; }
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50 && !(e.target instanceof HTMLVideoElement)) show(index + (dx < 0 ? 1 : -1));
      sx = null;
    });

    return { open };
  })();

  /* ---------- Realizacje: dane z data/realizacje.json (edytuje je panel) ----------
     Do strony trafia tylko pierwsza porcja kafelków, reszta po "Pokaż więcej".
     Kafelki mają małe miniatury, pełne zdjęcia i filmy ładują się dopiero w powiększeniu. */
  const CATS = { kuchnie: "Kuchnie", szafy: "Szafy i zabudowy", lazienki: "Łazienki", salon: "Salon", inne: "Inne" };
  const gallery = $("#gallery");
  const chips = $$(".chip");
  const moreWrap = $(".gallery__more");
  const moreBtn = $("#galleryMore");
  const PAGE_CELLS = 24;
  let realizacje = [];
  let filter = "all";
  let rendered = 0;

  const mediaPath = (p) => typeof p === "string" &&
    ((/^(img|video)\/[\w./-]+$/.test(p) && !p.includes("..")) || p.indexOf("blob:") === 0);
  const validItem = (it) => it && (it.type === "image" || it.type === "video") && CATS[it.cat] && mediaPath(it.src);
  const listFor = (f) => realizacje.filter((it) => f === "all" || it.cat === f);

  const setSources = (img, it, sizes) => {
    if (it.thumb && it.thumb !== it.src && it.tw && it.w && mediaPath(it.thumb)) {
      img.srcset = `${it.thumb} ${it.tw}w, ${it.src} ${it.w}w`;
      img.sizes = sizes;
    }
    img.src = it.type === "image" ? (it.thumb && mediaPath(it.thumb) ? it.thumb : it.src) : it.poster;
  };

  const lbItem = (it) => it.type === "video"
    ? { video: it.src, poster: mediaPath(it.poster) ? it.poster : "", caption: it.title || "", alt: it.title || "" }
    : { src: it.src, alt: it.title || "", caption: it.title || "", square: (it.w || 0) < 800 };

  const openFromGallery = (it) => {
    const list = listFor(filter);
    lightbox.open(list.map(lbItem), list.indexOf(it));
  };

  const tileFor = (it, wideIndex) => {
    const li = el("li");
    li.dataset.cat = it.cat;
    const wide = filter === "all" && it.featured;
    if (wide) {
      li.classList.add("g-wide");
      if (wideIndex % 2 === 1) li.classList.add("g-right");
    }
    const btn = el("button");
    btn.type = "button";
    if (typeof it.color === "string" && /^#[0-9a-f]{6}$/i.test(it.color)) btn.style.backgroundColor = it.color;
    const label = it.title || CATS[it.cat];
    btn.setAttribute("aria-label", (it.type === "video" ? "Odtwórz film: " : "Powiększ: ") + label);
    if (it.type === "image" || mediaPath(it.poster)) {
      const img = el("img", "is-loading");
      img.alt = label;
      img.loading = "lazy";
      img.decoding = "async";
      img.width = it.tw || it.w || 414;
      img.height = it.th || it.h || 414;
      img.addEventListener("load", () => img.classList.remove("is-loading"), { once: true });
      img.addEventListener("error", () => img.classList.remove("is-loading"), { once: true });
      setSources(img, it, wide ? "(max-width: 640px) 100vw, 600px" : "(max-width: 640px) 50vw, 300px");
      btn.appendChild(img);
    }
    if (it.type === "video") {
      const play = el("span", "g-play");
      const circle = el("span");
      circle.innerHTML = PLAY_SVG;
      play.appendChild(circle);
      btn.appendChild(play);
    }
    btn.addEventListener("click", () => openFromGallery(it));
    li.appendChild(btn);
    return li;
  };

  const renderNext = () => {
    const list = listFor(filter);
    let cells = 0;
    let wideCount = $$(".g-wide", gallery).length;
    const frag = document.createDocumentFragment();
    while (rendered < list.length) {
      const it = list[rendered];
      const c = filter === "all" && it.featured ? 4 : 1;
      // porcja kończy się na pełnym rzędzie (4 kolumny), żeby nie zostawały dziury
      const full = cells >= PAGE_CELLS && cells % 4 === 0;
      if (cells > 0 && (full || cells + c > PAGE_CELLS + 8)) break;
      frag.appendChild(tileFor(it, wideCount));
      if (c === 4) wideCount++;
      cells += c;
      rendered++;
    }
    gallery.appendChild(frag);
    const left = list.length - rendered;
    moreWrap.hidden = left <= 0;
    moreBtn.textContent = `Pokaż więcej realizacji (${left})`;
  };

  const renderGallery = () => {
    gallery.innerHTML = "";
    rendered = 0;
    gallery.classList.toggle("is-filtered", filter !== "all");
    gallery.classList.remove("is-filtering");
    void gallery.offsetWidth;
    gallery.classList.add("is-filtering");
    renderNext();
    gallery.removeAttribute("aria-busy");
  };

  const setFilter = (f) => {
    filter = f;
    chips.forEach((c) => {
      const on = c.dataset.filter === f;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    renderGallery();
  };

  chips.forEach((chip) => chip.addEventListener("click", () => setFilter(chip.dataset.filter)));
  moreBtn.addEventListener("click", () => {
    const first = rendered;
    renderNext();
    const btn = gallery.children[first] && gallery.children[first].querySelector("button");
    if (btn) btn.focus({ preventScroll: true });
  });

  /* ---------- Oferta: interaktywny plan mieszkania ---------- */
  const ROOMS = {
    kuchnia: {
      cat: "kuchnie", title: "Kuchnie na wymiar",
      desc: "Kuchnie projektujemy pod układ pomieszczenia i sposób, w jaki z niej korzystasz: w zabudowie, w kształcie litery L lub U, z wyspą albo półwyspem. Dobieramy fronty, blaty i oświetlenie, a zabudowę planujemy tak, by pomieściła sprzęt AGD i wszystko, czego potrzebujesz na co dzień."
    },
    salon: {
      cat: "salon", title: "Meble do salonu",
      desc: "Ściany RTV, witryny z podświetleniem i panele lamelowe, które porządkują przestrzeń i nadają wnętrzu charakter. Projektujemy je tak, by sprzęt i przewody zniknęły z widoku, a salon zyskał spójny, elegancki wygląd."
    },
    lazienka: {
      cat: "lazienki", title: "Meble łazienkowe",
      desc: "Szafki podumywalkowe, wysokie słupki i zabudowy stelaża WC z materiałów odpornych na wilgoć. Dopasowujemy je do każdej wnęki, także w niewielkich łazienkach, aby w pełni wykorzystać dostępne miejsce."
    },
    przedpokoj: {
      cat: "szafy", title: "Zabudowa przedpokoju", prefer: /przedpok/i,
      desc: "Szafy wnękowe, konsole i zabudowy na obuwie, zaprojektowane tak, by w ograniczonej przestrzeni zmieścić jak najwięcej. Wykorzystujemy pełną wysokość pomieszczenia, dzięki czemu przedpokój pozostaje uporządkowany na co dzień."
    },
    sypialnia: {
      cat: "szafy", title: "Szafy i garderoby", prefer: /sypial|szaf/i,
      desc: "Szafy od podłogi do sufitu, garderoby i zabudowy wokół łóżka. Wnętrze szafy planujemy indywidualnie, pod Twoje ubrania i sposób przechowywania, a fronty dobieramy tak, by współgrały z resztą wnętrza."
    },
    gabinet: {
      cat: "inne", title: "Biura i zabudowy schodów",
      desc: "Biurka, meble biurowe oraz zabudowy pod schodami z szufladami i półkami. Realizujemy także projekty nietypowe: przyjeżdżamy na pomiar, doradzamy i proponujemy rozwiązanie dopasowane do miejsca."
    }
  };

  const roomEls = $$(".room");
  const roomInfo = $("#roomInfo");
  const roomTitle = $("#roomTitle");
  const roomDesc = $("#roomDesc");
  const roomPhotos = $("#roomPhotos");
  const roomMore = $("#roomMore");
  let currentRoom = "kuchnia";

  const photosFor = (room) => {
    const r = ROOMS[room];
    const score = (it) => (r.prefer && r.prefer.test(it.title || "") ? 2 : 0) + (it.featured ? 1 : 0);
    return realizacje
      .filter((it) => it.cat === r.cat && it.type === "image")
      .map((it, i) => ({ it, i, s: score(it) }))
      .sort((x, y) => y.s - x.s || x.i - y.i)
      .map((x) => x.it);
  };

  const renderRoomPhotos = (room) => {
    const list = photosFor(room);
    const shown = list.slice(0, 3);
    roomPhotos.innerHTML = "";
    roomPhotos.dataset.n = String(shown.length);
    shown.forEach((it, k) => {
      const li = el("li");
      const b = el("button");
      b.type = "button";
      b.setAttribute("aria-label", "Powiększ zdjęcie: " + ROOMS[room].title);
      if (typeof it.color === "string" && /^#[0-9a-f]{6}$/i.test(it.color)) b.style.backgroundColor = it.color;
      const img = el("img", "is-loading");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("load", () => img.classList.remove("is-loading"), { once: true });
      img.addEventListener("error", () => img.classList.remove("is-loading"), { once: true });
      setSources(img, it, k === 0 && shown.length === 3 ? "(max-width: 980px) 62vw, 330px" : "(max-width: 980px) 46vw, 240px");
      b.appendChild(img);
      b.addEventListener("click", () => lightbox.open(list.map(lbItem), k));
      li.appendChild(b);
      roomPhotos.appendChild(li);
    });
    const n = realizacje.filter((it) => it.cat === ROOMS[room].cat).length;
    roomMore.textContent = n ? `Zobacz realizacje (${n})` : "Zobacz realizacje";
    roomMore.hidden = !n;
  };

  const selectRoom = (room) => {
    if (!ROOMS[room]) return;
    const changed = room !== currentRoom || !$(".room.is-active");
    currentRoom = room;
    roomEls.forEach((g) => {
      const on = g.dataset.room === room;
      g.classList.toggle("is-active", on);
      g.setAttribute("aria-pressed", String(on));
    });
    if (!changed) return;
    roomInfo.classList.add("is-changing");
    setTimeout(() => {
      roomTitle.textContent = ROOMS[room].title;
      roomDesc.textContent = ROOMS[room].desc;
      renderRoomPhotos(room);
      roomInfo.classList.remove("is-changing");
    }, reduceMotion ? 0 : 180);
  };

  roomEls.forEach((g) => {
    g.addEventListener("click", () => selectRoom(g.dataset.room));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectRoom(g.dataset.room); }
    });
  });
  roomMore.addEventListener("click", () => {
    setFilter(ROOMS[currentRoom].cat);
    $("#realizacje").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });

  // Gdy plan pojawia się pierwszy raz: pomieszczenia podświetlają się po kolei (widać, że da się klikać),
  // potem kuchnia "materializuje się" na oczach odwiedzającego.
  const planEl = $("#plan");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      if ($(".room.is-active")) return;
      const order = ["salon", "kuchnia", "lazienka", "przedpokoj", "sypialnia", "gabinet"];
      order.forEach((r, i) => setTimeout(() => {
        const g = $(`#room-${r}`);
        g.classList.add("is-hint");
        setTimeout(() => g.classList.remove("is-hint"), 420);
      }, 200 + i * 150));
      setTimeout(() => { if (!$(".room.is-active")) selectRoom("kuchnia"); }, 200 + order.length * 150 + 250);
    }, { threshold: .45 });
    io.observe(planEl);
  } else {
    roomEls.forEach((g) => {
      const on = g.dataset.room === currentRoom;
      g.classList.toggle("is-active", on);
      g.setAttribute("aria-pressed", String(on));
    });
  }

  /* ---------- Wczytanie realizacji ---------- */
  (async () => {
    try {
      const res = await fetch("data/realizacje.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      realizacje = (Array.isArray(data.items) ? data.items : []).filter(validItem);
    } catch (err) {
      realizacje = [];
    }
    // wersja pokazowa: zmiany z panelu zapisane na tym urządzeniu zastępują dane z serwera
    if (window.MGDemo && window.MGDemo.active()) {
      try {
        const local = await window.MGDemo.loadData();
        if (local && Array.isArray(local.items)) {
          const resolved = await window.MGDemo.resolve(local);
          realizacje = resolved.items.filter(validItem);
        }
      } catch (err) { /* zostają dane z serwera */ }
    }
    // liczby przy filtrach i ukrycie pustych kategorii
    chips.forEach((c) => {
      const f = c.dataset.filter;
      if (f === "all") return;
      const n = realizacje.filter((it) => it.cat === f).length;
      c.hidden = n === 0;
      let badge = $(".chip__n", c);
      if (!badge) { badge = el("span", "chip__n"); c.appendChild(badge); }
      badge.textContent = n;
    });
    renderGallery();
    renderRoomPhotos(currentRoom);
  })();

  /* ---------- Facebook: profil w telefonie ----------
     1) Jeśli data/facebook.json ma posty (GitHub Action + Graph API), rysujemy własny feed:
        szybki, w stylu strony i bez skryptów Facebooka.
     2) W przeciwnym razie od razu wczytujemy oficjalną wtyczkę strony Facebooka. */
  const PAGE_URL = "https://www.facebook.com/meblegrosman";
  const phoneContent = $("#phoneContent");

  const safeLink = (url) =>
    typeof url === "string" && /^https:\/\/(www\.|m\.|web\.)?facebook\.com\//.test(url) ? url : PAGE_URL;
  const safeSrc = (src) => typeof src === "string" && /^img\/fb\/[\w.-]+$/.test(src);

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return { label: "", full: "" };
    const now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    const full = d.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric"
    });
    let label = full;
    if (diff <= 0) label = "Dzisiaj";
    else if (diff === 1) label = "Wczoraj";
    else if (diff < 7) label = `${diff} dni temu`;
    return { label, full };
  };

  const avatar = (cls) => {
    const a = el("span", cls);
    const img = el("img");
    img.src = "img/logo-mark.png";
    img.alt = "";
    a.appendChild(img);
    return a;
  };

  const loadPlugin = () => {
    const w = Math.round(Math.min(500, Math.max(180, phoneContent.clientWidth || 338)));
    const h = Math.round(Math.max(400, phoneContent.clientHeight || 640));
    const f = document.createElement("iframe");
    f.title = "Profil Meble Grosman na Facebooku";
    f.loading = "lazy";
    f.setAttribute("scrolling", "no");
    f.setAttribute("allowfullscreen", "true");
    f.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share");
    f.src = "https://www.facebook.com/plugins/page.php?href=" + encodeURIComponent(PAGE_URL) +
      `&tabs=timeline&width=${w}&height=${h}&small_header=false&adapt_container_width=true` +
      "&hide_cover=false&show_facepile=true&locale=pl_PL";
    f.addEventListener("load", () => f.classList.add("is-loaded"), { once: true });
    phoneContent.appendChild(f);
    $("#fbHint").hidden = false;
  };

  const fbPost = (post) => {
    const article = el("article", "fbpost");
    const date = formatDate(post.date);
    const link = safeLink(post.link);
    const images = post.images.filter((im) => safeSrc(im.src));

    const head = el("header", "fbpost__head");
    head.appendChild(avatar("fbpost__avatar"));
    const who = el("div");
    who.appendChild(el("strong", null, "Meble Grosman"));
    const time = el("time", null, date.label);
    time.dateTime = post.date;
    who.appendChild(time);
    head.appendChild(who);
    article.appendChild(head);

    if (post.text) article.appendChild(el("p", "fbpost__text", post.text));

    const shown = post.video ? images.slice(0, 1) : images.slice(0, 4);
    const media = el(post.video ? "a" : "button", `fbpost__media fbpost__media--${shown.length}`);
    shown.forEach((im, k) => {
      const img = el("img");
      img.src = im.src;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (k === 0 && shown.length === 1 && im.w && im.h) {
        // pojedyncze zdjęcie w naturalnych proporcjach, ale w rozsądnych granicach
        const r = Math.min(1.25, Math.max(0.75, im.h / im.w));
        media.style.aspectRatio = `1 / ${r.toFixed(3)}`;
      }
      media.appendChild(img);
    });
    if (post.video) {
      media.href = link;
      media.target = "_blank";
      media.rel = "noopener";
      media.setAttribute("aria-label", `Obejrzyj film z ${date.full} na Facebooku`);
      const play = el("span", "fbpost__play");
      const circle = el("span");
      circle.innerHTML = PLAY_SVG;
      play.appendChild(circle);
      media.appendChild(play);
    } else {
      media.type = "button";
      media.setAttribute("aria-label", images.length > 1
        ? `Powiększ ${images.length} ${plural(images.length, ["zdjęcie", "zdjęcia", "zdjęć"])} z posta z ${date.full}`
        : `Powiększ zdjęcie z posta z ${date.full}`);
      if (images.length > 4) media.appendChild(el("span", "fbpost__extra", `+${images.length - 3}`));
      media.addEventListener("click", () => {
        lightbox.open(images.map((im, k) => ({
          src: im.src,
          alt: `Zdjęcie ${k + 1} z posta z ${date.full}`,
          caption: post.text || "",
          link
        })));
      });
    }
    article.appendChild(media);

    const a = el("a", "fbpost__link", post.video ? "Obejrzyj na Facebooku" : "Zobacz na Facebooku");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener";
    article.appendChild(a);
    return article;
  };

  const renderFeed = (posts) => {
    const feed = el("div", "fbfeed");
    feed.tabIndex = 0;
    feed.setAttribute("aria-label", "Ostatnie posty Meble Grosman z Facebooka");

    const head = el("div", "fbfeed__head");
    const cover = el("div", "fbfeed__cover");
    cover.style.backgroundImage = `url("${posts[0].images[0].src}")`;
    head.appendChild(cover);
    head.appendChild(avatar("fbfeed__avatar"));
    const name = el("div", "fbfeed__name");
    name.appendChild(el("strong", null, "Meble Grosman"));
    name.appendChild(el("span", null, "Producent mebli na wymiar, Pszów"));
    head.appendChild(name);
    const follow = el("a", "btn btn--small fbfeed__follow", "Obserwuj na Facebooku");
    follow.href = PAGE_URL;
    follow.target = "_blank";
    follow.rel = "noopener";
    head.appendChild(follow);
    feed.appendChild(head);

    posts.forEach((p) => feed.appendChild(fbPost(p)));

    const end = el("a", "fbfeed__end", "Zobacz wszystkie posty");
    end.href = PAGE_URL;
    end.target = "_blank";
    end.rel = "noopener";
    feed.appendChild(end);

    phoneContent.innerHTML = "";
    phoneContent.appendChild(feed);
  };

  (async () => {
    try {
      const res = await fetch("data/facebook.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const posts = (Array.isArray(data.posts) ? data.posts : [])
        .filter((p) => p && Array.isArray(p.images) && p.images.some((im) => safeSrc(im.src)))
        .slice(0, 12);
      if (!posts.length) throw new Error("brak postów");
      renderFeed(posts);
    } catch (err) {
      loadPlugin();
    }
  })();

  /* ---------- Instagram: 3 ostatnie posty, jeśli GitHub Action je pobrał ---------- */
  (async () => {
    const IG_URL = "https://www.instagram.com/meblenawymiar_dombezchemii/";
    const grid = $("#igGrid");
    try {
      const res = await fetch("data/instagram.json", { cache: "no-cache" });
      if (!res.ok) return;
      const data = await res.json();
      const posts = (Array.isArray(data.posts) ? data.posts : [])
        .filter((p) => p && typeof p.image === "string" && /^img\/ig\/[\w.-]+$/.test(p.image))
        .slice(0, 3);
      posts.forEach((p) => {
        const li = el("li");
        const a = el("a");
        a.href = typeof p.link === "string" && /^https:\/\/(www\.)?instagram\.com\//.test(p.link) ? p.link : IG_URL;
        a.target = "_blank";
        a.rel = "noopener";
        a.setAttribute("aria-label", "Post na Instagramie" + (p.date ? " z " + formatDate(p.date).full : ""));
        const img = el("img");
        img.src = p.image;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        a.appendChild(img);
        li.appendChild(a);
        grid.appendChild(li);
      });
      grid.hidden = posts.length === 0;
    } catch (err) { /* zostaje sama karta z linkiem */ }
  })();

  /* ---------- Godziny otwarcia ---------- */
  const hours = { 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [9, 17], 6: [9, 13], 0: null };
  const status = $("#openStatus");
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[get("weekday")];
    const now = parseInt(get("hour"), 10) + parseInt(get("minute"), 10) / 60;

    const row = $(`.hours__table tr[data-day="${day}"]`);
    if (row) row.classList.add("is-today");

    const today = hours[day];
    if (today && now >= today[0] && now < today[1]) {
      status.textContent = `Teraz otwarte, dziś do ${today[1]}:00`;
      status.classList.add("is-open");
    } else {
      // najbliższe otwarcie
      const names = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];
      let msg = "Teraz zamknięte";
      if (today && now < today[0]) {
        msg += `, otwieramy dziś o ${today[0]}:00`;
      } else {
        for (let k = 1; k <= 7; k++) {
          const d = (day + k) % 7;
          if (hours[d]) {
            msg += k === 1 ? `, otwieramy jutro o ${hours[d][0]}:00` : `, otwieramy ${names[d]} o ${hours[d][0]}:00`;
            break;
          }
        }
      }
      status.textContent = msg;
      status.classList.add("is-closed");
    }
  } catch (e) { /* zostaje nagłówek "Godziny otwarcia" */ }

  /* ---------- Pasek "Zadzwoń" na telefonie ---------- */
  const callbar = $(".callbar");
  const heroSection = $(".hero");
  const contact = $("#kontakt");
  if ("IntersectionObserver" in window) {
    let heroOut = false;
    let contactIn = false;
    const update = () => callbar.classList.toggle("is-visible", heroOut && !contactIn);
    new IntersectionObserver(([en]) => { heroOut = !en.isIntersecting; update(); }, { rootMargin: "-40% 0px 0px 0px" }).observe(heroSection);
    new IntersectionObserver(([en]) => { contactIn = en.isIntersecting; update(); }).observe(contact);
  } else {
    callbar.classList.add("is-visible");
  }

  /* ---------- Rok w stopce ---------- */
  $("#year").textContent = new Date().getFullYear();
})();
