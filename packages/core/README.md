# @cruncheevos/core

**@cruncheevos/core** is zero-dependency JavaScript library for dealing with [RetroAchievements](https://retroachievements.org/) assets
* Parse achievement condition strings, achievement and leaderboard strings produced by [RAIntegration](https://github.com/RetroAchievements/RAIntegration/) into JavaScript objects
* Output condition, achievement and leaderboard strings
* Validation at runtime

The library is provided in both ESM and UMD format, it expects your environment to support atleast ES2018, if that's a problem - include the package into your build step.

## Additional documentation

* [API](https://github.com/suXinjke/cruncheevos/blob/master/packages/core/api-core.md) - mirrors jsdoc comments
* [define function](https://github.com/suXinjke/cruncheevos/blob/master/packages/core/define.md)

## Installation

```
> npm install @cruncheevos/core
```

You can also get the library from unpkg:

```js
<script src="https://unpkg.com/@cruncheevos/core/dist/cruncheevos.umd.js"></script>
<script>
  console.log({ cruncheevos })
</script>
```

```js
import * as cruncheevos from 'https://unpkg.com/@cruncheevos/core/dist/cruncheevos.js'
console.log({ cruncheevos })
```

## Usage examples

```js
import { define as $, Condition, Achievement, Leaderboard, AchievementSet } from '@cruncheevos/core'

const conditionString = new Condition(
  ['ResetIf', 'Mem', '32bit', 0xCAFE, '=', 'Value', '', 1234]
).toString() // R:0xXcafe=1234

const conditionObject = new Condition('0xXcafe=1234')
/*
Condition {
  flag: '',
  lvalue: { type: 'Mem', size: '32bit', value: 51966 },
  cmp: '=',
  rvalue: { type: 'Value', size: '', value: 1234 },
  hits: 0
}
*/

// define.one ($.one) - same as new Condition
const cheat1 = $.one(['', 'Mem', '8bit', 0x34444, '=', 'Value', '', 0])
const cheat2 = $.one(['', 'Mem', '8bit', 0x34445, '=', 'Value', '', 0])
const cheat3 = $.one(['', 'Mem', '8bit', 0x34446, '=', 'Value', '', 0])

const achievement = new Achievement({
  id: 111000001,
  title: 'My Achievement',
  description: 'Do something funny',
  points: 5,
  type: 'win_condition',
  conditions: {
    core: $(
      conditionObject.with({ cmp: '!=' }) // make a slightly different copy of condition
    ).pauseIf(
      // each condition will be wrapped with PauseIf flag
      cheat1,
      cheat2,
      cheat3,
    ),
    alt1: [
      ['', 'Mem', '32bit', 0xFEED, '=', 'Value', '', 0xABCDEF]
    ]
  }
})

achievement.toString()
// 111000001:"0xXcafe!=1234_P:0xH34444=0_P:0xH34445=0_P:0xH34446=0S0xXfeed=11259375":My Achievement:Do something funny:::win_condition:cruncheevos:5:::::00000

const leaderboard = new Leaderboard({
  id: 111000001,
  title: 'My Leaderboard',
  description: 'Do something funny',
  type: 'SCORE',
  lowerIsBetter: false,
  conditions: {
    start: {
      core: $(
        conditionObject.with({ cmp: '!=' })
      ).pauseIf(
        // each condition will be wrapped with PauseIf flag
        cheat1,
        cheat2,
        cheat3,
      )
    },
    cancel: '0=1',
    submit: '1=1',
    value: $(['Measured', 'Mem', '32bit', 0x1234])
  }
})

leaderboard.toString()
// L111000001:"0xXcafe!=1234_P:0xH34444=0_P:0xH34445=0_P:0xH34446=0":"0=1":"1=1":"M:0xX1234":SCORE:My Leaderboard:Do something funny:0

const set = new AchievementSet({ gameId: 1234, title: 'Cool Game' })
set.addAchievement(achievement)
set.addLeaderboard(leaderboard)

set.toString()
/*
1.0
Cool Game
111000001:"0xXcafe!=1234_P:0xH34444=0_P:0xH34445=0_P:0xH34446=0S0xXfeed=11259375":My Achievement:Do something funny:::win_condition:cruncheevos:5:::::00000
L111000001:"0xXcafe!=1234_P:0xH34444=0_P:0xH34445=0_P:0xH34446=0":"0=1":"1=1":"M:0xX1234":SCORE:My Leaderboard:Do something funny:0
*/
```