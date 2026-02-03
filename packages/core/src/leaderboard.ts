import {
  Condition,
  normalizedConditionGroupSet,
  validateRegularMeasuredConditions,
} from './condition.js'
import {
  AssetData,
  eatSymbols,
  isObject,
  parseCSV,
  quoteIfHaveTo,
  deepFreeze,
  wrappedError,
  capitalizeWord,
  validate as commonValidate,
  DeepPartial,
  indexToConditionGroupName,
} from './util.js'

export namespace Leaderboard {
  export type Type =
    | 'SCORE'
    | 'TIME'
    | 'FRAMES'
    | 'MILLISECS'
    | 'SECS'
    | 'TIMESECS'
    | 'MINUTES'
    | 'SECS_AS_MINS'
    | 'VALUE'
    | 'UNSIGNED'
    | 'TENS'
    | 'HUNDREDS'
    | 'THOUSANDS'
    | 'FIXED1'
    | 'FIXED2'
    | 'FIXED3'

  export type InputConditions = LeaderboardConditions<Condition.GroupSet>

  export interface InputObject extends LeaderboardCommon {
    conditions: InputConditions | string
  }

  export type Input = InputObject | string
}

interface LeaderboardConditions<Type> {
  start: Type
  cancel: Type
  submit: Type
  value: Type
}

interface LeaderboardCommon extends AssetData<string | number> {
  /**
   * Specifies how to interpret Leaderboard's value.
   *
   * Additional info [can be seen here](https://docs.retroachievements.org/developer-docs/leaderboards.html#value-format)
   */
  type: Leaderboard.Type

  /**
   * Self explanatory, affects how leaderboard results are displayed.
   */
  lowerIsBetter: boolean

  conditions: LeaderboardConditions<Condition.GroupSet | Condition.GroupNormalized> | string
}

interface LeaderboardData extends LeaderboardCommon {
  id: number

  /**
   * Object representing four condition groups that make up Leaderboard code.
   *
   * Each group is an array of arrays containing Condition class instances:
   * * Outer array represents Condition groups like Core, Alt 1, Alt 2 ...
   * * Inner array represents individual Conditions within the group
   * * For `value` group, each outer array represents Value retrieval
   * and Max of these values is taken
   *
   * @alias \{ start: Condition[][], cancel: Condition[][], submit: Condition[][], value: Condition[][] \}
   */
  conditions: LeaderboardConditions<Condition.GroupNormalized>
}

const allowedLeaderboardConditionGroups = new Set(['start', 'cancel', 'submit', 'value'])
const allowedLeaderboardTypes = new Set([
  'SCORE',
  'TIME',
  'FRAMES',
  'MILLISECS',
  'SECS',
  'TIMESECS',
  'MINUTES',
  'SECS_AS_MINS',
  'VALUE',
  'UNSIGNED',
  'TENS',
  'HUNDREDS',
  'THOUSANDS',
  'FIXED1',
  'FIXED2',
  'FIXED3',
])

const validate = {
  andNormalizeLeaderboardId(id: number | string) {
    if (typeof id === 'string') {
      if (id.startsWith('L')) {
        id = id.slice(1)
      } else {
        throw new Error(`expected id to start with L, but got "${id}"`)
      }
    }

    return commonValidate.andNormalizeId(id)
  },

  andNormalizeConditions(
    conditions: LeaderboardConditions<Condition.GroupSet> | string,
  ): LeaderboardConditions<Condition.GroupNormalized> {
    let result: LeaderboardConditions<Condition.GroupNormalized>

    if (typeof conditions === 'string') {
      result = leaderboardConditionsFromLegacyString(conditions)
    } else if (isObject(conditions)) {
      result = Object.keys(conditions).reduce((obj, key) => {
        if (allowedLeaderboardConditionGroups.has(key) === false) {
          throw new Error(
            `expected leaderboard condition group name to be one of: [${[
              ...allowedLeaderboardConditionGroups,
            ].join(', ')}], but got ` + eatSymbols`${key}`,
          )
        }

        obj[key] = normalizedConditionGroupSet(conditions[key], {
          considerLegacyValueFormat: key === 'value',
        })
        return obj
      }, {} as LeaderboardConditions<Condition.GroupNormalized>)
    } else {
      throw new Error(eatSymbols`expected conditions to be an object, but got ${conditions}`)
    }

    for (const group of result.value) {
      const hasMeasuredFlag = group.some(x => x.flag === 'Measured')
      if (hasMeasuredFlag === false) {
        for (let i = 0; i < group.length; i++) {
          const condition = group[i]
          if (condition.flag === '') {
            group[i] = condition.with({ flag: 'Measured' })
            break
          }
        }
      }
    }

    return result
  },

  leaderboardType(type: string) {
    if (allowedLeaderboardTypes.has(type) === false) {
      throw new Error(
        `expected type to be one of: [${[...allowedLeaderboardTypes].join(', ')}], but got ` +
          eatSymbols`${type}`,
      )
    }
  },

  measuredConditions(conditions: LeaderboardConditions<Condition.GroupNormalized>) {
    for (const group of ['start', 'cancel', 'submit', 'value']) {
      try {
        if (group !== 'value') {
          validateRegularMeasuredConditions(conditions[group])
        }
        validate.lackOfMeasuredPercent(conditions[group])
      } catch (err) {
        throw wrappedError(err, `${capitalizeWord(group)}, ` + err.message)
      }
    }
  },

  lackOfMeasuredPercent(conditions: Condition.GroupNormalized) {
    conditions.forEach((group, groupIndex) => {
      group.forEach((condition, conditionIndex) => {
        if (condition.flag === 'Measured%') {
          const groupName = indexToConditionGroupName(groupIndex)
          throw new Error(
            `${groupName}, condition ${conditionIndex + 1}: Measured% conditions are not allowed in leaderboards`,
          )
        }
      })
    })
  },

  andNormalizeLowerIsBetter(lowerIsBetter: boolean | string) {
    if (typeof lowerIsBetter === 'string') {
      return lowerIsBetter.length > 0 && lowerIsBetter !== '0'
    } else if (typeof lowerIsBetter === 'boolean') {
      return lowerIsBetter
    } else {
      throw new Error(
        eatSymbols`expected lowerIsBetter as boolean or string, but got ${lowerIsBetter}`,
      )
    }
  },
}

