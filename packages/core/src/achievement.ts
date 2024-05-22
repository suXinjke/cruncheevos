import {
  Condition,
  normalizedConditionGroupSet,
  normalizedConditionGroupSetFromString,
  validateRegularMeasuredConditions,
} from './condition.js'
import {
  AssetData,
  deepFreeze,
  eatSymbols,
  isNumber,
  isObject,
  parseCSV,
  quoteIfHaveTo,
  validate as commonValidate,
  DeepPartial,
  indexToConditionGroupName,
} from './util.js'

export namespace Achievement {
  export type Type = '' | 'missable' | 'progression' | 'win_condition'

  export interface InputObject extends AchievementCommon {
    conditions: Condition.GroupSet | string
  }

  export type Input = InputObject | string
}

interface AchievementCommon extends AssetData<string | number> {
  /**
   * Achievement's author name, it's not necessary and
   * is not sent to servers, but local RACache
   * files do mention the author.
   */
  author?: string

  /**
   * Amount of points that players will get when earning
   * the Achievement. Must be set to any positive integer or 0.
   *
   * Server accepts following values: 0, 1, 2, 3, 4, 5, 10, 25, 50, 100.
   *
   * Server may still have odd Achievements with incorrect point values,
   * which is the reason for allowing any positive integer for points.
   */
  points: number

  /**
   * Optional type of achievement, accepted strings are self-explanatory.
   *
   * Falsy values are treated as empty string, which marks no type set.
   */
  type?: Achievement.Type

  /**
   * Optional numeric string representing Achievement's badge ID on server.
   *
   * Alternatively, can be set to a string like `'local\\\\mybadge.png'`, which will be recognized by RAIntegration.
   */
  badge?: string | number

  conditions: Condition.GroupSet | Condition.GroupNormalized | string
}

interface AchievementData extends AchievementCommon {
  id: number
  badge?: string

  /**
   * Array of arrays containing Condition class instances:
   * * Outer array represents Condition groups like Core, Alt 1, Alt 2 ...
   * * Inner array represents individual Conditions within the group
   */
  conditions: Condition.GroupNormalized
}

const allowedAchievementTypesForDisplay = ['missable', 'progression', 'win_condition']
const allowedAchievementTypes = new Set(['', ...allowedAchievementTypesForDisplay])

const validate = {
  points(points: number) {
    if (isNumber(points, { isInteger: true, isPositive: true }) === false) {
      throw new Error(
        `expected points value to be a positive integer, but got ` + eatSymbols`${points}`,
      )
    }
  },

  measuredConditionsMixing(conditions: Condition.GroupNormalized) {
    const measuredConditions = [] as Array<[string, number]>
    const measuredPercentConditions = [] as Array<[string, number]>

    conditions.forEach((group, groupIndex) => {
      const groupName = indexToConditionGroupName(groupIndex)
      group.forEach((condition, conditionIndex) => {
        if (condition.flag === 'Measured') {
          measuredConditions.push([groupName, conditionIndex])
        }

        if (condition.flag === 'Measured%') {
          measuredPercentConditions.push([groupName, conditionIndex])
        }
      })
    })

    if (measuredPercentConditions.length > 0 && measuredConditions.length > 0) {
      const m = measuredConditions[0]
      const mp = measuredPercentConditions[0]
      throw new Error(
        `${m[0]}, condition ${m[1] + 1}: Measured conflicts with ${mp[0]}, condition ${mp[1] + 1} Measured%, ` +
          `make sure you exclusively use Measured or Measured%`,
      )
    }
  },

  andNormalizeAuthor(author: string) {
    if (author === undefined || author === null) {
      author = ''
    }

    if (typeof author !== 'string') {
      throw new Error(eatSymbols`expected author as string, but got ${author}`)
    }

    return author || 'cruncheevos'
  },

  andNormalizeAchievementType(type: unknown) {
    type = type === undefined ? '' : type

    if (allowedAchievementTypes.has(type as any) === false) {
      throw new Error(
        `expected type to be one of: [${[...allowedAchievementTypesForDisplay].join(', ')}], or empty string, or undefined, but got ` +
          eatSymbols`${type}`,
      )
    }

    return type as Achievement.Type
  },

  andNormalizeBadge(badge: unknown) {
    const errMessage = eatSymbols`expected badge as unsigned integer or filepath starting with local\\\\ and going strictly down, but got ${badge}`

    if (badge === undefined || badge === null) {
      return '00000'
    }

    if (isNumber(badge, { isInteger: true })) {
      const num = Number(badge)
      if (num < 0 || num > 0xffffffff) {
        throw new Error(
          `expected badge id to be within the range of 0x0 .. 0xFFFFFFFF, but got ${badge}`,
        )
      }

      return badge.toString().padStart(5, '0')
    } else if (typeof badge === 'string') {
      const pieces = badge.split('\\\\')
      if (pieces.length < 2 || pieces[0] !== 'local') {
        throw new Error(errMessage)
      }

      for (const piece of pieces) {
        if (/^\.+$/.test(piece)) {
          throw new Error(`encountered ${piece} within ${badge}, path can only go down`)
        }
      }

      const fileName = pieces[pieces.length - 1]
      if (/^.+\.(png|jpe?g|gif)$/.test(fileName) === false) {
        throw new Error(`expected badge filename to be *.(png|jpg|jpeg|gif) but got "${fileName}"`)
      }

      return badge
    } else {
      throw new Error(errMessage)
    }
  },
}

