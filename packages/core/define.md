<!-- omit from toc -->
# define function

`@cruncheevos/core` exports `define` function which is a versatile tool to define conditions for your achievement sets. This page explores how it can be used and all of it's features.

To keep things concise, all examples focus on usage of the function and how it affects output (as shown by `.toString()` call) instead of showing real-life examples.

`define` function returns instance of `ConditionBuilder` class. While it's possible to import this class, it's not practical instantiating it directly. It's only exported so you're able to extend the prototype.

- [Basic usage](#basic-usage)
- [Chain calls](#chain-calls)
- [Defining hits](#defining-hits)
- [Conditional conditions](#conditional-conditions)
- [Accessing conditions directly](#accessing-conditions-directly)
- [Iterating](#iterating)
- [Mapping](#mapping)
- [withLast](#withlast)
- [toString / toJSON](#tostring--tojson)
- [String comparisons](#string-comparisons)

## Basic usage

When making achievement sets, it's recommended to alias `define` import to `$`, so your code is less verbose.

The example below explores different ways to pass a condition to `define`:

```js
import { define as $ } from '@cruncheevos/core'

// Storing ConditionBuilder class instance,
// this can be passed to another `define` call
const moreConditions = $(
  '0xXcafe=3',
  '0xXcafe=4'
)

// Same as calling `new Condition()`, has type hints
// Prefer defining single conditions like this - the intention is explicit,
// and you can compute conditions based of this one (by calling `singleCondition.with()`)
const singleCondition = $.one(['', 'Mem', '32bit', 0xCAFE, '=', 'Value', '', 5])

$(
  // Array form, looking similar to conditions in RAIntegration, has type hints
  ['', 'Mem', '32bit', 0xCAFE, '=', 'Value', '', 1],

  // Condition serialized to string
  '0xXcafe=2',

  // Return value from other `define` function call (an instance of ConditionBuilder)
  // It will include all conditions defined within `moreConditions`
  moreConditions,

  // Condition class instance
  singleCondition,

  // If you're mapping an array - it must be explicitly spread
  ...[6, 7].map(x => `0=${x}`),

  // Object form, represents Condition class instance data, has type hints, not practical
  {
    flag: '',
    lvalue: { type: 'Mem', size: '32bit', value: 0xCAFE },
    cmp: '=',
    rvalue: { type: 'Value', size: '', value: 8 },
    hits: 0
  }
).toString() // 0xXcafe=1_0xXcafe=2_0xXcafe=3_0xXcafe=4_0xXcafe=5_0=6_0=7_0xXcafe=8
```

## Chain calls

When calling the `define` function, you can chain call methods that represent condition flags, doing so will add conditions decorated with said flags (unless condition already has a flag set).

```js
import { define as $ } from '@cruncheevos/core'

$(
  '0=1',
).resetIf(
  'N:0=2', // N: stands for AndNext flag
  '0=3',
).also(
  '0=4',
).andNext(
  '0=5',
  '0=6', // Won't get AndNext flag, because it makes no sense to add it to final condition
).toString() // 0=1_N:0=2_R:0=3_0=4_N:0=5_0=6
```

Here's the table of available methods:

|     | Method            | Note |
|-----|-------------------|------|
|     | `also` | Only adds conditions
| `P` | `pauseIf`
| `R` | `resetIf`
| `Z` | `resetNextIf`
| `C` | `addHits`
| `D` | `subHits`
| `M` | `measured`
| `G` | `measuredPercent` | RAIntegration converts Measured flags to this if *Track as %* checkbox is ticked
| `Q` | `measuredIf`
| `T` | `trigger`
| `N` | `andNext` | Will not apply to final condition in the entire chain
| `O` | `orNext` | Will not apply to final condition in the entire chain

All of these methods with exception for `also` (which acts as regular `define`) are also available as exports:

```js
import { pauseIf, resetIf, resetNextIf, addHits, subHits, measured, measuredPercent, measuredIf, trigger, andNext, orNext } from '@cruncheevos/core'
```

They act same as `define`, but start the chain with respective flag:

```js
import { define as $, trigger } from '@cruncheevos/core'

const conditions1 = $(
  '0=1',
)

const conditions2 = $(
  'N:0=2', // N: stands for AndNext
  '0=3',
)

$(conditions1, conditions2).toString() // 0=1_N:0=2_0=3

// Trigger flag will be applied to 1st and 3rd conditions, as if filling holes
trigger(conditions1, conditions2).toString() // T:0=1_N:0=2_T:0=3
```

```js
import { define as $, orNext, andNext } from '@cruncheevos/core'

const conditions1 = $(
  '0=1',
  '0=2',
)

const conditions2 = $(
  '0=3',
  '0=4',
)

// There's no AndNext on final condition
andNext(conditions1, conditions2).toString() // N:0=1_N:0=2_N:0=3_0=4

// OrNext still filled 2nd condition because it's not the end of the entire chain
// There's no AndNext on final condition of the entire chain
orNext(
  conditions1
).andNext(
  conditions2
).toString() // O:0=1_O:0=2_N:0=3_0=4

// AndNext are applied to conditions separately,
// then the resulting conditions become part of outer chain of conditions.
// `.resetIf` chained call fills the empty flag left by `andNext(conditions2)`
$(
  andNext(conditions1)
).resetIf(
  andNext(conditions2)
).toString() // N:0=1_0=2_N:0=3_R:0=4
```

## Defining hits

For defining a single hit, `once` export is available. It's applied to final condition passed.

```js
import { define as $, once } from '@cruncheevos/core'

const conditions1 = $(
  '0=1',
  '0=2',
)

const conditions2 = $(
  '0=3',
  '0=4',
)

conditions1.toString() // 0=1_0=2
once(conditions1).toString() // 0=1_0=2.1.

// `once` can also be chain-called
pauseIf(
  conditions1
).once(
  conditions2
).also(
  '0=5'
).toString() // P:0=1_P:0=2_0=3_0=4.1._0=5
```

When you can't call `once`, pass a string literally spelling `'once'` as first argument:

```js
andNext(
  'once',
  conditions1
).toString() // N:0=1_0=2.1.
```

If you need to specify several hits, pass a string spelling `'hits <number>'`' as first argument:

```js
pauseIf(
  'hits 60',
  andNext(conditions1)
).toString() // N:0=1_P:0=2.60.
```

## Conditional conditions

When making functions, you may want to have optional parameters that set additional conditions. Inspired by [JSX conditional rendering](https://react.dev/learn/conditional-rendering#logical-and-operator-), you can prefix the conditions with boolean expressions. If it evaluates to falsy value - the condition naturally ends up not being included.

```js
function completedMission({
  missionId,
  minimalDifficulty = -1
}) {
  return $(
    ['', 'Mem', '32bit', 0xCAFE, '=', 'Value', '', missionId],
    minimalDifficulty >= 0 && $(
      ['', 'Mem', '32bit', 0xBEEF, '>=', 'Value', '', minimalDifficulty],
      ['', 'Mem', '32bit', 0xCACA, '>=', 'Value', '', 1],
    ),
    '0=3'
  )
}

completedMission({ missionId: 2, minimalDifficulty: 3 }) // 0xXcafe=2_0xXbeef>=3_0xXcaca>=1_0=3
completedMission({ missionId: 2 }) // 0xXcafe=2_0=3
```

## Accessing conditions directly

All of the conditions you pass as arguments to `define` function and it's methods end up in `conditions` array. Unless you know what you're doing, **the access should be read-only**.

**Ignored [conditional conditions](#conditional-conditions) will not appear in the `conditions` array**

```js
const builder = $(
  '0=1',
  false && '0=2', // will not end up in `builder.conditions`
  '0=3',
)

builder.conditions.length // 2
builder.conditions[1].toString() // 0=3
```

## Iterating

`ConditionBuilder` is [iterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators#iterables), therefore you can use it in `for .. of` loop, or apply spread syntax to it:

```js
const builder = $(
  '0=1',
  false && '0=2',
  '0=3',
)

// This loop will implicitly loop over builder.conditions
for (const condition of builder) {
  console.log(condition.toString())
}

const arrayOfConditions = [...builder]
  .map(x => x.toString()) // [ '0=1', '0=3' ]
```

## Mapping

If you need to process the entire chain in a complex way, there's `.map` method available which acts the same as [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) applied to [`conditions`](#accessing-conditions-directly). Calling `.map` on `ConditionBuilder` will result in new instance of `ConditionBuilder` with conditions you've mapped.

**Ignored [conditional conditions](#conditional-conditions) will not appear in the `map` callback**, and will not be a part of `array` callback argument.

Here's silly example that tampers with right value and amount of hits for each condition:

```js
$(
  '0=0',
).resetIf(
  false && '0=0', // this condition will not appear in the `map` callback
  '0=0',
).also(
  '0=0',
).andNext(
  '0=0',
  '0=0',
).map((c, index, array) =>
  c.with({ rvalue: { value: index + 1 }, hits: index + 1})
)
.toString() // 0=1.1._R:0=2.2._0=3.3._N:0=4.4._0=5.5.
```

More practical example of `.map` being useful:

```js
const cheat1Off = $.one('0xX1001=0')
const cheat2Off = $.one('0xX1002=0')
const cheat3Off = $.one('0xX1003=0')

const allCheatsOff = $(
  cheat1Off,
  cheat2Off,
  cheat3Off
)
allCheatsOff.toString() // 0xX1001=0_0xX1002=0_0xX1003=0

const anyCheatOn = orNext(
  allCheatsOff.map(c => c.with({ cmp: '!=' }))
).toString() // O:0xX1001!=0_O:0xX1002!=0_0xX1003!=0
```

## withLast

Acts like [`Condition.with`](https://github.com/suXinjke/cruncheevos/blob/master/packages/core/api-core.md#conditionwithdata-deeppartialconditiondata-condition) applied to final condition in the chain. This is mostly useful when dealing with pointer chains:

```js
$(
  ['AddAddress', 'Mem', '32bit', 0xcafe],
  ['AddAddress', 'Mem', '32bit', 0xbeef],
  ['', 'Mem', '32bit', 0, '=', 'Value', '', 120],
)
  .withLast({ cmp: '!=', rvalue: { value: 9 } })
  .toString() // I:0xXcafe_I:0xXbeef_0xX0!=9
```

## toString / toJSON

All the examples shown already involve calling `.toString()`, which gives you raw condition code. In the actual achievement set scripts, this can be useful when making Rich Presence.

ConditionBuilder class implements `.toJSON()` method which just calls `.toString()`, so this works:

```js
const conditions1 = $('0=1', '0=2')
const conditions2 = $('0=3', '0=4')
JSON.stringify({ conditions1, conditions2 }, null, 2 )
/*
{
  "conditions1": "0=1_0=2",
  "conditions2": "0=3_0=4"
}
*/
```

## String comparisons

Sometimes you need to compare strings, which can be tedious if you have long strings and AddAddress chains.

`define.str` function helps defining such comparisons:

```js
import { define as $ } from '@cruncheevos/core'

$.str(
  'abcde',
  (
    size, // '32bit' | '24bit' | '16bit' | '8bit'
    value // ['Value', '', someNumber]
  ) => $(
    ['AddAddress', 'Mem', '32bit', 0xcafe],
    ['AddAddress', 'Mem', '32bit', 0xfeed],
    ['', 'Mem', size, 0xabcd, '=', ...value],
  )
)
// "I:0xXcafe_I:0xXfeed_N:0xXabcd=1684234849_I:0xXcafe_I:0xXfeed_0xHabcd=101"
// abcd = 0x64636261 = 1684234849
//    e = 0x65       = 101
```