function conditionsToString(group: Condition.GroupNormalized, separator = 'S') {
  return group.map(x => x.map(x => x.toString()).join('_')).join(separator)
}

function leaderboardFromString(str: string) {
  const col = parseCSV(str)

  if (col.length !== 9) {
    throw new Error(
      `got an unexpected amount of data when parsing raw leaderboard string, either there's not enough data or it's not escaped/quoted correctly`,
    )
  }

  const [id, setId] = col[0].split('|')

  const def: LeaderboardData = {
    id: validate.andNormalizeLeaderboardId(id),
    setId: setId === undefined ? setId : commonValidate.andNormalizeId(setId, 'setId'),
    conditions: validate.andNormalizeConditions({
      start: col[1],
      cancel: col[2],
      submit: col[3],
      value: col[4],
    }),
    type: col[5] as Leaderboard.Type,
    title: col[6],
    description: col[7],
    lowerIsBetter: validate.andNormalizeLowerIsBetter(col[8]),
  }

  return def
}

const moveConditions = Symbol()

/**
 * This class represents a leaderboard for RetroAchievements. Leaderboards can be a part of AchievementSet class instances, or used separately if your goal is to parse and produce string representations of leaderboard that would go into local RACache file.
 *
 * Leaderboard are immutable, if you need to a make a new Leaderboard instance based of existing one - use `with()` method.
 */
export class Leaderboard implements LeaderboardData {
  declare id: number
  declare setId: number
  declare title: string
  declare description: string
  declare type: Leaderboard.Type
  declare lowerIsBetter: boolean
  declare conditions: LeaderboardConditions<Condition.GroupNormalized>

  /**
   * Creates Leaderboard using object representing it.
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   *
   * new Leaderboard({
   *   id: 58, // or numeric string
   *   setId: 1024, // or numeric string, optional
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
   * })
   */
  constructor(def: Leaderboard.InputObject)

  /**
   * Creates Leaderboard using string representing it, taken from `RACache/Data/GameId-User.txt` file.
   *
   * @example
   * new Leaderboard(
   *  'L58:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2"' +
   *  ':SCORE:My Leaderboard:Best score while doing something funny:0'
   * )
   *
   * new Leaderboard(
   *  'L58|1024:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2"' +
   *  ':SCORE:My Leaderboard:Best score while doing something funny:0'
   * )
   */
  constructor(def: string)
  /**
   * @ignore Stub definition to please TypeScript, this accepts all the previous types.
   */
  constructor(def: Leaderboard.Input)
  constructor(def: Leaderboard.Input) {
    const isLeaderboardInstance = def instanceof Leaderboard

    if (typeof def === 'string') {
      Object.assign(this, leaderboardFromString(def))
    } else if (isObject(def) && isLeaderboardInstance === false) {
      let conditions:
        | Leaderboard.InputObject['conditions']
        | LeaderboardConditions<Condition.GroupNormalized> = def.conditions

      if (!def[moveConditions]) {
        conditions = validate.andNormalizeConditions(def.conditions)
      }

      Object.assign(this, {
        ...def,
        id: validate.andNormalizeLeaderboardId(def.id),
        setId:
          def.setId === undefined ? def.setId : commonValidate.andNormalizeId(def.setId, 'setId'),
        title: def.title,
        description: def.description,
        type: def.type,
        lowerIsBetter: validate.andNormalizeLowerIsBetter(def.lowerIsBetter),
        conditions,
      })
    } else {
      throw new Error(
        'leaderboard data must be an object or string with leaderboard code, but got ' +
          (isLeaderboardInstance ? 'another Leaderboard instance' : eatSymbols`${def}`),
      )
    }

    commonValidate.title(this.title)
    this.description = commonValidate.andNormalizeDescription(this.description)
    validate.leaderboardType(this.type)
    validate.measuredConditions(this.conditions)

    deepFreeze(this)
  }

