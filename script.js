(function () {
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  const topbar = document.querySelector(".topbar");
  const navToggle = document.querySelector(".nav-toggle");
  const navClose = document.querySelector(".nav-close");
  const navLinks = document.querySelectorAll(".nav-links a");

  if (!header && !footer && !topbar) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let ticking = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function resetParallax() {
    if (header) {
      header.style.setProperty("--sky-y", "0px");
      header.style.setProperty("--hero-y", "0px");
    }

    if (footer) {
      footer.style.setProperty("--footer-y", "0px");
    }
  }

  function updateParallax() {
    ticking = false;

    if (topbar) {
      topbar.classList.toggle("topbar--scrolled", window.scrollY > 60);
    }

    if (reducedMotion.matches) {
      resetParallax();
      return;
    }

    if (header) {
      const rect = header.getBoundingClientRect();
      const progress = clamp(-rect.top / rect.height, 0, 1);
      const skyOffset = progress * 132;
      const heroOffset = progress * -72;

      header.style.setProperty("--sky-y", `${skyOffset.toFixed(2)}px`);
      header.style.setProperty("--hero-y", `${heroOffset.toFixed(2)}px`);
    }

    if (footer) {
      const rect = footer.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const progress = clamp((viewportHeight - rect.top) / rect.height, 0, 1);
      const footerOffset = (1 - progress) * 48;

      footer.style.setProperty("--footer-y", `${footerOffset.toFixed(2)}px`);
    }
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateParallax);
    }
  }

  function setNavOpen(isOpen) {
    if (!topbar || !navToggle) {
      return;
    }

    topbar.classList.toggle("nav-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );
  }

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      setNavOpen(!topbar.classList.contains("nav-open"));
    });
  }

  if (navClose) {
    navClose.addEventListener("click", () => {
      setNavOpen(false);
      navToggle.focus();
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setNavOpen(false);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setNavOpen(false);
    }
  });

  reducedMotion.addEventListener("change", requestUpdate);
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  requestUpdate();
})();

