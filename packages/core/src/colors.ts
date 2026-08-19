/**
 * Named colours (Dutch + English) and the fixed pen palette shown in the UI.
 * `setcolor` also accepts a hex string, or an index into PEN_ORDER.
 */

export const COLORS: Record<string, string> = {
  zwart: '#1B2430', black: '#1B2430', ink: '#1B2430',
  groen: '#33A06B', green: '#33A06B',
  rood: '#E05252', red: '#E05252',
  blauw: '#38A8C9', blue: '#38A8C9', cyaan: '#38A8C9', cyan: '#38A8C9',
  geel: '#E9A93C', yellow: '#E9A93C', oranje: '#E9A93C', amber: '#E9A93C',
  roze: '#D9527E', pink: '#D9527E', magenta: '#D9527E',
  paars: '#8B6FD1', purple: '#8B6FD1', violet: '#8B6FD1',
  wit: '#FCFBF7', white: '#FCFBF7',
};

/** Palette order for the pen strip (Dutch canonical names). */
export const PEN_ORDER = ['zwart', 'groen', 'blauw', 'geel', 'roze', 'paars'];

/** Dutch pen name -> English name, for bilingual labels/insertion. */
export const PEN_EN: Record<string, string> = {
  zwart: 'black', groen: 'green', blauw: 'blue',
  geel: 'yellow', roze: 'pink', paars: 'purple',
};

/**
 * Resolve a value to a hex colour, or null if unrecognised.
 * Accepts: a named colour, a #hex string, or a palette index number.
 */
export function resolveColor(v: unknown): string | null {
  if (typeof v === 'number') {
    return COLORS[PEN_ORDER[Math.abs(Math.floor(v)) % PEN_ORDER.length]];
  }
  if (typeof v === 'string') {
    const key = v.toLowerCase();
    if (COLORS[key]) return COLORS[key];
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  }
  return null;
}
