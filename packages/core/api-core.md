# @cruncheevos/core API

- [Condition](#condition)
  - [`flag`](#conditionflag-conditionflag)
  - [`lvalue`](#conditionlvalue-conditionvalue)
  - [`cmp`](#conditioncmp-conditionoperator)
  - [`rvalue`](#conditionrvalue-conditionvalue)
  - [`hits`](#conditionhits-number)
  - [`new Condition(def: Condition.Array)`](#new-conditiondef-conditionarray)
  - [`new Condition(def: string)`](#new-conditiondef-string)
  - [`new Condition(def: Condition)`](#new-conditiondef-condition)
  - [`new Condition(def: Condition.Data)`](#new-conditiondef-conditiondata)
  - [`with(data: Condition.PartialMergedData): Condition`](#conditionwithdata-conditionpartialmergeddata-condition)
  - [`toString(): string`](#conditiontostring-string)
  - [`toArray(): Condition.Array`](#conditiontoarray-conditionarray)
  - [`toArrayPretty(): string[]`](#conditiontoarraypretty-string)
- [Condition.Value](#conditionvalue)
  - [`type`](#valuetype-valuetype)
  - [`size`](#valuesize-size)
  - [`value`](#valuevalue-number)
- [Achievement](#achievement)
  - [`id`](#achievementid-number)
  - [`setId`](#achievementsetid-number)
  - [`title`](#achievementtitle-string)
  - [`description`](#achievementdescription-string)
  - [`author`](#achievementauthor-string)
  - [`points`](#achievementpoints-number)
  - [`type`](#achievementtype-achievementtype)
  - [`badge`](#achievementbadge-string)
  - [`conditions`](#achievementconditions-conditiongroupnormalized)
  - [`new Achievement(def: Achievement.InputObject)`](#new-achievementdef-achievementinputobject)
  - [`new Achievement(def: string)`](#new-achievementdef-string)
  - [`with(data: DeepPartial<Achievement.InputObject>): Achievement`](#achievementwithdata-deeppartialachievementinputobject-achievement)
  - [`toString(desiredData: 'achievement' | 'achievement-legacy' | 'conditions'): string`](#achievementtostringdesireddata-achievement--achievement-legacy--conditions-string)
- [Leaderboard](#leaderboard)
  - [`id`](#leaderboardid-number)
  - [`setId`](#leaderboardsetid-number)
  - [`title`](#leaderboardtitle-string)
  - [`description`](#leaderboarddescription-string)
  - [`type`](#leaderboardtype-leaderboardtype)
  - [`lowerIsBetter`](#leaderboardlowerisbetter-boolean)
  - [`conditions`](#leaderboardconditions-leaderboardconditionsconditiongroupnormalized)
  - [`new Leaderboard(def: Leaderboard.InputObject)`](#new-leaderboarddef-leaderboardinputobject)
  - [`new Leaderboard(def: string)`](#new-leaderboarddef-string)
  - [`with(data: DeepPartial<Leaderboard.InputObject>): Leaderboard`](#leaderboardwithdata-deeppartialleaderboardinputobject-leaderboard)
  - [`toString(desiredData: 'leaderboard' | 'leaderboard-legacy' | 'conditions'): string`](#leaderboardtostringdesireddata-leaderboard--leaderboard-legacy--conditions-string)
- [AchievementSet](#achievementset)
  - [`gameId`](#achievementsetgameid-number)
  - [`id`](#achievementsetid-number-1)
  - [`title`](#achievementsettitle-string)
  - [`achievements`](#achievementsetachievements-recordstring-achievement--iterableachievement)
  - [`leaderboards`](#achievementsetleaderboards-recordstring-leaderboard--iterableleaderboard)
  - [`addAchievement(def: AchievementSet.AchievementInputObject | Achievement | string): this`](#achievementsetaddachievementdef-achievementsetachievementinputobject--achievement--string-this)
  - [`addLeaderboard(def: AchievementSet.LeaderboardInputObject | Leaderboard | string): this`](#achievementsetaddleaderboarddef-achievementsetleaderboardinputobject--leaderboard--string-this)
  - [`[Symbol.iterator]()`](#achievementsetsymboliterator)
  - [`toString(desiredData: 'set' | 'set-legacy'): string`](#achievementsettostringdesireddata-set--set-legacy-string)
- [RichPresence(params: RichPresence.Params)](#richpresenceparams-richpresenceparams)
  - [`RichPresence.display(condition: Condition.Input | ConditionBuilder, displayString: string)`](#richpresencedisplaycondition-conditioninput--conditionbuilder-displaystring-string)
  - [`RichPresence.format(params: RichPresence.FormatParams)`](#richpresenceformatparams-richpresenceformatparams)
  - [`RichPresence.lookup(params: RichPresence.LookupParams)`](#richpresencelookupparams-richpresencelookupparams)
  - [`RichPresence.tag(strings: TemplateStringsArray, ...args)`](#richpresencetagstrings-templatestringsarray-args)
  - [`RichPresence.macro`](#richpresencemacro)

## Condition

This class represents a code piece that can be part of achievements, leaderboards or rich presence for RetroAchievements.

Conditions are immutable, if you need to a make a new Condition instance based of existing one - use `with()` method.

---

#### `condition.flag: Condition.Flag`

Affects condition logic or the way it reads memory.

Individual documentation for each flag [can be seen here](https://docs.retroachievements.org/developer-docs/achievement-development-overview.html#flags).

Possible values are: `'' | 'PauseIf' | 'ResetIf' | 'ResetNextIf' | 'AddHits' | 'SubHits' | 'AndNext' | 'OrNext' | 'Measured' | 'Measured%' | 'MeasuredIf' | 'Trigger' | 'AddSource' | 'SubSource' | 'AddAddress' | 'Remember'`

#### `condition.lvalue: Condition.Value`

Condition's left value, it always exists.

#### `condition.cmp: Condition.Operator`

An operator set between left and right value. Empty string is allowed for conditions that don't specify right value.

Possible values are: `'' | '=' | '!=' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%' | '&' | '^'`

#### `condition.rvalue: Condition.Value`

Condition's optional right value. If it's not set - rvalue properties are empty strings.

#### `condition.hits: number`

Amount of hits set (also known as Hit Count), additional explanation [can be seen here](https://docs.retroachievements.org/developer-docs/hit-counts.html).

---

#### `new Condition(def: Condition.Array)`

Creates Condition using array representing it.

```ts
new Condition(['ResetIf', 'Mem', 'Bit0', 71, '>', 'Delta', 'Bit1', 71, 3])
```

#### `new Condition(def: string)`

Creates Condition using a string representing the condition.

```ts
new Condition('R:0xM47>d0xN47.3.')
// same as
new Condition(['ResetIf', 'Mem', 'Bit0', 71, '>', 'Delta', 'Bit1', 71, 3])
```

#### `new Condition(def: Condition)`

Returns the same Condition instance passed,
which is due to Conditions being immutable.

#### `new Condition(def: Condition.Data)`

Creates Condition using an object that directly represents the Condition data.

```ts
new Condition({
  flag: '',
  lvalue: {
    type: 'Mem',
    size: '32bit',
    value: 0xcafe,
  },
  cmp: '=',
  rvalue: {
    type: 'Value',
    size: '',
    value: 47,
  },
  hits: 0,
})
```

#### `condition.with(data: Condition.PartialMergedData): Condition`

Returns new Condition instance with different values merged.

`lvalue` and `rvalue` can be specified as partial array, which can be less verbose

```ts
new Condition('0=1')
  .with({ cmp: '!=', rvalue: { value: 47 } })
  .toString() // 0!=47

new Condition('0xXcafe=0xXfeed')
  .with({ rvalue: ['Delta', '16bit', 0xabcd] })
  .toString() // 0xXcafe=d0x abcd

new Condition('0xXcafe=0xXfeed')
  .with({ rvalue: ['Delta'] })
  .toString() // 0xXcafe=d0xXfeed
```

#### `condition.toString(): string`

Returns string representation of Condition
suitable for RetroAchievements and local files.

```ts
new Condition(['ResetIf', 'Mem', 'Bit0', 71, '>', 'Delta', 'Bit1', 71, 3]).toString() // 'R:0xM47>d0xN47.3.'
```

#### `condition.toArray(): Condition.Array`

Returns direct Array representation of Condition,
values are exactly same as properties of Condition.

```ts
new Condition(['Measured', 'Mem', '8bit', 4]).toArray()
// [ "Measured", "Mem", "8bit", 4, "", "", "", 0, 0 ]
```

#### `condition.toArrayPretty(): string[]`

Returns prettier Array representation of Condition, which is more suitable for display:

* Everything is a string
* Values are formatted as hexadecimal if they are greater or equal to 100000
* Negative values are formatted as decimal if they are greater or equal to -4096, otherwise formatted as hexadecimal with underflow correction
* Hits are empty string if equal to zero

```ts
new cruncheevos.Condition(['ResetIf', 'Mem', '32bit', 0xfeedcafe, '>', 'Value', '', 71]).toArrayPretty()
// [ "ResetIf", "Mem", "32bit", "0xfeedcafe", ">", "Value", "", "71", "" ]

new cruncheevos.Condition(['', 'Value', '', -4097, '>', 'Value', '', -1]).toArrayPretty()
// [ "", "Value", "", "0xffffefff", ">", "Value", "", "-1", "" ]
```

## Condition.Value

---

#### `value.type: ValueType`

Specifies if value is read from memory and the way it's read/interpreted, or if value is constant. Empty string is allowed for rvalue.

Possible values are: `'' | 'Mem' | 'Delta' | 'Prior' | 'BCD' | 'Invert' | 'Value' | 'Float' | 'Recall'`

#### `value.size: Size`

Specifies how to interpret the value at specified memory address. Not required for constant values.

Possible values are: `'' | 'Float' | 'Bit0' | 'Bit1' | 'Bit2' | 'Bit3' | 'Bit4' | 'Bit5' | 'Bit6' | 'Bit7' | 'Lower4' | 'Upper4' | '8bit' | '16bit' | '24bit' | '32bit' | '16bitBE' | '24bitBE' | '32bitBE' | 'BitCount' | 'FloatBE' | 'Double32' | 'Double32BE' | 'MBF32' | 'MBF32LE'`

#### `value.value: number`

If value type implies reading from memory - this specifies memory address, otherwise specifies constant value.

## Achievement

This class represents an achievement for RetroAchievements. Achievement can be a part of AchievementSet class instance, or used separately if your goal is to parse and produce string representations of achievement that would go into local RACache file.

Achievements are immutable, if you need to a make a new Achievement instance based of existing one - use `with()` method.

---

#### `achievement.id: number`

ID of an Asset matching the one on server.
If Asset does not exist on the server yet, `id` should be set
to a high number like 111000001, similar to what RAIntegration
does when creating local assets.

#### `achievement.setId: number`

Optional Subset ID that an Asset belongs to, matching the one on server.

#### `achievement.title: string`

Title of an Asset, must be set.

#### `achievement.description: string`

Description of an Asset, must be set.

#### `achievement.author: string`

Achievement's author name, it's not necessary and
is not sent to servers, but local RACache
files do mention the author.

#### `achievement.points: number`

Amount of points that players will get when earning
the Achievement. Must be set to any positive integer or 0.

Server accepts following values: 0, 1, 2, 3, 4, 5, 10, 25, 50, 100.

Server may still have odd Achievements with incorrect point values,
which is the reason for allowing any positive integer for points.

#### `achievement.type: Achievement.Type`

Optional type of achievement, accepted strings are self-explanatory.

Falsy values are treated as empty string, which marks no type set.

Possible values are: `'' | 'missable' | 'progression' | 'win_condition'`

#### `achievement.badge: string`

Optional numeric string representing Achievement's badge ID on server.

Alternatively, can be set to a string like `'local\\\\mybadge.png'`, which will be recognized by RAIntegration.

#### `achievement.conditions: Condition.GroupNormalized`

Array of arrays containing Condition class instances:
* Outer array represents Condition groups like Core, Alt 1, Alt 2 ...
* Inner array represents individual Conditions within the group

---

#### `new Achievement(def: Achievement.InputObject)`

Creates Achievement using object representing it.

```ts
import { define as $ } from '@cruncheevos/core'

new Achievement({
  id: 58, // or numeric string
  setId: 1024, // or numeric string, optional
  title: 'My Achievement',
  description: 'Do something funny',
  points: 5,
  badge: `local\\\\my_achievement.png`, // optional, or ID of badge on server
  author: 'peepy', // optional and is not uploaded to server
  conditions: {
    core: [
      ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
      ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
    ],
    alt1: $(
      ['', 'Mem', '8bit', 0x00fe10, '>', 'Delta', '8bit', 0x00fe10],
      ['', 'Mem', '8bit', 0x00fe11, '=', 'Value', '', 0],
    ),
    alt2: '0=1'
  }
})

new Achievement({
  // ...
  conditions: '0=1'
})

new Achievement({
  // ...
  conditions: [
    ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
    ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
  ] // same as providing an object: { core: [ ... ] }
})
```

#### `new Achievement(def: string)`

Creates Achievement using string representing it, taken from `RACache/Data/GameId-User.txt` file.

```ts
new Achievement(
 '58:"0xHfff0=0_0xHfffb=0S0xHfe10>d0xHfe10_0xHfe11=0S0=1"' +
 ':My Achievement:Do something funny::::peepy:5:::::"local\\\\my_achievement.png"'
)

new Achievement(
 '58|1024:"0xHfff0=0_0xHfffb=0S0xHfe10>d0xHfe10_0xHfe11=0S0=1"' +
 ':My Achievement:Do something funny::::peepy:5:::::"local\\\\my_achievement.png"'
)
```

#### `achievement.with(data: DeepPartial<Achievement.InputObject>): Achievement`

Returns new Achievement instance with different values merged.

```ts
someAchievement
  .with({ title: someAchievement.title + 'suffix' })
```

#### `achievement.toString(desiredData: 'achievement' | 'achievement-legacy' | 'conditions'): string`

Returns string representation of Achievement suitable
for `RACache/Data/GameId-User.txt` file.

```ts
someAchievement.toString()
someAchievement.toString('achievement')
// '58:"0=1":My Achievement:Do something funny::::cruncheevos:5:::::00000'

someAchievement.toString('conditions') // '0=1'

// if setId is set
someAchievement.toString()
someAchievement.toString('achievement')
// '58|1024:"0=1":My Achievement:Do something funny::::cruncheevos:5:::::00000'

someAchievement.toString('achievement-legacy')
// '58:"0=1":My Achievement:Do something funny::::cruncheevos:5:::::00000'
```

## Leaderboard

This class represents a leaderboard for RetroAchievements. Leaderboards can be a part of AchievementSet class instances, or used separately if your goal is to parse and produce string representations of leaderboard that would go into local RACache file.

Leaderboard are immutable, if you need to a make a new Leaderboard instance based of existing one - use `with()` method.

---

#### `leaderboard.id: number`

ID of an Asset matching the one on server.
If Asset does not exist on the server yet, `id` should be set
to a high number like 111000001, similar to what RAIntegration
does when creating local assets.

#### `leaderboard.setId: number`

Optional Subset ID that an Asset belongs to, matching the one on server.

#### `leaderboard.title: string`

Title of an Asset, must be set.

#### `leaderboard.description: string`

Description of an Asset, must be set.

#### `leaderboard.type: Leaderboard.Type`

Specifies how to interpret Leaderboard's value.

Additional info [can be seen here](https://docs.retroachievements.org/developer-docs/leaderboards.html#value-format)

Possible values are: `'SCORE' | 'TIME' | 'FRAMES' | 'MILLISECS' | 'SECS' | 'TIMESECS' | 'MINUTES' | 'SECS_AS_MINS' | 'VALUE' | 'UNSIGNED' | 'TENS' | 'HUNDREDS' | 'THOUSANDS' | 'FIXED1' | 'FIXED2' | 'FIXED3'`

#### `leaderboard.lowerIsBetter: boolean`

Self explanatory, affects how leaderboard results are displayed.

#### `leaderboard.conditions: LeaderboardConditions<Condition.GroupNormalized>`

Object representing four condition groups that make up Leaderboard code.

Each group is an array of arrays containing Condition class instances:
* Outer array represents Condition groups like Core, Alt 1, Alt 2 ...
* Inner array represents individual Conditions within the group
* For `value` group, each outer array represents Value retrieval
and Max of these values is taken

---

#### `new Leaderboard(def: Leaderboard.InputObject)`

Creates Leaderboard using object representing it.

```ts
import { define as $ } from '@cruncheevos/core'

new Leaderboard({
  id: 58, // or numeric string
  setId: 1024, // or numeric string, optional
  title: 'My Leaderboard',
  description: 'Best score while doing something funny',
  type: 'SCORE',
  lowerIsBetter: false,
  conditions: {
    start: {
      core: [
        ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
        ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
      ],
      alt1: $(
        ['', 'Mem', '8bit', 0x00fe10, '>', 'Delta', '8bit', 0x00fe10],
        ['', 'Mem', '8bit', 0x00fe11, '=', 'Value', '', 0],
      ),
      alt2: '0=1',
    },
    cancel: [
      ['', 'Mem', '16bit', 0x34684, '=', 'Value', '', 0x140]
    ], // same as providing an object: { core: [ ... ] }
    submit: '0xH59d76=2',
    value: [['Measured', 'Mem', '32bit', 0x34440, '*', 'Value', '', 2]],
  },
})
```

#### `new Leaderboard(def: string)`

Creates Leaderboard using string representing it, taken from `RACache/Data/GameId-User.txt` file.

```ts
new Leaderboard(
 'L58:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2"' +
 ':SCORE:My Leaderboard:Best score while doing something funny:0'
)

new Leaderboard(
 'L58|1024:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2"' +
 ':SCORE:My Leaderboard:Best score while doing something funny:0'
)
```

#### `leaderboard.with(data: DeepPartial<Leaderboard.InputObject>): Leaderboard`

Returns new Leaderboard instance with different values merged.

```ts
someLeaderboard
  .with({ title: someLeaderboard.title + 'suffix' })
```

#### `leaderboard.toString(desiredData: 'leaderboard' | 'leaderboard-legacy' | 'conditions'): string`

Returns string representation of Leaderboard suitable
for `RACache/Data/GameId-User.txt` file.

```ts
someLeaderboard.toString()
someLeaderboard.toString('leaderboard')
// 'L58:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2":SCORE:My Leaderboard:Best score while doing something funny:0'

someLeaderboard.toString('conditions') // '"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2"'

// if setId is set
someLeaderboard.toString()
someLeaderboard.toString('leaderboard')
// 'L58|1024:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2":SCORE:My Leaderboard:Best score while doing something funny:0'

someLeaderboard.toString('leaderboard-legacy')
// 'L58:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2":SCORE:My Leaderboard:Best score while doing something funny:0'
```

## AchievementSet

This class represents AchievementSet that can be converted into
RACache/Data/GameId-User.txt file

AchievementSet is mostly to be used with standalone scripts that export it
for `@cruncheevos/cli` to update local file in RACache.

---

#### `achievementSet.gameId: number`

Game ID matching the one on RetroAchievement servers,
must be set correctly if using this class with `@cruncheevos/cli`

#### `achievementSet.id: number`

Optional Set ID matching the one on RetroAchievement servers.
`@cruncheevos/cli` respects this when performing asset diff and updates.
This will automatically inject setId to added Achievements and Leaderboards.
If Achievement or Leaderboard already specifies setId - it will be overridden.

Technically all achievement sets on RetroAchievement servers have an ID,
but they used not to and you would rely solely on Game ID instead.
In practice you'd specify Set ID only when you need to refer to a subset,
but remember that Core sets also have Set ID.

#### `achievementSet.title: string`

Game title or name, it doesn't have to be exact match and
is merely put on the second line of produced local file.

#### `achievementSet.achievements: Record<string, Achievement> & Iterable<Achievement>`

Object containing all added achievements, with achievement id as a key.
Treat it as read-only unless you know better.

Also implements Symbol.iterator which yields each Achievement stored.

#### `achievementSet.leaderboards: Record<string, Leaderboard> & Iterable<Leaderboard>`

Object containing all added leaderboards, with leaderboard id as a key.
Treat it as read-only unless you know better.

Also implements Symbol.iterator which yields each Leaderboard stored.

---

#### `achievementSet.addAchievement(def: AchievementSet.AchievementInputObject | Achievement | string): this`

Adds Achievement to the set, accepts same data as Achievement class constructor,
but you're allowed to omit id when passing an object (id will be assigned automatically, similar to how RAIntegration does it).

Also returns current AchievementSet instance, allowing you to chain calls.

```ts
import { AchievementSet, define as $ } from '@cruncheevos/core'

const set = new AchievementSet({ gameId: 1234, title: 'Funny Game' })

set.addAchievement({
  id: 58, // optional, or numeric string
  title: 'My Achievement',
  description: 'Do something funny',
  points: 5,
  badge: `local\\\\my_achievement.png`, // optional, or ID of badge on server
  author: 'peepy', // optional and is not uploaded to server
  conditions: {
    core: [
      ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
      ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
    ],
    alt1: $(
      ['', 'Mem', '8bit', 0x00fe10, '>', 'Delta', '8bit', 0x00fe10],
      ['', 'Mem', '8bit', 0x00fe11, '=', 'Value', '', 0],
    ),
    alt2: '0=1'
  }
}).addAchievement(...)
```

#### `achievementSet.addLeaderboard(def: AchievementSet.LeaderboardInputObject | Leaderboard | string): this`

Adds Leaderboard to the set, accepts same data as Leaderboard class constructor,
but you're allowed to omit id when passing an object (id will be assigned automatically, similar to how RAIntegration does it).

Also returns current AchievementSet instance, allowing you to chain calls.

```ts
import { AchievementSet, define as $ } from '@cruncheevos/core'

const set = new AchievementSet({ gameId: 1234, title: 'Funny Game' })

set.addLeaderboard({
  id: 58, // optional, or numeric string
  title: 'My Leaderboard',
  description: 'Best score while doing something funny',
  type: 'SCORE',
  lowerIsBetter: false,
  conditions: {
    start: {
      core: [
        ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
        ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
      ],
      alt1: $(
        ['', 'Mem', '8bit', 0x00fe10, '>', 'Delta', '8bit', 0x00fe10],
        ['', 'Mem', '8bit', 0x00fe11, '=', 'Value', '', 0],
      ),
      alt2: '0=1',
    },
    cancel: [
      ['', 'Mem', '16bit', 0x34684, '=', 'Value', '', 0x140]
    ], // same as providing an object: { core: [ ... ] }
    submit: '0xH59d76=2',
    value: [['Measured', 'Mem', '32bit', 0x34440, '*', 'Value', '', 2]],
  },
}).addLeaderboard(...)
```

#### `achievementSet[Symbol.iterator]()`

Allows to iterate the whole set for both achievements and leaderboards.

```ts
for (const asset of achSet) {
  if (asset instanceof Achievement) {
     // ...
  }
  if (asset instanceof Leaderboard) {
     // ...
  }
}
```

#### `achievementSet.toString(desiredData: 'set' | 'set-legacy'): string`

Returns string representation of AchievementSet suitable for
`RACache/Data/GameId-User.txt` file.

First line is version, always set to 1.0, second line is game's title.
Then come string representations of achievements and leaderboards,
each sorted by id.

```ts
new AchievementSet({ gameId: 1234, title: 'Funny Game' })
 .addAchievement(...)
 .addAchievement(...)
 .addLeaderboard(...)
 .addLeaderboard(...)
 .toString()
// may result in:
`
1.0
Funny Game
57:"0x cafe=102":Ach2:Desc2::::cruncheevos:2:::::00000
111000001:"0x cafe=101":Ach1:Desc1::::cruncheevos:1:::::00000
L58:"0x cafe=102":"0=1":"1=1":"M:0x feed":FRAMES:Lb2:Desc2:1
L111000001:"0x cafe=101":"0=1":"1=1":"M:0x feed":SCORE:Lb1:Desc1:0
`

new AchievementSet({ gameId: 1234, id: 5800, title: 'Funny Game' })
 .addAchievement(...)
 .addLeaderboard(...)
 .toString()
// may result in:
`
1.0
Funny Game
57|5800:"0x cafe=102":Ach2:Desc2::::cruncheevos:2:::::00000
L58|5800:"0x cafe=102":"0=1":"1=1":"M:0x feed":FRAMES:Lb2:Desc2:1
`

new AchievementSet({ gameId: 1234, id: 5800, title: 'Funny Game' })
 .addAchievement(...)
 .addLeaderboard(...)
 .toString('set-legacy')
// may result in:
`
1.0
Funny Game
57:"0x cafe=102":Ach2:Desc2::::cruncheevos:2:::::00000
L58:"0x cafe=102":"0=1":"1=1":"M:0x feed":FRAMES:Lb2:Desc2:1
`
```

## RichPresence(params: RichPresence.Params)

Provides declarative API to produce Rich Presence string

```ts
import { define as $, RichPresence } from '@cruncheevos/core'

RichPresence({
  lookupDefaultParameters: { keyFormat: 'hex', compressRanges: true },
  // Wraps calls to RichPresence.format
  format: {
    Score: 'VALUE',
  },
  // Wraps calls to RichPresence.lookup
  lookup: {
    Song: {
      // No need to specify name, it's taken from object
      values: {
        '*': 'Unknown value',
        1: 'Same value',
        2: 'Same value',
        3: 'Same value',
      },
      // overrides lookupDefaultParameters.keyFormat
      keyFormat: 'dec',
      defaultAt: 0x100,
    },
    Mode: {
      values: {
        1: 'Mode 1',
        2: 'Mode 2',
      },
      // overrides lookupDefaultParameters.compressRanges
      compressRanges: false
    },
  },
  // Callback function that must return an array of display strings.
  // All the previously specified Lookups and Formats are provided
  // through `lookup` and `format` objects respectively,
  // along with the `tag` function to inject lookups into display strings.
  displays: ({ lookup, format, macro, tag }) => [
    [
      $(['', 'Mem', '16bit', 0xcafe, '=', 'Value', '', 1]),

      // Passing lookup.Song to this tagged template literal function causes
      // `lookup.Song.at()` call with previosly set `defaultAt` value
      tag`Cafe at value 1, Song: ${lookup.Song}, Mode: ${lookup.Mode.at(0x990)}`,
    ],

    ['0xCAFE=2', tag`Cafe at value 2, format example: ${format.Score.at(0x600)}`],

    // `macro` is an object providing several pre-existing Formats
    ['0xCAFE=3', tag`Default macro test ${macro.Score.at('0xfeed')}`],
    'Playing a good game',
  ],
 })

 `Format:Score
 FormatType=VALUE

 Lookup:Song
 1-3=Same value
 *=Unknown value

 Lookup:Mode
 0x1=Mode 1
 0x2=Mode 2

 Display:
 ?0x cafe=1?Cafe at value 1, Song: ＠Song(0x100), Mode: ＠Mode(0x990)
 ?0xCAFE=2?Cafe at value 2, format example: ＠Score(0x600)
 ?0xCAFE=3?Default macro test ＠Score(0xfeed)
 Playing a good game`
```

#### `RichPresence.display(condition: Condition.Input | ConditionBuilder, displayString: string)`

Returns a string representing Rich Presence Display line

Does not check if provided arguments are of correct type

```ts
import { RichPresence } from '@cruncheevos/core'
RichPresence.display('0=1', 'Nothing is happening'))
// '?0=1?Nothing is happening'
```

#### `RichPresence.format(params: RichPresence.FormatParams)`

Creates an object representing Rich Presence Format

```ts
import { RichPresence } from '@cruncheevos/core'

const format = RichPresence.format({
  name: 'Score',
  type: 'VALUE',
})

format.at('0xCAFE_v1') // '@Score(0xCAFE_v1)'
format.at($(['Measured', 'Mem', '16bit', 0xCAFE])) // '@Score(0xcafe)'
format.toString() // 'Format:Score\nFormatType=VALUE'
```

#### `RichPresence.lookup(params: RichPresence.LookupParams)`

Creates an object representing Rich Presence Lookup

```ts
import { RichPresence } from '@cruncheevos/core'

const lookup = RichPresence.lookup({
  name: 'Car',
  keyFormat: 'hex',
  values: {
    1: 'First!',
    2: 'Second!',
    4: 'Same',
    5: 'Same',
  },
  defaultAt: 0xfeed,
  compressRanges: true
})

lookup.at() // '@Car(0xfeed)'
lookup.at('0xCAFE_v1') // '@Score(0xCAFE_v1)'
lookup.at($(['Measured', 'Mem', 'Float', 0xCAFE])) // '@Car(fFcafe)'
lookup.toString() // `Lookup:Car\n0x1=First!\n0x2=Second!\n0x4-0x5=Same'
```

#### `RichPresence.tag(strings: TemplateStringsArray, ...args)`

Tagged template literal function which can accept Rich Presence Lookup instances.
This allows for less noisy display strings.

```ts
import { RichPresence } from '@cruncheevos/core'

const lookup = RichPresence.lookup({ name: 'Song', defaultAddress: 0xfeed, values: { ... } })

RichPresence.tag`${lookup} - now playing` // '@Song(0xfeed) - now playing'
```

#### `RichPresence.macro`

Provides an object containing default Rich Presence Macros

```ts
import { RichPresence } from '@cruncheevos/core'

RichPresence.macro.Score.at('0xCAFE') // '@Score(0xCAFE)'
RichPresence.macro.ASCIIChar.at('0xCAFE') // '@ASCIIChar(0xCAFE)'
```