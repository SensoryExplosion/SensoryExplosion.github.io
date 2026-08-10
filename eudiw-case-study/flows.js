const definitions = window.EUDI_FLOW_DEFINITIONS ?? {};

const flows = [
  {
    id: "activation",
    title: "First-time activation and first credential",
    summary:
      "From opening the wallet through provider verification, storage approval, activation, and confirmation.",
    source: definitions.activation,
  },
  {
    id: "same-device",
    title: "Remote same-device presentation",
    summary:
      "A deep link opens the wallet, which verifies the requester, explains the request, asks for approval, and records the outcome.",
    source: definitions["same-device"],
  },
  {
    id: "cross-device",
    title: "Remote cross-device presentation",
    summary:
      "A QR handoff is checked before the wallet verifies the requester, presents the request, and returns the result to both devices.",
    source: definitions["cross-device"],
  },
  {
    id: "proximity",
    title: "Proximity presentation",
    summary:
      "A nearby QR, NFC, or reader handoff makes verification limits visible before approval, transfer, and a clear receipt or failure state.",
    source: definitions.proximity,
  },
  {
    id: "activity",
    title: "Review activity and exercise a right",
    summary:
      "A transaction can lead to an erasure request, a report, an export, or local-log deletion, each with its own consequence and confirmation.",
    source: definitions.activity,
  },
];

const viewer = document.querySelector("[data-flow-viewer]");

