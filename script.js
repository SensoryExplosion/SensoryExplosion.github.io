const SOFT_BLUR_DURATION = 648;
const SOFT_BLUR_STAGGER = 18;
const SOFT_BLUR_INITIAL_TRANSFORM = "translate3d(0, 9.28px, 0) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(1)";
const SOFT_BLUR_FINAL_TRANSFORM = "translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotate(0deg) scale(1)";

function prepareSoftBlurTitle(title) {
  const accessibleTitle = title.textContent.replace(/\s+/g, " ").trim();
  const textNodes = [];
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();

  while (textNode) {
    textNodes.push(textNode);
    textNode = walker.nextNode();
  }

  title.setAttribute("aria-label", accessibleTitle);

  const units = [];
  let hasVisibleText = false;

  function createUnit(character) {
    const unit = document.createElement("span");
    unit.className = "soft-blur__unit";
    unit.setAttribute("aria-hidden", "true");
    unit.textContent = character;
    units.push(unit);
    return unit;
  }

  textNodes.forEach((node) => {
    const normalizedText = node.nodeValue.replace(/\s+/g, " ");
    const text = hasVisibleText ? normalizedText : normalizedText.trimStart();

    if (!text) {
      node.remove();
      return;
    }

    const fragment = document.createDocumentFragment();

    text.match(/\S+|\s+/g).forEach((part) => {
      if (/^\s+$/.test(part)) {
        fragment.append(document.createTextNode(part));
        return;
      }

      const word = document.createElement("span");
      word.className = "soft-blur__word";
      word.setAttribute("aria-hidden", "true");
      Array.from(part).forEach((character) => {
        word.append(createUnit(character));
      });
      fragment.append(word);
    });

    node.replaceWith(fragment);
    hasVisibleText ||= /\S/.test(text);
  });

  units.forEach((unit) => {
    unit.style.opacity = "0";
    unit.style.filter = "blur(12px)";
    unit.style.transform = SOFT_BLUR_INITIAL_TRANSFORM;
  });

  return units;
}

function prepareSoftBlurWords(element, blur) {
  const text = element.textContent.replace(/\s+/g, " ").trim();
  const fragment = document.createDocumentFragment();
  const units = [];

  element.setAttribute("aria-label", text);

  text.match(/\S+|\s+/g).forEach((part) => {
    if (/^\s+$/.test(part)) {
      fragment.append(document.createTextNode(part));
      return;
    }

    const unit = document.createElement("span");
    unit.className = "soft-blur__unit";
    unit.setAttribute("aria-hidden", "true");
    unit.textContent = part;
    units.push(unit);
    fragment.append(unit);
  });

  element.replaceChildren(fragment);

  units.forEach((unit) => {
    unit.style.opacity = "0";
    unit.style.filter = `blur(${blur}px)`;
    unit.style.transform = SOFT_BLUR_INITIAL_TRANSFORM;
  });

  return units;
}

function playSoftBlurIn(
  units,
  { initialDelay = 0, stagger = SOFT_BLUR_STAGGER, blur = 12 } = {}
) {
  const animations = units.map((unit, index) =>
    unit.animate(
      [
        { opacity: 0, filter: `blur(${blur}px)`, transform: SOFT_BLUR_INITIAL_TRANSFORM },
        { opacity: 1, filter: "blur(0)", transform: SOFT_BLUR_FINAL_TRANSFORM }
      ],
      {
        delay: initialDelay + index * stagger,
        duration: SOFT_BLUR_DURATION,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards"
      }
    )
  );

  return Promise.all(animations.map((animation) => animation.finished)).then(() => {
    units.forEach((unit) => {
      unit.style.opacity = "1";
      unit.style.filter = "blur(0)";
      unit.style.transform = SOFT_BLUR_FINAL_TRANSFORM;
    });
    animations.forEach((animation) => animation.cancel());
  });
}

function playFadeUp(element) {
  element.style.opacity = "0";
  element.style.translate = "0 30px";
  element.style.willChange = "opacity, translate";

  const animation = element.animate(
    [
      { opacity: 0, translate: "0 30px" },
      { opacity: 1, translate: "0" }
    ],
    {
      duration: 500,
      easing: "ease",
      fill: "forwards"
    }
  );

  return animation.finished.then(() => {
    element.style.opacity = "1";
    element.style.translate = "0";
    element.style.willChange = "";
    animation.cancel();
  });
}

