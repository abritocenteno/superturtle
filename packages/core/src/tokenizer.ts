import { LogoError } from './errors.ts';
import type { Token, TokenType } from './types.ts';

/**
 * Turn source text into a flat token stream.
 *
 * Token kinds:
 *   num    123 / 12.5
 *   quote  "word            (a literal word, e.g. a colour or variable name)
 *   var    :name            (a variable reference)
 *   op     + - * / = < > <= >= <>
 *   [ ] ( )                 (structural, one char each)
 *   word   everything else  (command names, procedure names, keywords)
 *
 * `;` starts a line comment. Line numbers are tracked for error reporting.
 */
export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 1;
  const isWord = (c: string) => /[A-Za-z0-9_?.]/.test(c);
  const push = (t: TokenType, v: string | number) => out.push({ t, v, line });

  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === ';') { while (i < src.length && src[i] !== '\n') i++; continue; }

    if (c === '[' || c === ']' || c === '(' || c === ')') {
      push(c as TokenType, c); i++; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < src.length && !/[\s[\]()]/.test(src[j])) { s += src[j]; j++; }
      push('quote', s); i = j; continue;
    }
    if (c === ':') {
      let j = i + 1, s = '';
      while (j < src.length && isWord(src[j])) { s += src[j]; j++; }
      push('var', s.toLowerCase()); i = j; continue;
    }
    const two = src.substr(i, 2);
    if (two === '<=' || two === '>=' || two === '<>') { push('op', two); i += 2; continue; }

    // Minus ambiguity (the classic Logo gotcha). Following UCBLogo: a '-' that
    // has whitespace/opening-bracket before it and a digit glued directly after
    // is a NEGATIVE NUMBER, so `setxy 0 -320` reads as two args (0, -320). A '-'
    // with spaces on both sides — `:n - 1` — stays binary subtraction.
    if (c === '-') {
      const prev = i > 0 ? src[i - 1] : ' ';
      const nextCh = src[i + 1];
      const negCtx = i === 0 || /[\s[(]/.test(prev);
      if (negCtx && nextCh !== undefined && /[0-9.]/.test(nextCh)) {
        let j = i + 1, s = '-';
        while (j < src.length && /[0-9.]/.test(src[j])) { s += src[j]; j++; }
        push('num', parseFloat(s)); i = j; continue;
      }
    }
    if ('+-*/=<>'.includes(c)) { push('op', c); i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i, s = '';
      while (j < src.length && /[0-9.]/.test(src[j])) { s += src[j]; j++; }
      push('num', parseFloat(s)); i = j; continue;
    }
    if (isWord(c)) {
      let j = i, s = '';
      while (j < src.length && isWord(src[j])) { s += src[j]; j++; }
      push('word', s.toLowerCase()); i = j; continue;
    }
    throw new LogoError('char', line, { c });
  }
  return out;
}
