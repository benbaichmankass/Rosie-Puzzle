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

export function UrnTask({ urn, t, onChange, showHint }: { urn: UrnState; t: number; onChange: (u: UrnState) => void; showHint: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const prog = boilProgress(urn, t);
  const left = Math.ceil(BOIL_SECONDS * (1 - prog));
  const msg = urn.boiled
    ? 'Hot water for all of Shabbat!'
    : urn.on
      ? `Boiling... ${left}s`
      : urn.plugged
        ? 'Now flip the switch ON.'
        : 'Drag the plug into the socket.';

  const flip = () => {
    if (urn.on) return;
    if (!urn.plugged) {
      sfx.wrong();
      return;
    }
    sfx.click();
    onChange({ ...urn, on: true, onAt: t });
  };

  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center h-full">
      <div className="sh-msg">{msg}</div>
      <svg ref={svgRef} viewBox="0 0 360 430" className="w-full flex-1 touch-none select-none" style={{ maxHeight: '100%' }}>
        <rect x={0} y={0} width={360} height={330} fill={P.tile} />
        <g stroke={P.tileLine} strokeWidth={2}>
          {Array.from({ length: 15 }, (_, r) => (
            <line key={r} x1={0} y1={r * 30} x2={360} y2={r * 30} />
          ))}
          {Array.from({ length: 13 }, (_, c) => (
            <line key={c} x1={c * 30} y1={0} x2={c * 30} y2={330} />
          ))}
        </g>
        <rect x={-4} y={330} width={368} height={18} fill={P.counter} stroke={INK} strokeWidth={3} />
        <rect x={-4} y={346} width={368} height={90} fill={P.counterEdge} stroke={INK} strokeWidth={3} />
        <Urn x={230} y={338} s={2} on={urn.on} boiled={urn.boiled} progress={prog} />
        {/* big rocker switch on the base */}
        <g onPointerDown={flip} style={{ cursor: urn.on ? 'default' : 'pointer' }}>
          <rect x={196} y={292} width={68} height={34} rx={8} fill={P.black} stroke={INK} strokeWidth={3} />
          <rect x={urn.on ? 230 : 200} y={296} width={30} height={26} rx={5} fill={urn.on ? '#ff5a3c' : '#8b8494'} stroke={INK} strokeWidth={2.5} />
          <text x={urn.on ? 245 : 215} y={314} textAnchor="middle" className="sh-tiny" fill="#fff">
            {urn.on ? 'ON' : 'OFF'}
          </text>
          {urn.plugged && !urn.on && showHint && <rect x={190} y={286} width={80} height={46} rx={12} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="7 6" className="sh-pulse" />}
          <rect x={186} y={282} width={88} height={54} fill="transparent" />
        </g>
        <PlugCord
          svgRef={svgRef}
          socket={{ x: 70, y: 150 }}
          rest={{ x: 92, y: 384 }}
          anchor={{ x: 180, y: 330 }}
          plugged={urn.plugged}
          onPlug={() => onChange({ ...urn, plugged: true })}
          hint={showHint}
        />
        {/* boil gauge */}
        <g transform="translate(70 250)">
          <circle r={R + 8} fill={P.cream} stroke={INK} strokeWidth={3} />
          <circle r={R} fill="none" stroke="#e5dccb" strokeWidth={10} />
          <circle
            r={R}
            fill="none"
            stroke={urn.boiled ? P.green : '#ff7a4a'}
            strokeWidth={10}
            strokeDasharray={`${C * prog} ${C}`}
            transform="rotate(-90)"
            strokeLinecap="round"
          />
          <text y={7} textAnchor="middle" className="sh-small" fill={INK}>
            {urn.boiled ? '✓' : urn.on ? `${left}s` : '100°'}
          </text>
        </g>
      </svg>
    </div>
  );
}