// ── Expanding project modal ──
(function () {
  const modal = document.getElementById("project-scroll-modal");
  const triggers = document.querySelectorAll("[data-scroll-modal]");

  if (!modal || !triggers.length) {
    return;
  }

  const content = modal.querySelector(".sm-content");
  const deckHost = modal.querySelector(".sm-deck-host");
  const closeButton = modal.querySelector(".sm-close-btn");
  const deckTemplate = document.getElementById("pet-insurance-case-study-template");
  const caseStudyUrl = new URL("pet-insurance-case-study/index.html", document.baseURI);
  const caseStudyStylesUrl = new URL("pet-insurance-case-study/styles.css", document.baseURI);
  const modalGapRatio = 0.22;
  const modalTransitionDuration = 600;
  const deckWheelThreshold = 90;
  const deckSlideCooldown = 800;
  const deckExpansionSettleDuration = 600;
  let animationFrame;
  let deckApi;
  let deckLoadPromise;
  let deckInputUnlockAt = 0;
  let modalCollapseUnlockAt = 0;
  let expansionUnlocked = false;
  let lastTrigger;

  function updateScrollModalStyles() {
    const maxScrollThreshold = window.innerHeight * modalGapRatio;
    const maxScrollableDistance = Math.max(0, modal.scrollHeight - modal.clientHeight);
    const fullScreenThreshold = Math.min(maxScrollThreshold, maxScrollableDistance);
    const rawProgress =
      fullScreenThreshold > 0
        ? Math.min(1, Math.max(0, modal.scrollTop / fullScreenThreshold))
        : 0;
    const isAtScrollEnd =
      fullScreenThreshold > 0 && modal.scrollTop >= maxScrollableDistance - 1;
    const isExpanded = isAtScrollEnd || rawProgress >= 0.999;
    const progress = isExpanded ? 1 : rawProgress;
    const currentShrink = 2 - 2 * progress;
    const currentRadius = 30 - 30 * progress;
    const becameExpanded = isExpanded && !modal.classList.contains("is-expanded");

    content.style.setProperty("--shrink-x", currentShrink);
    content.style.setProperty("--radius", `${currentRadius}px`);
    modal.classList.toggle("is-expanded", isExpanded);
    document.body.classList.toggle("sm-modal-expanded", isExpanded);

    if (becameExpanded) {
      deckInputUnlockAt = window.performance.now() + deckExpansionSettleDuration;
      modalCollapseUnlockAt = 0;
      deckApi?.resetWheel();
    }
  }

  function requestStyleUpdate() {
    if (animationFrame) {
      return;
    }

    animationFrame = window.requestAnimationFrame(() => {
      updateScrollModalStyles();
      animationFrame = undefined;
    });
  }

  function initializeDeck(deckRoot) {
    const main = deckRoot.querySelector("main");
    const sections = Array.from(main.querySelectorAll(":scope > section"));
    const counter = deckRoot.querySelector("#counter");
    const previousButton = deckRoot.querySelector("#prev-slide");
    const nextButton = deckRoot.querySelector("#next-slide");
    const heartLayer = deckRoot.querySelector(".shared-heart");
    const heartArtifact = heartLayer.querySelector(".long-artifact");
    const consentLayer = deckRoot.querySelector(".shared-consent");
    const consentArtifact = consentLayer.querySelector(".long-artifact");
    let current = 0;
    let wheelLocked = false;
    let wheelRemainder = 0;
    let touchStartY = 0;

    function resetArtifact(layer, artifact) {
      layer.classList.remove("is-visible");
      layer.removeAttribute("data-step");
      artifact.style.width = "";
      artifact.style.setProperty("--artifact-x", "0px");
      artifact.style.setProperty("--artifact-y", "0px");
      artifact.style.setProperty("--artifact-scale", "1");
    }

    function positionArtifact(layer, artifact, stepIndex, stepCount, options = {}) {
      const artifactHeight = artifact.offsetHeight;
      const visibleHeight = deckRoot.clientHeight;
      const scale = options.zoomFirstStep && stepIndex === 0 ? 1 : 1 / 1.34;
      const maxOffset = Math.max(0, artifactHeight * scale - visibleHeight);
      const progress = stepCount <= 1 ? 0 : stepIndex / (stepCount - 1);
      const offset = -maxOffset * progress;
      const xOffset =
        options.zoomFirstStep && stepIndex === 0
          ? Math.max(0, deckRoot.clientWidth * 0.25 - artifact.offsetWidth * scale * 0.224)
          : 0;

      layer.classList.add("is-visible");
      layer.dataset.step = String(stepIndex);
      artifact.style.setProperty("--artifact-x", `${xOffset}px`);
      artifact.style.setProperty("--artifact-y", `${offset}px`);
      artifact.style.setProperty("--artifact-scale", String(scale));
    }

    function updateArtifacts(section) {
      const heartStep = section.className.match(/\bheart-frame-(\d)\b/);
      const consentStep = section.className.match(/\bconsent-frame-(\d)\b/);

      if (heartStep) {
        positionArtifact(heartLayer, heartArtifact, Number(heartStep[1]) - 1, 3, {
          zoomFirstStep: true,
        });
      } else {
        resetArtifact(heartLayer, heartArtifact);
      }

      if (consentStep) {
        positionArtifact(consentLayer, consentArtifact, Number(consentStep[1]) - 1, 2);
      } else {
        resetArtifact(consentLayer, consentArtifact);
      }
    }

    function goTo(index) {
      if (index < 0 || index >= sections.length) {
        return;
      }

      current = index;
      deckRoot.dataset.slide = String(current + 1);
      updateArtifacts(sections[current]);
      deckHost.scrollTop = 0;
      main.style.transform = `translateY(${-deckRoot.clientHeight * current}px)`;
      counter.textContent = `${current + 1} / ${sections.length}`;
      previousButton.disabled = current === 0;
      nextButton.disabled = current === sections.length - 1;
    }

    function moveBy(amount) {
      goTo(current + amount);
    }

    function handleWheel(deltaY) {
      if (wheelLocked) {
        return false;
      }

      wheelRemainder += deltaY;
      if (Math.abs(wheelRemainder) < deckWheelThreshold) {
        return false;
      }

      const previousSlide = current;
      moveBy(wheelRemainder > 0 ? 1 : -1);
      wheelRemainder = 0;
      wheelLocked = true;

      window.setTimeout(() => {
        wheelLocked = false;
      }, deckSlideCooldown);

      return current !== previousSlide;
    }

    function resetWheel() {
      wheelLocked = false;
      wheelRemainder = 0;
    }

    function isAtFirstSlide() {
      return current === 0;
    }

    deckRoot.addEventListener(
      "touchstart",
      (event) => {
        touchStartY = event.touches[0]?.clientY || 0;
      },
      { passive: true }
    );

    deckRoot.addEventListener(
      "touchend",
      (event) => {
        const deltaY = touchStartY - (event.changedTouches[0]?.clientY || touchStartY);
        if (Math.abs(deltaY) >= 40) {
          moveBy(deltaY > 0 ? 1 : -1);
        }
      },
      { passive: true }
    );

    previousButton.addEventListener("click", () => moveBy(-1));
    nextButton.addEventListener("click", () => moveBy(1));
    window.addEventListener("resize", () => goTo(current));
    goTo(0);

    return {
      goTo,
      moveBy,
      handleWheel,
      resetWheel,
      isAtFirstSlide,
      refresh: () => goTo(current),
    };
  }

  function ensureDeck() {
    if (deckApi) {
      return Promise.resolve(deckApi);
    }

    if (deckLoadPromise) {
      return deckLoadPromise;
    }

    if (!deckTemplate) {
      return Promise.reject(new Error("Case study template is missing."));
    }

    const shadowRoot = deckHost.attachShadow({ mode: "open" });
    const deckStyles = document.createElement("link");
    const deckBaseStyles = document.createElement("style");
    const deckRoot = document.createElement("div");
    const deckContent = deckTemplate.content.cloneNode(true);

    deckStyles.rel = "stylesheet";
    deckStyles.href = caseStudyStylesUrl.href;
    deckRoot.className = "case-study-deck";
    deckBaseStyles.textContent = `
      :host {
        --surface-brand: #135ee2;
        --fill-secondary: #537091;
        --surface-secondary: #e4eaf0;
        --text-primary: #0a285c;
        --bg: var(--surface-secondary);
        --bg-soft: var(--surface-secondary);
        --paper: #ffffff;
        --ink: #151719;
        --ink-soft: #343a40;
        --muted: #5e6872;
        --muted-strong: #46505a;
        --quiet: #e8ecef;
        --line: #d5dbe0;
        --line-strong: #9aa4ad;
        --shadow: 0 18px 50px rgba(21, 23, 25, 0.09);
        --shadow-soft: 0 10px 30px rgba(21, 23, 25, 0.07);
        --radius: 8px;
        --radius-lg: 12px;
        --max-wide: 1120px;
        --max-reading: 760px;
        --space-1: 8px;
        --space-2: 16px;
        --space-3: 24px;
        --space-4: 32px;
        --space-5: 40px;
        --space-6: 48px;
        --space-8: 64px;
        --space-10: 80px;
        --space-12: 96px;
        --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
        display: block;
        height: 100%;
        overflow: hidden;
      }

      .case-study-deck {
        background: var(--bg);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 16px;
        font-weight: 400;
        height: 100%;
        letter-spacing: 0;
        line-height: 1.6;
        overflow: hidden;
        position: relative;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }

      .case-study-deck main {
        transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform;
      }
    `;

    deckContent.querySelectorAll("[src]").forEach((asset) => {
      asset.src = new URL(asset.getAttribute("src"), caseStudyUrl).href;
    });

    deckRoot.append(deckContent);
    shadowRoot.append(deckStyles, deckBaseStyles, deckRoot);
    deckApi = initializeDeck(deckRoot);
    deckStyles.addEventListener("load", () => deckApi?.refresh(), { once: true });
    deckLoadPromise = Promise.resolve(deckApi);

    return deckLoadPromise;
  }

  function openScrollModal(trigger) {
    lastTrigger = trigger;
    expansionUnlocked = false;
    deckInputUnlockAt = 0;
    modalCollapseUnlockAt = 0;
    modal.scrollTop = 0;
    modal.classList.remove("is-expanded");
    document.body.classList.remove("sm-modal-expanded");
    updateScrollModalStyles();
    ensureDeck();
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("sm-modal-open");
  }

  function closeScrollModal() {
    if (!modal.classList.contains("active")) {
      return;
    }

    modal.classList.remove("active", "is-expanded");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sm-modal-open");
    document.body.classList.remove("sm-modal-expanded");
    expansionUnlocked = false;
    deckInputUnlockAt = 0;
    modalCollapseUnlockAt = 0;
    deckApi?.goTo(0);

    window.setTimeout(() => {
      if (!modal.classList.contains("active")) {
        modal.scrollTop = 0;
        updateScrollModalStyles();
      }
    }, modalTransitionDuration);

    if (lastTrigger) {
      lastTrigger.focus({ preventScroll: true });
    }
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      openScrollModal(trigger);
    });
  });

  closeButton.addEventListener("click", closeScrollModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeScrollModal();
    }
  });

  function unlockExpansion() {
    expansionUnlocked = true;
  }

  modal.addEventListener(
    "wheel",
    (event) => {
      if (modal.classList.contains("is-expanded") && deckApi) {
        if (event.deltaY < 0 && deckApi.isAtFirstSlide()) {
          if (window.performance.now() < modalCollapseUnlockAt) {
            if (event.cancelable) {
              event.preventDefault();
            }

            deckApi.resetWheel();
            return;
          }

          deckApi.resetWheel();
          unlockExpansion();
          return;
        }

        if (event.cancelable) {
          event.preventDefault();
        }

        if (window.performance.now() < deckInputUnlockAt) {
          deckApi.resetWheel();
          return;
        }

        const changedSlide = deckApi.handleWheel(event.deltaY);
        if (changedSlide && deckApi.isAtFirstSlide()) {
          modalCollapseUnlockAt = window.performance.now() + deckSlideCooldown;
        }

        return;
      }

      unlockExpansion();
    },
    { passive: false }
  );
  modal.addEventListener("touchstart", unlockExpansion, { passive: true });
  modal.addEventListener("pointerdown", unlockExpansion, { passive: true });
  modal.addEventListener(
    "scroll",
    () => {
      if (!expansionUnlocked) {
        modal.scrollTop = 0;
        updateScrollModalStyles();
        return;
      }

      requestStyleUpdate();
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    if (modal.classList.contains("active")) {
      updateScrollModalStyles();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("active")) {
      closeScrollModal();
    }

    if (!modal.classList.contains("active")) {
      return;
    }

    const forwardKeys = ["ArrowRight", "ArrowDown", "PageDown"];
    const backKeys = ["ArrowLeft", "ArrowUp", "PageUp"];

    if (modal.classList.contains("is-expanded") && deckApi) {
      if (forwardKeys.includes(event.key)) {
        event.preventDefault();
        deckApi.moveBy(1);
      }

      if (backKeys.includes(event.key)) {
        event.preventDefault();
        deckApi.moveBy(-1);
      }
    } else if (["ArrowDown", "PageDown", " ", "End"].includes(event.key)) {
      unlockExpansion();
    }
  });

  ensureDeck();
})();

