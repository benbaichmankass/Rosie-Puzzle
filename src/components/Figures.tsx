/**
 * SVG figures drawn in "cell units": one grid square = S units.
 * People and Rosie are built from their cells as a little skeleton
 * (head -> torso -> hips -> legs, hands off the torso) so every pose
 * reads as a body lying in bed, with the profile photo as the face.
 */
import React, { useId } from 'react';
import { DogCellT, Pose, PoseCell } from '../utils/puzzle';

export const S = 100;

type Pt = { x: number; y: number };
const center = (r: number, c: number): Pt => ({ x: (c + 0.5) * S, y: (r + 0.5) * S });
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const norm = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};
const perp = (v: Pt): Pt => ({ x: -v.y, y: v.x });
const poly = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const angle = (v: Pt) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

export interface Palette {
  shirt: string;
  shirtDark: string;
  pants: string;
  sock: string;
  ring: string;
  skin: string;
}

export const PALETTES: Record<'boyfriend' | 'girlfriend', Palette> = {
  boyfriend: { shirt: '#6f9fe0', shirtDark: '#4f7fc4', pants: '#34548f', sock: '#f2c14e', ring: '#4f7fc4', skin: '#e9b896' },
  girlfriend: { shirt: '#52b79a', shirtDark: '#3a9a7f', pants: '#2c6e5c', sock: '#f08a8a', ring: '#3a9a7f', skin: '#e2ad88' },
};

function PhotoHead({ at, r, photo, ring, className }: { at: Pt; r: number; photo: string; ring: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <g className={className}>
      <defs>
        <clipPath id={`clip-${id}`}>
          <circle cx={at.x} cy={at.y} r={r} />
        </clipPath>
      </defs>
      <circle cx={at.x} cy={at.y + 3} r={r + 4} fill="rgba(60,30,10,0.18)" />
      <circle cx={at.x} cy={at.y} r={r + 4} fill={ring} />
      <circle cx={at.x} cy={at.y} r={r} fill="#f3e3d3" />
      <image
        href={photo}
        x={at.x - r}
        y={at.y - r}
        width={r * 2}
        height={r * 2}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#clip-${id})`}
      />
    </g>
  );
}

/** Walk the leg chains that hang off the hips cell. */
function legChains(cells: PoseCell[], hipsIdx: number): number[][] {
  const kids = (i: number) => cells.map((c, j) => (c.parent === i && c.part === 'leg' ? j : -1)).filter((j) => j >= 0);
  const chains: number[][] = [];
  const walk = (i: number, path: number[]) => {
    const k = kids(i);
    if (!k.length) {
      chains.push(path);
      return;
    }
    k.forEach((j) => walk(j, [...path, j]));
  };
  const first = kids(hipsIdx);
  first.forEach((j) => walk(j, [j]));
  return chains;
}

