import React, { useEffect, useRef, useState } from 'react';
import { INK, P, PlataItem, PlataSurface } from './art';
import { PlugCord, svgPoint } from './PlugCord';
import { ITEMS, drop, itemById, landingY, supportsOf, type Placed } from './logic/plata';
import { sfx } from './sfx';

export interface PlataState {
  plugged: boolean;
  placed: Placed[];
}
export const newPlata = (): PlataState => ({ plugged: false, placed: [] });

const W = 360;
const H = 300;
const PLATE_Y = 200; // plate top in svg
const U = 0.85; // svg px per plate unit
const SHELF_Y = 284;
const COUNTER_Y = 218;

export function PlataTask({ plata, plateW, margin, onChange, showHint, onTopple }: { plata: PlataState; plateW: number; margin: number; onChange: (p: PlataState) => void; showHint: boolean; onTopple?: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [falling, setFalling] = useState<{ id: string; x: number; y: number; dir: number; key: number }[]>([]);
  const [msg, setMsg] = useState('');
  const fallKey = useRef(0);

  useEffect(() => {
    if (!falling.length) return;
    const t = setTimeout(() => setFalling([]), 900);
    return () => clearTimeout(t);
  }, [falling]);

  const placedIds = plata.placed.map((p) => p.id);
  const fallingIds = falling.map((f) => f.id);
  const shelf = ITEMS.filter((d) => !placedIds.includes(d.id) && !fallingIds.includes(d.id) && drag?.id !== d.id);
  const loaded = ITEMS.every((d) => placedIds.includes(d.id));

  const toUnits = (sx: number) => (sx - W / 2) / U;
  const clampX = (id: string, ux: number) => {
    const w = itemById(id).w;
    const lim = W / 2 / U - w / 2 + 4;
    return Math.max(-lim, Math.min(lim, ux));
  };

  const pick = (id: string) => (e: React.PointerEvent) => {
    if (!svgRef.current || drag) return;
    if (!plata.plugged) {
      sfx.wrong();
      setMsg('Plug the plata in first!');
      return;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    // Picking up a placed item: only if nothing rests on it.
    const onPlate = plata.placed.find((q) => q.id === id);
    if (onPlate) {
      const carrying = plata.placed.some((q) => supportsOf(plata.placed, q).some((s) => s.id === id));
      if (carrying) {
        sfx.wrong();
        setMsg('Take off what is on top first.');
        return;
      }
      onChange({ ...plata, placed: plata.placed.filter((q) => q.id !== id) });
    }
    sfx.tap();
    setMsg('');
    setDrag({ id, x: p.x, y: p.y });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    setDrag({ ...drag, x: p.x, y: p.y });
  };
  const release = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.y > COUNTER_Y + 22) return; // dropped back on the shelf
    const ux = clampX(d.id, toUnits(d.x));
    const r = drop(plata.placed, d.id, ux, plateW, margin);
    if (r.fell.length) {
      sfx.crash();
      onTopple?.();
      const all = [...plata.placed, r.landed];
      setFalling(
        r.fell.map((id) => {
          const p = all.find((q) => q.id === id) ?? r.landed;
          return { id, x: p.x, y: p.y, dir: p.x >= 0 ? 1 : -1, key: ++fallKey.current };
        }),
      );
      setMsg(r.reason === 'dome' ? 'Nothing stays on a round top!' : r.reason === 'off-plate' ? 'That hangs off the plata!' : 'Too wobbly, it toppled!');
    } else {
      sfx.thud();
      const left = ITEMS.length - r.placed.length;
      setMsg(left === 0 ? 'All loaded!' : '');
      if (left === 0) sfx.done();
    }
    onChange({ ...plata, placed: r.placed });
  };

  const ghostX = drag ? clampX(drag.id, toUnits(drag.x)) : 0;
  const ghostY = drag ? landingY(plata.placed, drag.id, ghostX) : 0;
  const ghostOver = drag && drag.y <= COUNTER_Y + 22;

  const status = loaded ? 'All loaded!' : msg || (plata.plugged ? (plata.placed.length === 0 ? 'Drag the food up onto the plata' : '') : 'Plug it in first');

  const shelfX = (i: number, n: number) => 14 + (i + 0.5) * ((W - 28) / Math.max(n, 1));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full touch-none select-none" preserveAspectRatio="xMidYMid meet" onPointerMove={move} onPointerUp={release} onPointerCancel={() => setDrag(null)}>
        <rect x={0} y={0} width={W} height={COUNTER_Y + 2} fill={P.tile} />
        <g stroke={P.tileLine} strokeWidth={1.5}>
          {Array.from({ length: 9 }, (_, r) => (
            <line key={r} x1={0} y1={r * 27} x2={W} y2={r * 27} />
          ))}
          {Array.from({ length: 14 }, (_, c) => (
            <line key={c} x1={c * 27} y1={0} x2={c * 27} y2={COUNTER_Y} />
          ))}
        </g>
        <rect x={-4} y={COUNTER_Y} width={W + 8} height={12} fill={P.counter} stroke={INK} strokeWidth={2.5} />
        <rect x={-4} y={COUNTER_Y + 10} width={W + 8} height={H} fill={P.counterEdge} stroke={INK} strokeWidth={2.5} />
        <PlugCord
          svgRef={svgRef}
          socket={{ x: W - 26, y: 36 }}
          rest={{ x: W - 18, y: PLATE_Y - 6 }}
          anchor={{ x: W / 2 + (plateW / 2) * U - 4, y: PLATE_Y + 12 }}
          scale={0.8}
          plugged={plata.plugged}
          onPlug={() => onChange({ ...plata, plugged: true })}
          hint={showHint || !plata.plugged}
        />
        {/* plate legs */}
        <rect x={W / 2 - (plateW / 2) * U + 6} y={PLATE_Y + 14} width={10} height={4} fill={INK} />
        <rect x={W / 2 + (plateW / 2) * U - 16} y={PLATE_Y + 14} width={10} height={4} fill={INK} />
        <g transform={`translate(${W / 2} ${PLATE_Y})`}>
          <PlataSurface w={plateW} on={plata.plugged} placed={plata.placed} unit={U} />
          {/* pick-up targets for placed items */}
          <g transform={`translate(0 ${-4 * U}) scale(${U})`}>
            {plata.placed.map((p) => {
              const d = itemById(p.id);
              return <rect key={p.id} x={p.x - d.w / 2} y={-p.y - d.h} width={d.w} height={d.h} fill="transparent" onPointerDown={pick(p.id)} />;
            })}
            {ghostOver && drag && (
              <g transform={`translate(${ghostX} ${-ghostY})`} opacity={0.45} pointerEvents="none">
                <PlataItem kind={itemById(drag.id).kind} w={itemById(drag.id).w} h={itemById(drag.id).h} />
              </g>
            )}
            {falling.map((f) => {
              const d = itemById(f.id);
              return (
                <g key={f.key} transform={`translate(${f.x} ${-f.y})`}>
                  <g className={f.dir > 0 ? 'sh-fall-r' : 'sh-fall-l'}>
                    <PlataItem kind={d.kind} w={d.w} h={d.h} />
                  </g>
                </g>
              );
            })}
          </g>
        </g>
        {/* shelf of food still to place */}
        {shelf.map((d, i) => (
          <g key={d.id} transform={`translate(${shelfX(i, shelf.length)} ${SHELF_Y}) scale(0.58)`} onPointerDown={pick(d.id)} style={{ cursor: 'grab' }}>
            <PlataItem kind={d.kind} w={d.w} h={d.h} />
            <rect x={-d.w / 2 - 10} y={-d.h - 16} width={d.w + 20} height={d.h + 26} fill="transparent" />
          </g>
        ))}
        {/* item being dragged */}
        {drag && (
          <g transform={`translate(${drag.x} ${drag.y + 20}) scale(${U})`} pointerEvents="none">
            <PlataItem kind={itemById(drag.id).kind} w={itemById(drag.id).w} h={itemById(drag.id).h} />
          </g>
        )}
        {status && (
          <text x={W / 2 - 14} y={18} textAnchor="middle" className="sh-tiny" style={{ fontSize: 15 }} fill={P.cream} stroke={INK} strokeWidth={4} paintOrder="stroke" pointerEvents="none">
            {status}
          </text>
        )}
    </svg>
  );
}
