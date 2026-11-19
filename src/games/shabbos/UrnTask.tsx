import React, { useRef } from 'react';
import { INK, P, Urn } from './art';
import { PlugCord } from './PlugCord';
import { BOIL_SECONDS } from './logic/levels';
import { sfx } from './sfx';

export interface UrnState {
  plugged: boolean;
  on: boolean;
  /** Level time (s) when it was switched on. */
  onAt: number | null;
  boiled: boolean;
}

export const newUrn = (): UrnState => ({ plugged: false, on: false, onAt: null, boiled: false });

export function boilProgress(u: UrnState, t: number) {
  if (u.boiled) return 1;
  if (!u.on || u.onAt === null) return 0;
  return Math.min(1, (t - u.onAt) / BOIL_SECONDS);
}

export function urnStatus(u: UrnState, t: number): string {
  if (u.boiled) return 'Hot water ready';
  if (u.on) return `Boiling ${Math.ceil(BOIL_SECONDS * (1 - boilProgress(u, t)))}s`;
  return u.plugged ? 'Flip it ON' : 'Plug it in';
}

/** Compact urn station: drag the plug into the socket, tap the big switch, wait 10 s. */
export function UrnTask({ urn, t, onChange, showHint }: { urn: UrnState; t: number; onChange: (u: UrnState) => void; showHint: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const prog = boilProgress(urn, t);
  const left = Math.ceil(BOIL_SECONDS * (1 - prog));

  const flip = () => {
    if (urn.on) return;
    if (!urn.plugged) {
      sfx.wrong();
      return;
    }
    sfx.click();
    onChange({ ...urn, on: true, onAt: t });
  };

  const R = 17;
  const C = 2 * Math.PI * R;
  return (
    <svg ref={svgRef} viewBox="0 -120 160 470" className="w-full h-full touch-none select-none" preserveAspectRatio="xMidYMax meet">
      <rect x={0} y={-130} width={160} height={392} fill={P.tile} />
      <g stroke={P.tileLine} strokeWidth={1.5}>
        {Array.from({ length: 15 }, (_, r) => (
          <line key={r} x1={0} y1={r * 27 - 135} x2={160} y2={r * 27 - 135} />
        ))}
        {Array.from({ length: 7 }, (_, c) => (
          <line key={c} x1={c * 27} y1={-130} x2={c * 27} y2={262} />
        ))}
      </g>
      <rect x={-4} y={260} width={168} height={12} fill={P.counter} stroke={INK} strokeWidth={2.5} />
      <rect x={-4} y={270} width={168} height={90} fill={P.counterEdge} stroke={INK} strokeWidth={2.5} />
      <Urn x={100} y={264} s={1.05} on={urn.on} boiled={urn.boiled} progress={prog} />
      {/* boil gauge */}
      <g transform="translate(36 150)">
        <circle r={R + 6} fill={P.cream} stroke={INK} strokeWidth={2.5} />
        <circle r={R} fill="none" stroke="#e5dccb" strokeWidth={7} />
        <circle r={R} fill="none" stroke={urn.boiled ? P.green : '#ff7a4a'} strokeWidth={7} strokeDasharray={`${C * prog} ${C}`} transform="rotate(-90)" strokeLinecap="round" />
        <text y={5} textAnchor="middle" className="sh-tiny" style={{ fontSize: 13 }} fill={INK}>
          {urn.boiled ? '✓' : urn.on ? `${left}s` : '100°'}
        </text>
      </g>
      {/* big rocker switch on the counter front */}
      <g onPointerDown={flip} style={{ cursor: urn.on ? 'default' : 'pointer' }}>
        <rect x={64} y={284} width={76} height={34} rx={8} fill={P.black} stroke={INK} strokeWidth={2.5} />
        <rect x={urn.on ? 102 : 68} y={288} width={34} height={26} rx={5} fill={urn.on ? '#ff5a3c' : '#8b8494'} stroke={INK} strokeWidth={2} />
        <text x={urn.on ? 119 : 85} y={306} textAnchor="middle" className="sh-tiny" fill="#fff">
          {urn.on ? 'ON' : 'OFF'}
        </text>
        {urn.plugged && !urn.on && <rect x={58} y={278} width={88} height={46} rx={12} fill="none" stroke="#fff" strokeWidth={3.5} strokeDasharray="6 5" className="sh-pulse" />}
        <rect x={54} y={274} width={100} height={56} fill="transparent" />
      </g>
      <PlugCord
        svgRef={svgRef}
        socket={{ x: 34, y: 54 }}
        rest={{ x: 26, y: 300 }}
        anchor={{ x: 74, y: 258 }}
        plugged={urn.plugged}
        onPlug={() => onChange({ ...urn, plugged: true })}
        hint={showHint || !urn.plugged}
        scale={0.85}
      />
    </svg>
  );
}
