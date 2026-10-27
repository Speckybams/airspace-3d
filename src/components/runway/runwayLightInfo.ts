export type RunwayLightInfo = { label: string; detail: string };

const THRESHOLD_GREENS = new Set(["#00800c", "#00ff28"]);

function parseFill(style: string | null): string | null {
  if (!style) return null;
  const match = style.match(/fill:(#[0-9a-f]{3,8})/i);
  return match ? match[1].toLowerCase() : null;
}

/** Map Wikimedia night-diagram light colours + position to a short label. */
export function lightInfoForSvgElement(el: SVGGraphicsElement, svgWidth: number, svgHeight: number): RunwayLightInfo | null {
  const fill = parseFill(el.getAttribute("style"));
  if (!fill || fill === "#333333" || fill === "#000000") return null;

  let box: DOMRect;
  try {
    box = el.getBBox();
  } catch {
    return null;
  }
  if (box.width > 90 || box.height > 90) return null;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  if (THRESHOLD_GREENS.has(fill)) {
    return {
      label: "Threshold light (green)",
      detail: "Green threshold lights — visible when approaching to land on this runway.",
    };
  }
  if (fill === "#ffe501") {
    return {
      label: "Runway edge light (yellow)",
      detail: "Yellow edge lights — typically the last third of the runway length.",
    };
  }
  if (fill === "#ff0000") {
    if (cx > svgWidth * 0.84) {
      return {
        label: "Runway end light (red)",
        detail: "Red runway end identifier lights at the departure / stop end.",
      };
    }
    if (cx < svgWidth * 0.14) {
      return {
        label: "Approach light (red)",
        detail: "Red segment on approach lighting — distance or threshold crossing cue.",
      };
    }
    if (Math.abs(cy - svgHeight / 2) < 28) {
      return {
        label: "Centreline light (red)",
        detail: "Red centreline lights — caution, last portion of runway remaining.",
      };
    }
    return {
      label: "Red runway light",
      detail: "Red light on approach or runway lighting system.",
    };
  }
  if (fill === "#ffffff") {
    if (cx < svgWidth * 0.2) {
      return {
        label: "Approach light (white)",
        detail: "White approach lighting (ALS-style) leading to the threshold.",
      };
    }
    const edge = cy < svgHeight * 0.34 || cy > svgHeight * 0.66;
    if (edge) {
      return {
        label: "Runway edge light (white)",
        detail: "White runway edge light along the usable runway surface.",
      };
    }
    return {
      label: "Centreline light (white)",
      detail: "White centreline light on a precision approach runway.",
    };
  }
  return null;
}

export function wireRunwayLightingSvg(root: SVGSVGElement, onPick: (info: RunwayLightInfo | null) => void) {
  const width = root.viewBox.baseVal.width || Number(root.getAttribute("width")) || 6094;
  const height = root.viewBox.baseVal.height || Number(root.getAttribute("height")) || 275;
  const layer = root.querySelector("#layer2");
  if (!layer) return () => {};

  const paths = layer.querySelectorAll<SVGPathElement>("path");
  const cleanups: (() => void)[] = [];

  paths.forEach((path) => {
    const info = lightInfoForSvgElement(path, width, height);
    if (!info) return;

    path.classList.add("runway-light-hit");
    path.style.cursor = "pointer";
    path.setAttribute("role", "button");
    path.setAttribute("tabindex", "0");
    path.setAttribute("aria-label", info.label);

    const onActivate = (event: Event) => {
      event.stopPropagation();
      onPick(info);
    };
    path.addEventListener("click", onActivate);
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onPick(info);
      }
    });
    cleanups.push(() => {
      path.removeEventListener("click", onActivate);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