  /**
   * Returns new Leaderboard instance with different values merged.
   *
   * @param {DeepPartial<Leaderboard.InputObject>} data DeepPartial<Leaderboard.InputObject>
   *
   * @example
   * someLeaderboard
   *   .with({ title: someLeaderboard.title + 'suffix' })
   */
  with(data: DeepPartial<Leaderboard.InputObject>) {
    return new Leaderboard({
      ...(this as any),
      ...data,
      [moveConditions]: data.hasOwnProperty('conditions') === false,
    })
  }

  /**
   * Returns string representation of Leaderboard suitable
   * for `RACache/Data/GameId-User.txt` file.
   *
   * @param desiredData optional parameter, set this to `'leaderboard'`,
   * `'leaderboard-legacy'` or `'conditions'` to have corresponding string returned.
   * `'leaderboard-legacy'` will omit `setId` from the output. Default option is `'leaderboard'`.
   *
   * @example
   *
   * someLeaderboard.toString()
   * someLeaderboard.toString('leaderboard')
   * // 'L58:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2":SCORE:My Leaderboard:Best score while doing something funny:0'
   *
   * someLeaderboard.toString('conditions') // '"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2"'
   *
   * // if setId is set
   * someLeaderboard.toString()
   * someLeaderboard.toString('leaderboard')
   * // 'L58|1024:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2":SCORE:My Leaderboard:Best score while doing something funny:0'
   *
   * someLeaderboard.toString('leaderboard-legacy')
   * // 'L58:"0xHfff0=1S":"0=1":"1=1":"M:0xX34440*2":SCORE:My Leaderboard:Best score while doing something funny:0'
   */
  toString(desiredData: 'leaderboard' | 'leaderboard-legacy' | 'conditions' = 'leaderboard') {
    const conditions = [
      conditionsToString(this.conditions.start),
      conditionsToString(this.conditions.cancel),
      conditionsToString(this.conditions.submit),
      conditionsToString(this.conditions.value, '$'),
    ].map(x => `"${x}"`)

    if (desiredData === 'conditions') {
      return conditions.join(':')
    } else if (desiredData === 'leaderboard' || desiredData === 'leaderboard-legacy') {
      let res = ''
      res += 'L' + this.id
      if (desiredData === 'leaderboard' && this.setId !== undefined) {
        res += '|' + this.setId
      }
      res += ':'
      res += conditions.join(':') + ':'
      res += this.type + ':'
      res += quoteIfHaveTo(this.title) + ':'
      res += quoteIfHaveTo(this.description) + ':'
      res += Number(this.lowerIsBetter)
      return res
    } else {
      throw new Error(eatSymbols`unexpected leaderboard data toString request: ${desiredData}`)
    }
  }
}

function leaderboardConditionsFromLegacyString(str: string) {
  const conditions = {
    start: null as Condition.GroupNormalized,
    cancel: null as Condition.GroupNormalized,
    submit: null as Condition.GroupNormalized,
    value: null as Condition.GroupNormalized,
  }

  let match: RegExpMatchArray = null

  for (const [rawKey, key] of [
    ['STA', 'start'],
    ['CAN', 'cancel'],
    ['SUB', 'submit'],
    ['VAL', 'value'],
  ]) {
    const isValue = rawKey === 'VAL'
    // TODO: cache regexps
    if ((match = str.match(new RegExp(isValue ? /VAL:(.+)/ : `${rawKey}:(.+?)::`)))) {
      str = str.slice(match[0].length)
      try {
        conditions[key] = normalizedConditionGroupSet(match[1], {
          considerLegacyValueFormat: isValue,
        })
      } catch (err) {
        // TODO: this error message needs tests
        throw wrappedError(err, `${capitalizeWord(key)}, ${err.message}`)
      }
    } else {
      throw new Error(`expected ${rawKey}:<conditions>::, but got ${str.slice(0, 6)}`)
    }
  }

  return conditions
}
