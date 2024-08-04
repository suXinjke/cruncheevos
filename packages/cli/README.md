<!-- omit from toc -->
# @cruncheevos/cli

**@cruncheevos/cli** is primarily an alternative to [RATools](https://github.com/Jamiras/RATools). You can code achievement sets using JavaScript and use this CLI to update the assets for [RAIntegration](https://github.com/RetroAchievements/RAIntegration/).

CLI expects Node 20 LTS and only respects working in ESM environment.

- [Why use this instead of RATools?](#why-use-this-instead-of-ratools)
- [Getting started](#getting-started)
  - [I want to create new achievement set from scratch](#i-want-to-create-new-achievement-set-from-scratch)
  - [I want to work on existing achievement set](#i-want-to-work-on-existing-achievement-set)
  - [General workflow](#general-workflow)
- [Recipes](#recipes)
  - [Handling different regions or versions of a game](#handling-different-regions-or-versions-of-a-game)
  - [AddAddress handling](#addaddress-handling)
  - [Badges](#badges)
  - [Rich Presence](#rich-presence)
  - [Async execution](#async-execution)
  - [Extending prototypes](#extending-prototypes)
- [Commands](#commands)
  - [diff](#diff)
  - [save](#save)
  - [diff-save](#diff-save)
  - [fetch](#fetch)
  - [generate](#generate)
  - [rich-save](#rich-save)

## Why use this instead of RATools?

* JavaScript is mature and expressive programming language compared to RATools [DSL](https://en.wikipedia.org/wiki/Domain-specific_language) being limited and sometimes having bugs [(see changelogs)](https://github.com/Jamiras/RATools/releases)
* cruncheevos forces you to produce conditions exactly the way you want them, where you want them. You own the abstractions you write. RATools DSL can change between versions and old scripts may stop working after update, or result in different output
  * And yet this is exactly why you may *not* like cruncheevos, because it requires more work for abstracting condition blocks
* JavaScript is widely supported by text and code editors
* Cross-platform support due to node.js
* Can reuse your own code due to module support provided by node.js, you have access to all npm packages too
* You can run scripts asynchronously. You can technically hold crucial data on Google Sheets or anywhere else remote, and fetch said data to use with your achievements directly

## Getting started

Create main directory that will hold your achievement sets, then create minimal `package.json` file with following contents:

```json
{
  "type": "module"
}
```

While inside main directory, install `@cruncheevos/cli`:

```
> npm install @cruncheevos/cli
```

Set `RACACHE` environment variable, it must contain absolute path to emulator directory containing `RACache`. This is where data will be read and dumped into. The CLI also uses credentials specified in `RAPrefs_EmulatorName.cfg` file to be able to fetch data for games you don't have in `RACache`.

`@cruncheevos/cli` supports [dotenv](https://github.com/motdotla/dotenv), which is useful when you have several emulators installed.
In such scenario it's recommended to make a directory per emulator, and create `.env` file in each directory with following contents (example for Windows):

```
RACACHE=D:\SharedProgramFiles\RALibRetro
```

Now you can run locally installed `@cruncheevos/cli` using `npx` (if you have `.env` file, run it from directory with said file):

```
> npx cruncheevos --help
```

**DO NOT install and run the CLI globally**, otherwise `@cruncheevos/core` dependency won't be resolved properly.

### I want to create new achievement set from scratch

Let's pretend that achievement set for [Sonic the Hedgehog](https://retroachievements.org/game/1) does not exist, take note of game ID the URL which is `1`. In your main directory, you can create a JavaScript file (named `sonic.js` for example) that would look like this:

```js
import { AchievementSet, define as $ } from '@cruncheevos/core'

const set = new AchievementSet({
  gameId: 1, // same ID as in https://retroachievements.org/game/1
  title: 'Sonic the Hedgehog'
})

set.addAchievement({
  title: 'My Achievement',
  description: 'Collect 25 Rings',
  points: 1,
  conditions: {
    core: $(
      ['', 'Mem', '8bit', 0xfff0, '=', 'Value', '', 0],
      ['', 'Mem', '8bit', 0xfffb, '=', 'Value', '', 0],
      ['', 'Delta', '8bit', 0xfe20, '<', 'Value', '', 25],
      ['', 'Mem', '8bit', 0xfe20, '>=', 'Value', '', 25],
    )
  }
})

export default set
```

Notice the default export at the bottom of the script, that's how CLI recognizes the achievement set to work with. Alternatively you can default export a function that returns the set, which is not practical. You can also [default export async function](#async-execution).

Now you can proceed to [General workflow](#general-workflow)

### I want to work on existing achievement set

You can use [generate](#generate) command to produce a script file containing achievements and leaderboards that were already uploaded to RetroAchievements.org.

For a [game you want to work on](https://retroachievements.org/game/1), take note of game ID the URL which in this case is `1`, and specify it in the command:

```
npx cruncheevos generate 1 sonic.js

generated code for achievement set for gameId 1: sonic.js
```

Generated file will look similar [to example above](#i-want-to-create-new-achievement-set-from-scratch), but will include all achievements and leaderboards.

### General workflow

Following [the example above](#i-want-to-create-new-achievement-set-from-scratch), most of the work involves moving out conditions into functions so they are reusable:

```js
import { AchievementSet, define as $ } from '@cruncheevos/core'
const set = new AchievementSet({ gameId: 1, title: 'Sonic the Hedgehog' })

function gotRings(amount) {
  return $(
    ['', 'Mem', '8bit', 0xfff0, '=', 'Value', '', 0],
    ['', 'Mem', '8bit', 0xfffb, '=', 'Value', '', 0],
    ['', 'Delta', '8bit', 0xfe20, '<', 'Value', '', amount],
    ['', 'Mem', '8bit', 0xfe20, '>=', 'Value', '', amount],
  )
}

set.addAchievement({
  title: 'Super Ring Collector',
  description: 'Collect 1000 rings',
  points: 50,
  conditions: $(
    gotRings(1000)
  ),
  badge: '250341',
  id: 1,
})
```

It's highly recommended to use `define` function exported by `@cruncheevos/core` to have TypeScript support and because of [additional features it provides.](https://github.com/suXinjke/cruncheevos/blob/master/packages/core/define.md) `define` being aliased into `$` is also opinionated so conditions are less verbose and to make sharing of code easier.

In this example not only unlock conditions have been tweaked, but also the title, description, and points. All these changes can be checked using [`diff`](#diff) command:

```
> npx cruncheevos diff sonic.js
Assets changed:

  A.ID│ 1 (compared to remote)
 Title│ - Ring Collector
      │ + Super Ring Collector
 Desc.│ - Collect 100 rings
      │ + Collect 1000 rings
  Pts.│ 5 -> 50
──────┼─────────────────────────────────────────────────
  Code│ Core
      │ Flag Type  Size  Value Cmp Type  Size Value Hits
──────┼─────────────────────────────────────────────────
  1  1│      Mem   8bit 0xfff0  =  Value          0
  2  2│      Mem   8bit 0xfffb  =  Value          0
  3  -│      Delta 8bit 0xfe20  <  Value        100
  4  -│      Mem   8bit 0xfe20 >=  Value        100
  +  3│      Delta 8bit 0xfe20  <  Value       1000
  +  4│      Mem   8bit 0xfe20 >=  Value       1000
```

Take note that it shows difference *compared to remote*, which means comparing to achievements stored on server (which were downloaded to `RACache/Data/1.json`). Saving the changes will dump them to *local* file: `RACache/Data/1-User.json`, and running `diff` later will compare your achievements *to local ones*.

If you're satisfied with changes, you can save updated assets using [save](#save) command:

```
> npx cruncheevos save sonic.js
dumped local data for gameId: 1: D:\SharedProgramFiles\RAIntegration\RACache\Data\1-User.txt
updated: 1 achievement

> cat D:\SharedProgramFiles\RAIntegration\RACache\Data\1-User.txt
1.0
Sonic the Hedgehog
1:"0xHfff0=0_0xHfffb=0_d0xHfe20<1000_0xHfe20>=1000":Super Ring Collector:Collect 1000 rings::::cruncheevos:50:::::250341
```

Same could have been done using [diff-save](#diff-save) command. After saving the changes, open RAIntegration in your emulator to test your work in-game and upload the changes.

## Recipes

### Handling different regions or versions of a game

Suppose you want to support different revisions of some game, or both regions like PAL and NTSC. This means that values you're interested in might be located at different memory addresses. Offsets are usually consistent.

The example below is based off `sonic.js` for simplicity, the `0x100` offset presented may not reflect the actual difference between game revisions. It also includes JSDoc comments at the start that allow you to infer `codeFor` return value in callback for `multiRegionalConditions`.

```js

/** @typedef {'rev00' | 'rev01'} Revision */

/**
 * @template T
 * @typedef {(c: typeof codeFor extends (...args: any[]) => infer U ? U : any) => T} CodeCallbackTemplate
*/

/** @typedef {CodeCallbackTemplate<
      import('@cruncheevos/core').ConditionBuilder |
      import('@cruncheevos/core').Condition
    >} CodeCallback */

/*
  Make a function that accepts revision name and produces
  addresses and functions that return conditions with correct offsets,

  basically abusing JavaScript closures.
*/
/** @param {Revision} revision */
const codeFor = revision => {

  /*
    You can do any conditions here, like offsets based on address
    ranges and additional revisions if you have more than two of them
  */
  const offset = address => {
    return revision === 'rev00' ? address : address + 0x100
  }

  /*
    Now you can store correct addresses for certain revision.
    No need to call offset function if you're certain that
    address is same between all revisions.
  */
  const addresses = {
    demo: offset(0xfff0),
    debug: offset(0xfffb),
    ringCount: offset(0xfe20),
  }

  const regionCheck = $(
    revision === 'rev00' && ['', 'Mem', '8bit', 0x100, '=', 'Value', '', 0],
    revision === 'rev01' && ['', 'Mem', '8bit', 0x100, '=', 'Value', '', 1]
  )

  return {
    // Recommended to provide addresses in case you don't want to make
    // additional functions to express conditions with
    addresses,

    // Code is same as before, but now has applied offsets on addresses
    gotRings(amount) {
      return $(
        regionCheck,
        ['', 'Mem', '8bit', addresses.demo, '=', 'Value', '', 0],
        ['', 'Mem', '8bit', addresses.debug, '=', 'Value', '', 0],
        ['', 'Delta', '8bit', addresses.ringCount, '<', 'Value', '', amount],
        ['', 'Mem', '8bit', addresses.ringCount, '>=', 'Value', '', amount],
      )
    }
  }
}

// So you don't have to call `codeFor` all the time
const code = {
  rev00: codeFor('rev00'),
  rev01: codeFor('rev01')
}

/**
 * Generic function to make multi-revisional code with.
 * It assumes that you need only one alt group per revision.
 * @param {CodeCallback} cb
 */
function multiRevisionalConditions(cb) {
  return {
    core: '1=1',
    alt1: cb(code.rev00),
    alt2: cb(code.rev01),
  }
}

set.addAchievement({
  title: 'Super Ring Collector',
  description: 'Collect 1000 rings',
  points: 50,
  conditions: multiRevisionalConditions(c => c.gotRings(1000)),
  badge: '250341',
  id: 1,
})

export default set
```

Here's the resulting diff:

```
> npx cruncheevos diff sonic.js
Assets changed:

  A.ID│ 1 (compared to local)
 Title│ Super Ring Collector
──────┼──────────────────────────────────────────────────
  Code│ Core
      │ Flag Type  Size   Value Cmp Type  Size Value Hits
──────┼──────────────────────────────────────────────────
  1  -│      Mem   8bit  0xfff0  =  Value          0
  2  -│      Mem   8bit  0xfffb  =  Value          0
  3  -│      Delta 8bit  0xfe20  <  Value       1000
  4  -│      Mem   8bit  0xfe20 >=  Value       1000
  +  1│      Value            1  =  Value          1
──────┼──────────────────────────────────────────────────
  Code│ Alt 1
      │ Flag Type  Size   Value Cmp Type  Size Value Hits
──────┼──────────────────────────────────────────────────
  +  1│      Mem   8bit   0x100  =  Value          0
  +  2│      Mem   8bit  0xfff0  =  Value          0
  +  3│      Mem   8bit  0xfffb  =  Value          0
  +  4│      Delta 8bit  0xfe20  <  Value       1000
  +  5│      Mem   8bit  0xfe20 >=  Value       1000
──────┼──────────────────────────────────────────────────
  Code│ Alt 2
      │ Flag Type  Size   Value Cmp Type  Size Value Hits
──────┼──────────────────────────────────────────────────
  +  1│      Mem   8bit   0x100  =  Value          1
  +  2│      Mem   8bit 0x100f0  =  Value          0
  +  3│      Mem   8bit 0x100fb  =  Value          0
  +  4│      Delta 8bit  0xff20  <  Value       1000
  +  5│      Mem   8bit  0xff20 >=  Value       1000
```

### AddAddress handling

You can be quite expressive when it comes to dealing with pointers, here's an example from actual set:

```js
const entityGroup = (group) => {
  const basePointer = $(
    ['AddAddress', 'Mem', '32bit', address.entitiesPointer],
    ['AddAddress', 'Mem', '32bit', group * 0x4],
    ['AddAddress', 'Mem', '32bit', 0x104],
  )

  return {
    index(index) {
      const offset = index * 0x4A0

      return {
        becameAlive: $(
          basePointer,
          ['AndNext', 'Delta', 'Bit1', offset + 0x1F8, '=', 'Value', '', 0],
          basePointer,
          ['', 'Mem', 'Bit1', offset + 0x1F8, '>', 'Value', '', 0]
        ),
        // ... and many other functions

        // ... alternatively
        get becameAliveAsGetter() {
          // scoped variables available here
          return $(
            // ...
          )
        }
      }
    }
  }
}

// which can be used like
$(
  entityGroup(0x5D).index(1).becameAlive,
  entityGroup(0x3D).index(2).becameAliveAsGetter
)
```

### Badges

It's tiresome to manually select badges in RAIntegration. To deal with this problem, you can follow consistent naming scheme for your badge file names and put badge files into `RACache\Badge\local` directory. Afterwards, define a function that produces correct file path for those badges:

```js
const b = (s) => `local\\\\${s}.png`

for (const missionId of missionIds) {
  set.addAchievement({
    // ...
    badge: b(`MISSION_${missionId}_COMPLETE`)
  })
}
```

Such badge will not be applied if achievement was already uploaded on server with badge set, otherwise it would always attempt to apply a new badge.

### Rich Presence

If you export an object returned by `RichPresence` function and name it `rich`, you can use [rich-save](#rich-save) command to transfer it to the `RACache/Data/1-Rich.txt` file.

If you wish to generate Rich Presence manually, you can do so and export a string named `rich`.

`@cruncheevos/core` provides [`RichPresence` export](https://github.com/suXinjke/cruncheevos/blob/master/packages/core/api-core.md#richpresenceparams-richpresenceparams) which you can use to define Rich Presence. Check the example below, and also examples in the core package.

```js
import { RichPresence } from '@cruncheevos/core'

// ...

export const rich = RichPresence({
  lookup: {
    LevelName: {
      values: {
        0x00: 'Green Hill Zone Act 1',
        0x01: 'Green Hill Zone Act 2',
        0x02: 'Green Hill Zone Act 3',
      }
    }
  },
  displays: ({ lookup, tag }) => [
    `Sonic is exploring ${lookup.LevelName.at(addresses.levelId)}`
  ]
})

export default set
```

```
> node sonic.js rich
Lookup:LevelName
0x00=Green Hill Zone Act 1
0x01=Green Hill Zone Act 2
0x02=Green Hill Zone Act 3

Display:
Sonic is exploring @LevelName(0xFE10)
```

### Async execution

You can export an async function (or a regular function returning promise) that resolves into AchievementSet. This is useful when you have achievement-related data stored somewhere on internet (something like Google Sheets). The actual fetching and caching of data remains your responsibility.

The example below is silly, and yet running the diff will result in different achievement title and conditions every time:

```js
import { AchievementSet, define as $ } from '@cruncheevos/core'
const set = new AchievementSet({ gameId: 1, title: 'Sonic the Hedgehog' })

function gotRings(amount) {
  return $(
    ['', 'Mem', '8bit', 0xfff0, '=', 'Value', '', 0],
    ['', 'Mem', '8bit', 0xfffb, '=', 'Value', '', 0],
    ['', 'Delta', '8bit', 0xfe20, '<', 'Value', '', amount],
    ['', 'Mem', '8bit', 0xfe20, '>=', 'Value', '', amount],
  )
}

export default async () => {
  const amountOfRings = await fetch(
    'https://www.randomnumberapi.com/api/v1.0/random?min=100&max=1000&count=1'
  ).then(x => x.json())
   .then(x => x[0])

  set.addAchievement({
    title: 'Super Ring Collector',
    description: `Collect ${amountOfRings} rings`,
    points: 50,
    conditions: gotRings(amountOfRings),
    badge: '250341',
    id: 1,
  })

  return set
}
```

### Extending prototypes

Due to relatively minimal API of `@cruncheevos/core` and the fact that scripts are ran only once by CLI, the idea of extending prototype of native JS objects and `@cruncheevos/core` classes isn't that bad if you think it allows your code to be more expressive.

The only problem is making your editor discover these extensions to provide code hints. If you don't care about that - just extend prototypes at the start of your script, implementation examples below would be the same.

If you care to make editor discover the prototype extensions, create two files:
  * `common.d.ts` to hold type declarations that editor will pick up
  * `common.js` to hold actual prototype extensions, you will import this file at the top of your script

`common` file name is merely a suggestion, as you can also make it export some reusable functions.

Here's how it may look like

`common.d.ts`:

```ts
import type { Condition } from '@cruncheevos/core'

declare module '@cruncheevos/core' {
  interface Condition {
    cmpInverted(): Condition
    delta(): Condition
  }
}

interface Number {
  toHexString(): string
}
```

`common.js`
```js
Condition.prototype.delta = function () {
  return this.with({ lvalue: { type: 'Delta' } })
}

Condition.prototype.cmpInverted = function () {
  switch (this.cmp) {
    case '=': return this.with({ cmp: '!=' })
    case '!=': return this.with({ cmp: '=' })
    case '<': return this.with({ cmp: '>=' })
    case '<=': return this.with({ cmp: '>' })
    case '>': return this.with({ cmp: '<=' })
    case '>=': return this.with({ cmp: '<' })
    default: return this
  }
}

// (10).toHexString() would give you 0xa
// It's not used in `sonic.js`,
// just a reminder on how to extend native JavaScript objects
Number.prototype.toHexString = function () {
  return '0x' + this.toString(16)
}
```

`sonic.js`
```js
import './common.js' // apply prototype extensions
import { AchievementSet, define as $ } from '@cruncheevos/core'
const set = new AchievementSet({ gameId: 1, title: 'Sonic the Hedgehog' })

function gotRings(amount) {
  // $.one returns instance of Condition class
  const ringsMoreThan = $.one(['', 'Mem', '8bit', 0xfe20, '>=', 'Value', '', amount])

  return $(
    ['', 'Mem', '8bit', 0xfff0, '=', 'Value', '', 0],
    ['', 'Mem', '8bit', 0xfffb, '=', 'Value', '', 0],
    ringsMoreThan.delta().cmpInverted(),
    ringsMoreThan,
  )
}
```
Technically some of class extension ideas could be part of `@cruncheevos/core` package from the start, but restrain is intentional: the library should stay minimal and it's better to see how other people use the library first.

While you can extend other `@cruncheevos/core` classes: `ConditionBuilder`, `Achievement`, `Leaderboard`, `AchievementSet`, it's yet to be seen how one can benefit from that.

## Commands

### diff

```
Usage: cruncheevos diff [options] <input_file_path>

shows the difference between achievement set exported by JavaScript module and set defined in remote
and/or local files

assumes that RACACHE environment variable is set - it must contain absolute path to emulator directory
containing the RACache directory. If there's .env file locally available - RACACHE value will be read
from that.

Arguments:
  input_file_path                 path to the JavaScript module which default exports AchievementSet or
                                  (async) function returning AchievementSet

Options:
  -f, --filter <filter:value...>  only output assets that matches the filter. available filters are: id,
                                  title, description
                                  id accepts comma separated list of ids, everything else accepts a
                                  regular expression
  --include-unofficial            do not ignore unofficial achievements on the server when executing
                                  this operation
  -c --context-lines <amount>     how much conditions to show around the changed conditions, 10 max
  -r --refetch                    force refetching of remote data
  -t --timeout <number>           amount of milliseconds after which the remote data fetching is
                                  considered failed (default: 3000)
```

### save

```
Usage: cruncheevos save [options] <input_file_path>

saves the achievement set exported by JavaScript module into local file in RACache directory

save command will try it's best to preserve the existing local assets that are not part of your
JavaScript module

assumes that RACACHE environment variable is set - it must contain absolute path to emulator directory
containing the RACache directory. If there's .env file locally available - RACACHE value will be read
from that.

Arguments:
  input_file_path                 path to the JavaScript module which default exports AchievementSet or
                                  (async) function returning AchievementSet

Options:
  -f, --filter <filter:value...>  only output assets that matches the filter. available filters are: id,
                                  title, description
                                  id accepts comma separated list of ids, everything else accepts a
                                  regular expression
  --include-unofficial            do not ignore unofficial achievements on the server when executing
                                  this operation
  -r --refetch                    force refetching of remote data
  -t --timeout <number>           amount of milliseconds after which the remote data fetching is
                                  considered failed (default: 3000)
  --force-rewrite                 completely overwrite the local data instead of updating only matching
                                  assets, THIS MAY RESULT IN LOSS OF LOCAL DATA!
```

### diff-save

```
Usage: cruncheevos diff-save [options] <input_file_path>

shows output of 'diff' command first, if there are any changes - prompts to issue 'save' command

save command will try it's best to preserve the existing local assets that are not part of your
JavaScript module

assumes that RACACHE environment variable is set - it must contain absolute path to emulator directory
containing the RACache directory. If there's .env file locally available - RACACHE value will be read
from that.

Arguments:
  input_file_path                 path to the JavaScript module which default exports AchievementSet or
                                  (async) function returning AchievementSet

Options:
  -f, --filter <filter:value...>  only output assets that matches the filter. available filters are: id,
                                  title, description
                                  id accepts comma separated list of ids, everything else accepts a
                                  regular expression
  --include-unofficial            do not ignore unofficial achievements on the server when executing
                                  this operation
  -c --context-lines <amount>     how much conditions to show around the changed conditions, 10 max
  -r --refetch                    force refetching of remote data
  -t --timeout <number>           amount of milliseconds after which the remote data fetching is
                                  considered failed (default: 3000)
  --force-rewrite                 completely overwrite the local data instead of updating only matching
                                  assets, THIS MAY RESULT IN LOSS OF LOCAL DATA!
```

### fetch

```
Usage: cruncheevos fetch [options] <game_id>

fetches the remote data about achievement set into RACache directoryNaN

assumes that RACACHE environment variable is set - it must contain absolute path to emulator directory
containing the RACache directory. If there's .env file locally available - RACACHE value will be read
from that.

Arguments:
  game_id                numeric game ID as specified on retroachievements.org

Options:
  -t --timeout <number>  amount of milliseconds after which the remote data fetching is considered
                         failed (default: 3000)
```

### generate

```
Usage: cruncheevos generate [options] <game_id> <output_file_path>

generates JavaScript module based on the remote data about achievement set

assumes that RACACHE environment variable is set - it must contain absolute path to emulator directory
containing the RACache directory. If there's .env file locally available - RACACHE value will be read
from that.

Arguments:
  game_id                         numeric game ID as specified on retroachievements.org
  output_file_path

Options:
  -f, --filter <filter:value...>  only output assets that matches the filter. available filters are: id,
                                  title, description
                                  id accepts comma separated list of ids, everything else accepts a
                                  regular expression
  --include-unofficial            do not ignore unofficial achievements on the server when executing
                                  this operation
  -r --refetch                    force refetching of remote data
  -t --timeout <number>           amount of milliseconds after which the remote data fetching is
                                  considered failed (default: 3000)
```

### rich-save

```
Usage: cruncheevos rich-save [options] <input_file_path>

saves the Rich Presence exported by JavaScript module as string named 'rich' or
object returned by RichPresence function, into local file in RACache directory

assumes that RACACHE environment variable is set - it must contain absolute
path to emulator directory containing the RACache directory. If there's .env
file locally available - RACACHE value will be read from that.

Arguments:
  input_file_path     path to the JavaScript module which default exports
                      AchievementSet or (async) function returning
                      AchievementSet

Options:
  -f --force-rewrite  skip prompting to overwrite local Rich Presence file if
                      it exists
```
