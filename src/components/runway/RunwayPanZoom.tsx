import { useCallback, useRef, useState, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";

const MIN_SCALE = 0.35;
const MAX_SCALE = 24;

export function RunwayPanZoom({
  children,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; active: boolean } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const onWheel = useCallback((event: ReactWheelEvent) => {
    event.preventDefault();
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScale((prev) => {
      const next = clampScale(prev * factor);
      const ratio = next / prev;
      setTx((t) => px - ratio * (px - t));
      setTy((t) => py - ratio * (py - t));
      return next;
    });
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as Element).closest(".runway-light-hit")) return;
    if (event.pointerType === "touch" && event.isPrimary === false) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, tx, ty, active: true };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    setTx(drag.tx + (event.clientX - drag.x));
    setTy(drag.ty + (event.clientY - drag.y));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (dragRef.current) dragRef.current.active = false;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { dist, scale };
    }
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length !== 2 || !pinchRef.current) return;
    event.preventDefault();
    const [a, b] = [event.touches[0], event.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const next = clampScale((pinchRef.current.scale * dist) / pinchRef.current.dist);
    setScale(next);
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  const resetView = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  return (
    <div className={className ?? "runway-pan-zoom-wrap"}>
      <div className="runway-pan-zoom-toolbar">
        <button type="button" className="btn runway-pan-zoom-reset" onClick={resetView}>
          Reset view
        </button>
        <span className="tiny muted mono">{Math.round(scale * 100)}%</span>
      </div>
      <div
        ref={rootRef}
        className="runway-pan-zoom"
        role="region"
        aria-label={ariaLabel}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="runway-pan-zoom-inner"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
