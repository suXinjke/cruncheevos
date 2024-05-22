import { ConditionBuilder } from './define.js'
import {
  formatNumberAsHex,
  eatSymbols,
  isObject,
  invertObject,
  isNumber,
  deepFreeze,
  wrappedError,
  DeepPartial,
  indexToConditionGroupName,
} from './util.js'

export namespace Condition {
  export type Hits = number
  export interface Value {
    /** Specifies if value is read from memory and the way it's read/interpreted, or if value is constant. Empty string is allowed for rvalue. */
    type: ValueType
    /** Specifies how to interpret the value at specified memory address. Not required for constant values. */
    size: Size
    /** If value type implies reading from memory - this specifies memory address, otherwise specifies constant value. */
    value: number
  }
  export type Array = [Flag, ValueType, Size, number, Operator?, ValueType?, Size?, number?, Hits?]
  export interface Data {
    /**
     * Affects condition logic or the way it reads memory.
     *
     * Individual documentation for each flag [can be seen here](https://docs.retroachievements.org/Achievement-Development-Overview/#flags).
     */
    flag: Flag

    /**
     * Condition's left value, it always exists.
     */
    lvalue: Value

    /**
     * An operator set between left and right value. Empty string is allowed for conditions that don't specify right value.
     */
    cmp: Operator

    /**
     * Condition's optional right value. If it's not set - rvalue properties are empty strings.
     */
    rvalue: Value

    /**
     * Amount of hits set (also known as Hit Count), additional explanation [can be seen here](https://docs.retroachievements.org/Hit-Counts/).
     */
    hits: number
  }
  export type Input = Condition.Data | Condition.Array | string | Condition

  export type FlagForReading =
    | ''
    | 'PauseIf'
    | 'ResetIf'
    | 'ResetNextIf'
    | 'AddHits'
    | 'SubHits'
    | 'AndNext'
    | 'OrNext'
    | 'Measured'
    | 'Measured%'
    | 'MeasuredIf'
    | 'Trigger'

  export type FlagForCalculation = 'AddSource' | 'SubSource' | 'AddAddress'
  export type Flag = FlagForReading | FlagForCalculation

  export type OperatorComparison = '=' | '!=' | '<' | '<=' | '>' | '>='
  export type OperatorModifier = '*' | '/' | '&' | '^'
  export type Operator = '' | OperatorComparison | OperatorModifier

  export type SizeRegular =
    | ''
    | 'Bit0'
    | 'Bit1'
    | 'Bit2'
    | 'Bit3'
    | 'Bit4'
    | 'Bit5'
    | 'Bit6'
    | 'Bit7'
    | 'Lower4'
    | 'Upper4'
    | '8bit'
    | '16bit'
    | '24bit'
    | '32bit'
    | '16bitBE'
    | '24bitBE'
    | '32bitBE'
    | 'BitCount'

  export type SizeExtended = 'Float' | 'FloatBE' | 'Double32' | 'Double32BE' | 'MBF32' | 'MBF32LE'
  export type Size = SizeRegular | SizeExtended

  export type ValueTypeSized = 'Mem' | 'Delta' | 'Prior' | 'BCD' | 'Invert'
  export type ValueTypeNoSize = 'Value' | 'Float'
  export type ValueType = '' | ValueTypeSized | ValueTypeNoSize

  export type GroupNormalized = Condition[][]
  export type Group = (Condition.Input | ConditionBuilder)[] | string | ConditionBuilder
  export type GroupSetObject<G = Group> = {
    core: G
    [x: `alt${bigint}`]: G
  }
  export type GroupSet = Group | GroupSetObject
}

function parseUnderflow(num: number) {
  const result = num < 0 ? num + 1 + 0xffffffff : num

  if (num < -2147483648) {
    throw new Error(
      `${num} (${formatNumberAsHex(num)}) underflows into positive ${result} (${formatNumberAsHex(
        result,
      )}), it's very unlikely you intended for that to happen`,
    )
  }

  return result
}