const entireLineIsWhitespace = /^\s+$/
function achievementDataFromString(str: string) {
  const col = parseCSV(str)

  if (col.length !== 13 && col.length !== 14) {
    throw new Error(
      `got an unexpected amount of data when parsing raw achievement string, either there's not enough data or it's not escaped/quoted correctly`,
    )
  }

  let type = col[6] as Achievement.Type
  if (type.match(entireLineIsWhitespace)) {
    type = ''
  }

  const def: AchievementData = {
    id: commonValidate.andNormalizeId(col[0]),
    title: col[2],
    description: col[3],
    type,
    author: col[7],
    points: Number(col[8]) as AchievementData['points'],
    badge: validate.andNormalizeBadge(col[13] || ''),

    conditions: normalizedConditionGroupSetFromString(col[1]),
  }

  return def
}

const moveConditions = Symbol()

/**
 * This class represents an achievement for RetroAchievements. Achievement can be a part of AchievementSet class instance, or used separately if your goal is to parse and produce string representations of achievement that would go into local RACache file.
 *
 * Achievements are immutable, if you need to a make a new condition instance based of existing one - use `with()` method.
 */
export class Achievement implements AchievementData {
  id: number
  title: string
  description: string
  author: string
  points: number
  type: Achievement.Type
  badge: string
  conditions: Condition.GroupNormalized

  /**
   * Creates Achievement using object representing it.
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   *
   * new Achievement({
   *   id: 58, // or numeric string
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
   * })
   *
   * new Achievement({
   *   // ...
   *   conditions: '0=1'
   * })
   *
   * new Achievement({
   *   // ...
   *   conditions: [
   *     ['', 'Mem', '8bit', 0x00fff0, '=', 'Value', '', 0],
   *     ['', 'Mem', '8bit', 0x00fffb, '=', 'Value', '', 0],
   *   ] // same as providing an object: { core: [ ... ] }
   * })
   */
  constructor(def: Achievement.InputObject)

  /**
   * Creates Achievement using string representing it, taken from `RACache/Data/GameId-User.txt` file.
   *
   * @example
   * new Achievement(
   *  '58:"0xHfff0=0_0xHfffb=0S0xHfe10>d0xHfe10_0xHfe11=0S0=1"' +
   *  ':My Achievement:Do something funny::::peepy:5:::::"local\\\\my_achievement.png"'
   * )
   */
  constructor(def: string)
  /**
   * @ignore Stub definition to please TypeScript, this accepts all the previous types.
   */
  constructor(def: Achievement.Input)
  constructor(def: Achievement.Input) {
    const isAchievementInstance = def instanceof Achievement

    if (typeof def === 'string') {
      Object.assign(this, achievementDataFromString(def))
    } else if (isObject(def) && isAchievementInstance === false) {
      let conditions: Condition.GroupNormalized | Condition.GroupSet = def.conditions
      if (!def[moveConditions]) {
        conditions = normalizedConditionGroupSet(def.conditions as Condition.GroupSet)
      }

      Object.assign(this, {
        id: commonValidate.andNormalizeId(def.id),
        title: def.title,
        description: def.description,
        author: def.author,
        points: def.points,
        type: def.type,
        badge: validate.andNormalizeBadge(def.badge),
        conditions,
      })
    } else {
      throw new Error(
        'achievement data must be an object or string with achievement code, but got ' +
          (isAchievementInstance ? 'another Achievement instance' : eatSymbols`${def}`),
      )
    }

    commonValidate.title(this.title)
    this.description = commonValidate.andNormalizeDescription(this.description)
    this.author = validate.andNormalizeAuthor(this.author)
    validate.points(this.points)
    this.type = validate.andNormalizeAchievementType(this.type)
    validateRegularMeasuredConditions(this.conditions)
    validate.measuredConditionsMixing(this.conditions)

    deepFreeze(this)
  }

  /**
   * Returns new Achievement instance with different values merged.
   *
   * @param {DeepPartial<Achievement.InputObject>} data DeepPartial<Achievement.InputObject>
   *
   * @example
   * someAchievement
   *   .with({ title: someAchievement.title + 'suffix' })
   */
  with(data: DeepPartial<Achievement.InputObject>) {
    return new Achievement({
      ...(this as any),
      ...data,
      [moveConditions]: data.hasOwnProperty('conditions') === false,
    })
  }

  /**
   * Returns string representation of Achievement suitable
   * for `RACache/Data/GameId-User.txt` file.
   *
   * @param desiredData optional parameter, set this to `'achievement'` or `'conditions'` to have corresponding string returned. Default option is `'achievement'`.
   *
   * @example
   *
   * someAchievement.toString()
   * someAchievement.toString('achievement')
   * // '58:"0=1":My Achievement:Do something funny::::cruncheevos:5:::::00000'
   *
   * someAchievement.toString('conditions') // '0=1'
   */
  toString(desiredData: 'achievement' | 'conditions' = 'achievement'): string {
    const conditions = this.conditions.map(x => x.map(x => x.toString()).join('_')).join('S')

    if (desiredData === 'conditions') {
      return conditions
    } else if (desiredData === 'achievement') {
      let res = ''
      res += this.id + ':'
      res += `"${conditions}"` + ':'
      res += quoteIfHaveTo(this.title) + ':'
      res += quoteIfHaveTo(this.description)
      res += ':::'
      res += this.type + ':'
      res += quoteIfHaveTo(this.author) + ':'
      res += this.points
      res += ':::::'
      res += this.badge.startsWith('local\\\\') ? `"${this.badge}"` : this.badge
      return res
    } else {
      throw new Error(eatSymbols`unexpected achievement data toString request: ${desiredData}`)
    }
  }
}
