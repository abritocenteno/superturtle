/**
 * The command vocabulary.
 *
 * ALIAS maps every surface word — Dutch, English, and their short forms — onto
 * one canonical primitive name. Both languages are always live: `vooruit` and
 * `forward` are the same primitive, so a program may mix them (useful when a
 * Dutch class follows an English tutorial). The UI language only switches
 * labels, examples, and error wording — never what the interpreter accepts.
 *
 * To add a command: add its aliases here, its argument count to ARITY, and a
 * case in primitives.ts. If it reports a value, also add it to REPORTERS.
 */

export const ALIAS: Record<string, string> = {
  // movement
  vooruit: 'forward', voor: 'forward', vo: 'forward', fd: 'forward', forward: 'forward',
  achteruit: 'back', terug: 'back', ac: 'back', bk: 'back', back: 'back',
  rechts: 'right', re: 'right', rt: 'right', right: 'right',
  links: 'left', li: 'left', lt: 'left', left: 'left',
  // pen
  penop: 'penup', po: 'penup', pu: 'penup', penup: 'penup',
  penneer: 'pendown', pn: 'pendown', pd: 'pendown', pendown: 'pendown',
  penkleur: 'setcolor', pk: 'setcolor', kleur: 'setcolor',
  setcolor: 'setcolor', setpencolor: 'setcolor', pc: 'setcolor',
  pendikte: 'setwidth', dikte: 'setwidth', setwidth: 'setwidth', setpensize: 'setwidth',
  // screen
  wisscherm: 'clearscreen', ws: 'clearscreen', cs: 'clearscreen', clearscreen: 'clearscreen',
  wis: 'clean', clean: 'clean',
  thuis: 'home', home: 'home',
  zetxy: 'setxy', setxy: 'setxy', setpos: 'setxy',
  zetkoers: 'setheading', koers: 'setheading', setheading: 'setheading', seth: 'setheading',
  verberg: 'hideturtle', ht: 'hideturtle', hideturtle: 'hideturtle',
  toon: 'showturtle', st: 'showturtle', showturtle: 'showturtle',
  // control
  herhaal: 'repeat', repeat: 'repeat',
  teller: 'repcount', repcount: 'repcount',
  als: 'if', if: 'if',
  alsanders: 'ifelse', ifelse: 'ifelse',
  zolang: 'while', while: 'while',
  stop: 'stop',
  geefterug: 'output', output: 'output',
  maak: 'make', make: 'make',
  schrijf: 'print', druk: 'print', print: 'print', pr: 'print',
  wacht: 'wait', wait: 'wait',
  // reporters (math + queries)
  toeval: 'random', random: 'random',
  wortel: 'sqrt', sqrt: 'sqrt',
  rond: 'round', round: 'round',
  abs: 'abs',
  sin: 'sin', cos: 'cos',
  rest: 'remainder', remainder: 'remainder', mod: 'remainder',
  xpos: 'xpos', xpositie: 'xpos',
  ypos: 'ypos', ypositie: 'ypos',
  richting: 'heading', heading: 'heading',
};

/** Words that open a procedure definition: `naar naam ... einde`. */
export const TO_WORDS = new Set(['naar', 'to', 'leer']);
/** Words that close a procedure definition. */
export const END_WORDS = new Set(['einde', 'end', 'klaar']);

/** Argument count per canonical primitive. */
export const ARITY: Record<string, number> = {
  forward: 1, back: 1, right: 1, left: 1,
  penup: 0, pendown: 0, setcolor: 1, setwidth: 1,
  clearscreen: 0, clean: 0, home: 0, setxy: 2, setheading: 1,
  hideturtle: 0, showturtle: 0,
  repeat: 2, repcount: 0, if: 2, ifelse: 3, while: 2,
  stop: 0, output: 1, make: 2, print: 1, wait: 1,
  random: 1, sqrt: 1, round: 1, abs: 1, sin: 1, cos: 1, remainder: 2,
  xpos: 0, ypos: 0, heading: 0,
};

/**
 * Argument positions (0-based) that must be a `[ ... ]` block. Used to catch
 * the commonest beginner mistake — forgetting the brackets, as in
 * `herhaal 4 vooruit 100` — while the tokens are still there to point at, so
 * the child gets "this needs square brackets" instead of a confusing complaint
 * about the command inside.
 */
export const LIST_ARGS: Record<string, number[]> = {
  repeat: [1], if: [1], ifelse: [1, 2], while: [0, 1],
};

/** Primitives that report a value (usable inside expressions). */
export const REPORTERS = new Set([
  'repcount', 'random', 'sqrt', 'round', 'abs', 'sin', 'cos',
  'remainder', 'xpos', 'ypos', 'heading',
]);

/** Control-flow words, highlighted distinctly in the editor. */
export const KEY_CTL = new Set([
  'herhaal', 'repeat', 'naar', 'to', 'einde', 'end', 'als', 'if',
  'alsanders', 'ifelse', 'zolang', 'while', 'stop', 'geefterug', 'output',
  'maak', 'make', 'teller', 'repcount',
]);

export function resolve(word: string): string | null {
  return ALIAS[word] ?? null;
}
