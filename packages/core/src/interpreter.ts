import { tokenize } from './tokenizer.ts';
import { LogoError, StopSignal, OutputSignal } from './errors.ts';
import {
  ALIAS, ARITY, LIST_ARGS, REPORTERS, TO_WORDS, END_WORDS, resolve,
} from './aliases.ts';
import type { Turtle } from './turtle.ts';
import type { Host, Token, Value, LogoList } from './types.ts';

/**
 * Tree-walking interpreter, generator-based so execution can be paused between
 * turtle steps (for animation) and cancelled cleanly. It evaluates a token
 * stream directly rather than building a full AST first — Logo's grammar is
 * simple enough that this stays readable, and it keeps line numbers close for
 * good error messages.
 *
 * Scoping is dynamic (classic Logo): `make` writes to the nearest frame that
 * already binds the name, else to globals. Procedure parameters create a frame.
 */

interface Reader { toks: Token[]; i: number; }
interface Procedure { name: string; params: string[]; body: Token[]; }

const makeReader = (toks: Token[]): Reader => ({ toks, i: 0 });
const peek = (r: Reader): Token | undefined => r.toks[r.i];
const next = (r: Reader): Token => r.toks[r.i++];
const lineOf = (r: Reader): number =>
  (r.toks[r.i] ?? r.toks[r.toks.length - 1] ?? { line: 1 }).line;

/** Split `to name :a :b ... end` blocks out of the stream up front. */
function extractProcedures(toks: Token[]): { procs: Map<string, Procedure>; main: Token[] } {
  const procs = new Map<string, Procedure>();
  const main: Token[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === 'word' && TO_WORDS.has(t.v as string)) {
      const nameTok = toks[++i];
      if (!nameTok || nameTok.t !== 'word') throw new LogoError('procname', t.line);
      const params: string[] = [];
      while (toks[i + 1] && toks[i + 1].t === 'var') params.push(toks[++i].v as string);
      const body: Token[] = [];
      let closed = false;
      while (++i < toks.length) {
        const b = toks[i];
        if (b.t === 'word' && END_WORDS.has(b.v as string)) { closed = true; break; }
        if (b.t === 'word' && TO_WORDS.has(b.v as string)) throw new LogoError('nestedto', b.line);
        body.push(b);
      }
      if (!closed) throw new LogoError('noend', t.line, { name: nameTok.v });
      procs.set(nameTok.v as string, { name: nameTok.v as string, params, body });
    } else {
      main.push(t);
    }
  }
  return { procs, main };
}

const PREC: Record<string, number> = {
  '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
  '+': 2, '-': 2, '*': 3, '/': 3,
};

export interface Interpreter {
  run(src: string): Generator<unknown>;
  knownWords(): string[];
}