function revealSoftBlurTitle({
  title,
  subtitle = null,
  accent = null,
  titlePendingClass,
  subtitlePendingClass = null,
  accentPendingClass,
  accentHighlightClass,
  onHighlightStart = null,
  initialDelay = 0
}) {
  const titleUnits = prepareSoftBlurTitle(title);
  const subtitleUnits = subtitle ? prepareSoftBlurWords(subtitle, 6) : [];
  const highlightLead = 160;
  const subtitleLead = 220;
  const lastAccentIndex = titleUnits.reduce(
    (lastIndex, unit, index) => accent?.contains(unit) ? index : lastIndex,
    -1
  );
  const titleEnd =
    initialDelay +
    Math.max(0, titleUnits.length - 1) * SOFT_BLUR_STAGGER +
    SOFT_BLUR_DURATION;
  const highlightDelay =
    lastAccentIndex >= 0
      ? initialDelay +
        lastAccentIndex * SOFT_BLUR_STAGGER +
        SOFT_BLUR_DURATION -
        highlightLead
      : titleEnd;
  const subtitleDelay = Math.max(0, highlightDelay - subtitleLead);

  playSoftBlurIn(titleUnits, { initialDelay });
  playSoftBlurIn(subtitleUnits, {
    initialDelay: subtitleDelay,
    stagger: 15,
    blur: 6
  });

  title.classList.remove(titlePendingClass);
  if (subtitle && subtitlePendingClass) {
    subtitle.classList.remove(subtitlePendingClass);
  }

  if (lastAccentIndex >= 0) {
    window.setTimeout(() => {
      accent?.classList.add(accentHighlightClass);
      onHighlightStart?.();
    }, highlightDelay);
  }
}

function revealSoftBlurTitleImmediately({
  title,
  subtitle = null,
  accent = null,
  titlePendingClass,
  subtitlePendingClass = null,
  accentPendingClass
}) {
  title?.classList.remove(titlePendingClass);
  if (subtitle && subtitlePendingClass) {
    subtitle.classList.remove(subtitlePendingClass);
  }
  accent?.classList.remove(accentPendingClass);
}

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

// ── About card directional spring ──
(function () {
  const cards = document.querySelectorAll(".about-section .bento-card, .about-section .christmas-cat");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const settings = {
    distance: 5,
    hold: 200,
    stiffness: 100,
    damping: 10,
    mass: 1,
  };

  if (!cards.length) {
    return;
  }

  cards.forEach((card) => {
    const position = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let frame = null;
    let returnTimer = null;
    let previousTime = null;

    function start() {
      if (frame !== null) {
        return;
      }

      previousTime = null;
      frame = requestAnimationFrame(animate);
    }

    function animate(time) {
      if (previousTime === null) {
        previousTime = time;
      }

      const delta = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;

      for (const axis of ["x", "y"]) {
        const displacement = position[axis] - target[axis];
        const springForce = -settings.stiffness * displacement;
        const dampingForce = -settings.damping * velocity[axis];
        const acceleration = (springForce + dampingForce) / Math.max(settings.mass, 0.01);

        velocity[axis] += acceleration * delta;
        position[axis] += velocity[axis] * delta;
      }

      card.style.translate = `${position.x}px ${position.y}px`;

      const atRest =
        Math.abs(position.x - target.x) < 0.01 &&
        Math.abs(position.y - target.y) < 0.01 &&
        Math.abs(velocity.x) < 0.01 &&
        Math.abs(velocity.y) < 0.01;

      if (atRest) {
        position.x = target.x;
        position.y = target.y;
        velocity.x = 0;
        velocity.y = 0;
        frame = null;

        if (target.x === 0 && target.y === 0) {
          card.style.translate = "none";
        }

        return;
      }

      frame = requestAnimationFrame(animate);
    }

    function stop() {
      clearTimeout(returnTimer);

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      position.x = 0;
      position.y = 0;
      velocity.x = 0;
      velocity.y = 0;
      target.x = 0;
      target.y = 0;
      frame = null;
      returnTimer = null;
      previousTime = null;
      card.style.translate = "none";
    }

    function handleMouseEnter(event) {
      if (reduceMotion.matches) {
        return;
      }

      const bounds = card.getBoundingClientRect();
      const halfWidth = Math.max(bounds.width / 2, 1);
      const halfHeight = Math.max(bounds.height / 2, 1);
      const normalizedX = Math.min(
        Math.max((event.clientX - (bounds.left + halfWidth)) / halfWidth, -1),
        1,
      );
      const normalizedY = Math.min(
        Math.max((event.clientY - (bounds.top + halfHeight)) / halfHeight, -1),
        1,
      );

      target.x = -normalizedX * settings.distance;
      target.y = -normalizedY * settings.distance;

      clearTimeout(returnTimer);
      start();

      returnTimer = setTimeout(() => {
        target.x = 0;
        target.y = 0;
        start();
      }, settings.hold);
    }

    card.addEventListener("mouseenter", handleMouseEnter);
    reduceMotion.addEventListener("change", ({ matches }) => {
      if (matches) {
        stop();
      }
    });
  });
})();