if (viewer) {
  const tabs = Array.from(viewer.querySelectorAll("[data-flow-index]"));
  const title = viewer.querySelector("[data-flow-title]");
  const count = viewer.querySelector("[data-flow-count]");
  const summary = viewer.querySelector("[data-flow-summary]");
  const stage = viewer.querySelector("[data-flow-stage]");
  const tablist = viewer.querySelector("[data-flow-tabs]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mermaidApi = window.mermaid;
  const minimumScale = 0.68;
  const maximumScale = 0.8;
  const targetViewportWidths = 2.5;
  let activeIndex = 0;
  let maximumDiagramWidth = 0;

  const setStageState = (state) => {
    stage.dataset.state = state;
    stage.setAttribute("aria-busy", String(state === "loading"));
  };

  const createStatus = (message, isError = false) => {
    const status = document.createElement("p");

    status.className = `flow-viewer-status${isError ? " flow-viewer-status-error" : ""}`;
    status.setAttribute("role", "status");
    status.textContent = message;

    return status;
  };

  const panels = flows.map((flow) => {
    const panel = document.createElement("div");

    panel.className = "flow-viewer-diagram";
    panel.dataset.state = "loading";
    panel.append(createStatus("Rendering flow diagram…"));

    return panel;
  });

  const updateDiagramScale = () => {
    if (!maximumDiagramWidth) {
      return;
    }

    const responsiveScale = (stage.clientWidth * targetViewportWidths) / maximumDiagramWidth;
    const scale = Math.min(maximumScale, Math.max(minimumScale, responsiveScale));

    flows.forEach((flow, index) => {
      const mount = panels[index].querySelector("[data-mermaid-mount]");

      if (!mount || !flow.renderWidth || !flow.renderHeight) {
        return;
      }

      mount.style.width = `${flow.renderWidth * scale}px`;
      mount.style.height = `${flow.renderHeight * scale}px`;
    });

    viewer.style.setProperty("--flow-diagram-scale", scale.toFixed(3));
  };

  const setPanelError = (index) => {
    const panel = panels[index];

    panel.replaceChildren(
      createStatus("This flow diagram could not be rendered. Try reloading the page.", true),
    );
    panel.dataset.state = "error";

    if (activeIndex === index) {
      setStageState("error");
    }
  };

  const renderFlow = async (index) => {
    const flow = flows[index];
    const panel = panels[index];

    if (!mermaidApi || !flow.source) {
      setPanelError(index);
      return;
    }

    try {
      const result = await mermaidApi.render(`eudi-live-flow-${flow.id}`, flow.source);
      const mount = document.createElement("div");

      mount.className = "flow-viewer-mermaid";
      mount.dataset.mermaidMount = "";
      mount.innerHTML = result.svg;

      const svg = mount.querySelector("svg");

      if (!svg) {
        throw new Error(`Mermaid did not return an SVG for ${flow.id}`);
      }

      const viewBox = svg.viewBox.baseVal;
      flow.renderWidth = viewBox.width;
      flow.renderHeight = viewBox.height;
      maximumDiagramWidth = Math.max(maximumDiagramWidth, viewBox.width);

      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.maxWidth = "none";
      svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `Flowchart: ${flow.title}. ${flow.summary}`);

      panel.replaceChildren(mount);
      panel.dataset.state = "ready";

      if (typeof result.bindFunctions === "function") {
        result.bindFunctions(mount);
      }

      updateDiagramScale();

      if (activeIndex === index) {
        setStageState("ready");
      }
    } catch {
      setPanelError(index);
    }
  };

  const showDiagram = (index) => {
    const panel = panels[index];

    stage.replaceChildren(panel);
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
    setStageState(panel.dataset.state);
  };

  const revealTab = (tab) => {
    const tablistBounds = tablist.getBoundingClientRect();
    const tabBounds = tab.getBoundingClientRect();
    const visibleLeft = tablist.scrollLeft;
    const visibleRight = visibleLeft + tablist.clientWidth;
    const tabLeft = visibleLeft + tabBounds.left - tablistBounds.left;
    const tabRight = tabLeft + tabBounds.width;
    let targetLeft = visibleLeft;

    if (tabLeft < visibleLeft) {
      targetLeft = tabLeft;
    } else if (tabRight > visibleRight) {
      targetLeft = tabRight - tablist.clientWidth;
    } else {
      return;
    }

    tablist.scrollTo({
      left: targetLeft,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  };

  const selectFlow = (index, focusTab = false) => {
    if (index < 0 || index >= flows.length) {
      return;
    }

    const flow = flows[index];
    activeIndex = index;
    viewer.dataset.activeFlow = flow.id;
    title.textContent = flow.title;
    count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(flows.length).padStart(
      2,
      "0",
    )}`;
    summary.textContent = flow.summary;

    tabs.forEach((tab, tabIndex) => {
      const isSelected = tabIndex === index;

      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    });

    const selectedTab = tabs[index];
    stage.setAttribute("aria-labelledby", selectedTab.id);

    if (focusTab) {
      selectedTab.focus();
    }

    revealTab(selectedTab);
    showDiagram(index);
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      selectFlow(Number(tab.dataset.flowIndex));
    });
  });

  tablist.addEventListener("keydown", (event) => {
    let nextIndex = activeIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (activeIndex + 1) % flows.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (activeIndex - 1 + flows.length) % flows.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = flows.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectFlow(nextIndex, true);
  });

  if (mermaidApi) {
    mermaidApi.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "loose",
      themeVariables: {
        fontFamily:
          'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: "15px",
        primaryColor: "#ffffff",
        primaryTextColor: "#29334f",
        primaryBorderColor: "#00adfe",
        lineColor: "#8a96a6",
        secondaryColor: "#00adfe14",
        tertiaryColor: "#00adfe14",
        edgeLabelBackground: "#fbfcfd",
      },
      flowchart: {
        curve: "basis",
        htmlLabels: true,
        nodeSpacing: 34,
        rankSpacing: 48,
        padding: 18,
        useMaxWidth: false,
      },
    });
  }

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(updateDiagramScale);
    resizeObserver.observe(stage);
  } else {
    window.addEventListener("resize", updateDiagramScale);
  }

  selectFlow(0);

  const renderAllFlows = async () => {
    for (let index = 0; index < flows.length; index += 1) {
      await renderFlow(index);
    }
  };

  renderAllFlows();
}
