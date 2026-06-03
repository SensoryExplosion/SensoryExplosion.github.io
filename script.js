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
