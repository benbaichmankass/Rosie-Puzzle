/**
 * Mom's phone calls: small talk with multiple-choice replies. One reply in each set wraps the
 * conversation up (it counts toward ending the call); the others invite more chat (Mom asks
 * another question). A call ends after `needed` wrap-up replies.
 */

export interface Reply {
  text: string;
  wrap: boolean;
}

export interface Line {
  mom: string;
  replies: Reply[];
}

export const LINES: Line[] = [
  {
    mom: 'Hi sweetie! Did you remember to buy flowers for the table?',
    replies: [
      { text: 'Yes, they are in a vase already. Love you!', wrap: true },
      { text: 'Which ones did you like last time? Roses? Tulips?', wrap: false },
      { text: 'Funny story, the florist told me about his cousin...', wrap: false },
    ],
  },
  {
    mom: 'Is Shai eating enough? He looked thin at Rosh Hashana.',
    replies: [
      { text: 'He is eating great, I promise. Shabbat shalom!', wrap: true },
      { text: 'Well, he started this new diet, let me explain it...', wrap: false },
      { text: 'Thin? What do you mean by thin exactly?', wrap: false },
    ],
  },
  {
    mom: 'Your father wants to know if the urn is on yet.',
    replies: [
      { text: 'All under control, tell him not to worry.', wrap: true },
      { text: 'Put him on, I want to ask about his knee.', wrap: false },
      { text: 'Which urn, the big one or the small one?', wrap: false },
    ],
  },
  {
    mom: 'Did you see the photo I sent to the family group?',
    replies: [
      { text: 'Gorgeous! I will reply after Shabbat.', wrap: true },
      { text: 'Which one? There were forty-two photos.', wrap: false },
      { text: 'Who was the man in the blue hat?', wrap: false },
    ],
  },
  {
    mom: 'How is Rosie? Is she being a good girl?',
    replies: [
      { text: 'She is perfect. Sends kisses. Bye Mom!', wrap: true },
      { text: 'She ate a whole kugel last week, let me tell you...', wrap: false },
      { text: 'Want me to put her on the phone?', wrap: false },
    ],
  },
  {
    mom: 'Are you coming for lunch tomorrow or not?',
    replies: [
      { text: 'Yes, we will be there at one. Shabbat shalom!', wrap: true },
      { text: 'Depends, what are you making?', wrap: false },
      { text: 'Maybe? Who else is coming?', wrap: false },
    ],
  },
  {
    mom: 'Your cousin Noa got engaged! Did you hear?',
    replies: [
      { text: 'Mazal tov! I will call her after Shabbat.', wrap: true },
      { text: 'To who? Tell me everything.', wrap: false },
      { text: 'Wait, wasn\'t she with that guy from Haifa?', wrap: false },
    ],
  },
  {
    mom: 'It\'s very windy here. Is it windy where you are?',
    replies: [
      { text: 'A little. Stay warm! Love you, bye!', wrap: true },
      { text: 'How windy? Like, chairs-flying windy?', wrap: false },
      { text: 'Did you close the balcony door?', wrap: false },
    ],
  },
  {
    mom: 'Did you make the challah yourself this week?',
    replies: [
      { text: 'Braiding it right now, actually!', wrap: true },
      { text: 'Can you send me your recipe again?', wrap: false },
      { text: 'Should I use more honey this time?', wrap: false },
    ],
  },
  {
    mom: 'Your father found a new doctor. Very nice man.',
    replies: [
      { text: 'Great news. Give him a hug for me!', wrap: true },
      { text: 'What kind of doctor? Is something wrong?', wrap: false },
      { text: 'Is he single? Asking for a friend.', wrap: false },
    ],
  },
  {
    mom: 'I saw a sale on towels. Do you need towels?',
    replies: [
      { text: 'We are fine on towels, thanks Mom!', wrap: true },
      { text: 'What colours do they have?', wrap: false },
      { text: 'How big? Bath towels or hand towels?', wrap: false },
    ],
  },
  {
    mom: 'Are you wearing a sweater? It gets cold at night.',
    replies: [
      { text: 'Yes, I have one on. Shabbat shalom!', wrap: true },
      { text: 'It is actually pretty warm today.', wrap: false },
      { text: 'Which sweater do you mean?', wrap: false },
    ],
  },
  {
    mom: 'Did you call your grandmother this week?',
    replies: [
      { text: 'Yesterday! She sounded great.', wrap: true },
      { text: 'No... is she upset with me?', wrap: false },
      { text: 'What is her new number again?', wrap: false },
    ],
  },
  {
    mom: 'I made too much soup. I\'ll send some with Dad.',
    replies: [
      { text: 'Thank you! We have soup on the plata already.', wrap: true },
      { text: 'Which soup? The one with kneidlach?', wrap: false },
      { text: 'When is he coming? Should we wait?', wrap: false },
    ],
  },
];

export interface CallState {
  /** Indices into LINES in play order. */
  queue: number[];
  /** Current line (index into queue). */
  pos: number;
  /** Shuffled reply order for the current line. */
  replyOrder: number[];
  wraps: number;
  needed: number;
  chats: number;
}

/** Deterministic PRNG (mulberry32) so tests and replays are stable. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newCall(needed: number, r: () => number, avoid: number[] = []): CallState {
  const fresh = shuffle(
    LINES.map((_, i) => i).filter((i) => !avoid.includes(i)),
    r,
  );
  const rest = shuffle(
    LINES.map((_, i) => i).filter((i) => avoid.includes(i)),
    r,
  );
  return { queue: [...fresh, ...rest], pos: 0, replyOrder: shuffle([0, 1, 2], r), wraps: 0, needed, chats: 0 };
}

export const currentLine = (c: CallState): Line => LINES[c.queue[c.pos % c.queue.length]];

export const isOver = (c: CallState) => c.wraps >= c.needed;

/** Pick the reply shown at slot `slot` (0..2). Returns the new state and whether it was a wrap-up reply. */
export function answer(c: CallState, slot: number, r: () => number): { state: CallState; wrap: boolean } {
  const reply = currentLine(c).replies[c.replyOrder[slot]];
  const wrap = reply.wrap;
  const state: CallState = {
    ...c,
    pos: c.pos + 1,
    replyOrder: shuffle([0, 1, 2], r),
    wraps: c.wraps + (wrap ? 1 : 0),
    chats: c.chats + (wrap ? 0 : 1),
  };
  return { state, wrap };
}

/** Lines already used in a call, so the next call can prefer fresh ones. */
export const usedLines = (c: CallState) => c.queue.slice(0, c.pos);
