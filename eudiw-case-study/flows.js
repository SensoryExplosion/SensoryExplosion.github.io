const definitions = window.EUDI_FLOW_DEFINITIONS ?? {};

const flows = [
  {
    id: "activation",
    title: "Activate wallet and obtain Person Identification Data (PID)",
    summary:
      "Wallet Unit activation is completed before the user optionally obtains a PID from a PID Provider.",
    source: definitions.activation,
  },
  {
    id: "same-device",
    title: "Remote same-device presentation",
    summary:
      "A deep link opens the wallet, which verifies the relying party and registered request before authenticated approval and presentation.",
    source: definitions["same-device"],
  },
  {
    id: "cross-device",
    title: "Remote cross-device presentation",
    summary:
      "The wallet scans a QR code on another device, validates the relying party and request, then returns a clear result to both devices.",
    source: definitions["cross-device"],
  },
  {
    id: "proximity-supervised",
    title: "Supervised proximity presentation",
    summary:
      "A person-operated verifier presents an engagement method; the wallet validates it online or offline before authenticated sharing.",
    source: definitions["proximity-supervised"],
  },
  {
    id: "proximity-unsupervised",
    title: "Unsupervised proximity presentation",
    summary:
      "A self-service terminal connects to the wallet, which validates the terminal and request online or offline before authenticated sharing.",
    source: definitions["proximity-unsupervised"],
  },
  {
    id: "activity",
    title: "Review activity and exercise a right",
    summary:
      "Transaction records expose identifiers and contact routes without retaining attribute values, then support erasure, reporting, export, or local deletion.",
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

  const addActivationPhaseFrames = (svg) => {
    const sourceViewBox = svg.viewBox.baseVal;
    const viewBox = {
      x: sourceViewBox.x,
      y: sourceViewBox.y,
      width: sourceViewBox.width,
      height: sourceViewBox.height,
    };
    const root = svg.querySelector("g.root");

    if (!root) {
      return viewBox;
    }

    const svgNamespace = "http://www.w3.org/2000/svg";
    const frameLayer = document.createElementNS(svgNamespace, "g");
    const phaseDefinitions = [
      {
        label: "Phase 1 - Activate Wallet Unit",
        nodeIds: ["A", "B", "C", "D", "E"],
      },
      {
        label: "Phase 2 - Obtain PID",
        nodeIds: ["F", "G", "H", "I", "J", "K", "L", "M", "N"],
      },
    ];
    const horizontalInset = 20;
    const titleInset = 58;
    const bottomInset = 28;
    const frameBounds = [];

    const getTranslation = (element) => {
      const transform = element?.getAttribute("transform")?.match(
        /translate\(\s*(-?[\d.]+)(?:\s*,\s*|\s+)(-?[\d.]+)\s*\)/,
      );

      return transform
        ? { x: Number(transform[1]), y: Number(transform[2]) }
        : { x: 0, y: 0 };
    };

    const getNodeBounds = (nodeId) => {
      const node = Array.from(svg.querySelectorAll("g.node")).find((candidate) =>
        candidate.id.includes(`-flowchart-${nodeId}-`),
      );
      const shape = node?.querySelector("rect, polygon");

      if (!shape || !node) {
        return null;
      }

      const nodeTranslation = getTranslation(node);
      const shapeTranslation = getTranslation(shape);
      const translateX = nodeTranslation.x + shapeTranslation.x;
      const translateY = nodeTranslation.y + shapeTranslation.y;

      if (shape.tagName.toLowerCase() === "rect") {
        const x = translateX + Number(shape.getAttribute("x"));
        const y = translateY + Number(shape.getAttribute("y"));
        const width = Number(shape.getAttribute("width"));
        const height = Number(shape.getAttribute("height"));

        return { left: x, top: y, right: x + width, bottom: y + height };
      }

      const points = shape
        .getAttribute("points")
        .trim()
        .split(/\s+/)
        .map((point) => point.split(",").map(Number));
      const xValues = points.map(([x]) => translateX + x);
      const yValues = points.map(([, y]) => translateY + y);

      return {
        left: Math.min(...xValues),
        top: Math.min(...yValues),
        right: Math.max(...xValues),
        bottom: Math.max(...yValues),
      };
    };

    phaseDefinitions.forEach(({ label, nodeIds }) => {
      const nodeBounds = nodeIds.map(getNodeBounds).filter(Boolean);

      if (!nodeBounds.length) {
        return;
      }

      const left = Math.min(...nodeBounds.map((bounds) => bounds.left)) - horizontalInset;
      const top = Math.min(...nodeBounds.map((bounds) => bounds.top)) - titleInset;
      const right = Math.max(...nodeBounds.map((bounds) => bounds.right)) + horizontalInset;
      const bottom = Math.max(...nodeBounds.map((bounds) => bounds.bottom)) + bottomInset;
      const frame = document.createElementNS(svgNamespace, "g");
      const rect = document.createElementNS(svgNamespace, "rect");
      const title = document.createElementNS(svgNamespace, "text");

      frame.classList.add("phase-frame");
      rect.setAttribute("x", String(left));
      rect.setAttribute("y", String(top));
      rect.setAttribute("width", String(right - left));
      rect.setAttribute("height", String(bottom - top));
      rect.setAttribute("rx", "20");
      rect.setAttribute("ry", "20");
      title.setAttribute("x", String((left + right) / 2));
      title.setAttribute("y", String(top + 25));
      title.setAttribute("text-anchor", "middle");
      title.setAttribute("dominant-baseline", "middle");
      title.textContent = label;
      frame.append(rect, title);
      frameLayer.append(frame);
      frameBounds.push({ left, top, right, bottom });
    });

    if (frameBounds.length === 2) {
      const phaseOneEnd = getNodeBounds("E");
      const phaseTwoStart = getNodeBounds("F");
      const marker = svg.querySelector('marker[id$="pointEnd"]');
      const connector = document.createElementNS(svgNamespace, "line");
      const markerTipOffset = 5;

      connector.classList.add("phase-connector");
      connector.setAttribute("x1", String(frameBounds[0].right));
      connector.setAttribute("x2", String(frameBounds[1].left - markerTipOffset));
      connector.setAttribute("y1", String((phaseOneEnd.top + phaseOneEnd.bottom) / 2));
      connector.setAttribute("y2", String((phaseTwoStart.top + phaseTwoStart.bottom) / 2));

      if (marker?.id) {
        connector.setAttribute("marker-end", `url(#${marker.id})`);
      }

      frameLayer.append(connector);
    }

    root.insertBefore(frameLayer, root.firstChild);

    const expandedLeft = Math.min(viewBox.x, ...frameBounds.map((bounds) => bounds.left));
    const expandedTop = Math.min(viewBox.y, ...frameBounds.map((bounds) => bounds.top));
    const expandedRight = Math.max(
      viewBox.x + viewBox.width,
      ...frameBounds.map((bounds) => bounds.right),
    );
    const expandedBottom = Math.max(
      viewBox.y + viewBox.height,
      ...frameBounds.map((bounds) => bounds.bottom),
    );
    const expandedViewBox = {
      x: expandedLeft,
      y: expandedTop,
      width: expandedRight - expandedLeft,
      height: expandedBottom - expandedTop,
    };

    svg.setAttribute(
      "viewBox",
      `${expandedViewBox.x} ${expandedViewBox.y} ${expandedViewBox.width} ${expandedViewBox.height}`,
    );

    return expandedViewBox;
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

      const sourceViewBox = svg.viewBox.baseVal;
      const viewBox =
        flow.id === "activation"
          ? addActivationPhaseFrames(svg)
          : {
              x: sourceViewBox.x,
              y: sourceViewBox.y,
              width: sourceViewBox.width,
              height: sourceViewBox.height,
            };
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
        nodeSpacing: 42,
        rankSpacing: 56,
        padding: 18,
        wrappingWidth: 300,
        subGraphTitleMargin: {
          top: 14,
          bottom: 24,
        },
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
