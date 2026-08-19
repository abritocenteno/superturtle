# The Schildpad language

A small Logo dialect. Both Dutch and English vocabularies are **always active** —
`vooruit` and `forward` resolve to the same primitive, so programs may mix them.
The UI language toggle changes only labels, examples, and error wording.

The vocabulary lives in `packages/core/src/aliases.ts`. This document is a
human-readable view of it; the code is the source of truth.

## Program structure

A program is a flat sequence of commands, plus zero or more procedure
definitions. Whitespace and newlines are insignificant except as separators.
`;` starts a line comment.

```logo
; a comment
wisscherm
herhaal 4 [ vooruit 100  rechts 90 ]
```

## Tokens

| Kind    | Looks like            | Meaning                                  |
|---------|-----------------------|------------------------------------------|
| number  | `100`  `12.5`         | a numeric literal                        |
| word    | `vooruit`  `ster`     | a command or procedure name              |
| quote   | `"roze`  `"hoek`      | a literal word (colour name, var name)   |
| var     | `:hoek`               | read the variable `hoek`                 |
| list    | `[ … ]`               | an unevaluated block (loop/if body)      |
| group   | `( … )`               | grouping in expressions                  |
| operator| `+ - * / = <> < > <= >=` | arithmetic and comparison             |

## Expressions

Infix arithmetic with the usual precedence: `*` and `/` bind tighter than `+`
and `-`, comparisons are lowest, and `( )` overrides. Unary minus is supported.
`=` and `<>` compare as strings-or-numbers; the rest are numeric.

```logo
schrijf 2 + 3 * 4        ; 14
schrijf (2 + 3) * 4      ; 20
schrijf 10 / 4           ; 2.5
```

## Variables

`maak` / `make` creates or updates a variable; `:name` reads it. Scoping is
dynamic: assignment targets the nearest enclosing frame that already binds the
name, otherwise a global.

```logo
maak "hoek 90
schrijf :hoek + 10       ; 100
```

## Procedures

`naar` / `to` … `einde` / `end` defines a command. Parameters are written as
`:name`. Procedures may recurse; `stop` exits early, `geefterug` / `output`
reports a value (making the procedure usable inside an expression).

```logo
naar veelhoek :zijden :lengte
  herhaal :zijden [ vooruit :lengte  rechts 360 / :zijden ]
einde

veelhoek 6 80
```

`leer` is accepted as a synonym for `naar`; `klaar` for `einde`.

## Command reference

Arity is the number of arguments. "Reporter" commands return a value and can be
used inside expressions; the rest are statements. Every alias below is
interchangeable.

### Movement

| Primitive | Args | Aliases |
|-----------|------|---------|
| forward   | 1 | `vooruit` `voor` `vo` `fd` `forward` |
| back      | 1 | `achteruit` `terug` `ac` `bk` `back` |
| right     | 1 | `rechts` `re` `rt` `right` |
| left      | 1 | `links` `li` `lt` `left` |

### Pen

| Primitive | Args | Aliases |
|-----------|------|---------|
| penup     | 0 | `penop` `po` `pu` `penup` |
| pendown   | 0 | `penneer` `pn` `pd` `pendown` |
| setcolor  | 1 | `penkleur` `pk` `kleur` `setcolor` `setpencolor` `pc` |
| setwidth  | 1 | `pendikte` `dikte` `setwidth` `setpensize` |

### Screen & turtle

| Primitive   | Args | Aliases |
|-------------|------|---------|
| clearscreen | 0 | `wisscherm` `ws` `cs` `clearscreen` (clears **and** resets the turtle) |
| clean       | 0 | `wis` `clean` (clears ink, leaves the turtle put) |
| home        | 0 | `thuis` `home` |
| setxy       | 2 | `zetxy` `setxy` `setpos` |
| setheading  | 1 | `zetkoers` `koers` `setheading` `seth` |
| hideturtle  | 0 | `verberg` `ht` `hideturtle` |
| showturtle  | 0 | `toon` `st` `showturtle` |

### Control flow

| Primitive | Args | Aliases | Notes |
|-----------|------|---------|-------|
| repeat    | 2 | `herhaal` `repeat` | `repeat N [ … ]` |
| repcount  | 0 *(reporter)* | `teller` `repcount` | current iteration, 1-based |
| if        | 2 | `als` `if` | `if COND [ … ]` |
| ifelse    | 3 | `alsanders` `ifelse` | `ifelse COND [ … ] [ … ]` |
| while     | 2 | `zolang` `while` | `while [ COND ] [ … ]` |
| stop      | 0 | `stop` | exit the current procedure |
| output    | 1 | `geefterug` `output` | report a value from a procedure |

### Data & output

| Primitive | Args | Aliases |
|-----------|------|---------|
| make      | 2 | `maak` `make` |
| print     | 1 | `schrijf` `druk` `print` `pr` |
| wait      | 1 | `wacht` `wait` (milliseconds) |

### Reporters (math & queries)

| Primitive | Args | Aliases |
|-----------|------|---------|
| random    | 1 | `toeval` `random` (0 … n-1) |
| sqrt      | 1 | `wortel` `sqrt` |
| round     | 1 | `rond` `round` |
| abs       | 1 | `abs` |
| sin       | 1 | `sin` (degrees) |
| cos       | 1 | `cos` (degrees) |
| remainder | 2 | `rest` `remainder` `mod` |
| xpos      | 0 | `xpos` `xpositie` |
| ypos      | 0 | `ypos` `ypositie` |
| heading   | 0 | `richting` `heading` |

## Colours

`setcolor` accepts a named colour, a `#hex` string, or a palette index. Named
colours (Dutch and English, with a few synonyms) are in
`packages/core/src/colors.ts`:

`zwart`/`black`, `groen`/`green`, `rood`/`red`, `blauw`/`blue` (`cyaan`/`cyan`),
`geel`/`yellow` (`oranje`/`amber`), `roze`/`pink` (`magenta`),
`paars`/`purple` (`violet`), `wit`/`white`.

The pen strip in the UI shows: zwart, groen, blauw, geel, roze, paars.

## Coordinates & headings

Logical coordinate space is **1200 × 900**, origin at the centre, **y up**.
Heading is in degrees, **0 = up/north**, increasing **clockwise** (so `rechts 90`
faces east). This matches SuperLogo and differs from mathematical convention on
purpose — "turn right" should feel like turning right.

## Errors

Every error names its source **line**, says what's wrong in plain language, and
where useful suggests the fix — aimed at a child, in the active UI language. The
interpreter raises structured `LogoError`s carrying an i18n key and data;
`formatError(err, lang)` renders the sentence. Catalogue and full key list:
`packages/core/src/messages.ts`.

Examples (Dutch): an unknown command → *"Ik weet niet hoe ik '…' moet doen."*; a
missing bracket → *"Je bent een ] vergeten."*; an undefined variable → *"De
variabele :… bestaat nog niet. Maak hem eerst met: maak '… 10"*.

Where a `[ … ]` block is required — the body of `herhaal`/`als`/`alsanders` and
both arguments of `zolang` — a bare command in that slot is reported as the
missing brackets it is (*"Hier horen blokhaken omheen, zoals [ vooruit 100 ]."*)
rather than as a complaint about the command inside it. A variable or a
procedure call is still allowed there, since either may hold or report a block.
