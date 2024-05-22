import { Achievement } from './achievement.js'
import { Leaderboard } from './leaderboard.js'
import { PartialByKey, validate } from './util.js'

export namespace AchievementSet {
  export type AchievementInput = PartialByKey<Achievement.InputObject, 'id'> | string
  export type LeaderboardInput = PartialByKey<Leaderboard.InputObject, 'id'> | string

  export interface Input {
    gameId: number | string
    title: string
  }
}

const privateMap = new WeakMap<
  AchievementSet,
  {
    achievementIdCounter: number
    leaderboardIdCounter: number
  }
>()

function* iterateObject(this: Record<string, any>) {
  for (const key in this) {
    yield this[key]
  }
}

/**
 * This class represents AchievementSet that can be converted into
 * RACache/Data/GameId-User.txt file
 *
 * AchievementSet is mostly to be used with standalone scripts that export it
 * for `@cruncheevos/cli` to update local file in RACache.
 */
export class AchievementSet {
  /**
   * Game ID matching the one on RetroAchievement servers,
   * must be set correctly if using this class with @cruncheevos/cli
   */
  gameId: number

  /**
   * Game title or name, it doesn't have to be exact match and
   * is merely put on the second line of produced local file.
   */
  title: string

  /**
   * Object containing all added achievements, with achievement id as a key.
   * Treat it as read-only unless you know better.
   *
   * Also implements Symbol.iterator which yields each Achievement stored.
   *
   * @alias \{ [id: string]: Achievement \}
   */
  achievements: Record<string, Achievement> & Iterable<Achievement> = {
    [Symbol.iterator]: iterateObject,
  }

  /**
   * Object containing all added leaderboards, with leaderboard id as a key.
   * Treat it as read-only unless you know better.
   *
   * Also implements Symbol.iterator which yields each Leaderboard stored.
   *
   * @alias \{ [id: string]: Leaderboard \}
   */
  leaderboards: Record<string, Leaderboard> & Iterable<Leaderboard> = {
    [Symbol.iterator]: iterateObject,
  }

  /**
   * Creates AchievementSet.
   *
   * @example
   * new AchievementSet({ gameId: 1234, title: 'Funny Game' })
   */
  constructor(opts: AchievementSet.Input) {
    const { gameId, title } = opts
    this.gameId = validate.andNormalizeId(gameId, 'gameId')
    validate.title(title, 'achievement set title')
    this.title = title

    privateMap.set(this, {
      achievementIdCounter: 111000001,
      leaderboardIdCounter: 111000001,
    })
  }

  /**
   * Adds Achievement to the set, accepts same data as {@link Achievement} class constructor,
   * but you're allowed to omit id when passing an object (id will be assigned automatically, similar to how RAIntegration does it).
   *
   * Also returns current AchievementSet instance, allowing you to chain calls.
   *
   * @example
   * import { AchievementSet, define as $ } from '@cruncheevos/core'
   *
   * const set = new AchievementSet({ gameId: 1234, title: 'Funny Game' })
   *
   * set.addAchievement({
   *   id: 58, // optional, or numeric string
   *   title: 'My Achievement',
   *   description: 'Do something funny',
   *   points: 5,
   *   badge: `local\\\\my_achievement.png`, // optional, or ID of badge on server
   *   author: 'peepy', // optional and is not uploaded to server
   *   conditions: {
   *     core: [
   *       ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
   *       ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
   *     ],
   *     alt1: $(
   *       ['', 'Mem', '8bit', 0x00fe10, '>', 'Delta', '8bit', 0x00fe10],
   *       ['', 'Mem', '8bit', 0x00fe11, '=', 'Value', '', 0],
   *     ),
   *     alt2: '0=1'
   *   }
   * }).addAchievement(...)
   */
  addAchievement(def: AchievementSet.AchievementInput | Achievement) {
    const privateData = privateMap.get(this)

    // prettier-ignore
    const ach = def instanceof Achievement ? def : new Achievement(
      typeof def === 'string' ? def : {
        ...def,
        id: def.id || privateData.achievementIdCounter,
      }
    )

    const { id } = ach
    if (this.achievements[id]) {
      throw new Error(`achievement with id ${id}: "${this.achievements[id].title}", already exists`)
    }

    this.achievements[id] = ach

    if (ach.id >= privateData.achievementIdCounter) {
      privateData.achievementIdCounter = Math.max(privateData.achievementIdCounter + 1, ach.id + 1)
    }

    return this
  }

