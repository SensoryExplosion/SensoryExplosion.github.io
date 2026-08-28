// Portfolio overlay integration
(() => {
  "use strict";

  const isPortfolioOverlay =
    window.self !== window.top &&
    new URLSearchParams(window.location.search).get("display") === "overlay";

  if (!isPortfolioOverlay) {
    return;
  }

  document.documentElement.dataset.display = "overlay";

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    window.parent.postMessage({ type: "close-project-overlay" }, window.location.origin);
  });
})();

// Sticky Table of Contents
(() => {
  "use strict";

  const stickyToc = document.querySelector("[data-sticky-toc]");
  const stickyTocList = document.querySelector("[data-sticky-toc-list]");

  if (!stickyToc || !stickyTocList) {
    return;
  }

  const decodeHash = (hash) => {
    try {
      return decodeURIComponent(hash.slice(1));
    } catch {
      return "";
    }
  };

  const seenIds = new Set();
  const entries = Array.from(document.querySelectorAll("[data-toc]"))
    .map((target) => {
      const id = target.id.trim();
      const heading = target.matches("h2, h3") ? target : target.querySelector("h2, h3");
      const title = target.dataset.tocTitle?.trim() || heading?.textContent.trim() || "";

      if (!id || !title || seenIds.has(id)) {
        return null;
      }

      seenIds.add(id);

      return {
        id,
        title,
        target,
        level: Number.parseInt(heading?.tagName.slice(1), 10) || 2,
        tocLink: null,
      };
    })
    .filter(Boolean);

  if (entries.length < 2) {
    stickyToc.hidden = true;
    return;
  }

  entries.forEach((entry) => {
    const tocItem = document.createElement("li");
    const tocLink = document.createElement("a");

    tocItem.className = "sticky-toc__item";
    tocItem.classList.toggle("sticky-toc__item--nested", entry.level > 2);
    tocLink.className = "sticky-toc__link";
    tocLink.href = `#${encodeURIComponent(entry.id)}`;
    tocLink.textContent = entry.title;

    tocItem.append(tocLink);
    stickyTocList.append(tocItem);
    entry.tocLink = tocLink;
  });

  const tocIndicator = document.createElement("li");
  tocIndicator.className = "sticky-toc__indicator";
  tocIndicator.setAttribute("aria-hidden", "true");
  tocIndicator.setAttribute("role", "presentation");
  stickyTocList.append(tocIndicator);

  stickyToc.hidden = false;
  stickyToc.dataset.ready = "true";

  const topOffset = 48;
  const scrollDuration = 900;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const article = document.querySelector(".article");

  let activeIndex = -1;
  let entryOffsets = [];
  let updateFrame = 0;
  let measureFrame = 0;
  let scrollFrame = 0;
  let resizeTimer = 0;
  let indicatorFrame = 0;
  let indicatorPosition = null;

  const quadraticBezier = (start, control, end, progress) => {
    const remaining = 1 - progress;
    return (
      remaining * remaining * start +
      2 * remaining * progress * control +
      progress * progress * end
    );
  };

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const cssLengthToPixels = (value) => {
    const numericValue = Number.parseFloat(value);

    if (value.trim().endsWith("rem")) {
      return numericValue * Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    }

    return numericValue;
  };

  const getIndicatorTarget = (index) => {
    const link = entries[index]?.tocLink;

    if (!link) {
      return null;
    }

    const listBounds = stickyTocList.getBoundingClientRect();
    const linkBounds = link.getBoundingClientRect();
    const listStyles = window.getComputedStyle(stickyTocList);
    const insetX = cssLengthToPixels(listStyles.getPropertyValue("--toc-indicator-inset-x"));
    const insetY = cssLengthToPixels(listStyles.getPropertyValue("--toc-indicator-inset-y"));

    return {
      x: linkBounds.left - listBounds.left + insetX,
      y: linkBounds.top - listBounds.top + insetY,
    };
  };

  const setIndicatorPosition = (position) => {
    tocIndicator.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    indicatorPosition = position;
  };

  const cancelIndicatorAnimation = () => {
    if (!indicatorFrame) {
      return;
    }

    window.cancelAnimationFrame(indicatorFrame);
    indicatorFrame = 0;
  };

  const snapIndicator = (index = activeIndex) => {
    const target = getIndicatorTarget(index);

    if (!target) {
      return;
    }

    cancelIndicatorAnimation();
    setIndicatorPosition(target);
  };

  const moveIndicator = (nextIndex, shouldAnimate) => {
    const target = getIndicatorTarget(nextIndex);

    if (!target) {
      return;
    }

    cancelIndicatorAnimation();

    if (!shouldAnimate || reducedMotion.matches || !indicatorPosition) {
      setIndicatorPosition(target);
      return;
    }

    const start = indicatorPosition;
    const distanceX = target.x - start.x;
    const distanceY = target.y - start.y;
    const travel = Math.hypot(distanceX, distanceY);

    if (travel < 0.5) {
      setIndicatorPosition(target);
      return;
    }

    const controlPoint = {
      x: (start.x + target.x) / 2 - clamp(travel * 0.25, 8, 40),
      y: (start.y + target.y) / 2,
    };
    const duration = clamp(180 + travel * 1.4, 220, 500);
    const startedAt = window.performance.now();

    const step = (currentTime) => {
      const progress = Math.min((currentTime - startedAt) / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      setIndicatorPosition({
        x: quadraticBezier(start.x, controlPoint.x, target.x, easedProgress),
        y: quadraticBezier(start.y, controlPoint.y, target.y, easedProgress),
      });

      if (progress < 1) {
        indicatorFrame = window.requestAnimationFrame(step);
        return;
      }

      indicatorFrame = 0;
      setIndicatorPosition(target);
    };

    indicatorFrame = window.requestAnimationFrame(step);
  };

  const activate = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= entries.length || nextIndex === activeIndex) {
      return;
    }

    entries.forEach((entry, index) => {
      const isActive = index === nextIndex;
      entry.tocLink.classList.toggle("is-active", isActive);

      if (isActive) {
        entry.tocLink.setAttribute("aria-current", "location");
      } else {
        entry.tocLink.removeAttribute("aria-current");
      }
    });

    const shouldAnimate = activeIndex >= 0;
    activeIndex = nextIndex;
    moveIndicator(nextIndex, shouldAnimate);
  };

  const calculateActiveIndex = () => {
    const page = document.documentElement;
    const atPageEnd = Math.ceil(window.scrollY + window.innerHeight) >= page.scrollHeight - 2;

    if (atPageEnd) {
      return entries.length - 1;
    }

    const probePosition = window.scrollY + window.innerHeight * 0.32;
    let nextIndex = 0;

    for (let index = 0; index < entryOffsets.length; index += 1) {
      if (entryOffsets[index] <= probePosition) {
        nextIndex = index;
      } else {
        break;
      }
    }

    return nextIndex;
  };

  const scheduleUpdate = () => {
    if (scrollFrame || updateFrame) {
      return;
    }

    updateFrame = window.requestAnimationFrame(() => {
      updateFrame = 0;

      if (scrollFrame) {
        return;
      }

      activate(calculateActiveIndex());
    });
  };

  const measureEntries = ({ updateActive = true } = {}) => {
    entryOffsets = entries.map(
      (entry) => window.scrollY + entry.target.getBoundingClientRect().top,
    );

    if (updateActive) {
      scheduleUpdate();
    }
  };

  const scheduleMeasure = () => {
    if (measureFrame) {
      return;
    }

    measureFrame = window.requestAnimationFrame(() => {
      measureFrame = 0;
      measureEntries();
      snapIndicator();
    });
  };

  const easeInOutCubic = (progress) =>
    progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  const cancelScroll = (updateActiveItem = true) => {
    if (!scrollFrame) {
      return;
    }

    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;

    if (updateActiveItem) {
      scheduleUpdate();
    }
  };

  const scrollToSection = (sectionIndex, { updateHistory = true, smooth = true } = {}) => {
    const entry = entries[sectionIndex];

    if (!entry) {
      return;
    }

    cancelScroll(false);

    if (updateFrame) {
      window.cancelAnimationFrame(updateFrame);
      updateFrame = 0;
    }

    measureEntries({ updateActive: false });

    const startY = window.scrollY;
    const maximumY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const targetY = Math.min(maximumY, Math.max(0, entryOffsets[sectionIndex] - topOffset));
    const distance = targetY - startY;
    const hash = `#${encodeURIComponent(entry.id)}`;

    activate(sectionIndex);

    if (updateHistory) {
      if (window.location.hash === hash) {
        window.history.replaceState(null, "", hash);
      } else {
        window.history.pushState(null, "", hash);
      }
    }

    if (!smooth || reducedMotion.matches || Math.abs(distance) < 1) {
      window.scrollTo(0, targetY);
      scheduleUpdate();
      return;
    }

    const startedAt = window.performance.now();

    const step = (currentTime) => {
      const progress = Math.min((currentTime - startedAt) / scrollDuration, 1);

      window.scrollTo(0, startY + distance * easeInOutCubic(progress));

      if (progress < 1) {
        scrollFrame = window.requestAnimationFrame(step);
        return;
      }

      scrollFrame = 0;
      window.scrollTo(0, targetY);
      scheduleMeasure();
    };

    scrollFrame = window.requestAnimationFrame(step);
  };

  const handleHashNavigation = () => {
    const hashId = decodeHash(window.location.hash);
    const matchingIndex = entries.findIndex((entry) => entry.id === hashId);

    if (matchingIndex >= 0) {
      scrollToSection(matchingIndex, {
        updateHistory: false,
        smooth: false,
      });
      return;
    }

    scheduleMeasure();
  };

  measureEntries();

  const initialIndex = entries.findIndex((entry) => entry.id === decodeHash(window.location.hash));

  activate(initialIndex >= 0 ? initialIndex : calculateActiveIndex());

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("load", scheduleMeasure);
  window.addEventListener("pageshow", scheduleMeasure);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      snapIndicator();
    }
  });
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(scheduleMeasure, 120);
  });
  window.addEventListener("wheel", cancelScroll, { passive: true });
  window.addEventListener("touchstart", cancelScroll, { passive: true });
  window.addEventListener("hashchange", handleHashNavigation);
  window.addEventListener("popstate", handleHashNavigation);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && stickyToc.contains(document.activeElement)) {
      document.activeElement.blur();
      return;
    }

    if (["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "].includes(event.key)) {
      cancelScroll();
    }
  });

  stickyToc.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link = event.target.closest('a[href^="#"]');
    const sectionIndex = entries.findIndex((entry) => entry.tocLink === link);

    if (sectionIndex < 0) {
      return;
    }

    event.preventDefault();
    scrollToSection(sectionIndex);
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleMeasure);
  }

  if ("ResizeObserver" in window && article) {
    const articleResizeObserver = new ResizeObserver(scheduleMeasure);
    articleResizeObserver.observe(article);
  }

  if ("ResizeObserver" in window) {
    const tocResizeObserver = new ResizeObserver(() => snapIndicator());
    tocResizeObserver.observe(stickyTocList);
  }
})();