export function createInterpreter(turtle: Turtle, host: Host): Interpreter {
  let procs = new Map<string, Procedure>();
  const globals = new Map<string, Value>();
  let scopes: Map<string, Value>[] = [];
  let repcounts: number[] = [];

  function lookup(name: string): Value | undefined {
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
    if (globals.has(name)) return globals.get(name);
    return undefined;
  }
  function assign(name: string, val: Value): void {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) { scopes[i].set(name, val); return; }
    }
    globals.set(name, val);
  }

  const num = (v: unknown, line: number): number => {
    const n = typeof v === 'number' ? v : parseFloat(v as string);
    if (typeof v !== 'number' && (v === null || v === undefined || isNaN(n))) {
      throw new LogoError('notnum', line, { v: String(v) });
    }
    if (isNaN(n)) throw new LogoError('notnum', line, { v: String(v) });
    return n;
  };
  const truthy = (v: unknown): boolean =>
    v === true || v === 'true' || v === 'waar' || (typeof v === 'number' && v !== 0);

  function* evalExpr(r: Reader, minPrec = 0): Generator<unknown, Value> {
    let left = yield* evalOperand(r);
    while (true) {
      const t = peek(r);
      if (!t || t.t !== 'op') break;
      const p = PREC[t.v as string];
      if (!p || p < minPrec) break;
      next(r);
      const right = yield* evalExpr(r, p + 1);
      left = binop(t.v as string, left, right, t.line);
    }
    return left;
  }

  function binop(op: string, a: Value, b: Value, line: number): Value {
    if (op === '=') return String(a) === String(b);
    if (op === '<>') return String(a) !== String(b);
    const x = num(a, line), y = num(b, line);
    switch (op) {
      case '+': return x + y;
      case '-': return x - y;
      case '*': return x * y;
      case '/': if (y === 0) throw new LogoError('divzero', line); return x / y;
      case '<': return x < y;
      case '>': return x > y;
      case '<=': return x <= y;
      case '>=': return x >= y;
    }
    throw new LogoError('unexpected', line, { v: op });
  }

  function collectList(r: Reader): LogoList {
    const open = next(r); // consumes '['
    const out: Token[] = [];
    let depth = 1;
    while (r.i < r.toks.length) {
      const t = next(r);
      if (t.t === '[') depth++;
      if (t.t === ']') { depth--; if (depth === 0) return { list: out }; }
      out.push(t);
    }
    throw new LogoError('nobracket', open.line);
  }

  function* evalOperand(r: Reader): Generator<unknown, Value> {
    const t = peek(r);
    if (!t) throw new LogoError('needarg', lineOf(r));
    if (t.t === 'num') { next(r); return t.v as number; }
    if (t.t === 'quote') { next(r); return t.v as string; }
    if (t.t === 'var') {
      next(r);
      const v = lookup(t.v as string);
      if (v === undefined) throw new LogoError('novar', t.line, { name: t.v });
      return v;
    }
    if (t.t === '[') return collectList(r);
    if (t.t === '(') {
      next(r);
      const v = yield* evalExpr(r);
      const close = next(r);
      if (!close || close.t !== ')') throw new LogoError('noparen', t.line);
      return v;
    }
    if (t.t === 'op' && t.v === '-') { next(r); const v = yield* evalOperand(r); return -num(v, t.line); }
    if (t.t === 'word') return yield* apply(r, true) as Generator<unknown, Value>;
    throw new LogoError('unexpected', t.line, { v: String(t.v) });
  }

  function* apply(r: Reader, wantValue: boolean): Generator<unknown, Value | undefined> {
    const t = next(r);
    const name = t.v as string;
    const canon = resolve(name);

    if (canon) {
      if (wantValue && !REPORTERS.has(canon)) throw new LogoError('novalue', t.line, { name });
      const n = ARITY[canon];
      const listSlots = LIST_ARGS[canon];
      const args: Value[] = [];
      for (let k = 0; k < n; k++) {
        const nt = peek(r);
        if (!nt) throw new LogoError('needargs', t.line, { name, n });
        // Missing brackets: `herhaal 4 vooruit 100`. Evaluating the operand
        // would blame `vooruit` for not reporting a value, which tells a child
        // nothing. A command word where a block belongs can only be this
        // mistake, so name it. Variables and user procedures are left alone —
        // they can legitimately hold or report a block.
        if (listSlots?.includes(k) && nt.t === 'word' && resolve(nt.v as string)) {
          throw new LogoError('needlist', nt.line);
        }
        args.push(yield* evalExpr(r));
      }
      return yield* primitive(canon, args, t.line);
    }

    if (procs.has(name)) {
      const proc = procs.get(name)!;
      const args: Value[] = [];
      for (let k = 0; k < proc.params.length; k++) {
        if (!peek(r)) throw new LogoError('needargs', t.line, { name, n: proc.params.length });
        args.push(yield* evalExpr(r));
      }
      if (scopes.length > 240) throw new LogoError('toodeep', t.line, { name });
      const frame = new Map<string, Value>();
      proc.params.forEach((p, idx) => frame.set(p, args[idx]));
      scopes.push(frame);
      try {
        yield* runTokens(proc.body);
        if (wantValue) throw new LogoError('noreturn', t.line, { name });
        return undefined;
      } catch (e) {
        if (e instanceof StopSignal) {
          if (wantValue) throw new LogoError('noreturn', t.line, { name });
          return undefined;
        }
        if (e instanceof OutputSignal) return e.value as Value;
        throw e;
      } finally {
        scopes.pop();
      }
    }

    throw new LogoError('unknown', t.line, { name });
  }

  function asList(v: unknown, line: number): Token[] {
    if (v && typeof v === 'object' && Array.isArray((v as LogoList).list)) return (v as LogoList).list;
    throw new LogoError('needlist', line);
  }
  function fmt(v: unknown): string {
    if (v && typeof v === 'object' && Array.isArray((v as LogoList).list)) {
      return '[' + (v as LogoList).list.map((t) => t.v).join(' ') + ']';
    }
    if (v === true) return 'waar';
    if (v === false) return 'onwaar';
    if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
    return String(v);
  }

  function* primitive(name: string, a: Value[], line: number): Generator<unknown, Value | undefined> {
    switch (name) {
      case 'forward': yield* turtle.move(num(a[0], line)); return;
      case 'back': yield* turtle.move(-num(a[0], line)); return;
      case 'right': turtle.turn(num(a[0], line)); yield 'draw'; return;
      case 'left': turtle.turn(-num(a[0], line)); yield 'draw'; return;
      case 'penup': turtle.pen = false; return;
      case 'pendown': turtle.pen = true; return;
      case 'setcolor': turtle.setColor(a[0], line); host.penChanged(turtle.color); return;
      case 'setwidth': turtle.width = Math.max(0.5, num(a[0], line)); return;
      case 'clearscreen': turtle.clear(); turtle.reset(); host.penChanged(turtle.color); yield 'draw'; return;
      case 'clean': turtle.clear(); yield 'draw'; return;
      case 'home': turtle.home(); yield 'draw'; return;
      case 'setxy': yield* turtle.goTo(num(a[0], line), num(a[1], line)); return;
      case 'setheading': turtle.heading = ((num(a[0], line) % 360) + 360) % 360; yield 'draw'; return;
      case 'hideturtle': turtle.visible = false; yield 'draw'; return;
      case 'showturtle': turtle.visible = true; yield 'draw'; return;

      case 'repeat': {
        const n = Math.floor(num(a[0], line));
        const body = asList(a[1], line);
        for (let k = 1; k <= n; k++) {
          repcounts.push(k);
          try { yield* runTokens(body); } finally { repcounts.pop(); }
          yield 'tick';
        }
        return;
      }
      case 'repcount': return repcounts.length ? repcounts[repcounts.length - 1] : 0;
      case 'while': {
        const cond = asList(a[0], line);
        const body = asList(a[1], line);
        let guard = 0;
        while (true) {
          const rr = makeReader(cond);
          const v = yield* evalExpr(rr);
          if (!truthy(v)) break;
          yield* runTokens(body);
          yield 'tick';
          if (++guard > 200000) throw new LogoError('runaway', line);
        }
        return;
      }
      case 'if': if (truthy(a[0])) yield* runTokens(asList(a[1], line)); return;
      case 'ifelse': yield* runTokens(asList(truthy(a[0]) ? a[1] : a[2], line)); return;
      case 'stop': throw new StopSignal();
      case 'output': throw new OutputSignal(a[0]);
      case 'make': assign(String(a[0]).toLowerCase(), a[1]); return;
      case 'print': host.print(fmt(a[0])); return;
      case 'wait': yield { wait: Math.max(0, num(a[0], line)) }; return;

      case 'random': return Math.floor(Math.random() * num(a[0], line));
      case 'sqrt': return Math.sqrt(num(a[0], line));
      case 'round': return Math.round(num(a[0], line));
      case 'abs': return Math.abs(num(a[0], line));
      case 'sin': return Math.sin((num(a[0], line) * Math.PI) / 180);
      case 'cos': return Math.cos((num(a[0], line) * Math.PI) / 180);
      case 'remainder': return num(a[0], line) % num(a[1], line);
      case 'xpos': return Math.round(turtle.x * 10) / 10;
      case 'ypos': return Math.round(turtle.y * 10) / 10;
      case 'heading': return Math.round(turtle.heading * 10) / 10;
    }
    throw new LogoError('unknown', line, { name });
  }

  function* runTokens(toks: Token[]): Generator<unknown> {
    const r = makeReader(toks);
    while (peek(r)) {
      const t = peek(r)!;
      if (t.t === ']' || t.t === ')') { next(r); continue; }
      if (t.t !== 'word') throw new LogoError('expectcmd', t.line, { v: String(t.v) });
      host.mark(t.line);
      yield* apply(r, false);
    }
  }

  return {
    *run(src: string): Generator<unknown> {
      const { procs: p, main } = extractProcedures(tokenize(src));
      procs = p;
      scopes = [];
      repcounts = [];
      try {
        yield* runTokens(main);
      } catch (e) {
        if (e instanceof StopSignal || e instanceof OutputSignal) return;
        throw e;
      }
    },
    knownWords(): string[] {
      return [...new Set([...Object.keys(ALIAS), ...procs.keys()])];
    },
  };
}
