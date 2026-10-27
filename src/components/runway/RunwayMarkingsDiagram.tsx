import { useEffect, useRef } from "react";

const FIGURES = [
  {
    src: "/reference/runway-icao-standard.svg",
    title: "Full runway markings (2,468 m × 45 m, RWY 10/28)",
    className: "runway-reference-figure runway-reference-figure--plan",
  },
  {
    src: "/reference/runway-markings-icao.svg",
    title: "Threshold & touchdown zone (detail, labelled)",
    className: "runway-reference-figure runway-reference-figure--detail",
  },
] as const;

/** Wikimedia ICAO Annex 14 marking diagrams (vector, to scale). */
export function RunwayMarkingsDiagram() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    void (async () => {
      const blocks = await Promise.all(
        FIGURES.map(async (fig) => {
          const res = await fetch(fig.src);
          const text = await res.text();
          return { ...fig, text };
        }),
      );
      if (cancelled || !hostRef.current) return;

      host.innerHTML = "";
      for (const block of blocks) {
        const wrap = document.createElement("div");
        wrap.className = "runway-reference-block";
        const h = document.createElement("p");
        h.className = "runway-reference-block-title tiny muted";
        h.textContent = block.title;
        wrap.appendChild(h);
        const inner = document.createElement("div");
        inner.className = block.className;
        inner.innerHTML = block.text;
        const svg = inner.querySelector("svg");
        if (svg) {
          svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", block.title);
        }
        wrap.appendChild(inner);
        host.appendChild(wrap);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="runway-markings-diagram runway-reference-stack" ref={hostRef} aria-busy="true">
      <p className="tiny muted">Loading ICAO reference markings…</p>
    </div>
  );
}