const flags = (() => {
  const forReadingRaw: Record<Condition.FlagForReading, string> = {
    '': '',
    PauseIf: 'P',
    ResetIf: 'R',
    ResetNextIf: 'Z',
    AddHits: 'C',
    SubHits: 'D',
    AndNext: 'N',
    OrNext: 'O',
    Measured: 'M',
    'Measured%': 'G',
    MeasuredIf: 'Q',
    Trigger: 'T',
  }

  const forCalcRaw: Record<Condition.FlagForCalculation, string> = {
    AddSource: 'A',
    SubSource: 'B',
    AddAddress: 'I',
  }

  const toRaw = {
    ...forReadingRaw,
    ...forCalcRaw,
  }

  const fromRaw = invertObject(toRaw) as Record<string, Condition.Flag>
  delete fromRaw['']

  return {
    forReading: {
      toRaw: forReadingRaw,
    },

    forCalc: {
      toRaw: forCalcRaw,
    },

    toRaw,
    fromRaw,
  }
})()

const types = (() => {
  const toRaw: Record<Condition.ValueTypeSized, string> = {
    Mem: '',
    Delta: 'd',
    Prior: 'p',
    BCD: 'b',
    Invert: '~',
  }

  return {
    withSize: {
      toRaw,
      array: Object.keys(toRaw) as Condition.ValueTypeSized[],
      fromRaw: invertObject(toRaw),
    },

    withoutSize: {
      array: ['Value', 'Float'] satisfies Condition.ValueTypeNoSize[],
    },
  }
})()

const sizesRegular = (() => {
  const toRaw: Record<Condition.SizeRegular, string> = {
    '': '',
    Bit0: 'M',
    Bit1: 'N',
    Bit2: 'O',
    Bit3: 'P',
    Bit4: 'Q',
    Bit5: 'R',
    Bit6: 'S',
    Bit7: 'T',
    Lower4: 'L',
    Upper4: 'U',
    '8bit': 'H',
    '16bit': ' ',
    '24bit': 'W',
    '32bit': 'X',
    '16bitBE': 'I',
    '24bitBE': 'J',
    '32bitBE': 'G',
    BitCount: 'K',
  }

  return {
    toRaw,
    fromRaw: invertObject(toRaw) as Record<string, Condition.Size>,
  }
})()

const sizesExt = (() => {
  const toRaw: Record<Condition.SizeExtended, string> = {
    Float: 'F',
    FloatBE: 'B',
    Double32: 'H',
    Double32BE: 'I',
    MBF32: 'M',
    MBF32LE: 'L',
  }

  return {
    toRaw,
    fromRaw: invertObject(toRaw) as Record<string, Condition.Size>,
  }
})()

const cmp = {
  forReading: ['=', '!=', '<', '<=', '>', '>='] satisfies Condition.OperatorComparison[],
  forCalc: ['*', '/', '&', '^'] satisfies Condition.OperatorModifier[],

  isLegalForReading(cmp: any) {
    return typeof cmp === 'string' && this.forReading.includes(cmp as Condition.OperatorComparison)
  },

  isLegalForCalc(cmp: any) {
    return typeof cmp === 'string' && this.forCalc.includes(cmp as Condition.OperatorModifier)
  },

  isLegal(cmp: any) {
    return this.isLegalForReading(cmp) || this.isLegalForCalc(cmp)
  },
}

function flagNeedsComparisonOperator(def: Condition.Data) {
  return flags.forReading.toRaw.hasOwnProperty(def.flag)
}

function flagNeedsCalculationOperator(def: Condition.Data) {
  return flags.forCalc.toRaw.hasOwnProperty(def.flag)
}

function isBareMeasured(def: Condition.Data) {
  return def.flag === 'Measured' && hasRValueDefined(def) === false
}

function isMeasuredLeaderboardValue(def: Condition.Data) {
  return def.flag === 'Measured' && hasRValueDefined(def) && cmp.isLegalForCalc(def.cmp)
}

function hasRValueDefined(def: Condition.Data) {
  const hasType = Boolean(def.rvalue.type)
  const hasSize = Boolean(def.rvalue.size)

  if (!hasSize && !hasType) {
    return false
  }

  if (hasSize) {
    return hasType
  }

  const mustHaveSizeDefined = types.withSize.toRaw.hasOwnProperty(def.rvalue.type)
  return mustHaveSizeDefined ? hasSize : true
}

