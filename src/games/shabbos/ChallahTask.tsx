import React, { useEffect, useRef, useState } from 'react';
import { braidRows, isComplete, legalMoves, resolveDrop, ruleText, span, tryMove, type BraidState } from './logic/challah';
import { INK, P } from './art';
import { sfx } from './sfx';

const W = 360;
const H = 430;
const KNOT_Y = 400;
const TOP_Y = 78;
const STRAND = 17;

function svgPoint(svg: SVGSVGElement, e: React.PointerEvent) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const m = svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

const vcurve = (x0: number, y0: number, x1: number, y1: number) => {
  const d = (y0 - y1) * 0.5;
  return `M ${x0} ${y0} C ${x0} ${y0 - d} ${x1} ${y1 + d} ${x1} ${y1}`;
};

/** A dough strand. `overlay` segments get round fill caps that blend into the strand underneath (no seams). */
function StrandSeg({ d, baked, hi = true, overlay = false }: { d: string; baked: boolean; hi?: boolean; overlay?: boolean }) {
  const cap = overlay ? 'round' : 'butt';
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth={STRAND + 6} fill="none" strokeLinecap="butt" />
      <path d={d} stroke={baked ? P.baked : P.dough} strokeWidth={STRAND} fill="none" strokeLinecap={cap} />
      {hi && <path d={d} stroke={baked ? P.bakedHi : P.doughHi} strokeWidth={4} fill="none" strokeLinecap={cap} transform="translate(-3 0)" opacity={0.9} />}
    </g>
  );
}