  /**
   * Adds Leaderboard to the set, accepts same data as {@link Leaderboard} class constructor,
   * but you're allowed to omit id when passing an object (id will be assigned automatically, similar to how RAIntegration does it).
   *
   * Also returns current AchievementSet instance, allowing you to chain calls.
   *
   * @example
   * import { AchievementSet, define as $ } from '@cruncheevos/core'
   *
   * const set = new AchievementSet({ gameId: 1234, title: 'Funny Game' })
   *
   * set.addLeaderboard({
   *   id: 58, // optional, or numeric string
   *   title: 'My Leaderboard',
   *   description: 'Best score while doing something funny',
   *   type: 'SCORE',
   *   lowerIsBetter: false,
   *   conditions: {
   *     start: {
   *       core: [
   *         ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
   *         ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
   *       ],
   *       alt1: $(
   *         ['', 'Mem', '8bit', 0x00fe10, '>', 'Delta', '8bit', 0x00fe10],
   *         ['', 'Mem', '8bit', 0x00fe11, '=', 'Value', '', 0],
   *       ),
   *       alt2: '0=1',
   *     },
   *     cancel: [
   *       ['', 'Mem', '16bit', 0x34684, '=', 'Value', '', 0x140]
   *     ], // same as providing an object: { core: [ ... ] }
   *     submit: '0xH59d76=2',
   *     value: [['Measured', 'Mem', '32bit', 0x34440, '*', 'Value', '', 2]],
   *   },
   * }).addLeaderboard(...)
   */
  addLeaderboard(def: AchievementSet.LeaderboardInput | Leaderboard) {
    const privateData = privateMap.get(this)

    // prettier-ignore
    const lb = def instanceof Leaderboard ? def : new Leaderboard(
      typeof def === 'string' ? def : {
        ...def,
        id: def.id || privateData.leaderboardIdCounter,
      }
    )

    const { id } = lb
    if (this.leaderboards[id]) {
      throw new Error(`leaderboard with id ${id}: "${this.leaderboards[id].title}", already exists`)
    }

    this.leaderboards[id] = lb

    if (lb.id >= privateData.leaderboardIdCounter) {
      privateData.leaderboardIdCounter = Math.max(privateData.leaderboardIdCounter + 1, lb.id + 1)
    }

    return this
  }

  /**
   * Allows to iterate the whole set for both achievements and leaderboards.
   *
   * @example
   * for (const asset of achSet) {
   *   if (asset instanceof Achievement) {
   *      // ...
   *   }
   *   if (asset instanceof Leaderboard) {
   *      // ...
   *   }
   * }
   */
  *[Symbol.iterator]() {
    for (const ach of this.achievements) {
      yield ach
    }

    for (const lb of this.leaderboards) {
      yield lb
    }
  }

  /**
   * Returns string representation of AchievementSet suitable for
   * `RACache/Data/GameId-User.txt` file.
   *
   * First line is version, always set to 1.0, second line is game's title.
   * Then come string representations of achievements and leaderboards,
   * each sorted by id.
   *
   * @example
   * new AchievementSet({ gameId: 1234, title: 'Funny Game' })
   *  .addAchievement(...)
   *  .addAchievement(...)
   *  .addLeaderboard(...)
   *  .addLeaderboard(...)
   *  .toString()
   * // may result in:
   * `
   * 1.0
   * Funny Game
   * 57:"0x cafe=102":Ach2:Desc2::::cruncheevos:2:::::00000
   * 111000001:"0x cafe=101":Ach1:Desc1::::cruncheevos:1:::::00000
   * L58:"0x cafe=102":"0=1":"1=1":"M:0x feed":FRAMES:Lb2:Desc2:1
   * L111000001:"0x cafe=101":"0=1":"1=1":"M:0x feed":SCORE:Lb1:Desc1:0
   * `
   */
  toString() {
    let res = ''

    res += '1.0\n'
    res += this.title + '\n'

    Object.keys(this.achievements)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(key => {
        res += this.achievements[key].toString() + '\n'
      })

    Object.keys(this.leaderboards)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(key => {
        res += this.leaderboards[key].toString() + '\n'
      })

    return res
  }
}