const validateAndNormalize = {
  value(value: Condition.Value, placement: 'lvalue' | 'rvalue') {
    if (types.withSize.array.some(x => x === value.type)) {
      if (Number.isInteger(value.value) === false) {
        throw new Error(
          `expected ${placement} memory address as unsigned integer, but got ` +
            eatSymbols`${value.value}`,
        )
      }

      if (value.value < 0 || value.value > 0xffffffff) {
        throw new Error(
          `expected ${placement} memory address to be within the range of 0x0 .. 0xFFFFFFFF, but got ` +
            eatSymbols`${value.value}`,
        )
      }
    } else if (value.type === 'Value') {
      if (Number.isInteger(value.value) === false) {
        throw new Error(`expected ${placement} as integer, but got ` + eatSymbols`${value.value}`)
      }

      try {
        var finalValue = parseUnderflow(value.value)
      } catch (err) {
        throw wrappedError(err, `${placement}: ${err.message}`)
      }

      // the value cannot be less than 0 due to underflow
      if (finalValue > 0xffffffff) {
        throw new Error(
          `expected ${placement} to be within the range of 0x0 .. 0xFFFFFFFF, but got ` +
            eatSymbols`${value.value}`,
        )
      }
    } else if (value.type === 'Float') {
      if (Number.isNaN(value.value) || Number.isFinite(value.value) === false) {
        throw new Error(`expected ${placement} as float, but got ` + eatSymbols`${value.value}`)
      }

      const lowerLimit = -294967040
      const upperLimit = 4294967040
      // TODO: questionable limits, figure out proper ones
      if (value.value < lowerLimit || value.value > upperLimit) {
        throw new Error(
          `expected ${placement} to be within the range of ${lowerLimit} .. ${upperLimit}, but got ` +
            eatSymbols`${value.value}`,
        )
      }
    } else if (value.type !== '') {
      throw new Error(`expected valid ${placement} type, but got ` + eatSymbols`${value.type}`)
    }

    if (types.withoutSize.array.some(x => x === value.type)) {
      if (value.size) {
        throw new Error(
          `${placement} value cannot have size specified, but got ` + eatSymbols`${value.size}`,
        )
      }
    }

    if (value.type === 'Value') {
      return {
        ...value,
        value: parseUnderflow(value.value),
      }
    } else {
      return value
    }
  },

  calculations(def: Condition) {
    if (flagNeedsCalculationOperator(def) === false) {
      return
    }

    if (def.cmp) {
      if (cmp.isLegalForCalc(def.cmp) === false) {
        throw new Error(
          `expected an accumulation operator (${cmp.forCalc.join(' ')}), but got ` +
            eatSymbols`${def.cmp}`,
        )
      }

      if (hasRValueDefined(def) === false) {
        throw new Error('rvalue must be fully provided if operator is specified')
      }

      def.rvalue = validateAndNormalize.value(def.rvalue, 'rvalue')
    } else if (def.cmp === '' && hasRValueDefined(def)) {
      throw new Error(`expected an accumulation operator (${cmp.forCalc.join(' ')}), but got ""`)
    }
  },

  memoryComparisons(def: Condition) {
    if (
      flagNeedsComparisonOperator(def) === false ||
      isBareMeasured(def) ||
      isMeasuredLeaderboardValue(def)
    ) {
      return
    }

    def.rvalue = validateAndNormalize.value(def.rvalue, 'rvalue')

    if (cmp.isLegalForReading(def.cmp) === false || !def.cmp) {
      throw new Error(
        `expected comparison operator (${cmp.forReading.join(' ')}), but got ` +
          eatSymbols`${def.cmp}`,
      )
    }
  },
}