// ── Duolingo stats ──
(function () {
  const streakElement = document.querySelector("[data-duolingo-streak]");
  const xpElement = document.querySelector("[data-duolingo-xp]");
  const heatmapElement = document.querySelector("[data-duolingo-heatmap]");

  if (!streakElement && !xpElement && !heatmapElement) {
    return;
  }

  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  });
  const heatmapDayCount = 15;
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  });

  function normalizeHeatmapEntry(entry) {
    const xp = Number(entry && entry.xp);

    if (!entry || typeof entry.date !== "string" || !Number.isFinite(xp)) {
      return null;
    }

    const dateParts = entry.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!dateParts) {
      return null;
    }

    const [, year, month, day] = dateParts;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);

    return {
      date,
      xp: Math.max(0, xp)
    };
  }

  function getHeatmapEntries(heatmap) {
    if (Array.isArray(heatmap)) {
      return heatmap;
    }

    if (heatmap && typeof heatmap === "object") {
      return Object.entries(heatmap).map(([date, xp]) => ({ date, xp }));
    }

    return [];
  }

  function renderHeatmap(heatmap) {
    if (!heatmapElement) {
      return;
    }

    const days = getHeatmapEntries(heatmap)
      .map(normalizeHeatmapEntry)
      .filter(Boolean)
      .sort((a, b) => a.date - b.date)
      .slice(-heatmapDayCount);

    if (!days.length) {
      return;
    }

    const paddedDays = Array.from({ length: heatmapDayCount - days.length }, () => null).concat(days);
    const maxXp = Math.max(...days.map((day) => day.xp), 0);
    const fragment = document.createDocumentFragment();

    paddedDays.forEach((day) => {
      const cell = document.createElement("span");
      let level = 0;
      let label = "No XP data";

      if (day) {
        if (maxXp > 0 && day.xp > 0) {
          level = Math.max(1, Math.ceil((day.xp / maxXp) * 4));
        }

        label = `${dateFormatter.format(day.date)}: ${formatter.format(day.xp)} XP`;
      }

      cell.className = `duolingo-heatmap-cell is-level-${level}`;
      cell.setAttribute("role", "img");
      cell.setAttribute("aria-label", label);
      cell.title = label;
      fragment.append(cell);
    });

    heatmapElement.replaceChildren(fragment);
  }

  fetch(`duolingo-stats.json?cache=${Date.now()}`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Duolingo stats unavailable");
      }

      return response.json();
    })
    .then((stats) => {
      if (streakElement && Number.isFinite(stats.streak)) {
        streakElement.textContent = formatter.format(stats.streak);
      }

      if (xpElement && Number.isFinite(stats.totalXp)) {
        xpElement.textContent = formatter.format(stats.totalXp);
      }

      renderHeatmap(stats.heatmap);
    })
    .catch(() => {
      // Keep the fallback values already rendered in the HTML.
    });
})();

