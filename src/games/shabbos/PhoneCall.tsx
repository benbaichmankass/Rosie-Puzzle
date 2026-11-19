import React, { useEffect, useRef, useState } from 'react';
import { INK, MomFace } from './art';
import { answer, currentLine, isOver, type CallState } from './logic/calls';
import { sfx } from './sfx';

const WRAP_REACTIONS = ['Okay, okay.', 'Good, good.', 'Wonderful.', 'Lovely!'];
const CHAT_REACTIONS = ['Ooh! That reminds me...', 'Really? Tell me more! Oh, and...', 'Hmm. Speaking of which...', 'Oh! And another thing...'];

export function PhoneCall({
  call,
  index,
  total,
  rand,
  onUpdate,
  onHangUp,
}: {
  call: CallState;
  index: number;
  total: number;
  rand: () => number;
  onUpdate: (c: CallState) => void;
  onHangUp: () => void;
}) {
  const [said, setSaid] = useState<{ me: string; mom: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const line = currentLine(call);
  const over = isOver(call);

  const choose = (slot: number) => {
    if (said || over) return;
    const me = line.replies[call.replyOrder[slot]].text;
    const r = answer(call, slot, rand);
    const done = isOver(r.state);
    const mom = done
      ? 'Shabbat shalom, sweetie! Kisses to Shai and Rosie. Bye!'
      : r.wrap
        ? WRAP_REACTIONS[Math.floor(rand() * WRAP_REACTIONS.length)]
        : CHAT_REACTIONS[Math.floor(rand() * CHAT_REACTIONS.length)];
    if (r.wrap) sfx.blip();
    else sfx.wrong();
    setSaid({ me, mom });
    timer.current = setTimeout(() => {
      setSaid(null);
      onUpdate(r.state);
      if (done) {
        sfx.done();
        onHangUp();
      }
    }, done ? 1300 : 900);
  };

  return (
    <div className="flex flex-col items-center h-full w-full">
      <div className="sh-phone">
        <div className="flex items-center gap-3 px-3 pt-3">
          <svg viewBox="-60 -60 120 120" width={58} height={58}>
            <circle r={58} fill="#f7c6d0" stroke={INK} strokeWidth={4} />
            <MomFace s={0.95} />
          </svg>
          <div className="flex-1">
            <div className="sh-caller">Mom ❤</div>
            <div className="sh-tiny opacity-80">
              Call {index + 1} of {total} · {'●'.repeat(call.wraps)}
              {'○'.repeat(Math.max(0, call.needed - call.wraps))}
            </div>
            <div className="sh-tiny opacity-70">Pick the reply that wraps it up!</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2 px-3 py-3 overflow-hidden">
          <div className="sh-bubble sh-bubble-mom">{line.mom}</div>
          {said && <div className="sh-bubble sh-bubble-me">{said.me}</div>}
          {said && <div className="sh-bubble sh-bubble-mom">{said.mom}</div>}
        </div>
        <div className="flex flex-col gap-2 px-3 pb-3">
          {call.replyOrder.map((ri, slot) => (
            <button key={`${call.pos}-${slot}`} className="sh-reply" disabled={!!said} onClick={() => choose(slot)}>
              {line.replies[ri].text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