const validate = {
  enums(def: Condition) {
    if (flags.toRaw.hasOwnProperty(def.flag) === false) {
      throw new Error(eatSymbols`expected valid condition flag, but got ${def.flag}`)
    }

    for (const [value, valueSide] of [
      [def.lvalue, 'lvalue'],
      [def.rvalue, 'rvalue'],
    ] as const) {
      if (
        sizesRegular.toRaw.hasOwnProperty(value.size) === false &&
        sizesExt.toRaw.hasOwnProperty(value.size) === false
      ) {
        throw new Error(`expected valid ${valueSide} size, but got ` + eatSymbols`${value.size}`)
      }
    }

    if (def.cmp && cmp.isLegal(def.cmp) === false) {
      throw new Error(eatSymbols`expected an operator or lack of it, but got ${def.cmp}`)
    }
  },

  hits(def: Condition) {
    if (Number.isInteger(def.hits) === false) {
      throw new Error(eatSymbols`expected hits as unsigned integer, but got ${def.hits}`)
    }

    if (def.hits < 0 || def.hits > 0xffffffff) {
      throw new Error(
        `expected hits to be within the range of 0x0 .. 0xFFFFFFFF, but got ${def.hits}`,
      )
    }

    if (flagNeedsCalculationOperator(def) && def.hits > 0) {
      throw new Error(`hits value cannot be specified with ${def.flag} condition flag`)
    }
  },
}

const consume = {
  flag(str: string): [Condition.Flag, string] {
    const match = str.match(regExes.flag)
    if (!match) {
      return ['', str]
    }

    const flag = match[1]
    if (flags.fromRaw.hasOwnProperty(flag.toUpperCase()) === false) {
      throw new Error(eatSymbols`expected a legal condition flag, but got ${match[0]}`)
    }

    return [flags.fromRaw[flag.toUpperCase()], str.slice(match[0].length)]
  },
  value(str: string): [Condition.Value, string] {
    const def: Condition.Value = {
      type: 'Mem',
      size: '',
      value: 0,
    }

    let match: RegExpMatchArray = null
    let integersAllowed = true

    if ((match = str.match(regExes.type))) {
      str = str.slice(match[0].length)
      def.type = types.withSize.fromRaw[match[1].toLowerCase()]
      integersAllowed = false
    }

    if ((match = str.match(regExes.valueFloat))) {
      str = str.slice(match[0].length)
      def.type = 'Float'
      def.value = Number(match[1])
    } else if ((match = str.match(regExes.memAddress))) {
      str = str.slice(match[0].length)

      if (match[1].toLowerCase() === '0x') {
        if ((match = str.match(regExes.sizesRegular))) {
          str = str.slice(match[0].length)
          def.size = sizesRegular.fromRaw[match[1].toUpperCase()]
        } else if (str.match(regExes.hexValue)) {
          def.size = '16bit'
        } else {
          throw new Error(eatSymbols`expected valid size specifier, but got ${str.slice(0, 6)}`)
        }
      } else {
        if ((match = str.match(regExes.sizesExt))) {
          str = str.slice(match[0].length)
          def.size = sizesExt.fromRaw[match[1].toUpperCase()]
        } else {
          throw new Error(eatSymbols`expected valid size specifier, but got ${str.slice(0, 6)}`)
        }
      }

      if ((match = str.match(regExes.hexValue))) {
        str = str.slice(match[0].length)
        const value = match[1]
        def.value = Number('0x' + value)
      } else {
        throw new Error(
          eatSymbols`expected memory address as hex number, but got ${str.slice(0, 6)}`,
        )
      }
    } else if (integersAllowed && (match = str.match(regExes.valueHex))) {
      str = str.slice(match[0].length)
      def.type = 'Value'
      def.value = parseUnderflow(parseInt(match[1].replace(regExes.hexPrefix, '0x')))
    } else if (integersAllowed && (match = str.match(regExes.valueInteger))) {
      str = str.slice(match[0].length)
      def.type = 'Value'
      def.value = parseUnderflow(Number(match[1]))
    } else {
      throw new Error(eatSymbols`expected proper definition, but got ${str.slice(0, 6)}`)
    }

    return [def, str]
  },
  cmp(str: string): [Condition.Operator, string] {
    const match = str.match(regExes.cmp)
    if (!match) {
      throw new Error(eatSymbols`expected an operator, but got ${str.slice(0, 6)}`)
    }

    return [match[1] as Condition.Operator, str.slice(match[0].length)]
  },
  hits(str: string): [number, string] {
    const match = str.match(regExes.hits)
    if (!match) {
      throw new Error(eatSymbols`expected hits definition, but got ${str}`)
    }

    const hitsString = match[1]
    if (isNumber(hitsString, { isInteger: true, isPositive: true })) {
      const hits = Number(hitsString)
      if (hits > 0xffffffff) {
        throw new Error(
          `expected hits to be within the range of 0x0 .. 0xFFFFFFFF, but got ${hitsString}`,
        )
      }
      return [hits, str.slice(match[0].length)]
    } else {
      throw new Error(eatSymbols`expected hits as unsigned integer, but got ${hitsString}`)
    }
  },
}