// ── Letterboxd component ──
(function () {
  const card   = document.getElementById('lbCard');
  if (!card) return; // guard: exit if element isn't on this page

  const wraps  = card.querySelectorAll('.poster-wrap');
  const videos = card.querySelectorAll('.bg-video');

  // Prime all videos on load so the first hover has no blank-frame delay
  videos.forEach(v => {
    v.play().then(() => v.pause()).catch(() => {});
  });

  // Activate on poster hover
  wraps.forEach(wrap => {
    wrap.addEventListener('mouseenter', () => {
      const film   = wrap.dataset.film;
      const target = card.querySelector(`.bg-video[data-film="${film}"]`);

      // Deactivate only non-target videos — never clear all first or you get a flash
      videos.forEach(v => {
        if (v !== target) {
          v.classList.remove('active');
          v.pause();
        }
      });

      if (target) {
        // Only restart if this video wasn't already playing
        if (!target.classList.contains('active')) {
          target.currentTime = 0;
        }
        target.classList.add('active');
        target.play().catch(() => {});
        card.classList.add('playing');
      }
    });
  });

  // Only reset when cursor leaves the card entirely
  card.addEventListener('mouseleave', () => {
    videos.forEach(v => {
      v.classList.remove('active');
      v.pause();
    });
    card.classList.remove('playing');
  });
})();
