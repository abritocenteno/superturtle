/**
 * Errors and control-flow signals.
 *
 * LogoError carries an i18n `key` plus structured `data`, never a
 * pre-formatted string. The UI turns (key, data, line) into a localised,
 * kid-friendly sentence via the message catalogues. This keeps the language
 * spec (what can go wrong) separate from wording (how we say it), and lets the
 * same error read in Dutch or English without touching the interpreter.
 */

export type ErrorKey =
  | 'char' | 'procname' | 'nestedto' | 'noend' | 'unknown' | 'novar'
  | 'needarg' | 'needargs' | 'needlist' | 'nobracket' | 'noparen'
  | 'notnum' | 'divzero' | 'novalue' | 'noreturn' | 'unexpected'
  | 'expectcmd' | 'toodeep' | 'runaway' | 'nocolor';

export class LogoError extends Error {
  key: ErrorKey;
  line: number;
  data: Record<string, unknown>;
  constructor(key: ErrorKey, line: number, data: Record<string, unknown> = {}) {
    super(key);
    this.name = 'LogoError';
    this.key = key;
    this.line = line;
    this.data = data;
  }
}

/** Thrown by `stop` — unwinds to the nearest procedure boundary. */
export class StopSignal {}

/** Thrown by `output` / `geefterug` — reports a value out of a procedure. */
export class OutputSignal {
  value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}
