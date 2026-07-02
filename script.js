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
  const mobileCaseStudy = window.matchMedia("(max-width: 680px)");
  const modalGapRatio = 0.22;
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
    let touchStartScrollTop = 0;
    const artifactExitTimers = new WeakMap();

    function setLayerOffset(layer, offset) {
      layer.style.setProperty("--artifact-slide-y", `${offset}px`);
    }

    function suppressTransition(element, callback) {
      const previousTransition = element.style.transition;
      element.style.transition = "none";
      callback();
      element.offsetHeight;
      element.style.transition = previousTransition;
    }

    function clearArtifactExit(layer) {
      const exitTimer = artifactExitTimers.get(layer);

      if (exitTimer) {
        window.clearTimeout(exitTimer);
        artifactExitTimers.delete(layer);
      }
    }

    function resetArtifact(layer, artifact) {
      clearArtifactExit(layer);
      layer.classList.remove("is-visible");
      layer.removeAttribute("data-step");
      setLayerOffset(layer, 0);
      artifact.style.width = "";
      artifact.style.setProperty("--artifact-x", "0px");
      artifact.style.setProperty("--artifact-y", "0px");
      artifact.style.setProperty("--artifact-scale", "1");
    }

    function positionArtifact(layer, artifact, stepIndex, stepCount, options = {}) {
      const artifactHeight = artifact.offsetHeight;
      const isMobile = window.matchMedia("(max-width: 680px)").matches;
      let scale;
      let offset;
      let xOffset;

      if (isMobile) {
        const visibleWidth = layer.clientWidth;
        const visibleHeight = layer.clientHeight;
        const focus = options.mobileFocus?.[stepIndex] || { x: 0.5, y: 0.5 };
        const artifactWidth = artifact.offsetWidth;
        const minX = Math.min(0, visibleWidth - artifactWidth);
        const minY = Math.min(0, visibleHeight - artifactHeight);

        scale = 1;
        xOffset = Math.min(0, Math.max(minX, visibleWidth / 2 - artifactWidth * focus.x));
        offset = Math.min(0, Math.max(minY, visibleHeight / 2 - artifactHeight * focus.y));
      } else {
        const visibleHeight = deckRoot.clientHeight;
        scale = options.zoomFirstStep && stepIndex === 0 ? 1 : 1 / 1.34;
        const maxOffset = Math.max(0, artifactHeight * scale - visibleHeight);
        const progress = stepCount <= 1 ? 0 : stepIndex / (stepCount - 1);
        offset = -maxOffset * progress;
        xOffset =
          options.zoomFirstStep && stepIndex === 0
            ? Math.max(0, deckRoot.clientWidth * 0.25 - artifact.offsetWidth * scale * 0.224)
            : 0;
      }

      layer.classList.add("is-visible");
      layer.dataset.step = String(stepIndex);
      artifact.style.setProperty("--artifact-x", `${xOffset}px`);
      artifact.style.setProperty("--artifact-y", `${offset}px`);
      artifact.style.setProperty("--artifact-scale", String(scale));
    }

    function getArtifactStep(section, classPrefix) {
      return section?.className.match(new RegExp(`\\b${classPrefix}-(\\d)\\b`));
    }

    function updateArtifactGroup(config) {
      const { layer, artifact, step, previousStep, stepCount, direction, options } = config;
      const isEntering = step && !previousStep;
      const isLeaving = !step && previousStep;

      if (step) {
        const stepIndex = Number(step[1]) - 1;

        clearArtifactExit(layer);

        if (isEntering && direction !== 0) {
          const entryOffset = direction > 0 ? deckRoot.clientHeight : -deckRoot.clientHeight;

          suppressTransition(layer, () => {
            setLayerOffset(layer, entryOffset);
          });
          suppressTransition(artifact, () => {
            positionArtifact(layer, artifact, stepIndex, stepCount, options);
          });
          setLayerOffset(layer, 0);
          return;
        }

        setLayerOffset(layer, 0);
        positionArtifact(layer, artifact, stepIndex, stepCount, options);
        return;
      }

      if (isLeaving && direction !== 0) {
        const exitOffset = direction > 0 ? -deckRoot.clientHeight : deckRoot.clientHeight;
        const exitTimer = artifactExitTimers.get(layer);

        if (exitTimer) {
          window.clearTimeout(exitTimer);
        }

        setLayerOffset(layer, exitOffset);
        artifactExitTimers.set(
          layer,
          window.setTimeout(() => {
            resetArtifact(layer, artifact);
          }, 620)
        );
        return;
      }

      resetArtifact(layer, artifact);
    }

    function updateArtifacts(section, previousSection, direction) {
      const heartStep = getArtifactStep(section, "heart-frame");
      const previousHeartStep = getArtifactStep(previousSection, "heart-frame");
      const consentStep = getArtifactStep(section, "consent-frame");
      const previousConsentStep = getArtifactStep(previousSection, "consent-frame");

      updateArtifactGroup({
        layer: heartLayer,
        artifact: heartArtifact,
        step: heartStep,
        previousStep: previousHeartStep,
        stepCount: 3,
        direction,
        options: {
          zoomFirstStep: true,
          mobileFocus: [
            { x: 0.23, y: 0.18 },
            { x: 0.5, y: 0.56 },
            { x: 0.55, y: 0.76 },
          ],
        },
      });

      updateArtifactGroup({
        layer: consentLayer,
        artifact: consentArtifact,
        step: consentStep,
        previousStep: previousConsentStep,
        stepCount: 2,
        direction,
        options: {
          mobileFocus: [
            { x: 0.7, y: 0.31 },
            { x: 0.72, y: 0.81 },
          ],
        },
      });
    }

    function goTo(index) {
      if (index < 0 || index >= sections.length) {
        return;
      }

      const previous = current;
      current = index;
      deckRoot.dataset.slide = String(current + 1);
      updateArtifacts(sections[current], sections[previous], Math.sign(current - previous));
      sections[current].scrollTop = 0;
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
        touchStartScrollTop = sections[current].scrollTop;
      },
      { passive: true }
    );

    deckRoot.addEventListener(
      "touchend",
      (event) => {
        const deltaY = touchStartY - (event.changedTouches[0]?.clientY || touchStartY);

        if (Math.abs(deltaY) < 40) return;

        const activeSlide = sections[current];
        const maxScroll = Math.max(0, activeSlide.scrollHeight - activeSlide.clientHeight);
        const startedAtBoundary =
          deltaY > 0 ? touchStartScrollTop >= maxScroll - 1 : touchStartScrollTop <= 1;

        if (maxScroll > 1 && !startedAtBoundary) return;

        moveBy(deltaY > 0 ? 1 : -1);
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

  function finalizeScrollModalClose(restoreFocus) {
    modal.classList.remove("active", "is-closing", "is-expanded");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sm-modal-open", "sm-modal-expanded");
    expansionUnlocked = false;
    deckInputUnlockAt = 0;
    modalCollapseUnlockAt = 0;
    deckApi?.goTo(0);
    modal.scrollTop = 0;
    updateScrollModalStyles();

    if (restoreFocus && lastTrigger) {
      lastTrigger.focus({ preventScroll: true });
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function closeScrollModal({ restoreFocus = true } = {}) {
    if (!modal.classList.contains("active") || modal.classList.contains("is-closing")) {
      return;
    }

    let closeFinished = false;
    const closeFallback = window.setTimeout(() => {
      if (!closeFinished) {
        closeFinished = true;
        content.removeEventListener("transitionend", handleCloseTransition);
        finalizeScrollModalClose(restoreFocus);
      }
    }, 700);

    function handleCloseTransition(event) {
      if (closeFinished) {
        return;
      }

      if (event.target !== content || event.propertyName !== "transform") {
        return;
      }

      content.removeEventListener("transitionend", handleCloseTransition);
      window.clearTimeout(closeFallback);
      closeFinished = true;
      finalizeScrollModalClose(restoreFocus);
    }

    content.addEventListener("transitionend", handleCloseTransition);
    modal.classList.add("is-closing");
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (mobileCaseStudy.matches) {
        return;
      }

      event.preventDefault();
      openScrollModal(trigger);
    });
  });

  closeButton.addEventListener("click", (event) => {
    closeScrollModal({ restoreFocus: event.detail === 0 });
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeScrollModal({ restoreFocus: false });
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
      if (modal.classList.contains("is-closing")) {
        return;
      }

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

  if (!mobileCaseStudy.matches) {
    ensureDeck();
  }
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
