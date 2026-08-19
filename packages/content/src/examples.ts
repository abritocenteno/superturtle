import type { Lang } from '@schildpad/core';

/** A named starter program, per language. */
export interface Example { name: string; source: string; }

export const EXAMPLES: Record<Lang, Example[]> = {
  nl: [
    { name: 'Vierkant', source: `wisscherm
herhaal 4 [
  vooruit 150
  rechts 90
]` },
    { name: 'Ster', source: `naar ster :zijde
  herhaal 5 [ vooruit :zijde  rechts 144 ]
einde

wisscherm
penkleur "roze
pendikte 4
ster 260` },
    { name: 'Bloem van vierkanten', source: `wisscherm
penkleur "blauw
herhaal 36 [
  herhaal 4 [ vooruit 120  rechts 90 ]
  rechts 10
]` },
    { name: 'Spiraal met de teller', source: `wisscherm
penkleur "paars
herhaal 140 [
  vooruit teller * 1.5
  rechts 91
]` },
    { name: 'Boom (roept zichzelf aan)', source: `naar tak :lengte
  als :lengte < 9 [ stop ]
  pendikte :lengte / 14
  vooruit :lengte
  rechts 27
  tak :lengte * 0.72
  links 54
  tak :lengte * 0.72
  rechts 27
  penop  achteruit :lengte  penneer
einde

wisscherm
verberg
penop  zetxy 0 -320  penneer
zetkoers 0
penkleur "groen
tak 150` },
    { name: 'Sneeuwvlok', source: `naar zijde :lengte :diepte
  alsanders :diepte < 1 [
    vooruit :lengte
  ][
    zijde :lengte / 3 :diepte - 1
    links 60
    zijde :lengte / 3 :diepte - 1
    rechts 120
    zijde :lengte / 3 :diepte - 1
    links 60
    zijde :lengte / 3 :diepte - 1
  ]
einde

wisscherm
verberg
penop  zetxy -270 120  zetkoers 90  penneer
penkleur "blauw
herhaal 3 [ zijde 540 4  rechts 120 ]` },
  ],
  en: [
    { name: 'Square', source: `clearscreen
repeat 4 [
  forward 150
  right 90
]` },
    { name: 'Star', source: `to star :side
  repeat 5 [ forward :side  right 144 ]
end

clearscreen
setcolor "pink
setwidth 4
star 260` },
    { name: 'Flower of squares', source: `clearscreen
setcolor "blue
repeat 36 [
  repeat 4 [ forward 120  right 90 ]
  right 10
]` },
    { name: 'Spiral using repcount', source: `clearscreen
setcolor "purple
repeat 140 [
  forward repcount * 1.5
  right 91
]` },
    { name: 'Tree (calls itself)', source: `to branch :len
  if :len < 9 [ stop ]
  setwidth :len / 14
  forward :len
  right 27
  branch :len * 0.72
  left 54
  branch :len * 0.72
  right 27
  penup  back :len  pendown
end

clearscreen
hideturtle
penup  setxy 0 -320  pendown
setheading 0
setcolor "green
branch 150` },
    { name: 'Snowflake', source: `to side :len :depth
  ifelse :depth < 1 [
    forward :len
  ][
    side :len / 3 :depth - 1
    left 60
    side :len / 3 :depth - 1
    right 120
    side :len / 3 :depth - 1
    left 60
    side :len / 3 :depth - 1
  ]
end

clearscreen
hideturtle
penup  setxy -270 120  setheading 90  pendown
setcolor "blue
repeat 3 [ side 540 4  right 120 ]` },
  ],
};
