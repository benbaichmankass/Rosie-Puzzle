/**
 * Character reference for every game. Each game draws these in its OWN art style, but must
 * keep these identifying traits so the cast is recognisable everywhere. Full notes: docs/CHARACTERS.md.
 */
export const CHARACTERS = {
  bentzi: {
    name: 'Bentzi',
    traits: 'stocky man, light skin, short dark-brown hair, full brown beard, sunglasses pushed up on his head, black t-shirt',
    colors: { skin: '#e8b48f', hair: '#4a3222', beard: '#5a3b26', shirt: '#1b1b1f', shades: '#222' },
  },
  shai: {
    name: 'Shai',
    traits: 'slim man, olive skin, very short dark hair, trimmed dark beard, big smile, sand/beige t-shirt, sunglasses on head',
    colors: { skin: '#d9a07a', hair: '#2a1d16', beard: '#2f2018', shirt: '#cdbf9c', shades: '#333' },
  },
  rosie: {
    name: 'Rosie',
    traits:
      'lean medium-size dog, white coat with light grey ticking, black head with a white blaze/muzzle, black ears, big black spot on her rump by the tail, thin legs, long thin tail, red or teal collar/harness',
    colors: { coat: '#f4f2ee', ticking: '#9a9a9a', head: '#141414', collar: '#d93a3a', harness: '#1f9aa6' },
  },
  bunnies: [
    { id: 'white', traits: 'white rabbit, pink ears, red eyes', colors: { fur: '#f7f7f5', ear: '#f2b8c0', eye: '#c0283a' } },
    { id: 'black-white', traits: 'black-and-white rabbit, black head and ears, white blaze and collar band', colors: { fur: '#f5f5f2', patch: '#151515' } },
    { id: 'grey-white', traits: 'grey-and-white rabbit, grey head, ears and back, white face stripe and chest', colors: { fur: '#f2f2ef', patch: '#7c7f86' } },
  ],
  turtles: {
    name: 'turtles',
    traits: 'two red-eared slider turtles, olive-green shells, yellow-striped heads, they sun themselves on a stone in their pond',
    colors: { shell: '#5b5a2e', skin: '#4f6b2a', stripe: '#e3cf4a', ear: '#c0392b' },
  },
} as const;

/** The 4-shade Game Boy palette used by the map and shell. */
export const GB = { darkest: '#0f380f', dark: '#306230', light: '#8bac0f', lightest: '#9bbc0f' } as const;

/**
 * Game Boy Color style palette for the house map and the shell (Ben's call: GBC colours, not green).
 * The map draws its tiles with its own small per-tile palettes (src/map/art.ts); these are the UI colours.
 */
export const GBC = {
  ink: '#1c1a30', // outlines and text
  navy: '#2a3570', // dialog borders, selected buttons
  shell: '#4c3c8c', // console body (page background)
  shellDark: '#2e2462', // console shadows, D-pad well
  screen: '#24203c', // screen bezel
  paper: '#faf6e6', // dialog boxes and panels
  paperShade: '#e2d8b8',
  pad: '#2a2a34', // D-pad
  button: '#c0386a', // A/B buttons
  accent: '#f0c040', // highlight / cursor
} as const;
