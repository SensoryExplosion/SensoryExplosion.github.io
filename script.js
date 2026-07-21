// ── Apple-style card corners ──
(function () {
  const cards = document.querySelectorAll(
    ".work-section .thumbnail, .about-section .bento-card"
  );

  if (
    !cards.length ||
    !window.ResizeObserver ||
    !window.CSS?.supports('clip-path', 'path("M0 0H1V1H0Z")')
  ) {
    return;
  }

  function appleCornerPath({ width, height, radius, smoothing = 60 }) {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const w = Math.max(0, width);
    const h = Math.max(0, height);
    const r = clamp(radius, 0, Math.min(w, h) / 2);
    const exponent = 2 + clamp(smoothing, 0, 100) / 100 * 3.35;
    const points = [];
    const steps = 22;

    const corner = (cx, cy, start, end) => {
      for (let index = 0; index <= steps; index += 1) {
        const angle = start + (end - start) * (index / steps);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = cx + r * Math.sign(cos) * Math.abs(cos) ** (2 / exponent);
        const y = cy + r * Math.sign(sin) * Math.abs(sin) ** (2 / exponent);
        points.push([+x.toFixed(3), +y.toFixed(3)]);
      }
    };

    points.push([r, 0], [w - r, 0]);
    corner(w - r, r, -Math.PI / 2, 0);
    points.push([w, h - r]);
    corner(w - r, h - r, 0, Math.PI / 2);
    points.push([r, h]);
    corner(r, h - r, Math.PI / 2, Math.PI);
    points.push([0, r]);
    corner(r, r, Math.PI, Math.PI * 1.5);

    return `M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
  }

  function smoothCard(card) {
    const width = card.clientWidth;
    const height = card.clientHeight;
    const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius);

    if (!width || !height || !radius) {
      return;
    }

    const path = appleCornerPath({ width, height, radius, smoothing: 60 });
    card.style.clipPath = `path("${path}")`;
  }

  const observer = new ResizeObserver((entries) => {
    entries.forEach(({ target }) => smoothCard(target));
  });

  cards.forEach((card) => {
    smoothCard(card);
    observer.observe(card);
  });
})();

(function () {
  const topbar = document.querySelector(".topbar");
  const navToggle = document.querySelector(".nav-toggle");
  const navClose = document.querySelector(".nav-close");
  const navLinks = document.querySelectorAll(".nav-links a");
  const navScrollTargets = new Map([
    ["#work", document.getElementById("work")],
    ["#about", document.getElementById("about")],
    ["#connect", document.getElementById("connect")]
  ]);

  if (!topbar) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function updateTopbarState() {
    topbar.classList.toggle("topbar--scrolled", window.scrollY > 60);
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
    link.addEventListener("click", (event) => {
      const target = navScrollTargets.get(link.getAttribute("href"));

      setNavOpen(false);

      if (
        !target ||
        !window.gsap ||
        !window.ScrollToPlugin ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      window.gsap.to(window, {
        duration: reducedMotion.matches ? 0 : 0.8,
        ease: "sine.inOut",
        overwrite: "auto",
        scrollTo: {
          y: target,
          offsetY:
            target.id === "about"
              ? 0
              : Math.round(topbar.getBoundingClientRect().bottom + 24),
          autoKill: true
        }
      });
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setNavOpen(false);
    }
  });

  window.addEventListener("scroll", updateTopbarState, { passive: true });
  updateTopbarState();
})();

// ── About curve-swipe reveal ──
(function () {
  const aboutSection = document.getElementById("about");
  const aboutHeading = document.getElementById("about-title");
  const aboutCurve = document.getElementById("about-curve-path");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (
    !aboutSection ||
    !aboutHeading ||
    !aboutCurve ||
    reducedMotion.matches ||
    !window.gsap ||
    !window.MorphSVGPlugin ||
    !("IntersectionObserver" in window)
  ) {
    return;
  }

  window.gsap.registerPlugin(window.MorphSVGPlugin);

  const curveRise = "M 0 100 V 50 Q 50 0 100 50 V 100 z";
  const curveFill = "M 0 100 V 0 Q 50 0 100 0 V 100 z";

  aboutSection.classList.add("curve-pending", "cards-pending");

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        return;
      }

      observer.unobserve(aboutSection);

      window.gsap
        .timeline({
          onComplete: () => aboutSection.classList.remove("curve-pending")
        })
        .to(aboutCurve, {
          duration: 0.5,
          ease: "power2.in",
          morphSVG: curveRise
        })
        .to(aboutCurve, {
          duration: 0.45,
          ease: "power2.out",
          morphSVG: curveFill
        })
        .to(aboutHeading, {
          duration: 0.5,
          ease: "power2.out",
          opacity: 1,
          y: 0
        })
        .call(() => {
          aboutSection.classList.remove("cards-pending");
          aboutSection.classList.add("is-revealed");
        });
    },
    { rootMargin: "0px 0px -35%", threshold: 0 }
  );

  observer.observe(aboutSection);
})();

// ── Fishing philosophy modal ──
(function () {
  const triggers = document.querySelectorAll("[data-fishing-modal-trigger]");

  if (!triggers.length) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modal = document.createElement("div");
  let lastTrigger;
  let closeTimer;

  modal.className = "fishing-modal";
  modal.id = "fishing-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "fishing-modal-title");
  modal.setAttribute("aria-describedby", "fishing-modal-intro");
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
  modal.innerHTML = `
    <div class="fishing-modal__panel" role="document" tabindex="-1">
      <div class="fishing-modal__controls">
        <button class="fishing-modal__close" type="button" aria-label="Close Fishing With Lynch">×</button>
      </div>
      <div class="fishing-modal__content">
        <header class="fishing-modal__header">
          <p class="fishing-modal__eyebrow">Design philosophy</p>
          <h2 class="fishing-modal__title" id="fishing-modal-title">Fishing With Lynch</h2>
          <p class="fishing-modal__intro" id="fishing-modal-intro">
            A small design philosophy borrowed from David Lynch’s idea of catching fish: go deeper,
            follow what bites, and know when to let the thing go.
          </p>
        </header>
        <div class="fishing-modal__essay">
        <section class="fishing-modal__section">
          <blockquote class="fishing-modal__quote">
            “Ideas are like fish. If you want to catch little fish, you can stay in the shallow
            water. But if you want to catch the big fish, you’ve got to go deeper. Down deep, the
            fish are more powerful and more pure. They’re huge and abstract. And they’re
            beautiful.”
          </blockquote>
          <p>
            The best ideas rarely appear when I’m skimming the surface. I like to collect the whole
            world around a problem: user needs, business goals, legal frameworks, technical
            constraints, architecture, competitors, existing solutions, edge cases, and the tiny
            details that seem unimportant until they suddenly become the key.
          </p>
        </section>
        <section class="fishing-modal__section">
          <blockquote class="fishing-modal__quote">
            “If you can expand the container you’re fishing in—your consciousness—you can catch
            bigger fish.”
          </blockquote>
          <p>
            For design, the container is context. The more I understand, the more connections I can
            make. Research is not just validation. It is fuel.
          </p>
        </section>
        <section class="fishing-modal__section">
          <blockquote class="fishing-modal__quote">
            “The beautiful thing is that when you catch one fish that you love, even if it’s a
            little fish—a fragment of an idea—that fish will draw in another fish, and they’ll hook
            onto it. Then you’re on your way. Soon there are more and more and more fragments, and
            the whole thing emerges.”
          </blockquote>
          <p>
            A good idea does not always arrive as a finished concept. Sometimes it starts as a small
            fragment: a user flow, a piece of copy, a layout rhythm, a visual direction, or one
            weird little “wait, that’s interesting” moment. I try to notice the thing that feels
            alive and follow it.
          </p>
        </section>
        <section class="fishing-modal__section">
          <blockquote class="fishing-modal__quote">
            “The idea is the whole thing. If you stay true to the idea, it tells you everything you
            need to know, really. You just keep working to make it look like that idea looked, feel
            like it felt, sound like it sounded, and be the way it was.”
          </blockquote>
          <p>
            A product is organized ideas. Sometimes the idea leads to high-fidelity screens,
            sometimes to motion, sometimes to prototyping, sometimes to documentation or cleaning up
            a design system. Not every design day looks shiny, but every part matters when it helps
            the idea become clearer, stronger, and easier to use.
          </p>
        </section>
        <section class="fishing-modal__section">
          <blockquote class="fishing-modal__quote">
            “Intuition is seeing the solution.....its emotion and intellect going together.”
          </blockquote>
          <p>
            Good design is rarely pure logic or pure feeling. It is both. The rational part checks
            whether the product works. The emotional part checks whether it feels clear, human,
            useful, and memorable. You feel-think your way through until the thing starts to make
            sense.
          </p>
        </section>
        <section class="fishing-modal__section">
          <blockquote class="fishing-modal__quote">
            “At some point, it feels correct to you.”
          </blockquote>
          <p>
            Design can be improved forever, which is exactly why finishing matters. At some point,
            the work is clear enough, strong enough, and honest enough to leave your hands. You make
            the thing, sharpen it, and then let it live.
          </p>
        </section>
        </div>
      </div>
    </div>
  `;
  document.body.append(modal);

  const panel = modal.querySelector(".fishing-modal__panel");
  const closeButton = modal.querySelector(".fishing-modal__close");

  function setExpandedState(isExpanded) {
    triggers.forEach((trigger) => {
      trigger.setAttribute("aria-expanded", String(isExpanded));
    });
  }

  function updateTransformOrigin(trigger) {
    panel.style.setProperty("--fishing-origin-x", "0px");
    panel.style.setProperty("--fishing-origin-y", "0px");
    panel.style.setProperty("--fishing-origin-scale-x", "1");
    panel.style.setProperty("--fishing-origin-scale-y", "1");

    if (reducedMotion.matches) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;
    const panelCenterX = panelRect.left + panelRect.width / 2;
    const panelCenterY = panelRect.top + panelRect.height / 2;

    panel.style.setProperty("--fishing-origin-x", `${triggerCenterX - panelCenterX}px`);
    panel.style.setProperty("--fishing-origin-y", `${triggerCenterY - panelCenterY}px`);
    panel.style.setProperty(
      "--fishing-origin-scale-x",
      String(Math.max(0.24, triggerRect.width / panelRect.width))
    );
    panel.style.setProperty(
      "--fishing-origin-scale-y",
      String(Math.max(0.18, triggerRect.height / panelRect.height))
    );
  }

  function finishClose(restoreFocus) {
    modal.classList.remove("is-closing");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("fishing-modal-open");
    setExpandedState(false);

    if (restoreFocus && lastTrigger) {
      lastTrigger.focus({ preventScroll: true });
    }
  }

  function closeModal({ restoreFocus = true } = {}) {
    if (!modal.classList.contains("is-open")) {
      return;
    }

    window.clearTimeout(closeTimer);
    modal.classList.remove("is-open");
    modal.classList.add("is-closing");

    if (reducedMotion.matches) {
      finishClose(restoreFocus);
      return;
    }

    closeTimer = window.setTimeout(() => {
      finishClose(restoreFocus);
    }, 580);
  }

  function openModal(trigger, showKeyboardFocus) {
    lastTrigger = trigger;
    window.clearTimeout(closeTimer);
    modal.hidden = false;
    modal.classList.remove("is-closing");
    modal.scrollTop = 0;
    panel.scrollTop = 0;
    document.body.classList.add("fishing-modal-open");
    updateTransformOrigin(trigger);
    modal.setAttribute("aria-hidden", "false");
    setExpandedState(true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        modal.classList.add("is-open");
        (showKeyboardFocus ? closeButton : panel).focus({ preventScroll: true });
      });
    });
  }

  function handleFocusLoop(event) {
    if (event.key !== "Tab" || !modal.classList.contains("is-open")) {
      return;
    }

    const focusableElements = Array.from(
      panel.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );

    if (!focusableElements.length) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (
      event.shiftKey &&
      (document.activeElement === firstElement || document.activeElement === panel)
    ) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  }

  triggers.forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", (event) => openModal(trigger, event.detail === 0));
  });

  closeButton.addEventListener("click", () => closeModal());

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("is-open")) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    handleFocusLoop(event);
  });
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

        label = `${formatter.format(day.xp)} XP`;
        cell.dataset.tooltip = label;
        cell.tabIndex = 0;
      }

      cell.className = `duolingo-heatmap-cell is-level-${level}`;
      cell.setAttribute("role", "img");
      cell.setAttribute("aria-label", label);
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

(function () {
  if (document.documentElement.dataset.pageKind !== "portfolio") {
    return;
  }

  let isTransitioning = false;
  let overlayState;

  function startWhenReady(frame, callback) {
    let started = false;

    function start() {
      if (started) {
        return;
      }

      started = true;
      callback();
    }

    frame.addEventListener(
      "load",
      () => {
        frame.classList.add("is-loaded");
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(start);
        });
      },
      { once: true }
    );
  }

  function finishAfterTransition(element, callback) {
    let finished = false;

    function finish() {
      if (finished) {
        return;
      }

      finished = true;
      element.removeEventListener("transitionend", handleTransitionEnd);
      callback();
    }

    function handleTransitionEnd(event) {
      if (event.target === element && event.propertyName === "transform") {
        finish();
      }
    }

    element.addEventListener("transitionend", handleTransitionEnd);
    window.setTimeout(finish, 800);
  }

  function closeOverlay() {
    if (!overlayState || overlayState.isClosing) {
      return;
    }

    overlayState.isClosing = true;
    isTransitioning = true;
    const { overlay, backdrop, trigger } = overlayState;

    finishAfterTransition(overlay, () => {
      overlay.remove();
      backdrop.remove();
      document.body.classList.remove("project-overlay-open");
      overlayState = undefined;
      isTransitioning = false;
      trigger.focus({ preventScroll: true });
    });

    overlay.classList.remove("is-open", "is-active");
    backdrop.classList.remove("is-active");
  }

  window.addEventListener("message", (event) => {
    if (
      event.origin === window.location.origin &&
      event.source === overlayState?.frame.contentWindow &&
      event.data?.type === "close-project-overlay"
    ) {
      closeOverlay();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlayState) {
      closeOverlay();
    }
  });

  document.querySelectorAll("[data-project-overlay]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        isTransitioning
      ) {
        return;
      }

      event.preventDefault();
      isTransitioning = true;

      const frameUrl = new URL(trigger.dataset.projectUrl, document.baseURI);
      const overlay = document.createElement("div");
      const frame = document.createElement("iframe");
      const backdrop = document.createElement("div");
      const closeButton = document.createElement("button");

      frameUrl.searchParams.set("display", "overlay");
      overlay.className = "project-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Project case study");
      frame.className = "project-overlay-frame";
      frame.src = frameUrl.href;
      frame.tabIndex = -1;
      frame.title = "Project case study";
      backdrop.className = "project-overlay-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      closeButton.className = "project-overlay-close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Close case study");
      closeButton.textContent = "×";
      closeButton.addEventListener("click", closeOverlay);
      overlay.append(frame, closeButton);
      document.body.append(backdrop, overlay);
      overlayState = { overlay, frame, backdrop, trigger };
      document.body.classList.add("project-overlay-open");

      startWhenReady(frame, () => {
        finishAfterTransition(overlay, () => {
          if (overlayState?.overlay !== overlay || overlayState.isClosing) {
            return;
          }

          overlay.classList.add("is-open");
          isTransitioning = false;
          frame.focus();
        });

        window.requestAnimationFrame(() => {
          backdrop.classList.add("is-active");
          overlay.classList.add("is-active");
        });
      });
    });
  });
})();
