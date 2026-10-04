/* Meble Grosman: interakcje strony */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header ---------- */
  const top = $("#top");
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

  /* ---------- Hero: zdjęcie z lameli ---------- */
  const slides = [
    { src: "img/kuchnia-czarna-dab.webp", caption: "Kuchnia: czarny mat i dąb", alt: "Kuchnia z czarnymi matowymi frontami i dębem" },
    { src: "img/kuchnia-lamele-dab.webp", caption: "Kuchnia: lamele, dąb i biel", alt: "Kuchnia z lamelowymi frontami i dębowym blatem" },
    { src: "img/salon-rtv.webp", caption: "Salon: ściana RTV z lamelami", alt: "Ściana RTV w salonie z białą szafką i lamelami" },
    { src: "img/lazienka-zabudowa.webp", caption: "Łazienka: dębowa zabudowa", alt: "Łazienka z dębową zabudową WC i regałami" },
    { src: "img/kuchnia-dab-polysk.webp", caption: "Kuchnia: dąb i biały połysk", alt: "Kuchnia w kształcie L z dębowymi szafkami" }
  ];

  const slatsEl = $("#slats");
  const captionEl = $("#slatsCaption");
  const dotsEl = $("#slatsDots");
  let current = 0;
  let timer = null;
  let paused = false;
  let visible = true;
  let n = 0;

  // wczytaj zdjęcia z wyprzedzeniem
  slides.forEach((s) => { const i = new Image(); i.src = s.src; });

  const slatCount = () => parseInt(getComputedStyle(slatsEl).getPropertyValue("--n"), 10) || 11;

  const makeFace = (i, src, entering) => {
    const face = document.createElement("div");
    face.className = "slat__face" + (entering ? " is-entering" : "");
    face.style.backgroundImage = `url("${src}")`;
    return face;
  };

  const buildSlats = (intro) => {
    n = slatCount();
    slatsEl.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const slat = document.createElement("div");
      slat.className = "slat";
      slat.style.setProperty("--i", i);
      slat.appendChild(makeFace(i, slides[current].src, false));
      slatsEl.appendChild(slat);
    }
    sizeSlats();
    if (intro && !reduceMotion) {
      slatsEl.classList.remove("is-settled");
      slatsEl.classList.add("is-intro");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        slatsEl.classList.add("is-ready");
        slatsEl.classList.remove("is-intro");
      }));
      // fugi ciemnieją, kiedy listwy są już prawie na miejscu
      setTimeout(() => slatsEl.classList.add("is-settled"), 650 + n * 55);
    } else {
      slatsEl.classList.add("is-settled");
    }
  };

  const sizeSlats = () => {
    slatsEl.style.setProperty("--cw", slatsEl.clientWidth + "px");
  };

  const updateMeta = () => {
    captionEl.textContent = slides[current].caption;
    slatsEl.setAttribute("aria-label", slides[current].alt);
    $$("button", dotsEl).forEach((b, i) => b.setAttribute("aria-current", String(i === current)));
  };

  const goTo = (index) => {
    if (index === current) return;
    current = (index + slides.length) % slides.length;
    const src = slides[current].src;
    $$(".slat", slatsEl).forEach((slat, i) => {
      const face = makeFace(i, src, !reduceMotion);
      slat.appendChild(face);
      const cleanup = () => {
        while (slat.children.length > 1) slat.removeChild(slat.firstChild);
        face.classList.remove("is-entering");
      };
      if (reduceMotion) cleanup();
      else face.addEventListener("animationend", cleanup, { once: true });
    });
    updateMeta();
  };

  slides.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Pokaż zdjęcie ${i + 1} z ${slides.length}: ${s.caption}`);
    b.addEventListener("click", () => { goTo(i); restart(); });
    dotsEl.appendChild(b);
  });

  const tick = () => { if (!paused && visible && !document.hidden) goTo(current + 1); };
  const restart = () => {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(tick, 5200);
  };

  buildSlats(true);
  updateMeta();
  restart();

  const hero = $(".hero__visual");
  hero.addEventListener("mouseenter", () => { paused = true; });
  hero.addEventListener("mouseleave", () => { paused = false; });
  hero.addEventListener("focusin", () => { paused = true; });
  hero.addEventListener("focusout", () => { paused = false; });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(slatsEl);
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (slatCount() !== n) {
        slatsEl.classList.remove("is-intro", "is-ready");
        buildSlats(false);
      } else {
        sizeSlats();
      }
    }).observe(slatsEl);
  } else {
    window.addEventListener("resize", sizeSlats);
  }

  /* ---------- Oferta ---------- */
  const offerItems = $$(".offer__item");
  const preview = $("#offerPreview");
  const canHover = window.matchMedia("(hover: hover)").matches;
  let swapTimer = null;

  const activate = (item) => {
    if (item.classList.contains("is-active")) return;
    offerItems.forEach((o) => {
      o.classList.toggle("is-active", o === item);
      o.setAttribute("aria-expanded", String(o === item));
    });
    const src = item.dataset.img;
    if (reduceMotion) { preview.src = src; return; }
    preview.classList.add("is-fading");
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      preview.src = src;
      const show = () => preview.classList.remove("is-fading");
      if (preview.complete) show(); else preview.onload = show;
    }, 180);
  };

  offerItems.forEach((item) => {
    item.setAttribute("aria-expanded", String(item.classList.contains("is-active")));
    item.addEventListener("click", () => activate(item));
    if (canHover) item.addEventListener("mouseenter", () => activate(item));
    const i = new Image(); i.src = item.dataset.img;
  });

  /* ---------- Realizacje: filtry ---------- */
  const gallery = $("#gallery");
  const tiles = $$("li", gallery);
  const chips = $$(".chip");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-pressed", String(on));
      });
      gallery.classList.remove("is-filtering");
      void gallery.offsetWidth;
      tiles.forEach((t) => { t.hidden = !(f === "all" || t.dataset.cat === f); });
      gallery.classList.toggle("is-filtered", f !== "all");
      gallery.classList.add("is-filtering");
    });
  });

  /* ---------- Lightbox (wspólny dla galerii i postów z Facebooka) ---------- */
  const lightbox = (() => {
    const box = $("#lightbox");
    const img = $("#lbImg");
    const cap = $("#lbCap");
    const count = $("#lbCount");
    const link = $("#lbLink");
    const prev = $("#lbPrev");
    const next = $("#lbNext");
    const supported = typeof box.showModal === "function";
    let items = [];
    let index = 0;
    let lastFocus = null;

    const show = (i) => {
      index = (i + items.length) % items.length;
      const it = items[index];
      img.classList.toggle("is-square", Boolean(it.square));
      img.src = it.src;
      img.alt = it.alt || "";
      cap.textContent = it.caption || "";
      count.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : "";
      if (it.link) {
        link.href = it.link;
        link.hidden = false;
      } else {
        link.hidden = true;
      }
      const single = items.length < 2;
      prev.style.visibility = single ? "hidden" : "";
      next.style.visibility = single ? "hidden" : "";
      img.style.animation = "none";
      void img.offsetWidth;
      img.style.animation = "";
      // wczytaj sąsiednie zdjęcia, żeby przewijanie było płynne
      [index + 1, index - 1].forEach((k) => {
        const n = items[(k + items.length) % items.length];
        if (n) { const pre = new Image(); pre.src = n.src; }
      });
    };

    const open = (list, i = 0) => {
      if (!list.length) return;
      if (!supported) { window.open(list[i].src, "_blank", "noopener"); return; }
      items = list;
      lastFocus = document.activeElement;
      show(i);
      box.showModal();
    };

    $("#lbClose").addEventListener("click", () => box.close());
    prev.addEventListener("click", () => show(index - 1));
    next.addEventListener("click", () => show(index + 1));
    box.addEventListener("close", () => { if (lastFocus) lastFocus.focus(); });
    box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
    box.addEventListener("keydown", (e) => {
      if (items.length < 2) return;
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });

    // przesuwanie palcem
    let sx = null;
    box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (sx === null || items.length < 2) { sx = null; return; }
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      sx = null;
    });

    return { open };
  })();

  // galeria realizacji
  const visibleTiles = () => tiles.filter((t) => !t.hidden);
  tiles.forEach((t) => {
    const btn = $("button", t);
    const pic = $("img", t);
    btn.setAttribute("aria-label", "Powiększ: " + pic.alt);
    btn.addEventListener("click", () => {
      const list = visibleTiles();
      lightbox.open(
        list.map((li) => {
          const im = $("img", li);
          return { src: im.currentSrc || im.src, alt: im.alt, caption: im.alt, square: true };
        }),
        list.indexOf(t)
      );
    });
  });

  /* ---------- Facebook: najnowsze posty ----------
     Posty pobiera GitHub Action (scripts/fetch_facebook.py) przez Graph API
     i zapisuje do data/facebook.json oraz img/fb/. Token nie trafia do przeglądarki.
     Gdy postów jeszcze nie ma, pokazujemy okno Facebooka wczytywane po kliknięciu. */
  const PAGE_URL = "https://www.facebook.com/meblegrosman";
  const rail = $("#feedRail");
  const feedFallback = $("#feedFallback");
  const feedArrows = $("#feedArrows");
  const feedPrev = $("#feedPrev");
  const feedNext = $("#feedNext");

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

  const playIcon = () => {
    const wrap = el("span", "post__play");
    const circle = el("span");
    circle.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
    wrap.appendChild(circle);
    return wrap;
  };

  const postItem = (post, i) => {
    const li = el("li", "post");
    const date = formatDate(post.date);
    const link = safeLink(post.link);
    const images = post.images.filter((im) => safeSrc(im.src));
    const first = images[0];

    const media = el(post.video ? "a" : "button", "post__media");
    if (post.video) {
      media.href = link;
      media.target = "_blank";
      media.rel = "noopener";
      media.setAttribute("aria-label", `Obejrzyj film z ${date.full} na Facebooku`);
    } else {
      media.type = "button";
      media.setAttribute("aria-label", images.length > 1
        ? `Powiększ ${images.length} ${plural(images.length, ["zdjęcie", "zdjęcia", "zdjęć"])} z posta z ${date.full}`
        : `Powiększ zdjęcie z posta z ${date.full}`);
      media.addEventListener("click", () => {
        lightbox.open(images.map((im, k) => ({
          src: im.src,
          alt: `Zdjęcie ${k + 1} z posta z ${date.full}`,
          caption: post.text || "",
          link
        })));
      });
    }

    const img = el("img", "is-loading");
    img.alt = "";
    img.decoding = "async";
    img.loading = i < 4 ? "eager" : "lazy";
    if (first.w && first.h) { img.width = first.w; img.height = first.h; }
    img.addEventListener("load", () => img.classList.remove("is-loading"), { once: true });
    img.addEventListener("error", () => img.classList.remove("is-loading"), { once: true });
    img.src = first.src;
    media.appendChild(img);

    if (post.video) {
      media.appendChild(playIcon());
    } else if (images.length > 1) {
      media.appendChild(el("span", "post__badge", `${images.length} ${plural(images.length, ["zdjęcie", "zdjęcia", "zdjęć"])}`));
    }
    li.appendChild(media);

    const body = el("div", "post__body");
    const time = el("time", "post__date", date.label);
    time.dateTime = post.date;
    if (date.label !== date.full) time.title = date.full;
    body.appendChild(time);
    if (post.text) body.appendChild(el("p", "post__text", post.text));
    const a = el("a", "post__link", post.video ? "Obejrzyj na Facebooku" : "Zobacz na Facebooku");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener";
    body.appendChild(a);
    li.appendChild(body);
    return li;
  };

  const moreItem = () => {
    const li = el("li", "post post--more");
    const a = el("a");
    a.href = PAGE_URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.appendChild(el("strong", null, "Więcej realizacji znajdziesz na naszym Facebooku"));
    a.appendChild(el("span", null, "facebook.com/meblegrosman"));
    li.appendChild(a);
    return li;
  };

  const updateArrows = () => {
    const overflow = rail.scrollWidth > rail.clientWidth + 8;
    feedArrows.hidden = !overflow;
    feedPrev.disabled = rail.scrollLeft < 8;
    feedNext.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8;
  };

  const renderFeed = (posts) => {
    rail.innerHTML = "";
    posts.forEach((p, i) => rail.appendChild(postItem(p, i)));
    rail.appendChild(moreItem());
    rail.removeAttribute("aria-busy");
    rail.tabIndex = 0;
    feedFallback.classList.remove("is-shown");
    updateArrows();
    rail.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    const scrollStep = () => {
      const card = $(".post", rail);
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 16;
      const w = card ? card.offsetWidth + gap : 300;
      return Math.max(1, Math.floor((rail.clientWidth * 0.8) / w)) * w;
    };
    const smooth = reduceMotion ? "auto" : "smooth";
    feedPrev.addEventListener("click", () => rail.scrollBy({ left: -scrollStep(), behavior: smooth }));
    feedNext.addEventListener("click", () => rail.scrollBy({ left: scrollStep(), behavior: smooth }));
  };

  const showFallback = () => {
    rail.hidden = true;
    rail.removeAttribute("aria-busy");
    feedArrows.hidden = true;
    feedFallback.classList.add("is-shown");
  };

  const loadFeed = async () => {
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
      showFallback();
    }
  };

  // wczytaj posty, gdy sekcja zbliża się do ekranu
  if ("IntersectionObserver" in window) {
    const feedObs = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { feedObs.disconnect(); loadFeed(); }
    }, { rootMargin: "600px 0px" });
    feedObs.observe(rail);
  } else {
    loadFeed();
  }

  // okno Facebooka (wtyczka strony), wczytywane dopiero po kliknięciu
  const fbLoad = $("#fbLoad");
  const fbEmbed = $("#fbEmbed");
  fbLoad.addEventListener("click", () => {
    const w = Math.round(Math.min(500, Math.max(280, fbEmbed.clientWidth)));
    const h = window.innerWidth < 640 ? 560 : 640;
    const src = "https://www.facebook.com/plugins/page.php?href=" +
      encodeURIComponent(PAGE_URL) +
      `&tabs=timeline&width=${w}&height=${h}&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false&locale=pl_PL`;
    const f = document.createElement("iframe");
    f.src = src;
    f.title = "Ostatnie posty Meble Grosman na Facebooku";
    f.setAttribute("allow", "encrypted-media; clipboard-write");
    fbEmbed.innerHTML = "";
    fbEmbed.appendChild(f);
    fbEmbed.classList.add("is-loaded");
  });

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