function fromString(str: string): Condition.Data {
  str = str.trim()

  const def: Condition.Data = {
    flag: '',
    lvalue: {
      type: '',
      size: '',
      value: 0,
    },
    cmp: '',
    rvalue: {
      type: '',
      size: '',
      value: 0,
    },
    hits: 0,
  }

  ;[def.flag, str] = consume.flag(str)
  try {
    ;[def.lvalue, str] = consume.value(str)
  } catch (err) {
    throw wrappedError(err, `lvalue: ${err.message}`)
  }

  if (str) {
    ;[def.cmp, str] = consume.cmp(str)

    const comparisonOperatorExpected = flagNeedsComparisonOperator(def)
    const hasValidComparisonOperator = cmp.isLegalForReading(def.cmp)
    const hasValidOperator = hasValidComparisonOperator || cmp.isLegalForCalc(def.cmp)

    if (hasValidOperator === false) {
      if (comparisonOperatorExpected) {
        throw new Error(
          `expected comparison operator (${cmp.forReading.join(' ')}), but got ` +
            eatSymbols`${def.cmp}`,
        )
      } else {
        throw new Error(
          `expected calculation operator (${cmp.forCalc.join(' ')}), but got ` +
            eatSymbols`${def.cmp}`,
        )
      }
    }

    try {
      ;[def.rvalue, str] = consume.value(str)
    } catch (err) {
      throw wrappedError(err, `rvalue: ${err.message}`)
    }

    if (str) {
      ;[def.hits, str] = consume.hits(str)
    }

    // code like A:0xcafe=0 is legal despite comparison making no
    // sense in case of AddSource, just suppress the operator and rvalue
    if (comparisonOperatorExpected === false && hasValidComparisonOperator) {
      def.cmp = ''
      def.rvalue = {
        type: '',
        size: '',
        value: 0,
      }
    }
  }

  return def
}

function conditionValueValueToString(def: Condition.Value) {
  if (def.type === 'Value') {
    const diff = def.value - 0xffffffff - 1
    if (diff >= -0x1000 && diff < 0) {
      return diff.toString()
    } else {
      return def.value >= 100000 ? formatNumberAsHex(def.value) : def.value.toString()
    }
  } else if (def.type) {
    const shouldFormatAsHex = def.type !== 'Float' || def.value >= 100000
    return shouldFormatAsHex ? formatNumberAsHex(def.value) : def.value.toString()
  }
}

function conditionDataFromArray(def: Condition.Array): Condition.Data {
  const shouldFallbackRValue =
    def[4] === undefined && def[5] === undefined && def[6] === undefined && def[7] === undefined

  return {
    flag: def[0],
    lvalue: {
      type: def[1],
      size: def[2],
      value: def[3],
    },
    cmp: shouldFallbackRValue ? '' : def[4],
    rvalue: {
      type: shouldFallbackRValue ? '' : def[5],
      size: shouldFallbackRValue ? '' : def[6],
      value: shouldFallbackRValue ? 0 : def[7],
    },
    hits: def[8] === undefined ? 0 : def[8],
  }
}