// Building blocks motion
(() => {
  "use strict";

  function initLogoMotion() {
    const stage = document.querySelector("[data-building-blocks-logo]");
    const particleField = stage?.querySelector("[data-particle-field]");

    if (!stage || !particleField) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const svgNamespace = "http://www.w3.org/2000/svg";
    const particleMotion = {
      duration: [2100, 2600],
      delay: [420, 680],
      initialDelay: [240, 360],
      rotationIn: [-42, 42],
      rotationMiddle: [-6, 6],
      rotationOut: [-22, 22],
    };

    const colourRoutes = [
      ["#b3cce4", "#6799cb", "#0399cd"],
      ["#81cce5", "#4390cd", "#243e90"],
      ["#a2c8e5", "#0399cd", "#4390cd"],
      ["#fff3b7", "#ffcd05", "#ffe36a"],
    ];

    /*
      Like the Aave reference, particles stay on fixed anchors. Randomness is
      limited to timing and visual treatment; there is no positional drift.
    */
    const anchors = [
      { id: "t1", zone: "top", distance: "near", x: 20, y: -22 },
      { id: "t2", zone: "top", distance: "far", x: 80, y: -31 },
      { id: "t3", zone: "top", distance: "near", x: 142, y: -20 },
      { id: "t4", zone: "top", distance: "far", x: 207, y: -31 },
      { id: "t5", zone: "top", distance: "near", x: 270, y: -22 },

      { id: "r1", zone: "right", distance: "near", x: 307, y: 25 },
      { id: "r2", zone: "right", distance: "far", x: 318, y: 85 },
      { id: "r3", zone: "right", distance: "near", x: 307, y: 150 },
      { id: "r4", zone: "right", distance: "far", x: 318, y: 215 },

      { id: "b1", zone: "bottom", distance: "near", x: 30, y: 263 },
      { id: "b2", zone: "bottom", distance: "far", x: 105, y: 274 },
      { id: "b3", zone: "bottom", distance: "near", x: 180, y: 263 },
      { id: "b4", zone: "bottom", distance: "far", x: 260, y: 274 },

      { id: "l1", zone: "left", distance: "near", x: -20, y: 35 },
      { id: "l2", zone: "left", distance: "far", x: -31, y: 120 },
      { id: "l3", zone: "left", distance: "near", x: -20, y: 210 },
    ];

    /*
      WebKit can fail to repaint an initially empty, dynamically populated SVG
      group under a mask. Fixed anchors make the mask unnecessary, and this
      guard preserves a full glyph-radius exclusion around the logo.
    */
    const particleExclusion = {
      left: -8,
      right: 293.5,
      top: -8,
      bottom: 247.5,
      margin: 12,
    };

    const unsafeAnchors = anchors.filter(
      ({ x, y }) =>
        x > particleExclusion.left - particleExclusion.margin &&
        x < particleExclusion.right + particleExclusion.margin &&
        y > particleExclusion.top - particleExclusion.margin &&
        y < particleExclusion.bottom + particleExclusion.margin,
    );

    if (unsafeAnchors.length) {
      throw new Error("Particle anchor intersects the protected logo boundary.");
    }

    const glyphPaths = {
      paragraph: stage.querySelector("#building-blocks-glyph-paragraph").getAttribute("d"),
      section: stage.querySelector("#building-blocks-glyph-section").getAttribute("d"),
    };

    const particlePool = Array.from({ length: 16 }, () => {
      const position = document.createElementNS(svgNamespace, "g");
      const motion = document.createElementNS(svgNamespace, "g");
      const glyph = document.createElementNS(svgNamespace, "path");

      position.classList.add("particle-anchor");
      motion.classList.add("particle-motion");
      position.setAttribute("data-active", "false");
      motion.setAttribute("transform", "scale(0.25)");

      motion.appendChild(glyph);
      position.appendChild(motion);
      particleField.appendChild(position);

      return { position, motion, glyph };
    });

    const activeAnimations = new Set();
    const activeAnchorIds = new Set();
    let spawnTimer = null;
    let renderFrameId = null;
    let spawnIndex = 0;
    let glyphOffset = 0;

    function random(min, max) {
      return min + Math.random() * (max - min);
    }

    function getParticleSizeRange() {
      return stage.getBoundingClientRect().width <= 400 ? [29, 38] : [22, 30];
    }

    function pick(items) {
      return items[Math.floor(Math.random() * items.length)];
    }

    function clamp(value, min = 0, max = 1) {
      return Math.min(max, Math.max(min, value));
    }

    function interpolate(from, to, progress) {
      return from + (to - from) * progress;
    }

    function curveCoordinate(time, control1, control2) {
      const inverse = 1 - time;
      return (
        3 * inverse * inverse * time * control1 +
        3 * inverse * time * time * control2 +
        time * time * time
      );
    }

    function curveDerivative(time, control1, control2) {
      const inverse = 1 - time;
      return (
        3 * inverse * inverse * control1 +
        6 * inverse * time * (control2 - control1) +
        3 * time * time * (1 - control2)
      );
    }

    function referenceEase(progress) {
      const target = clamp(progress);
      let time = target;

      for (let iteration = 0; iteration < 7; iteration += 1) {
        const error = curveCoordinate(time, 0.2, 0) - target;
        const slope = curveDerivative(time, 0.2, 0);
        if (Math.abs(error) < 0.00001 || Math.abs(slope) < 0.00001) break;
        time = clamp(time - error / slope);
      }

      return curveCoordinate(time, 0, 1);
    }

    function hexToRgb(hex) {
      const value = Number.parseInt(hex.slice(1), 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }

    function mixColour(from, to, progress) {
      const mixed = from.map((channel, index) =>
        Math.round(interpolate(channel, to[index], progress)),
      );
      return `rgb(${mixed.join(", ")})`;
    }

    function chooseAnchor(preference = {}) {
      let candidates = anchors.filter(
        (anchor) =>
          !activeAnchorIds.has(anchor.id) &&
          (!preference.zone || anchor.zone === preference.zone) &&
          (!preference.distance || anchor.distance === preference.distance),
      );

      if (!candidates.length && preference.distance) {
        candidates = anchors.filter(
          (anchor) =>
            !activeAnchorIds.has(anchor.id) &&
            (!preference.zone || anchor.zone === preference.zone),
        );
      }

      if (!candidates.length) {
        candidates = anchors.filter((anchor) => !activeAnchorIds.has(anchor.id));
      }

      return candidates.length ? pick(candidates) : null;
    }

    function resetParticle(particle) {
      const { position, motion } = particle;
      position.setAttribute("data-active", "false");
      position.removeAttribute("data-zone");
      position.removeAttribute("data-distance");
      position.removeAttribute("data-anchor");
      position.removeAttribute("data-glyph");
      position.removeAttribute("data-x");
      position.removeAttribute("data-y");
      motion.setAttribute("opacity", "0");
      motion.setAttribute("transform", "scale(0.25)");
    }

    function renderParticle(record, now) {
      const rawProgress = clamp((now - record.startedAt) / record.duration);
      const progress = referenceEase(rawProgress);
      let segmentProgress;
      let opacity;
      let colour;
      let scale;
      let rotation;

      if (progress <= 0.34) {
        segmentProgress = progress / 0.34;
        opacity = interpolate(0, record.peakOpacity, segmentProgress);
        colour = mixColour(record.colours[0], record.colours[1], segmentProgress);
        scale = interpolate(0.25, 1, segmentProgress);
        rotation = interpolate(record.rotations[0], 0, segmentProgress);
      } else if (progress <= 0.72) {
        segmentProgress = (progress - 0.34) / 0.38;
        opacity = interpolate(record.peakOpacity, record.peakOpacity * 0.72, segmentProgress);
        colour = mixColour(record.colours[1], record.colours[2], segmentProgress);
        scale = interpolate(1, 0.92, segmentProgress);
        rotation = interpolate(0, record.rotations[1], segmentProgress);
      } else {
        segmentProgress = (progress - 0.72) / 0.28;
        opacity = interpolate(record.peakOpacity * 0.72, 0, segmentProgress);
        colour = mixColour(record.colours[2], record.colours[2], segmentProgress);
        scale = interpolate(0.92, 0.25, segmentProgress);
        rotation = interpolate(record.rotations[1], record.rotations[2], segmentProgress);
      }

      record.particle.motion.setAttribute("opacity", opacity.toFixed(4));
      record.particle.motion.setAttribute("fill", colour);
      record.particle.motion.setAttribute(
        "transform",
        `rotate(${rotation.toFixed(2)}) scale(${(scale * record.size).toFixed(4)})`,
      );

      return rawProgress >= 1;
    }

    function renderParticles(now) {
      renderFrameId = null;

      activeAnimations.forEach((record) => {
        if (!renderParticle(record, now)) return;
        activeAnimations.delete(record);
        activeAnchorIds.delete(record.anchorId);
        resetParticle(record.particle);
      });

      if (activeAnimations.size) {
        renderFrameId = window.requestAnimationFrame(renderParticles);
      }
    }

    function ensureRenderLoop() {
      if (renderFrameId === null && activeAnimations.size) {
        renderFrameId = window.requestAnimationFrame(renderParticles);
      }
    }

    function spawnParticle(preference = {}) {
      if (reducedMotion.matches) return;

      const particle = particlePool.find(
        (candidate) => candidate.position.getAttribute("data-active") === "false",
      );
      if (!particle) return;

      const anchor = chooseAnchor(preference);
      if (!anchor) return;
      activeAnchorIds.add(anchor.id);

      const selectedRoute = pick(colourRoutes);
      const [colour1, colour2, colour3] =
        Math.random() < 0.5 ? selectedRoute : [...selectedRoute].reverse();
      const peakOpacity = random(0.34, 0.56);
      const duration = random(...particleMotion.duration);
      const rotationIn = random(...particleMotion.rotationIn);
      const rotationMiddle = random(...particleMotion.rotationMiddle);
      const rotationOut = random(...particleMotion.rotationOut);
      const glyphIsParagraph = (spawnIndex + glyphOffset) % 2 === 0;
      const glyphName = glyphIsParagraph ? "paragraph" : "section";

      particle.glyph.setAttribute("d", glyphPaths[glyphName]);
      particle.position.setAttribute("transform", `translate(${anchor.x} ${anchor.y})`);
      particle.position.setAttribute("data-zone", anchor.zone);
      particle.position.setAttribute("data-distance", anchor.distance);
      particle.position.setAttribute("data-anchor", anchor.id);
      particle.position.setAttribute("data-x", anchor.x);
      particle.position.setAttribute("data-y", anchor.y);
      particle.position.setAttribute("data-glyph", glyphIsParagraph ? "paragraph" : "section");
      particle.position.setAttribute("data-active", "true");

      const record = {
        particle,
        anchorId: anchor.id,
        startedAt: performance.now(),
        duration,
        peakOpacity,
        size: random(...getParticleSizeRange()) / 18,
        colours: [colour1, colour2, colour3].map(hexToRgb),
        rotations: [rotationIn, rotationMiddle, rotationOut],
      };

      activeAnimations.add(record);
      renderParticle(record, record.startedAt);
      ensureRenderLoop();
    }

    function clearSpawnTimer() {
      if (spawnTimer !== null) {
        window.clearTimeout(spawnTimer);
        spawnTimer = null;
      }
    }

    function scheduleNextParticle(delay = random(...particleMotion.delay)) {
      clearSpawnTimer();
      if (reducedMotion.matches) return;

      spawnTimer = window.setTimeout(() => {
        spawnTimer = null;
        spawnIndex += 1;
        const preference =
          spawnIndex % 4 === 0 ? { zone: "top" } : spawnIndex % 5 === 0 ? { distance: "far" } : {};
        spawnParticle(preference);
        scheduleNextParticle();
      }, delay);
    }

    function cancelParticleStream() {
      clearSpawnTimer();
      if (renderFrameId !== null) {
        window.cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
      }
      activeAnimations.clear();
      activeAnchorIds.clear();
      particlePool.forEach(resetParticle);
    }

    function startParticleStream() {
      spawnIndex = 0;
      glyphOffset = Math.random() < 0.5 ? 0 : 1;
      spawnParticle({ zone: "top", distance: "far" });
      scheduleNextParticle(random(...particleMotion.initialDelay));
    }

    function restartLogoMotion() {
      if (reducedMotion.matches) {
        return;
      }

      cancelParticleStream();
      stage.classList.remove("is-running");
      void stage.getBoundingClientRect();
      stage.classList.add("is-running");
      startParticleStream();
    }

    function syncLogoMotionPreference() {
      if (reducedMotion.matches) {
        cancelParticleStream();
        stage.classList.remove("is-running");
      } else {
        restartLogoMotion();
      }
    }

    syncLogoMotionPreference();

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", syncLogoMotionPreference);
    } else if (typeof reducedMotion.addListener === "function") {
      reducedMotion.addListener(syncLogoMotionPreference);
    }
  }

  function initPilotCarousel() {
    const pilotCarousel = document.querySelector("[data-pilot-carousel]");
    const pilotViewport = pilotCarousel?.querySelector("[data-pilot-viewport]");
    const pilotTrack = pilotCarousel?.querySelector("[data-pilot-track]");

    if (!pilotCarousel || !pilotViewport || !pilotTrack) return;

    const pilotOriginalSlides = Array.from(pilotTrack.querySelectorAll(".pilot-carousel__slide"));

    if (pilotOriginalSlides.length < 2) return;

    const leadingClone = pilotOriginalSlides[pilotOriginalSlides.length - 1].cloneNode(true);
    const trailingClone = pilotOriginalSlides[0].cloneNode(true);

    leadingClone.setAttribute("data-pilot-clone", "true");
    trailingClone.setAttribute("data-pilot-clone", "true");
    pilotTrack.insertBefore(leadingClone, pilotTrack.firstChild);
    pilotTrack.appendChild(trailingClone);

    const pilotSlides = Array.from(pilotTrack.querySelectorAll(".pilot-carousel__slide"));
    const pilotMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pilotDwellDuration = 1800;
    const pilotMoveDuration = 650;
    const pilotSpringStrength = 7;
    const pilotSpringEnd = 1 - (1 + pilotSpringStrength) * Math.exp(-pilotSpringStrength);

    let pilotViewportWidth = 0;
    let pilotSlotWidth = 0;
    let pilotGap = 0;
    let pilotPhysicalIndex = 1;
    let pilotPhase = "dwell";
    let pilotDwellRemaining = pilotDwellDuration;
    let pilotDwellStartedAt = 0;
    let pilotMoveElapsed = 0;
    let pilotMoveStartedAt = 0;
    let pilotDwellTimer = null;
    let pilotFrameId = null;
    let pilotIsIntersecting = false;
    let pilotIsRunning = false;

    function pilotClamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }

    function pilotInterpolate(from, to, progress) {
      return from + (to - from) * progress;
    }

    function pilotCalmSpring(progress) {
      const time = pilotClamp(progress, 0, 1);
      const value = 1 - (1 + pilotSpringStrength * time) * Math.exp(-pilotSpringStrength * time);
      return value / pilotSpringEnd;
    }

    function pilotOffsetFor(index) {
      return pilotViewportWidth / 2 - pilotSlotWidth / 2 - index * (pilotSlotWidth + pilotGap);
    }

    function pilotSetTrackOffset(offset) {
      pilotTrack.style.transform = "translate3d(" + offset.toFixed(3) + "px, 0, 0)";
    }

    function pilotSetSlideState(slide, opacity, scale) {
      slide.style.opacity = opacity.toFixed(4);
      slide.style.transform = "scale(" + scale.toFixed(4) + ")";
    }

    function pilotSetCurrentData() {
      const currentSlide = pilotSlides[pilotPhysicalIndex];
      pilotCarousel.dataset.pilotCurrent = currentSlide.getAttribute("data-pilot-index") || "0";
      pilotCarousel.dataset.pilotName = currentSlide.getAttribute("data-pilot-name") || "NOBID";
    }

    function pilotRenderRest() {
      pilotTrack.classList.remove("pilot-is-moving");
      pilotTrack.style.filter = "none";
      pilotSetTrackOffset(pilotOffsetFor(pilotPhysicalIndex));

      pilotSlides.forEach((slide, index) => {
        const isCurrent = index === pilotPhysicalIndex;
        pilotSetSlideState(slide, isCurrent ? 1 : 0.58, isCurrent ? 1 : 0.94);
      });

      pilotSetCurrentData();
      pilotCarousel.dataset.pilotPhase = pilotMotionPreference.matches ? "static" : pilotPhase;
    }

    function pilotRenderMove(rawProgress) {
      const progress = pilotClamp(rawProgress, 0, 1);
      const springProgress = pilotCalmSpring(progress);
      const fromOffset = pilotOffsetFor(pilotPhysicalIndex);
      const toOffset = pilotOffsetFor(pilotPhysicalIndex + 1);
      const blurProgress = pilotClamp(progress / 0.55, 0, 1);
      const motionBlur = 1.6 * Math.sin(Math.PI * blurProgress);

      pilotTrack.classList.add("pilot-is-moving");
      pilotSetTrackOffset(pilotInterpolate(fromOffset, toOffset, springProgress));
      pilotTrack.style.filter =
        motionBlur > 0.01 ? "blur(" + motionBlur.toFixed(3) + "px)" : "none";

      pilotSlides.forEach((slide, index) => {
        let opacity = 0.58;
        let scale = 0.94;

        if (index === pilotPhysicalIndex) {
          opacity = pilotInterpolate(1, 0.58, springProgress);
          scale = pilotInterpolate(1, 0.94, springProgress);
        } else if (index === pilotPhysicalIndex + 1) {
          opacity = pilotInterpolate(0.58, 1, springProgress);
          scale = pilotInterpolate(0.94, 1, springProgress);
        }

        pilotSetSlideState(slide, opacity, scale);
      });

      pilotCarousel.dataset.pilotPhase = pilotIsRunning ? "moving" : "suspended";
    }

    function pilotUpdateGeometry() {
      const measuredWidth = pilotViewport.getBoundingClientRect().width;
      if (!measuredWidth) return;

      pilotViewportWidth = measuredWidth;
      pilotSlotWidth = measuredWidth;
      pilotGap = 0;

      pilotViewport.style.setProperty("--pilot-slot", pilotSlotWidth.toFixed(3) + "px");
      pilotViewport.style.setProperty("--pilot-gap", pilotGap.toFixed(3) + "px");

      if (pilotPhase === "move") {
        const elapsed = pilotIsRunning ? performance.now() - pilotMoveStartedAt : pilotMoveElapsed;
        pilotRenderMove(elapsed / pilotMoveDuration);
      } else {
        pilotRenderRest();
      }
    }

    function pilotClearDwellTimer() {
      if (pilotDwellTimer !== null) {
        window.clearTimeout(pilotDwellTimer);
        pilotDwellTimer = null;
      }
    }

    function pilotClearFrame() {
      if (pilotFrameId !== null) {
        window.cancelAnimationFrame(pilotFrameId);
        pilotFrameId = null;
      }
    }

    function pilotFinishMove() {
      pilotClearFrame();
      pilotPhysicalIndex += 1;

      if (pilotPhysicalIndex === pilotSlides.length - 1) {
        pilotPhysicalIndex = 1;
      }

      pilotPhase = "dwell";
      pilotMoveElapsed = 0;
      pilotDwellRemaining = pilotDwellDuration;
      pilotRenderRest();

      if (pilotIsRunning) {
        pilotStartDwell(pilotDwellDuration);
      }
    }

    function pilotRenderFrame(now) {
      pilotFrameId = null;
      if (!pilotIsRunning || pilotPhase !== "move") return;

      pilotMoveElapsed = pilotClamp(now - pilotMoveStartedAt, 0, pilotMoveDuration);
      const progress = pilotMoveElapsed / pilotMoveDuration;
      pilotRenderMove(progress);

      if (progress >= 1) {
        pilotFinishMove();
        return;
      }

      pilotFrameId = window.requestAnimationFrame(pilotRenderFrame);
    }

    function pilotStartMove() {
      pilotClearDwellTimer();
      if (!pilotIsRunning || pilotMotionPreference.matches) return;

      pilotPhase = "move";
      pilotMoveElapsed = 0;
      pilotMoveStartedAt = performance.now();
      pilotCarousel.dataset.pilotPhase = "moving";
      pilotTrack.classList.add("pilot-is-moving");
      pilotFrameId = window.requestAnimationFrame(pilotRenderFrame);
    }

    function pilotStartDwell(duration) {
      pilotClearDwellTimer();
      pilotPhase = "dwell";
      pilotDwellRemaining = Math.max(0, duration);
      pilotDwellStartedAt = performance.now();
      pilotCarousel.dataset.pilotPhase = "dwell";

      if (pilotDwellRemaining <= 0) {
        pilotStartMove();
        return;
      }

      pilotDwellTimer = window.setTimeout(pilotStartMove, pilotDwellRemaining);
    }

    function pilotSuspend() {
      const now = performance.now();

      if (pilotPhase === "dwell") {
        pilotDwellRemaining = Math.max(0, pilotDwellRemaining - (now - pilotDwellStartedAt));
        pilotClearDwellTimer();
      } else {
        pilotMoveElapsed = pilotClamp(now - pilotMoveStartedAt, 0, pilotMoveDuration);
        pilotClearFrame();
        pilotRenderMove(pilotMoveElapsed / pilotMoveDuration);
        pilotTrack.classList.remove("pilot-is-moving");
      }

      pilotCarousel.dataset.pilotPhase = "suspended";
    }

    function pilotResume() {
      if (pilotPhase === "dwell") {
        pilotStartDwell(pilotDwellRemaining);
        return;
      }

      if (pilotMoveElapsed >= pilotMoveDuration) {
        pilotFinishMove();
        return;
      }

      pilotMoveStartedAt = performance.now() - pilotMoveElapsed;
      pilotTrack.classList.add("pilot-is-moving");
      pilotCarousel.dataset.pilotPhase = "moving";
      pilotFrameId = window.requestAnimationFrame(pilotRenderFrame);
    }

    function pilotSyncActivity() {
      const shouldRun = !pilotMotionPreference.matches && pilotIsIntersecting && !document.hidden;

      if (shouldRun === pilotIsRunning) return;

      if (shouldRun) {
        pilotIsRunning = true;
        pilotResume();
      } else {
        pilotSuspend();
        pilotIsRunning = false;
      }
    }

    function pilotResetCycle(staticMode) {
      pilotClearDwellTimer();
      pilotClearFrame();
      pilotPhysicalIndex = 1;
      pilotPhase = "dwell";
      pilotDwellRemaining = pilotDwellDuration;
      pilotDwellStartedAt = performance.now();
      pilotMoveElapsed = 0;
      pilotCarousel.classList.toggle("pilot-is-static", staticMode);
      pilotUpdateGeometry();
      pilotRenderRest();
    }

    function pilotSyncMotionPreference() {
      if (pilotMotionPreference.matches) {
        if (pilotIsRunning) {
          pilotSuspend();
          pilotIsRunning = false;
        }
        pilotResetCycle(true);
      } else {
        pilotResetCycle(false);
        pilotSyncActivity();
      }
    }

    const initialBounds = pilotCarousel.getBoundingClientRect();
    const initialVisibleHeight = Math.max(
      0,
      Math.min(initialBounds.bottom, window.innerHeight) - Math.max(initialBounds.top, 0),
    );
    pilotIsIntersecting =
      initialBounds.height > 0 && initialVisibleHeight / initialBounds.height >= 0.35;

    pilotUpdateGeometry();
    pilotCarousel.classList.add("pilot-is-ready");

    if ("ResizeObserver" in window) {
      const pilotResizeObserver = new ResizeObserver(pilotUpdateGeometry);
      pilotResizeObserver.observe(pilotViewport);
    } else {
      window.addEventListener("resize", pilotUpdateGeometry);
    }

    if ("IntersectionObserver" in window) {
      const pilotIntersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          pilotIsIntersecting = entry.isIntersecting && entry.intersectionRatio >= 0.35;
          pilotSyncActivity();
        },
        { threshold: [0, 0.35, 0.6] },
      );
      pilotIntersectionObserver.observe(pilotCarousel);
    } else {
      pilotIsIntersecting = true;
    }

    document.addEventListener("visibilitychange", pilotSyncActivity);
    pilotSyncMotionPreference();

    if (typeof pilotMotionPreference.addEventListener === "function") {
      pilotMotionPreference.addEventListener("change", pilotSyncMotionPreference);
    } else if (typeof pilotMotionPreference.addListener === "function") {
      pilotMotionPreference.addListener(pilotSyncMotionPreference);
    }
  }

  function initLayerStack() {
    const layerStack = document.querySelector("[data-layer-stack]");

    if (!layerStack) {
      return;
    }

    const layerStackMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const layerStackTransitionLayer = layerStack.querySelector(".layer-stack__layer--top");
    const layerStackRevealRatio = 0.8;
    let layerStackHasRevealed = false;
    let layerStackIsIntersecting = false;
    let layerStackRevealPending = false;
    let layerStackObserver;
    let layerStackCleanupTimer;

    function layerStackSyncActivity() {
      const shouldAnimate =
        layerStackHasRevealed &&
        layerStack.classList.contains("layer-stack-is-ambient") &&
        layerStackIsIntersecting &&
        !document.hidden &&
        !layerStackMotionPreference.matches;

      layerStack.classList.toggle("layer-stack-is-active", shouldAnimate);
    }

    function layerStackFinishReveal() {
      window.clearTimeout(layerStackCleanupTimer);
      layerStack.classList.remove("layer-stack-is-revealing");

      if (
        layerStackHasRevealed &&
        layerStack.classList.contains("layer-stack-is-separated") &&
        !layerStackMotionPreference.matches
      ) {
        layerStack.classList.add("layer-stack-is-ambient");
      }

      layerStackSyncActivity();
    }

    function layerStackReveal() {
      if (layerStackHasRevealed) {
        return;
      }

      if (document.hidden) {
        layerStackRevealPending = true;
        return;
      }

      layerStackHasRevealed = true;
      layerStackRevealPending = false;
      layerStack.classList.add("layer-stack-is-revealing");

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (layerStackTransitionLayer) {
            layerStackTransitionLayer.addEventListener("transitionend", layerStackFinishReveal, {
              once: true,
            });
          }

          layerStack.classList.add("layer-stack-is-separated");
          layerStackCleanupTimer = window.setTimeout(layerStackFinishReveal, 1250);
        });
      });
    }

    function layerStackHandleVisibility() {
      if (!document.hidden && layerStackRevealPending && layerStackIsIntersecting) {
        layerStackReveal();
      }

      layerStackSyncActivity();
    }

    function layerStackHandleMotionPreference(event) {
      if (!event.matches) {
        if (layerStackHasRevealed) {
          layerStack.classList.add("layer-stack-is-ambient");
          layerStackSyncActivity();
        }
        return;
      }

      layerStackHasRevealed = true;
      layerStackRevealPending = false;
      layerStack.classList.add("layer-stack-is-separated");
      layerStack.classList.remove(
        "layer-stack-is-revealing",
        "layer-stack-is-ambient",
        "layer-stack-is-active",
      );
      window.clearTimeout(layerStackCleanupTimer);
    }

    if (layerStackMotionPreference.matches) {
      layerStackHasRevealed = true;
      layerStack.classList.add("layer-stack-is-separated");
      return;
    }

    if ("IntersectionObserver" in window) {
      layerStackObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          layerStackIsIntersecting =
            entry.isIntersecting && entry.intersectionRatio >= layerStackRevealRatio;

          if (layerStackIsIntersecting) {
            layerStackReveal();
          } else if (!layerStackHasRevealed) {
            layerStackRevealPending = false;
          }

          layerStackSyncActivity();
        },
        { threshold: [0, 0.5, layerStackRevealRatio, 1] },
      );
      layerStackObserver.observe(layerStack);
    } else {
      layerStackIsIntersecting = true;
      layerStackReveal();
    }

    document.addEventListener("visibilitychange", layerStackHandleVisibility);

    if (typeof layerStackMotionPreference.addEventListener === "function") {
      layerStackMotionPreference.addEventListener("change", layerStackHandleMotionPreference);
    } else if (typeof layerStackMotionPreference.addListener === "function") {
      layerStackMotionPreference.addListener(layerStackHandleMotionPreference);
    }
  }

  initLogoMotion();
  initPilotCarousel();
  initLayerStack();
})();