// ── Hero soft-blur-in reveal ──
(function () {
  const title = document.getElementById("hero-title");
  const subtitle = document.getElementById("hero-subtitle");
  const accent = title?.querySelector(".hero-title__accent");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pendingClasses = {
    title: "hero-title--animation-pending",
    subtitle: "hero-subtitle--animation-pending",
    accent: "hero-title__accent--highlight-pending",
    highlightedAccent: "hero-title__accent--highlighted"
  };

  if (!title) {
    subtitle?.classList.remove("hero-subtitle--animation-pending");
    return;
  }

  if (reducedMotion.matches || !Element.prototype.animate) {
    revealSoftBlurTitleImmediately({
      title,
      subtitle,
      accent,
      titlePendingClass: pendingClasses.title,
      subtitlePendingClass: pendingClasses.subtitle,
      accentPendingClass: pendingClasses.accent
    });
    return;
  }

  revealSoftBlurTitle({
    title,
    subtitle,
    accent,
    titlePendingClass: pendingClasses.title,
    subtitlePendingClass: pendingClasses.subtitle,
    accentPendingClass: pendingClasses.accent,
    accentHighlightClass: pendingClasses.highlightedAccent,
    initialDelay: Math.round(Math.random() * 400)
  });
})();

// ── Contact title soft-blur reveal ──
(function () {
  const title = document.getElementById("connect-title");
  const emailButton = document.getElementById("connect-email");
  const emailLabel = emailButton?.querySelector(".rolling-email__label");
  const accent = title?.querySelector(".connect-title__accent");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pendingClasses = {
    title: "connect-title--animation-pending",
    accent: "connect-title__accent--highlight-pending",
    highlightedAccent: "connect-title__accent--highlighted"
  };

  const syncEmailButtonWidths = () => {
    const [idleLabel, hoverLabel] = emailLabel ? Array.from(emailLabel.children) : [];

    if (!idleLabel || !hoverLabel) {
      return;
    }

    const measureLabel = (source) => {
      const styles = window.getComputedStyle(source);
      const probe = document.createElement("span");
      probe.textContent = source.textContent;
      probe.style.position = "fixed";
      probe.style.inset = "auto";
      probe.style.inlineSize = "max-content";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.whiteSpace = "nowrap";
      probe.style.fontFamily = styles.fontFamily;
      probe.style.fontSize = styles.fontSize;
      probe.style.fontStyle = styles.fontStyle;
      probe.style.fontWeight = styles.fontWeight;
      probe.style.fontStretch = styles.fontStretch;
      probe.style.fontFeatureSettings = styles.fontFeatureSettings;
      probe.style.fontVariationSettings = styles.fontVariationSettings;
      probe.style.letterSpacing = styles.letterSpacing;
      probe.style.textTransform = styles.textTransform;
      document.body.append(probe);

      const width = Math.ceil(probe.getBoundingClientRect().width);
      probe.remove();
      return width;
    };

    emailLabel.style.setProperty(
      "--rolling-email-idle-width",
      `${measureLabel(idleLabel)}px`
    );
    emailLabel.style.setProperty(
      "--rolling-email-hover-width",
      `${measureLabel(hoverLabel)}px`
    );
  };

  syncEmailButtonWidths();
  document.fonts?.ready.then(syncEmailButtonWidths);

  if (!title) {
    emailButton?.classList.remove("connect-email--animation-pending");
    return;
  }

  const revealImmediately = () => {
    revealSoftBlurTitleImmediately({
      title,
      accent,
      titlePendingClass: pendingClasses.title,
      accentPendingClass: pendingClasses.accent
    });
    emailButton?.classList.remove("connect-email--animation-pending");
  };

  if (reducedMotion.matches || !Element.prototype.animate || !("IntersectionObserver" in window)) {
    revealImmediately();
    return;
  }

  let hasRevealed = false;
  const observer = new IntersectionObserver(([entry]) => {
    if (hasRevealed || !entry.isIntersecting || entry.intersectionRatio < 1) {
      return;
    }

    hasRevealed = true;
    observer.disconnect();
    revealSoftBlurTitle({
      title,
      accent,
      titlePendingClass: pendingClasses.title,
      accentPendingClass: pendingClasses.accent,
      accentHighlightClass: pendingClasses.highlightedAccent,
      onHighlightStart: () => {
        if (!emailButton) {
          return;
        }

        playFadeUp(emailButton);
        emailButton.classList.remove("connect-email--animation-pending");
      }
    });
  }, { threshold: 1 });

  observer.observe(title);
  reducedMotion.addEventListener("change", ({ matches }) => {
    if (!matches || hasRevealed) {
      return;
    }

    hasRevealed = true;
    observer.disconnect();
    revealImmediately();
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

// ── Christmas cat tooltip and playback ──
(function () {
  const cat = document.getElementById("christmas-cat");
  const trigger = cat?.querySelector(".christmas-cat__trigger");
  const tooltip = document.getElementById("christmas-tooltip");
  const animation = document.getElementById("christmas-animation");

  if (!cat || !trigger || !tooltip || !animation) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let inView = false;

  function updatePlayback() {
    const player = animation.dotLottie;

    if (!player) {
      return;
    }

    if (inView && !reducedMotion.matches && !document.hidden) {
      player.play();
    } else {
      player.pause();
    }
  }

  function showTooltip() {
    tooltip.hidden = false;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  cat.addEventListener("pointerenter", showTooltip);
  cat.addEventListener("pointerleave", () => {
    if (document.activeElement !== trigger) {
      hideTooltip();
    }
  });
  trigger.addEventListener("focus", showTooltip);
  trigger.addEventListener("blur", hideTooltip);
  trigger.addEventListener("click", showTooltip);
  document.addEventListener("pointerdown", (event) => {
    if (!cat.contains(event.target)) {
      hideTooltip();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !tooltip.hidden) {
      hideTooltip();
    }
  });

  customElements.whenDefined("dotlottie-wc").then(() => {
    animation.dotLottie?.addEventListener("load", updatePlayback);
    updatePlayback();
  });
  reducedMotion.addEventListener("change", updatePlayback);
  document.addEventListener("visibilitychange", updatePlayback);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updatePlayback();
    });
    observer.observe(cat);
  } else {
    inView = true;
  }

  updatePlayback();
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
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
  modal.innerHTML = `
    <div class="fishing-modal__panel" role="document" tabindex="-1">
      <div class="fishing-modal__controls">
        <button class="fishing-modal__close" type="button" aria-label="Close Fishing with David Lynch">×</button>
      </div>
      <div class="fishing-modal__content">
        <header class="fishing-modal__header">
          <h2 class="fishing-modal__title" id="fishing-modal-title">Fishing with David Lynch</h2>
        </header>
        <img
          class="fishing-modal__hero"
          src="assets/david-lynch-hero.jpg"
          alt="A man holding a cigarette, surrounded by blue-lit smoke."
          width="2160"
          height="1060"
          loading="lazy"
          decoding="async"
        >
        <div class="fishing-modal__essay">
          <section class="fishing-modal__section">
            <h3>You can’t schedule a fish</h3>
            <p>
              We have this annoying model of creativity, according to which ideas are things we
              create. Sit down. Concentrate. Think harder. Come up with something brilliant.
            </p>
            <p>
              But thoughts don’t actually work like that. You cannot put “Have a good idea” in
              your calendar for Thursday at 9:30.
            </p>
            <p>
              Sam Harris often points out a strange characteristic of our own minds. You don’t
              know what your next thought will be until it appears. You can try this out right
              now. Think of a random city. Whatever popped into your head – Tokyo, Budapest, Oslo,
              for whatever reason – you only became aware of it once it appeared. You didn’t
              consciously scan through all the cities stored in your brain, nor did you carefully
              select the winner.
            </p>
            <p>
              We know a great deal about attention, memory, perception and the brain activity
              associated with conscious experience. But consciousness itself remains an unsolved
              scientific mystery. There is no single accepted theory that accurately explains how
              the brain’s physical processes become the personal experience of a thought. A recent
              review puts the fundamental problem very simply: “Consciousness is personal”.
            </p>
          </section>
          <section class="fishing-modal__section">
            <h3>Ideas are like fish</h3>
            <p>David Lynch uses fish to explain this.</p>
            <blockquote class="fishing-modal__quote">“Ideas are like fish.”</blockquote>
            <p>And, more importantly:</p>
            <blockquote class="fishing-modal__quote">
              “We don’t make the fish, we catch the fish.”
            </blockquote>
            <p>The emergence of an idea and turning it into something are two different things.</p>
            <p>
              A chef doesn’t make the fish either. She gets the fish, and then has to cook it. She
              might create something brilliant. But she might poison the whole dinner.
            </p>
          </section>
          <section class="fishing-modal__section">
            <h3>Go where the bigger fish are</h3>
            <p>
              Lynch says: “If you want to catch a big fish, you have to dive deeper.” He means
              this in relation to meditation and expanding consciousness, but there’s other useful
              readings.
            </p>
            <p>
              Your mind can only connect with what has entered the sea. Books, conversations,
              films, childhood memories, jobs you hated, things you saw through the train window,
              screenshots you saved years ago.
            </p>
            <p>So diving deeper can also mean:</p>
            <p>
              Learning something unrelated to your work. Visiting places. Talking to people who
              know things you don’t. Taking an interest in something that has absolutely no
              obvious professional value. Feeding your mind with stranger materials.
            </p>
            <p>
              And don’t overlook the small fish either. Lynch talks about picking up fragments of
              ideas and using them as bait for something bigger. Gradually, the seemingly
              unrelated fragments begin to recognise one another. Eventually there’s a big fish.
            </p>
          </section>
          <section class="fishing-modal__section">
            <h3>Leave the line in the water</h3>
            <p>
              This is also why Lynch talks so much about daydreaming. You need enough space for
              ideas to arise, which is inconvenient from a professional perspective, because
              daydreaming looks almost exactly as if you’re doing absolutely nothing. But if every
              spare moment is filled with feeds, podcasts, messages, tasks and productivity, there
              isn’t much room left to notice what your mind is tossing up.
            </p>
            <p>
              You can also catch Lynch’s “flying fish”. Ideas that you don’t have to go looking
              for at all. Sometimes they simply fly towards you. Your job is to notice them.
            </p>
          </section>
          <section class="fishing-modal__section">
            <h3>Don’t outsource the sea</h3>
            <p>
              If we introduce AI into the story, it gets interesting because AI is exceptionally
              good at fishing.
            </p>
            <p>
              There is an important distinction here. We still don’t fully understand
              consciousness itself. Neuroscience can explore what happens in the brain when we
              perceive, remember, imagine something, or become aware of a thought, but there is no
              accepted theory that explains how these physical processes become subjective
              experiences.
            </p>
            <p>
              This doesn’t prove AI could never be conscious, and we don’t need to hide behind
              that claim anyway.
            </p>
            <p>
              This means that whatever strange mixture of memory, experience, emotion and
              association caused that particular thought to surface in you is not something to
              which artificial intelligence has direct access to. It knows what you tell it. It
              recognises patterns in things created by humans. It can generate an absurd number of
              plausible new combinations. But it isn’t immersed in your personal stream of
              experience when a forgotten memory suddenly collides with something you saw on the
              tram yesterday.
            </p>
            <p>
              Research has shown that people using generative AI can produce content that is
              perceived as more creative than what they would create without assistance. However,
              these AI-assisted ideas are becoming increasingly similar to one another.
              Individually, they catch better fish. Collectively, however, everyone starts fishing
              in the same pond.
            </p>
            <p>
              It seems that this is the real creative risk. Gradually replacing our own unique
              contributions with this infinitely convenient source of suggestions.
            </p>
            <p>
              If artificial intelligence provides the references, the associations, the initial
              ideas, the variations, and ultimately even tells us which is the best, then the sea
              starts getting very well stocked but also very familiar.
            </p>
            <p>
              Creativity means projecting our own story, our curiosity and our attention onto
              things, and then finding something that matters to us.
            </p>
          </section>
          <section class="fishing-modal__section">
            <h3>Feel-think your way through</h3>
            <p>Lynch calls this “feel-thinking”: emotion and intellect working together.</p>
            <p>
              You create something. You look at it. Something isn’t quite right. You change it.
              You remove it. Some seemingly insignificant detail suddenly becomes the foundation
              of the whole thing.
            </p>
            <p>Your job is to follow the idea and to stay true to the idea.</p>
            <p>
              Before AI, whenever you started something new, you had to spend quite a lot of time
              on it before you could actually create anything. During that time, your taste
              developed. In most cases, your taste was ahead of your skill. With your skill alone,
              you were not yet able to produce something that reflected your taste. Those who
              stuck with it and pushed through this difficult period went on to become
              professionals or artists.
            </p>
            <p>
              This may be the most useful creative skill in a world driven by AI: Spending enough
              time on your ideas and your craft to allow your taste and judgement to develop.
              Building a mind worth fishing in.
            </p>
          </section>
          <section class="fishing-modal__section">
            <h3>Set it free</h3>
            <p>
              Eventually, the idea will feel right to you. Then you have to cook the fish and set
              it free into the world.
            </p>
            <p>
              (Which is admittedly a terrible thing to do after cooking it, but the metaphor has
              suffered enough.)
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
  const preparedOverlays = new Map();
  const overlayTriggers = Array.from(
    document.querySelectorAll("[data-project-overlay]")
  );

  function markOverlayReady(state) {
    if (state.isReady) {
      return;
    }

    state.isReady = true;
    state.frame.classList.add("is-loaded");
    state.overlay.classList.add("is-content-ready");
    state.overlay.setAttribute("aria-busy", "false");

    if (overlayState === state && !state.isClosing) {
      state.status.textContent = "Case study loaded.";

      if (
        state.overlay.classList.contains("is-open") &&
        document.activeElement === state.closeButton
      ) {
        state.frame.focus({ preventScroll: true });
      }
    }
  }

  function revealWhenReady(state) {
    state.frame.addEventListener(
      "load",
      () => {
        window.requestAnimationFrame(() => {
          markOverlayReady(state);
        });
      },
      { once: true }
    );
  }

  function findOverlayBySource(source) {
    if (overlayState?.frame.contentWindow === source) {
      return overlayState;
    }

    return Array.from(preparedOverlays.values()).find(
      (state) => state.frame.contentWindow === source
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

  function createOverlay(trigger) {
    const frameUrl = new URL(trigger.dataset.projectUrl, document.baseURI);
    const overlay = document.createElement("div");
    const frame = document.createElement("iframe");
    const backdrop = document.createElement("div");
    const closeButton = document.createElement("button");
    const loading = document.createElement("div");
    const loadingSurface = document.createElement("div");
    const loadingSpinner = document.createElement("span");
    const loadingLabel = document.createElement("span");
    const status = document.createElement("span");

    frameUrl.searchParams.set("display", "overlay");
    overlay.className = "project-overlay";
    if (trigger.dataset.projectOverlayBackground) {
      overlay.style.setProperty(
        "--project-overlay-background",
        trigger.dataset.projectOverlayBackground
      );
    }
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Project case study");
    overlay.setAttribute("aria-busy", "true");
    frame.className = "project-overlay-frame";
    frame.tabIndex = -1;
    frame.title = "Project case study";
    backdrop.className = "project-overlay-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    loading.className = "project-overlay-loading";
    loading.setAttribute("aria-hidden", "true");
    loadingSurface.className = "project-overlay-loading__surface";
    loadingSpinner.className = "project-overlay-loading__spinner";
    loadingLabel.className = "project-overlay-loading__label";
    loadingLabel.textContent = "Loading case study…";
    loadingSurface.append(loadingSpinner, loadingLabel);
    loading.append(loadingSurface);
    status.className = "project-overlay-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    closeButton.className = "project-overlay-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close case study");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", closeOverlay);
    overlay.append(frame, loading, status, closeButton);

    const state = {
      overlay,
      frame,
      backdrop,
      closeButton,
      status,
      trigger,
      isReady: false,
    };

    revealWhenReady(state);
    frame.src = frameUrl.href;

    return state;
  }

  function prepareOverlay(trigger) {
    if (preparedOverlays.has(trigger) || overlayState?.trigger === trigger) {
      return;
    }

    const preparedOverlay = createOverlay(trigger);
    preparedOverlay.overlay.classList.add("is-preloading");
    preparedOverlays.set(trigger, preparedOverlay);
    document.body.append(preparedOverlay.backdrop, preparedOverlay.overlay);
  }

  function prepareOverlaysAfterDomReady() {
    const prepare = () => {
      overlayTriggers.forEach(prepareOverlay);
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prepare, { timeout: 1500 });
      return;
    }

    window.setTimeout(prepare, 0);
  }

  function closeOverlay() {
    if (!overlayState || overlayState.isClosing) {
      return;
    }

    overlayState.isClosing = true;
    isTransitioning = true;
    const closingState = overlayState;
    const { overlay, backdrop, status, trigger } = closingState;

    finishAfterTransition(overlay, () => {
      document.body.classList.remove("project-overlay-open");
      overlayState = undefined;
      isTransitioning = false;
      status.textContent = "";
      overlay.setAttribute("aria-hidden", "true");
      closingState.isClosing = false;

      if (closingState.wasReadyOnOpen) {
        overlay.remove();
        backdrop.remove();
        prepareOverlay(trigger);
      } else {
        closingState.wasReadyOnOpen = undefined;
        overlay.classList.add("is-preloading");
        preparedOverlays.set(trigger, closingState);
      }

      trigger.focus({ preventScroll: true });
    });

    overlay.classList.remove("is-open", "is-active");
    backdrop.classList.remove("is-active");
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    const sourceOverlay = findOverlayBySource(event.source);
    if (!sourceOverlay) {
      return;
    }

    if (event.data?.type === "project-overlay-shell-ready") {
      markOverlayReady(sourceOverlay);
      return;
    }

    if (
      event.data?.type === "close-project-overlay" &&
      sourceOverlay === overlayState
    ) {
      closeOverlay();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlayState) {
      closeOverlay();
    }
  });

  overlayTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        isTransitioning
      ) {
        return;
      }

      event.preventDefault();
      isTransitioning = true;

      const preparedOverlay = preparedOverlays.get(trigger);
      if (preparedOverlay) {
        preparedOverlays.delete(trigger);
        preparedOverlay.overlay.classList.remove("is-preloading");
        overlayState = preparedOverlay;
      } else {
        overlayState = createOverlay(trigger);
        document.body.append(overlayState.backdrop, overlayState.overlay);
      }

      overlayState.isClosing = false;
      overlayState.wasReadyOnOpen = overlayState.isReady;
      const { overlay, frame, backdrop, closeButton, status } = overlayState;
      overlay.setAttribute("aria-hidden", "false");
      status.textContent = overlayState.isReady ? "" : "Loading case study.";
      document.body.classList.add("project-overlay-open");

      finishAfterTransition(overlay, () => {
        if (overlayState?.overlay !== overlay || overlayState.isClosing) {
          return;
        }

        overlay.classList.add("is-open");
        isTransitioning = false;

        if (overlayState.isReady) {
          frame.focus({ preventScroll: true });
        } else {
          closeButton.focus({ preventScroll: true });
        }
      });

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          backdrop.classList.add("is-active");
          overlay.classList.add("is-active");
        });
      });
    });
  });

  prepareOverlaysAfterDomReady();
})();