function conditionValueToString(def: Condition.Value) {
  let res = ''

  if (def.type === 'Value') {
    res += def.value
  } else if (def.type === 'Float') {
    res += 'f'
    res += def.value
    if (Number.isInteger(def.value)) {
      res += '.0'
    }
  } else {
    res += types.withSize.toRaw[def.type]
    if (sizesExt.toRaw.hasOwnProperty(def.size)) {
      res += 'f'
      res += sizesExt.toRaw[def.size]
    } else {
      res += `0x`
      res += sizesRegular.toRaw[def.size]
    }

    res += def.value.toString(16)
  }

  return res
}

interface GroupSetParseOptions {
  considerLegacyValueFormat?: boolean
}

export function validateRegularMeasuredConditions(conditions: Condition.GroupNormalized) {
  conditions.forEach((group, groupIndex) => {
    const groupName = indexToConditionGroupName(groupIndex)

    group.forEach((condition, conditionIndex) => {
      if (isBareMeasured(condition)) {
        throw new Error(
          `${groupName}, condition ${conditionIndex + 1}: cannot have Measured condition without rvalue specified`,
        )
      }

      if (isMeasuredLeaderboardValue(condition)) {
        throw new Error(
          `${groupName}, condition ${conditionIndex + 1}: expected comparison operator (${cmp.forReading.join(' ')}), but got ` +
            eatSymbols`${condition.cmp}`,
        )
      }
    })
  })
}

/**
 * This class represents a code piece that can be part of achievements, leaderboards or rich presence for RetroAchievements.
 *
 * Conditions are immutable, if you need to a make a new condition instance based of existing one - use `with()` method.
 */
export class Condition implements Condition.Data {
  flag: Condition.Flag
  lvalue: Condition.Value
  cmp: Condition.Operator
  rvalue: Condition.Value
  hits: number

  /**
   * Creates Condition using array representing it.
   *
   * @example
   * new Condition(['ResetIf', 'Mem', 'Bit0', 71, '>', 'Delta', 'Bit1', 71, 3])
   */
  constructor(def: Condition.Array)
  /**
   * Creates Condition using a string representing the condition.
   *
   * @example
   * new Condition('R:0xM47>d0xN47.3.')
   * // same as
   * new Condition(['ResetIf', 'Mem', 'Bit0', 71, '>', 'Delta', 'Bit1', 71, 3])
   */
  constructor(def: string)
  /**
   * Returns the same Condition instance passed,
   * which is due to Conditions being immutable.
   */
  constructor(def: Condition)
  /**
   * Creates Condition using an object that directly represents the Condition data.
   *
   * @example
   * new Condition({
   *   flag: '',
   *   lvalue: {
   *     type: 'Mem',
   *     size: '32bit',
   *     value: 0xcafe,
   *   },
   *   cmp: '=',
   *   rvalue: {
   *     type: 'Value',
   *     size: '',
   *     value: 47,
   *   },
   *   hits: 0,
   * })
   */
  constructor(def: Condition.Data)
  /**
   * @ignore Stub definition to please TypeScript, this accepts all the previous types.
   */
  constructor(def: Condition.Input)
  constructor(def: Condition.Input) {
    if (def instanceof Condition) {
      return def
    }

    if (typeof def === 'string') {
      Object.assign(this, fromString(def))
    } else if (Array.isArray(def)) {
      Object.assign(this, conditionDataFromArray(def))
    } else if (isObject(def)) {
      this.flag = def.flag
      this.cmp = def.cmp
      this.rvalue = { ...def.rvalue }
      this.lvalue = { ...def.lvalue }
      this.hits = def.hits
    } else {
      throw new Error(
        eatSymbols`condition data must be an array, object or string with condition code, but got ${def}`,
      )
    }

    validate.enums(this)
    this.lvalue = validateAndNormalize.value(this.lvalue, 'lvalue')
    validateAndNormalize.memoryComparisons(this)
    validateAndNormalize.calculations(this)
    validate.hits(this)

    deepFreeze(this)
  }

