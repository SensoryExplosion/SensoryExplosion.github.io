(function () {
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");

  if (!header && !footer) {
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

  reducedMotion.addEventListener("change", requestUpdate);
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  requestUpdate();
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
