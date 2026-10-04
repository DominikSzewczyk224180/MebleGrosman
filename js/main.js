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
      slatsEl.classList.add("is-intro");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        slatsEl.classList.add("is-ready");
        slatsEl.classList.remove("is-intro");
      }));
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

  /* ---------- Lightbox ---------- */
  const lb = $("#lightbox");
  const lbImg = $("#lbImg");
  const lbCap = $("#lbCap");
  let lbIndex = 0;
  let lastFocus = null;

  const visibleTiles = () => tiles.filter((t) => !t.hidden);

  const showLb = (i) => {
    const list = visibleTiles();
    lbIndex = (i + list.length) % list.length;
    const img = $("img", list[lbIndex]);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = img.alt;
    lbImg.style.animation = "none";
    void lbImg.offsetWidth;
    lbImg.style.animation = "";
  };

  const supportsDialog = typeof lb.showModal === "function";

  tiles.forEach((t) => {
    $("button", t).setAttribute("aria-label", "Powiększ: " + $("img", t).alt);
    $("button", t).addEventListener("click", () => {
      if (!supportsDialog) { window.open($("img", t).src, "_blank"); return; }
      lastFocus = document.activeElement;
      showLb(visibleTiles().indexOf(t));
      lb.showModal();
    });
  });

  const closeLb = () => lb.close();
  $("#lbClose").addEventListener("click", closeLb);
  $("#lbPrev").addEventListener("click", () => showLb(lbIndex - 1));
  $("#lbNext").addEventListener("click", () => showLb(lbIndex + 1));
  lb.addEventListener("close", () => { if (lastFocus) lastFocus.focus(); });
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") showLb(lbIndex - 1);
    if (e.key === "ArrowRight") showLb(lbIndex + 1);
  });

  // przesuwanie palcem
  let sx = null;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) showLb(lbIndex + (dx < 0 ? 1 : -1));
    sx = null;
  });

  /* ---------- Facebook: posty ładowane dopiero na życzenie ---------- */
  const fbBtn = $("#fbLoad");
  const fbEmbed = $("#fbEmbed");
  fbBtn.addEventListener("click", () => {
    if (!fbEmbed.hidden) {
      fbEmbed.hidden = true;
      fbBtn.textContent = "Pokaż ostatnie posty";
      return;
    }
    if (!fbEmbed.firstChild) {
      const w = Math.min(500, Math.max(280, fbEmbed.clientWidth || gallery.clientWidth));
      const src = "https://www.facebook.com/plugins/page.php?href=" +
        encodeURIComponent("https://www.facebook.com/meblegrosman") +
        `&tabs=timeline&width=${w}&height=620&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false&locale=pl_PL`;
      const f = document.createElement("iframe");
      f.src = src;
      f.title = "Ostatnie posty Meble Grosman na Facebooku";
      f.loading = "lazy";
      f.setAttribute("allow", "encrypted-media");
      fbEmbed.appendChild(f);
    }
    fbEmbed.hidden = false;
    fbBtn.textContent = "Ukryj posty";
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
