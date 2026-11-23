"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Finger (or mouse) signature box. Puts the signature, as a picture, into a hidden form field.
 * The box is the same size on every phone so the layout never shifts.
 */
export function SignaturePad({ name, onChange }: { name: string; onChange?: (signed: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [signed, setSigned] = useState(false);

  // Sharp lines on high-resolution phone screens.
  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#15202b";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!signed) {
      setSigned(true);
      onChange?.(true);
    }
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (field.current) field.current.value = canvas.current!.toDataURL("image/png");
  }
  function clear() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    if (field.current) field.current.value = "";
    setSigned(false);
    onChange?.(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-40 overflow-hidden rounded-xl border-2 border-dashed border-line bg-white">
        <canvas
          ref={canvas}
          aria-label="Signature box. Sign with your finger."
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        {!signed && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#5b6672]">
            Sign here with your finger
          </span>
        )}
        <span className="pointer-events-none absolute bottom-8 left-4 right-4 border-b border-[#c9c2b6]" aria-hidden />
      </div>
      <input ref={field} type="hidden" name={name} />
      <button type="button" onClick={clear} className="self-end text-sm font-semibold text-primary">
        Clear signature
      </button>
    </div>
  );
}
