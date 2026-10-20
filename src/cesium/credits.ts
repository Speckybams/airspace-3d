const UPSELL = /upgrade for commercial use/i;

/** Hide the Community-plan upsell. Leave the ion logo and data attribution. */
export function hideIonUpsell(root: Element): () => void {
  const sweep = () => {
    root.querySelectorAll("a, span").forEach((node) => {
      const el = node as HTMLElement;
      if (el.querySelector("img")) return;
      if (!UPSELL.test(el.textContent ?? "")) return;
      el.style.display = "none";
      const previous = el.previousElementSibling as HTMLElement | null;
      if (previous?.classList.contains("cesium-credit-delimiter")) {
        previous.style.display = "none";
      }
    });
  };
  sweep();
  const observer = new MutationObserver(sweep);
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