export function ChallahTask({ braid, onChange, showHint }: { braid: BraidState; onChange: (b: BraidState) => void; showHint: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; x0: number } | null>(null);
  const [flash, setFlash] = useState<{ x: number; y: number; ok: boolean; key: number } | null>(null);
  const [msg, setMsg] = useState<string>(ruleText(braid.n));
  const [shake, setShake] = useState(0);
  const [hintOn, setHintOn] = useState(false);

  const n = braid.n;
  const done = isComplete(braid);
  const rows = braidRows(braid);
  const K = rows.length - 1;
  const rowH = Math.min(38, 250 / braid.target);
  const bsp = 24;
  const fsp = Math.min(84, 290 / (n - 1));
  const bx = (pos: number) => W / 2 + (pos - (n - 1) / 2) * bsp;
  const fx = (pos: number) => W / 2 + (pos - (n - 1) / 2) * fsp;
  const rowY = (k: number) => KNOT_Y - 14 - k * rowH;
  const posOf = (row: number[], s: number) => row.indexOf(s);
  const last = rows[K];

  // Each strand is one continuous path (knot -> braid rows -> free end), so there are no seams;
  // then each crossing segment is redrawn on top so the moved strand lies OVER the others.
  const segs: React.ReactNode[] = [];
  const draggedStrand = drag ? last[drag.from] : -1;
  const strandPath = (s: number) => {
    let d = `M ${bx(posOf(rows[0], s))} ${rowY(0)}`;
    for (let k = 1; k <= K; k++) d += vcurve(bx(posOf(rows[k - 1], s)), rowY(k - 1), bx(posOf(rows[k], s)), rowY(k)).replace(/^M [^C]+/, ' ');
    const p = posOf(last, s);
    const ex = s === draggedStrand && drag ? drag.x : fx(p);
    const ey = s === draggedStrand && drag ? drag.y : TOP_Y;
    d += vcurve(bx(p), rowY(K), ex, ey).replace(/^M [^C]+/, ' ');
    return { d, ex, ey };
  };
  const order = last.slice().sort((a, b) => (a === draggedStrand ? 1 : 0) - (b === draggedStrand ? 1 : 0));
  const paths = new Map(order.map((s) => [s, strandPath(s)]));
  for (const s of order) {
    if (s === draggedStrand) continue;
    segs.push(
      <g key={`s-${s}`}>
        <StrandSeg d={paths.get(s)!.d} baked={done} />
      </g>,
    );
  }
  for (let k = 1; k <= K; k++) {
    const c = braid.crosses[k - 1].strand;
    const d = vcurve(bx(posOf(rows[k - 1], c)), rowY(k - 1), bx(posOf(rows[k], c)), rowY(k));
    segs.push(
      <g key={`x-${k}`}>
        <StrandSeg d={d} baked={done} overlay />
      </g>,
    );
  }
  if (draggedStrand >= 0) {
    segs.push(
      <g key={`s-${draggedStrand}`}>
        <StrandSeg d={paths.get(draggedStrand)!.d} baked={done} />
      </g>,
    );
  }
  for (const s of order) {
    const { ex, ey } = paths.get(s)!;
    if (done) segs.push(<circle key={`tip-${s}`} cx={ex} cy={ey} r={STRAND / 2 + 1} fill={P.baked} stroke={INK} strokeWidth={3} />);
  }

  const moves = legalMoves(braid);
  const hint = (showHint || hintOn) && !done && !drag ? moves[0] : null;
  const hintStrand = hint ? last[hint.from] : -1;

  // After a few idle seconds, show the next correct move.
  useEffect(() => {
    if (done) return;
    setHintOn(false);
    const t = setTimeout(() => setHintOn(true), 3000);
    return () => clearTimeout(t);
  }, [braid.crosses.length, braid.mistakes, done]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [flash]);

  const startDrag = (pos: number) => (e: React.PointerEvent) => {
    if (done || !svgRef.current) return;
    e.preventDefault();
    svgRef.current.setPointerCapture?.(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ from: pos, x: p.x, y: p.y, x0: p.x });
    sfx.tap();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    setDrag({ ...drag, x: Math.max(16, Math.min(W - 16, p.x)), y: Math.max(30, Math.min(rowY(K) - 24, p.y)) });
  };
  const onUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    const to = resolveDrop(braid, d.from, (d.x - d.x0) / fsp);
    if (to === null || to === d.from) return;
    const r = tryMove(braid, d.from, to);
    if (r.ok) {
      sfx.braid();
      setFlash({ x: fx(to), y: TOP_Y, ok: true, key: Date.now() });
      const left = r.state.target - r.state.crosses.length;
      setMsg(left === 0 ? 'Beautiful braid!' : `Nice! ${left} more cross${left === 1 ? '' : 'es'}.`);
      if (left === 0) sfx.done();
      onChange(r.state);
    } else {
      sfx.wrong();
      setFlash({ x: d.x, y: d.y, ok: false, key: Date.now() });
      setShake((v) => v + 1);
      setHintOn(true);
      const k = span(n);
      const reason = (r as { reason: string }).reason;
      setMsg(
        reason === 'not-outer'
          ? 'Grab an OUTSIDE strand (left or right end).'
          : reason === 'wrong-side'
            ? 'Now the other side! Alternate left and right.'
            : `Drag it over ${k === 1 ? 'the middle strand' : `${k} strands`}, toward the middle.`,
      );
      onChange(r.state);
    }
  };

  const zoneW = Math.min(fsp, 120);
  return (
    <div className="flex flex-col items-center h-full">
      <div className={`sh-msg sh-msg-sm ${shake ? 'sh-shake' : ''}`} key={shake}>
        {hint && hintOn ? `Hint: drag the glowing ${hint.side === 'R' ? 'right' : 'left'} strand over toward the middle.` : msg}
      </div>
      <svg
        ref={svgRef}
        viewBox={`12 8 ${W - 24} ${H - 2}`}
        className="w-full flex-1 touch-none select-none"
        style={{ maxHeight: '100%', touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
      >
        {/* board */}
        <rect x={20} y={36} width={320} height={384} rx={26} fill={P.wood} stroke={INK} strokeWidth={3} />
        <rect x={34} y={50} width={292} height={356} rx={18} fill="none" stroke={P.woodDark} strokeWidth={3} opacity={0.6} />
        {[110, 190, 270, 340].map((y) => (
          <path key={y} d={`M 40 ${y} q 60 -8 130 0 t 150 2`} stroke={P.woodDark} strokeWidth={2} fill="none" opacity={0.35} />
        ))}
        {[
          [70, 380],
          [290, 360],
          [80, 120],
          [270, 100],
          [300, 250],
          [60, 260],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={6 + (i % 3) * 3} fill="#fff8ea" opacity={0.35} />
        ))}
        {/* glow under the strand to move next */}
        {hintStrand >= 0 && (
          <path d={paths.get(hintStrand)!.d} stroke="#fff27a" strokeWidth={STRAND + 24} fill="none" strokeLinecap="round" opacity={0.95} className="sh-pulse" pointerEvents="none" />
        )}
        {segs}
        {/* knot where the strands are joined */}
        <ellipse cx={W / 2} cy={KNOT_Y - 8} rx={bsp * (n - 1) / 2 + 16} ry={14} fill={done ? P.baked : P.dough} stroke={INK} strokeWidth={3} />
        <path d={`M ${W / 2 - bsp * (n - 1) / 2 - 4} ${KNOT_Y - 10} q ${bsp * (n - 1) / 2 + 4} 8 ${bsp * (n - 1) + 8} 0`} stroke={done ? P.bakedHi : P.doughHi} strokeWidth={4} fill="none" />
        {/* grab knobs on each strand end */}
        {!done &&
          order.map((s2) => {
            const { ex, ey } = paths.get(s2)!;
            const pos = posOf(last, s2);
            const outer = pos === 0 || pos === n - 1;
            return (
              <g key={`knob-${s2}`} pointerEvents="none">
                <circle cx={ex} cy={ey} r={16} fill={P.dough} stroke={INK} strokeWidth={3} />
                <path d={`M ${ex - 6} ${ey - 4} h 12 M ${ex - 6} ${ey} h 12 M ${ex - 6} ${ey + 4} h 12`} stroke={P.woodDark} strokeWidth={2} strokeLinecap="round" />
                {outer && <circle cx={ex} cy={ey} r={21} fill="none" stroke="#fff" strokeWidth={2.5} opacity={0.8} />}
              </g>
            );
          })}
        {hint && (
          <g className="sh-pulse" pointerEvents="none">
            <path
              d={`M ${fx(hint.from)} ${TOP_Y - 26} Q ${(fx(hint.from) + fx(hint.to)) / 2} ${TOP_Y - 64} ${fx(hint.to)} ${TOP_Y - 26}`}
              stroke="#fff"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
            />
            <path d={`M ${fx(hint.to)} ${TOP_Y - 18} l -10 -14 l 20 0 z`} fill="#fff" />
          </g>
        )}
        {flash && (
          <g key={flash.key} pointerEvents="none" className="sh-burst">
            <circle cx={flash.x} cy={flash.y} r={28} fill="none" stroke={flash.ok ? P.green : P.red} strokeWidth={6} />
            {flash.ok ? (
              <path d={`M ${flash.x - 10} ${flash.y} l 7 7 l 13 -14`} stroke={P.green} strokeWidth={6} fill="none" strokeLinecap="round" />
            ) : (
              <path d={`M ${flash.x - 9} ${flash.y - 9} l 18 18 M ${flash.x + 9} ${flash.y - 9} l -18 18`} stroke={P.red} strokeWidth={6} strokeLinecap="round" />
            )}
          </g>
        )}
        {/* forgiving touch targets: a tall column over each free strand end */}
        {!done &&
          Array.from({ length: n }, (_, i) => (
            <rect
              key={i}
              data-strand-handle={i}
              x={fx(i) - zoneW / 2}
              y={TOP_Y - 44}
              width={zoneW}
              height={Math.max(90, rowY(K) - TOP_Y + 20)}
              fill="transparent"
              style={{ cursor: drag ? 'grabbing' : 'grab' }}
              onPointerDown={startDrag(i)}
            />
          ))}
        <text x={W / 2} y={H - 2} textAnchor="middle" className="sh-small" fill={P.cream} data-braid-progress>
          {done ? 'Braided!' : `${braid.crosses.length} / ${braid.target}`}
        </text>
      </svg>
    </div>
  );
}