  /**
   * Returns new Condition instance with different values merged.
   *
   * @param {DeepPartial<Condition.Data>} data DeepPartial<Condition.Data>
   *
   * @example
   * new Condition('0=1')
   *   .with({ cmp: '!=', rvalue: { value: 47 } })
   *   .toString() // 0!=47
   */
  with(data: DeepPartial<Condition.Data>) {
    return new Condition({
      ...this,
      ...data,
      lvalue: { ...this.lvalue, ...(data.lvalue || {}) },
      rvalue: { ...this.rvalue, ...(data.rvalue || {}) },
    })
  }

  /**
   * Returns string representation of Condition
   * suitable for RetroAchievements and local files.
   * @example
   * new Condition(['ResetIf', 'Mem', 'Bit0', 71, '>', 'Delta', 'Bit1', 71, 3]).toString() // 'R:0xM47>d0xN47.3.'
   */
  toString() {
    let res = ''
    if (this.flag !== '') {
      res += flags.toRaw[this.flag] + ':'
    }

    res += conditionValueToString(this.lvalue)
    if (hasRValueDefined(this)) {
      res += this.cmp
      res += conditionValueToString(this.rvalue)

      if (this.hits) {
        res += '.' + this.hits + '.'
      }
    }

    return res
  }

  /**
   * Returns direct Array representation of Condition,
   * values are exactly same as properties of Condition.
   *
   * @example
   * new Condition(['Measured', 'Mem', '8bit', 4]).toArray()
   * // [ "Measured", "Mem", "8bit", 4, "", "", "", 0, 0 ]
   */
  toArray() {
    return [
      this.flag,
      this.lvalue.type,
      this.lvalue.size,
      this.lvalue.value,
      this.cmp,
      this.rvalue.type,
      this.rvalue.size,
      this.rvalue.value,
      this.hits,
    ] as Condition.Array
  }

  /**
   * Returns prettier Array representation of Condition, which is more suitable for display:
   *
   * * Everything is a string
   * * Values are formatted as hexadecimal if they are greater or equal to 100000
   * * Negative values are formatted as decimal if they are greater or equal to -4096, otherwise formatted as hexadecimal with underflow correction
   * * Hits are empty string if equal to zero
   *
   * @example
   * new cruncheevos.Condition(['ResetIf', 'Mem', '32bit', 0xfeedcafe, '>', 'Value', '', 71]).toArrayPretty()
   * // [ "ResetIf", "Mem", "32bit", "0xfeedcafe", ">", "Value", "", "71", "" ]
   *
   * new cruncheevos.Condition(['', 'Value', '', -4097, '>', 'Value', '', -1]).toArrayPretty()
   * // [ "", "Value", "", "0xffffefff", ">", "Value", "", "-1", "" ]
   */
  toArrayPretty(): string[] {
    const rValueIsDefined = hasRValueDefined(this)
    return [
      this.flag,
      this.lvalue.type,
      this.lvalue.size,
      conditionValueValueToString(this.lvalue),
      this.cmp,
      rValueIsDefined ? this.rvalue.type : '',
      rValueIsDefined ? this.rvalue.size : '',
      rValueIsDefined ? conditionValueValueToString(this.rvalue) : '',
      this.hits > 0 ? this.hits.toString() : '',
    ] as const
  }
}

export function normalizedConditionGroupSetFromString(
  str: string,
  options: GroupSetParseOptions = {},
) {
  const { considerLegacyValueFormat = false } = options
  const conditionStrings = str
    .split(considerLegacyValueFormat ? '$' : /(?<!0x)S/)
    .map(group => (group.trim().length > 0 ? group.split('_') : []))

  const parseAsLegacy =
    considerLegacyValueFormat &&
    conditionStrings.every(group =>
      group.every(conditionString => conditionString.match(regExes.flag) === null),
    )

  return conditionStrings.map((group, groupIndex) =>
    group.map((conditionString, conditionIndex) => {
      if (parseAsLegacy) {
        const isLastElement = conditionIndex === group.length - 1

        conditionString = (isLastElement ? 'M' : 'A') + ':' + conditionString
      }

      try {
        return new Condition(conditionString)
      } catch (err) {
        const groupName = indexToConditionGroupName(groupIndex)
        throw wrappedError(err, `${groupName}, condition ${conditionIndex + 1}: ${err.message}`)
      }
    }),
  )
}

