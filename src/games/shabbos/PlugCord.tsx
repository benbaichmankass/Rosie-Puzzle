import React, { useState } from 'react';
import { INK, Plug, Socket } from './art';
import { sfx } from './sfx';

export function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const m = svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

/**
 * A wall socket and a draggable plug on a cord. Drag the plug into the socket to plug in.
 * Render inside an <svg>; pass that svg's ref for pointer maths.
 */
export function PlugCord({
  svgRef,
  socket,
  rest,
  anchor,
  plugged,
  onPlug,
  hint,
  scale = 1,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  socket: { x: number; y: number };
  rest: { x: number; y: number };
  anchor: { x: number; y: number };
  plugged: boolean;
  onPlug: () => void;
  hint?: boolean;
  /** Size of socket and plug (1 = full-size panel). */
  scale?: number;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const pos = plugged ? { x: socket.x, y: socket.y + 12 * scale } : drag ?? rest;
  const sag = Math.max(30, Math.abs(pos.x - anchor.x) * 0.35);
  const cord = `M ${anchor.x} ${anchor.y} C ${anchor.x} ${anchor.y + sag} ${pos.x} ${pos.y + 6 + sag} ${pos.x} ${pos.y + 6}`;

  const down = (e: React.PointerEvent) => {
    if (plugged || !svgRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag(svgPoint(svgRef.current, e));
    sfx.tap();
  };
  const move = (e: React.PointerEvent) => {
    if (!drag || !svgRef.current) return;
    setDrag(svgPoint(svgRef.current, e));
  };
  const up = () => {
    if (!drag) return;
    const d = Math.hypot(drag.x - socket.x, drag.y + 4 - socket.y);
    setDrag(null);
    if (d < 48 * scale) {
      sfx.plug();
      onPlug();
    }
  };

  return (
    <g>
      <Socket x={socket.x} y={socket.y} s={1.6 * scale} />
      {!plugged && hint && !drag && (
        <g className="sh-pulse" pointerEvents="none">
          <circle cx={socket.x} cy={socket.y} r={30 * scale} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="7 6" />
        </g>
      )}
      <path d={cord} stroke={INK} strokeWidth={7 * scale} fill="none" strokeLinecap="round" />
      <path d={cord} stroke="#4a4552" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
      <Plug x={pos.x} y={pos.y} s={1.7 * scale} />
      {!plugged && (
        <circle
          cx={pos.x}
          cy={pos.y - 4 * scale}
          r={Math.max(26, 34 * scale)}
          fill="transparent"
          style={{ cursor: 'grab' }}
          className="touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag(null)}
        />
      )}
    </g>
  );
}
