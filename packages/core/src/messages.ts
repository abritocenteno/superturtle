import type { ErrorKey } from './errors.ts';
import type { Lang } from './types.ts';

/**
 * Localised, kid-friendly wording for each error key, plus the UI strings.
 * The interpreter only ever produces (key, data, line); this module is the
 * single place that turns those into sentences. Add a language by adding an
 * entry to MESSAGES with the same shape.
 */

type ErrFn = (d: Record<string, unknown>) => string;

export interface Messages {
  ui: {
    run: string; stop: string; program: string; sheet: string; pens: string;
    speed: string; grid: string; examples: string; clear: string;
    ready: string; running: string; done: string; stopped: string; line: string;
    cleared: string; restored: string;
  };
  err: Record<ErrorKey, ErrFn>;
}

export const MESSAGES: Record<Lang, Messages> = {
  nl: {
    ui: {
      run: 'Teken', stop: 'Stop', program: 'Programma', sheet: 'Vel', pens: 'Pennen',
      speed: 'tempo', grid: 'raster', examples: 'Voorbeelden…', clear: 'wissen',
      ready: 'Klaar. Schrijf een programma en druk op Teken.',
      running: 'Bezig met tekenen…', done: 'Klaar.', stopped: 'Gestopt.', line: 'regel',
      cleared: 'Programma gewist. Druk nog eens op wissen om het terug te halen.',
      restored: 'Programma teruggehaald.',
    },
    err: {
      char: (d) => `Ik snap het teken ${d.c} niet.`,
      procname: () => `Na "naar" hoort de naam van je opdracht te staan.`,
      nestedto: () => `Je kunt geen opdracht in een opdracht maken. Sluit de vorige eerst af met "einde".`,
      noend: (d) => `De opdracht "${d.name}" heeft geen "einde".`,
      unknown: (d) => `Ik weet niet hoe ik "${d.name}" moet doen.`,
      novar: (d) => `De variabele :${d.name} bestaat nog niet. Maak hem eerst met: maak "${d.name} 10`,
      needarg: () => `Hier mist nog een getal of woord.`,
      needargs: (d) => `"${d.name}" heeft ${d.n} getal(len) nodig.`,
      needlist: () => `Hier horen blokhaken omheen, zoals [ vooruit 100 ].`,
      nobracket: () => `Je bent een ] vergeten.`,
      noparen: () => `Je bent een ) vergeten.`,
      notnum: (d) => `"${d.v}" is geen getal.`,
      divzero: () => `Delen door nul kan niet.`,
      novalue: (d) => `"${d.name}" geeft geen antwoord terug, dus je kunt er niet mee rekenen.`,
      noreturn: (d) => `"${d.name}" geeft niets terug. Gebruik "geefterug" in de opdracht.`,
      unexpected: (d) => `Ik verwachtte hier geen "${d.v}".`,
      expectcmd: (d) => `"${d.v}" is geen opdracht.`,
      toodeep: (d) => `"${d.name}" roept zichzelf te vaak aan. Vergeet je een stopregel?`,
      runaway: () => `Deze lus stopt nooit.`,
      nocolor: (d) => `"${d.v}" ken ik niet als kleur. Probeer groen, rood, blauw, geel, roze, paars of zwart.`,
    },
  },
  en: {
    ui: {
      run: 'Draw', stop: 'Stop', program: 'Program', sheet: 'Sheet', pens: 'Pens',
      speed: 'speed', grid: 'grid', examples: 'Examples…', clear: 'clear',
      ready: 'Ready. Write a program and press Draw.',
      running: 'Drawing…', done: 'Done.', stopped: 'Stopped.', line: 'line',
      cleared: 'Program cleared. Press clear again to get it back.',
      restored: 'Program restored.',
    },
    err: {
      char: (d) => `I don't understand the character ${d.c}.`,
      procname: () => `"to" should be followed by the name of your command.`,
      nestedto: () => `You can't define a command inside a command. Close the previous one with "end".`,
      noend: (d) => `The command "${d.name}" has no "end".`,
      unknown: (d) => `I don't know how to "${d.name}".`,
      novar: (d) => `The variable :${d.name} doesn't exist yet. Create it with: make "${d.name} 10`,
      needarg: () => `Something is missing here — a number or a word.`,
      needargs: (d) => `"${d.name}" needs ${d.n} value(s).`,
      needlist: () => `This needs square brackets around it, like [ forward 100 ].`,
      nobracket: () => `You're missing a ].`,
      noparen: () => `You're missing a ).`,
      notnum: (d) => `"${d.v}" is not a number.`,
      divzero: () => `You can't divide by zero.`,
      novalue: (d) => `"${d.name}" doesn't report a value, so you can't calculate with it.`,
      noreturn: (d) => `"${d.name}" doesn't report anything. Use "output" inside it.`,
      unexpected: (d) => `I didn't expect "${d.v}" here.`,
      expectcmd: (d) => `"${d.v}" is not a command.`,
      toodeep: (d) => `"${d.name}" calls itself too many times. Missing a stopping rule?`,
      runaway: () => `This loop never ends.`,
      nocolor: (d) => `I don't know the colour "${d.v}". Try green, red, blue, yellow, pink, purple or black.`,
    },
  },
};

import { LogoError } from './errors.ts';

/** Format any error into a localised one-line string with its source line. */
export function formatError(e: unknown, lang: Lang): string {
  const m = MESSAGES[lang];
  if (e instanceof LogoError) {
    const fn = m.err[e.key];
    const body = fn ? fn(e.data) : e.key;
    return `${m.ui.line} ${e.line}: ${body}`;
  }
  return String((e as Error)?.message ?? e);
}