export function PersonFigure({
  pose,
  col = 0,
  photo,
  palette,
  sleeping = true,
  delay = 0,
}: {
  pose: Pose;
  col?: number;
  photo: string;
  palette: Palette;
  sleeping?: boolean;
  delay?: number;
}) {
  const cells = pose.cells;
  const pt = (i: number) => center(cells[i].r, cells[i].c + col);
  const torsoIdx = cells.findIndex((c) => c.part === 'torso');
  const hipsIdx = cells.findIndex((c) => c.part === 'hips');
  const H = pt(0);
  const T = pt(torsoIdx);
  const hipsC = pt(hipsIdx);
  const Sh = lerp(H, T, 0.6);
  const P = lerp(T, hipsC, 0.85);
  const axis = norm(Sh, P);
  const side = perp(axis);

  const hands = cells.map((c, i) => (c.part === 'hand' ? i : -1)).filter((i) => i >= 0);
  const chains = legChains(cells, hipsIdx);

  // Legs
  type Leg = { pts: Pt[]; w: number };
  const legs: Leg[] = [];
  if (chains.length === 0) {
    // Knees tucked: short legs folded inside the hips square.
    const knee = add(P, side, 24);
    const foot = add(knee, axis, -10);
    legs.push({ pts: [add(P, side, -10), add(knee, side, -14), foot], w: 22 });
    legs.push({ pts: [add(P, side, 10), knee, add(foot, side, 8)], w: 22 });
  } else if (chains.length === 1) {
    const path = [P, ...chains[0].map(pt)];
    for (const off of [-12, 12]) {
      legs.push({
        pts: path.map((p, i) => {
          const dir = i === 0 ? norm(path[0], path[1]) : norm(path[i - 1], path[i]);
          return add(p, perp(dir), off);
        }),
        w: 22,
      });
    }
  } else {
    chains.forEach((ch) => legs.push({ pts: [P, ...ch.map(pt)], w: 25 }));
  }

  // Arms
  type Arm = { from: Pt; to: Pt };
  const arms: Arm[] = hands.map((h) => {
    const target = pt(h);
    const towards = (target.x - Sh.x) * side.x + (target.y - Sh.y) * side.y >= 0 ? 1 : -1;
    return { from: add(Sh, side, 22 * towards), to: lerp(Sh, target, 0.92) };
  });
  const usedSides: number[] = hands.map((h) => {
    const target = pt(h);
    return (target.x - Sh.x) * side.x + (target.y - Sh.y) * side.y >= 0 ? 1 : -1;
  });
  for (const s of [-1, 1] as const) {
    if (arms.length >= 2) break;
    if (usedSides.includes(s)) continue;
    const from = add(Sh, side, 25 * s);
    arms.push({ from, to: add(lerp(Sh, P, 0.7), side, 30 * s) });
  }

  const style = { animationDelay: `${delay}s` } as React.CSSProperties;

  return (
    <g>
      {/* soft shadow on the duvet */}
      <path d={poly([H, Sh, T, P])} stroke="rgba(70,40,20,0.10)" strokeWidth={70} strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(4 6)" />

      {/* legs */}
      <g className={sleeping ? 'fig-legs' : undefined} style={style}>
        {legs.map((l, i) => (
          <path key={i} d={poly(l.pts)} stroke={palette.pants} strokeWidth={l.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        {legs.map((l, i) => {
          const end = l.pts[l.pts.length - 1];
          const dir = norm(l.pts[l.pts.length - 2], end);
          const foot = add(end, dir, 8);
          return (
            <ellipse key={`f${i}`} cx={foot.x} cy={foot.y} rx={15} ry={10} fill={palette.sock} stroke="rgba(0,0,0,0.12)" strokeWidth={2} transform={`rotate(${angle(dir)} ${foot.x} ${foot.y})`} />
          );
        })}
      </g>

      {/* torso */}
      <g className={sleeping ? 'fig-breathe' : undefined} style={style}>
        <path d={poly([Sh, T, P])} stroke={palette.shirt} strokeWidth={60} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={poly([lerp(T, P, 0.55), P])} stroke={palette.pants} strokeWidth={56} strokeLinecap="round" fill="none" />
        {/* pajama buttons */}
        {[0.25, 0.5, 0.75].map((t) => {
          const b = lerp(Sh, lerp(T, P, 0.5), t);
          return <circle key={t} cx={b.x} cy={b.y} r={3.2} fill="#ffffff" opacity={0.85} />;
        })}
        {/* arms */}
        {arms.map((a, i) => (
          <g key={i}>
            <path d={poly([a.from, a.to])} stroke={palette.shirtDark} strokeWidth={19} strokeLinecap="round" fill="none" />
            <circle cx={a.to.x} cy={a.to.y} r={10} fill={palette.skin} stroke="rgba(0,0,0,0.12)" strokeWidth={2} />
          </g>
        ))}
      </g>

      {/* neck + head */}
      <path d={poly([H, lerp(H, Sh, 0.9)])} stroke={palette.skin} strokeWidth={18} strokeLinecap="round" />
      <PhotoHead at={H} r={36} photo={photo} ring={palette.ring} className={sleeping ? 'fig-head' : undefined} />
      {sleeping && (
        <text x={H.x + 30} y={H.y - 22} className="fig-zzz" style={style} fontSize={22} fontWeight={700} fill="#7c6bb0">
          z
        </text>
      )}
    </g>
  );
}

export function DogFigure({ cells, photo, grumpy }: { cells: DogCellT[]; photo: string; grumpy: number }) {
  const pts = cells.map((c) => center(c.r, c.c));
  const H = pts[0];
  const black = '#2b2a2e';
  const white = '#f7f3ec';
  const body = cells.map((c, i) => (c.part === 'body' ? i : -1)).filter((i) => i >= 0);
  const edges = cells.map((c, i) => (c.parent >= 0 ? { from: c.parent, to: i, part: c.part } : null)).filter(Boolean) as {
    from: number;
    to: number;
    part: string;
  }[];
  const firstChild = edges.find((e) => e.from === 0);
  const neckDir = firstChild ? norm(H, pts[firstChild.to]) : { x: 0, y: 1 };

  return (
    <g className={grumpy > 0 ? 'dog-grumpy' : undefined}>
      {/* shadow */}
      <g transform="translate(4 6)" opacity={0.12}>
        {edges.map((e, i) => (
          <path key={i} d={poly([pts[e.from], pts[e.to]])} stroke="#3b1f0f" strokeWidth={74} strokeLinecap="round" fill="none" />
        ))}
      </g>
      <g className="fig-breathe">
        {/* fur: Rosie fills every square she is lying on */}
        {edges.map((e, i) => (
          <path key={i} d={poly([pts[e.from], pts[e.to]])} stroke={black} strokeWidth={74} strokeLinecap="round" fill="none" />
        ))}
        {cells.map((c, i) => (i === 0 ? null : <circle key={`b${i}`} cx={pts[i].x} cy={pts[i].y} r={40} fill={black} />))}
        {/* border-collie white patches */}
        {body.map((i, k) =>
          k % 2 === 1 ? <ellipse key={`w${i}`} cx={pts[i].x + 8} cy={pts[i].y - 6} rx={18} ry={12} fill={white} opacity={0.95} /> : null
        )}
        {/* white paws at the end of each leg */}
        {edges
          .filter((e) => e.part === 'paw')
          .map((e, i) => {
            const dir = norm(pts[e.from], pts[e.to]);
            const tip = add(pts[e.to], dir, 26);
            const n = perp(dir);
            return (
              <g key={`p${i}`}>
                {[-11, 11].map((o) => {
                  const q = add(tip, n, o);
                  return <ellipse key={o} cx={q.x} cy={q.y} rx={11} ry={13} fill={white} stroke="rgba(0,0,0,0.18)" strokeWidth={2} transform={`rotate(${angle(dir) + 90} ${q.x} ${q.y})`} />;
                })}
              </g>
            );
          })}
        {/* tail curling out of the last square */}
        {edges
          .filter((e) => e.part === 'tail')
          .map((e, i) => {
            const dir = norm(pts[e.from], pts[e.to]);
            const a = add(pts[e.to], dir, 18);
            const b = add(add(a, dir, 26), perp(dir), 24);
            const mid = add(add(a, dir, 26), perp(dir), -6);
            return (
              <g key={`t${i}`} className="dog-tail" style={{ transformOrigin: `${a.x}px ${a.y}px` }}>
                <path d={`M${a.x} ${a.y} Q${mid.x} ${mid.y} ${b.x} ${b.y}`} stroke={black} strokeWidth={20} strokeLinecap="round" fill="none" />
                <circle cx={b.x} cy={b.y} r={10} fill={white} />
              </g>
            );
          })}
        {/* white chest blaze */}
        <ellipse cx={H.x + neckDir.x * 34} cy={H.y + neckDir.y * 34} rx={20} ry={14} fill={white} transform={`rotate(${angle(neckDir) + 90} ${H.x + neckDir.x * 34} ${H.y + neckDir.y * 34})`} />
      </g>
      {/* ears + head */}
      <g className="fig-head">
        <path d={`M${H.x - 30} ${H.y - 14} L${H.x - 30} ${H.y - 48} L${H.x - 6} ${H.y - 30} Z`} fill={black} />
        <path d={`M${H.x + 30} ${H.y - 14} L${H.x + 30} ${H.y - 48} L${H.x + 6} ${H.y - 30} Z`} fill={black} />
        <PhotoHead at={H} r={34} photo={photo} ring={black} />
      </g>
      {grumpy === 0 ? (
        <text x={H.x + 28} y={H.y - 30} className="fig-zzz" fontSize={20} fontWeight={700} fill="#7c6bb0">
          z
        </text>
      ) : (
        <text x={H.x + 22} y={H.y - 34} fontSize={26} fontWeight={800} fill="#d9480f">
          {grumpy >= 2 ? 'GRR' : '!'}
        </text>
      )}
    </g>
  );
}

/** Small standalone preview of a pose (used in the pose picker). */
export function PosePreview({ pose, photo, palette, height = 120 }: { pose: Pose; photo: string; palette: Palette; height?: number }) {
  const pad = 12;
  const w = pose.width * S + pad * 2;
  const h = pose.height * S + pad * 2;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w} ${h}`} style={{ height, width: (height * w) / h, maxWidth: '100%' }} aria-hidden="true">
      {pose.cells.map((c, i) => (
        <rect key={i} x={c.c * S + 4} y={c.r * S + 4} width={S - 8} height={S - 8} rx={14} fill="rgba(255,255,255,0.55)" stroke="rgba(120,80,40,0.25)" strokeDasharray="6 6" strokeWidth={2} />
      ))}
      <PersonFigure pose={pose} photo={photo} palette={palette} sleeping={false} />
    </svg>
  );
}