export function normalizedConditionGroupSet(
  def: Condition.GroupSet,
  options: GroupSetParseOptions = {},
): Condition.GroupNormalized {
  const res: Condition.GroupNormalized = []

  if (typeof def === 'string') {
    return normalizedConditionGroupSetFromString(def, options)
  } else if (Array.isArray(def)) {
    /*
    core [
      condition 1,
      condition 2
    ]
    */
    const subRes: Condition[] = []
    for (let i = 0; i < def.length; i++) {
      const x = def[i]
      try {
        if (x instanceof ConditionBuilder) {
          subRes.push(...x)
        } else {
          subRes.push(new Condition(x))
        }
      } catch (err) {
        throw wrappedError(err, `conditions[${i}]: ${err.message}`)
      }
    }

    res.push(subRes)
  } else if (def instanceof ConditionBuilder) {
    res.push([...def])
  } else if (isObject(def)) {
    let coreDefined = false
    const altNumbers: number[] = []

    for (const key in def) {
      const match = key.match(/^(?:core|alt([1-9]\d*))$/)
      if (match) {
        if (match[0] === 'core') {
          coreDefined = true
        } else if (match[1]) {
          altNumbers.push(Number(match[1]))
        }
      } else {
        throw new Error(`conditions.${key}: group name must be "core" or "alt1", "alt2"...`)
      }
    }

    if (!coreDefined) {
      throw new Error(`conditions: expected "core" group`)
    }

    altNumbers
      .sort((a, b) => a - b)
      .forEach((num, index) => {
        if (num !== index + 1) {
          throw new Error(
            `conditions: expected "alt${
              index + 1
            }" group, but got "alt${num}", make sure there are no gaps`,
          )
        }
      })

    const groups = ['core', ...altNumbers.map(x => `alt${x}`)]

    for (const groupName of groups) {
      const group = def[groupName] as Condition.Group

      if (typeof group === 'string') {
        try {
          res.push(...normalizedConditionGroupSetFromString(group, options))
        } catch (err) {
          throw wrappedError(err, `conditions.${groupName}: ${err.message}`)
        }
      } else if (group instanceof ConditionBuilder) {
        res.push([...group])
      } else if (Array.isArray(group)) {
        const subRes: Condition[] = []
        for (let i = 0; i < group.length; i++) {
          try {
            const x = group[i]
            if (x instanceof ConditionBuilder) {
              subRes.push(...x)
            } else {
              subRes.push(new Condition(x))
            }
          } catch (err) {
            throw wrappedError(err, `conditions.${groupName}[${i}]: ${err.message}`)
          }
        }

        res.push(subRes)
      } else {
        throw new Error(
          `conditions.${groupName}: expected an array of conditions or string, but got ` +
            eatSymbols`${group}`,
        )
      }
    }
  } else {
    throw new Error(
      eatSymbols`expected conditions as object, array of arrays or string, but got ${def}`,
    )
  }

  return res
}

const regExes = (() => {
  const cmps = [...cmp.forCalc, ...cmp.forReading]
    .sort((a, b) => {
      return b.length - a.length
    })
    .map(x =>
      x
        .split('')
        .map(x => `\\${x}`)
        .join(''),
    )

  return {
    cmp: new RegExp(`^(${cmps.join('|')})`),

    flag: /^(.*?):/i,
    hits: /^\.(.*)\./,

    hexPrefix: /h/i,
    hexValue: /^([\dabcdef]+)/i,

    sizesRegular: new RegExp(
      '^(' + Object.values(sizesRegular.toRaw).filter(Boolean).join('|') + ')',
      'i',
    ),
    sizesExt: new RegExp('^(' + Object.values(sizesExt.toRaw).filter(Boolean).join('|') + ')', 'i'),

    memAddress: /^(0x|f)/i,

    type: new RegExp(
      '^(' + Object.values(types.withSize.toRaw).filter(Boolean).join('|') + ')',
      'i',
    ),
    valueHex: /^(-?h[\dabcdef]+)/i,
    valueInteger: /^(-?\d+)/,
    valueFloat: /^f(-?\d+\.\d+)/i,
  }
})()
