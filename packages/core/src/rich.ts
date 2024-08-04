import { Condition, normalizedConditionGroupSetFromString } from './condition.js'
import { ConditionBuilder } from './define.js'
import { eatSymbols, formatNumberAsHex, isNumber, wrappedError } from './util.js'

export namespace RichPresence {
  export type Format =
    | 'VALUE'
    | 'SCORE'
    | 'POINTS'
    | 'TIME'
    | 'FRAMES'
    | 'MILLISECS'
    | 'SECS'
    | 'MINUTES'
    | 'SECS_AS_MINS'
    | 'FLOAT1'
    | 'FLOAT2'
    | 'FLOAT3'
    | 'FLOAT4'
    | 'FLOAT5'
    | 'FLOAT6'

  /**
   * Specifies how keys should look like in string representation of the Lookup
   * Default is `'dec'`
   */
  export type LookupKeyFormat = 'dec' | 'hex' | 'hex-lowercase'

  export interface LookupParams {
    /** Name of this Rich Presence Lookup */
    name: string

    /** Object representing values of this Rich Presence Lookup, key must be a number or '*' */
    values: Record<string | number, string>

    /** Specifies default memory address or conditions representing it, which can be used when passing the Lookup instance to the {@link RichPresence.tag} function */
    defaultAt?: string | Condition | ConditionBuilder

    /**
     * Specifies if same Lookup values should be contained within a key range if possible
     * Default is `true`
     *
     * @example
     * import { RichPresence } from '@cruncheevos/core'
     * const values = { 1: 'Same', 2: 'Same' }
     * const withCompress = RichPresence.lookup({ name: 'Car', values })
     * const withoutCompress = RichPresence.lookup({ name: 'Car', values, compressRanges: true })
     *
     * withCompress.toString() // 'Lookup:Car\n1-2=Same'
     * withoutCompress.toString() // 'Lookup:Car\n1=Same\n2=Same'
     */
    compressRanges?: boolean
  }

  export interface FormatParams {
    /** Name of this Rich Presence Format */
    name: string
    /** Type of this Rich Presence Format, such as SCORE, FRAMES, etc. */
    type: Format
  }

  export interface Params<L, F> {
    lookupDefaultParameters?: {
      compressRanges?: RichPresence.LookupParams['compressRanges']
      keyFormat?: RichPresence.LookupKeyFormat
    }

    /**
     * An object wrapping calls to {@link RichPresence.format}
     *
     * Key specifies Format name, value specifies Format type.
     * */
    format?: F

    /**
     * An object wrapping calls to {@link RichPresence.lookup}
     *
     * Key specifies Lookup name, value specifies parameters that
     * will get passed to {@link RichPresence.lookup} (except name).
     * */
    lookup?: L

    /**
     * Callback providing previously specified Rich Presence Formats
     * and Lookups, also provides Macros and {@link RichPresence.tag} function.
     *
     * This callback expects you to return an array of display strings.
     * See example for {@link RichPresence}.
     */
    displays: (params: {
      lookup: {
        [x in keyof L]: ReturnType<typeof makeRichPresenceLookup>
      }
      format: {
        [x in keyof F]: ReturnType<typeof makeRichPresenceFormat>
      }
      tag: typeof taggedDisplayString
      macro: typeof RichPresence.macro
    }) => Array<string | [Condition.Input | ConditionBuilder, string]>
  }
}

const richLookup = Symbol('isRichLookupOrFormat')

const allowedFormatTypes = new Set([
  'VALUE',
  'SCORE',
  'POINTS',
  'TIME',
  'FRAMES',
  'MILLISECS',
  'SECS',
  'MINUTES',
  'SECS_AS_MINS',
  'FLOAT1',
  'FLOAT2',
  'FLOAT3',
  'FLOAT4',
  'FLOAT5',
  'FLOAT6',
])

function compressRange(input: string[]): {
  formattedRanges: string
  notNumbers: string[]
} {
  const { numbers, notNumbers } = input.reduce(
    (prev, cur) => {
      const numberMaybe = Number(cur)
      if (Number.isNaN(numberMaybe)) {
        prev.notNumbers.push(cur)
      } else {
        prev.numbers.push(numberMaybe)
      }

      return prev
    },
    { numbers: [] as number[], notNumbers: [] as string[] },
  )

  if (numbers.length === 0) {
    return { formattedRanges: '', notNumbers }
  }

  const ranges = [] as Array<[number, number]>

  let start = numbers[0]
  let end = numbers[0]

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] - end === 1) {
      end = numbers[i]
    } else {
      ranges.push([start, end])
      start = numbers[i]
      end = numbers[i]
    }
  }

  ranges.push([start, end])

  return {
    notNumbers,
    formattedRanges: ranges
      .map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`))
      .join(','),
  }
}

function isRichLookup(input: unknown): input is ReturnType<typeof makeRichPresenceLookup> {
  return input && typeof input !== 'string' && input[richLookup]
}

function taggedDisplayString(
  strings: TemplateStringsArray,
  ...args: Array<string | Condition | ConditionBuilder | ReturnType<typeof makeRichPresenceLookup>>
) {
  return strings
    .map((str, i) => {
      let val = i === strings.length - 1 ? '' : args[i]
      if (isRichLookup(val)) {
        val = val.at()
      }
      return `${str}${val}`
    })
    .join('')
}

function doesntHaveMeasuredTrail(condition: Condition | ConditionBuilder | Condition[]) {
  // prettier-ignore
  const conditions =
    condition instanceof ConditionBuilder ? condition.conditions :
    Array.isArray(condition) ? condition :
    [condition]

  return conditions[conditions.length - 1].flag !== 'Measured'
}

function shortenMaybe(input: Condition | ConditionBuilder) {
  const conditions = input instanceof ConditionBuilder ? input.conditions : [input]
  if (conditions.length === 1) {
    return input.toString().replace('M:', '').replace(' ', '')
  }

  return input.toString()
}

function makeRichPresenceDisplay(
  condition: Condition.Input | ConditionBuilder,
  displayString: string,
) {
  return `?${condition}?${displayString}`
}

function _makeRichPresenceFormat(params: { name: string; type: string }) {
  const { name, type } = params
  return {
    /** Name of this Rich Presence Format */
    name,

    /** Type of this Rich Presence Format, such as SCORE, FRAMES, etc. */
    type: type as RichPresence.Format,

    /**
     * Returns string representation of Rich Presence Format definition
     *
     * @example
     * import { RichPresence } from '@cruncheevos/core'
     * const format = RichPresence.format({ name: 'Score', type: 'VALUE' })
     * format.toString() // 'Format:Score\nFormatType=VALUE'
     */
    toString() {
      return `Format:${name}\nFormatType=${type}`
    },

    /**
     * Returns string representation of Rich PresenceFormat macro call
     *
     * If there's only one condition - output may be shortened.
     *
     * When passing Condition or ConditionBuilder - you must have
     * at least one condition marked as Measured.
     *
     * Legacy value format is only supported by passing a string.
     *
     * @example
     * import { define as $, RichPresence } from '@cruncheevos/core'
     *
     * const format = RichPresence.format({ name: 'Score', type: 'VALUE' })
     * format.at('0xcafe_v1') // '@Car(0xcafe_v1)'
     * format.at($(['Measured', 'Mem', 'Float', 0xCAFE])) // '@Car(fFcafe)'
     */
    at(input: string | Condition | ConditionBuilder) {
      if (typeof input === 'string') {
        try {
          normalizedConditionGroupSetFromString(input, {
            considerLegacyValueFormat: true,
          })
        } catch (err) {
          throw wrappedError(
            err,
            eatSymbols`Rich Presence Format ${name} got invalid string input: ${err.message}`,
          )
        }

        return `@${name}(${input})`
      }

      if (input instanceof Condition || input instanceof ConditionBuilder) {
        if (doesntHaveMeasuredTrail(input)) {
          throw new Error(
            eatSymbols`Rich Presence Format ${name} got invalid input: must have at least one condition with Measured flag, but got ${input.toString()}`,
          )
        }

        return `@${name}(${shortenMaybe(input)})`
      }

      throw new Error(eatSymbols`Rich Presence Format ${name} got invalid input: ${input}`)
    },
  }
}

function makeRichPresenceFormat(params: RichPresence.FormatParams) {
  const { name, type } = params

  if (typeof name !== 'string') {
    throw new Error(
      eatSymbols`Rich Presence Format expected to have a name as string, but got ${name}`,
    )
  }

  if (allowedFormatTypes.has(type) === false) {
    throw new Error(eatSymbols`Rich Presence Format ${name} got unexpected type: ${type}`)
  }

  return _makeRichPresenceFormat(params)
}

function makeRichPresenceLookup(params: RichPresence.LookupParams) {
  const { name, values, defaultAt, compressRanges = true } = params
  let parsedDefaultAt = ''

  if (typeof name !== 'string') {
    throw new Error(
      eatSymbols`Rich Presence Lookup expected to have a name as string, but got ${name}`,
    )
  }

  const entries = Object.entries(values || {})
  if (entries.length === 0) {
    throw new Error(
      eatSymbols`Rich Presence Lookup ${name} must define at least one key-value pair`,
    )
  }

  for (const [key, value] of entries) {
    if (key === '*') {
      continue
    }

    if (isNumber(key, { isInteger: true, isPositive: true }) === false) {
      throw new Error(
        eatSymbols`Rich Presence Lookup ${name} got invalid key-value pair ${key}: ${value}, value must be positive integer or "*"`,
      )
    }
  }

  if (defaultAt !== undefined) {
    if (typeof defaultAt === 'string') {
      try {
        var conditions = normalizedConditionGroupSetFromString(defaultAt, {
          considerLegacyValueFormat: true,
        })
      } catch (err) {
        throw wrappedError(
          err,
          eatSymbols`Rich Presence Lookup ${name} got invalid defaultAt: ${err.message}`,
        )
      }

      if (doesntHaveMeasuredTrail(conditions[0])) {
        throw new Error(
          eatSymbols`Rich Presence Lookup ${name} got invalid input: must have at least one condition with Measured flag, but got ${defaultAt}`,
        )
      }

      parsedDefaultAt = `@${name}(${defaultAt})`
    } else if (defaultAt instanceof Condition || defaultAt instanceof ConditionBuilder) {
      if (doesntHaveMeasuredTrail(defaultAt)) {
        throw new Error(
          eatSymbols`Rich Presence Lookup ${name} got invalid defaultAt: must have at least one condition with Measured flag, but got ${defaultAt}`,
        )
      }

      parsedDefaultAt = `@${name}(${shortenMaybe(defaultAt)})`
    } else {
      throw new Error(
        eatSymbols`Rich Presence Lookup ${name} defaultAt expected to be a string, Condition or ConditionBuilder, but got ${defaultAt}`,
      )
    }
  }

  let finalValues = values
  if (compressRanges) {
    const valueRanges = entries.reduce((prev, [key, value]) => {
      if (!prev[value]) {
        prev[value] = []
      }

      prev[value].push(key)
      return prev
    }, {}) as Record<string, string[]>

    finalValues = Object.entries(valueRanges).reduce((prev, [value, keys]) => {
      const { notNumbers, formattedRanges } = compressRange(keys)
      if (formattedRanges) {
        prev[formattedRanges] = value
      }

      for (const bad of notNumbers) {
        prev[bad] = value
      }

      return prev
    }, {})
  }

  return {
    [richLookup]: true,

    /** Name of this Rich Presence Lookup */
    name,

    /**
     * Returns string representation of Rich Presence Lookup definition
     *
     * @param {RichPresence.LookupKeyFormat} keyFormat defines how to format Lookup keys, defaults to `'dec'`
     *
     * @example
     * import { RichPresence } from '@cruncheevos/core'
     * const format = RichPresence.format({ name: 'Score', type: 'VALUE' })
     * lookup.toString() // `Lookup:Car\n0x1=First!\n0x2=Second!\n0x4-0x5=Same'
     */
    toString(keyFormat: RichPresence.LookupKeyFormat = 'dec') {
      let rich = `Lookup:${name}`
      for (const inputKey in finalValues) {
        let key = inputKey
        if (key !== '*' && keyFormat.startsWith('hex')) {
          key = key.replace(/\d+/g, num =>
            formatNumberAsHex(Number(num), keyFormat !== 'hex-lowercase'),
          )
        }

        rich += `\n${key}=${finalValues[inputKey]}`
      }

      return rich
    },
    at: function at(input: string | Condition | ConditionBuilder) {
      if (input === undefined) {
        if (parsedDefaultAt) {
          return parsedDefaultAt
        }

        throw new Error(`Rich Presence Lookup ${name} got no input, neither defaultAt specified`)
      }

      if (typeof input === 'string') {
        try {
          var conditions = normalizedConditionGroupSetFromString(input, {
            considerLegacyValueFormat: true,
          })
        } catch (err) {
          throw wrappedError(
            err,
            eatSymbols`Rich Presence Lookup ${name} got error when parsing input: ${err.message}`,
          )
        }

        if (doesntHaveMeasuredTrail(conditions[0])) {
          throw new Error(
            eatSymbols`Rich Presence Lookup ${name} got invalid input: must have at least one condition with Measured flag, but got ${input}`,
          )
        }

        return `@${name}(${input})`
      } else if (input instanceof Condition || input instanceof ConditionBuilder) {
        if (doesntHaveMeasuredTrail(input)) {
          throw new Error(
            eatSymbols`Rich Presence Lookup ${name} got invalid input: must have at least one condition with Measured flag, but got ${input}`,
          )
        }

        return `@${name}(${shortenMaybe(input)})`
      } else {
        throw new Error(eatSymbols`Rich Presence Lookup ${name} got invalid input: ${input}`)
      }
    } as {
      /**
       * Returns string representation of Lookup call
       *
       * If there's only one condition - output may be shortened.
       *
       * When passing Condition or ConditionBuilder - you must have
       * at least one condition marked as Measured.
       *
       * Legacy value format is only supported by passing a string.
       *
       * @example
       * import { define as $, RichPresence } from '@cruncheevos/core'
       *
       * const lookup = RichPresence.lookup({ name: 'Car', values: { ... } })
       * lookup.at('0xcafe_v1') // '@Car(0xcafe_v1)'
       * lookup.at($(['Measured', 'Mem', 'Float', 0xCAFE])) // '@Car(fFcafe)'
       */
      (conditionInput: string | Condition | ConditionBuilder): string

      /**
       * Returns string representation of Lookup call with previously set `defaultAt` property
       *
       * If there's only one condition - output may be shortened.
       *
       * If `defaultAt` is Condition or ConditionBuilder - it must have
       * at least one condition marked as Measured.
       *
       * Legacy value format is only supported by setting `defaultAt` as string.
       *
       * @example
       * import { RichPresence } from '@cruncheevos/core'
       *
       * const lookup = RichPresence.lookup({ name: 'Car', defaultAt: '0xCAFE', values: { ... } })
       * lookup.at() // '@Car(0xCAFE)'
       */
      (): string
    },
  }
}

/**
 * Provides declarative API to produce Rich Presence string
 *
 * @example
 * import { define as $, RichPresence } from '@cruncheevos/core'
 *
 * RichPresence({
 *   lookupDefaultParameters: { keyFormat: 'hex', compressRanges: true },
 *   // Wraps calls to RichPresence.format
 *   format: {
 *     Score: 'VALUE',
 *   },
 *   // Wraps calls to RichPresence.lookup
 *   lookup: {
 *     Song: {
 *       // No need to specify name, it's taken from object
 *       values: {
 *         '*': 'Unknown value',
 *         1: 'Same value',
 *         2: 'Same value',
 *         3: 'Same value',
 *       },
 *       // overrides lookupDefaultParameters.keyFormat
 *       keyFormat: 'dec',
 *       defaultAt: 0x100,
 *     },
 *     Mode: {
 *       values: {
 *         1: 'Mode 1',
 *         2: 'Mode 2',
 *       },
 *       // overrides lookupDefaultParameters.compressRanges
 *       compressRanges: false
 *     },
 *   },
 *   // Callback function that must return an array of display strings.
 *   // All the previously specified Lookups and Formats are provided
 *   // through `lookup` and `format` objects respectively,
 *   // along with the `tag` function to inject lookups into display strings.
 *   displays: ({ lookup, format, macro, tag }) => [
 *     [
 *       $(['', 'Mem', '16bit', 0xcafe, '=', 'Value', '', 1]),
 *
 *       // Passing lookup.Song to this tagged template literal function causes
 *       // `lookup.Song.at()` call with previosly set `defaultAt` value
 *       tag`Cafe at value 1, Song: ${lookup.Song}, Mode: ${lookup.Mode.at(0x990)}`,
 *     ],
 *
 *     ['0xCAFE=2', tag`Cafe at value 2, format example: ${format.Score.at(0x600)}`],
 *
 *     // `macro` is an object providing several pre-existing Formats
 *     ['0xCAFE=3', tag`Default macro test ${macro.Score.at('0xfeed')}`],
 *     'Playing a good game',
 *   ],
 *  })
 *
 *  `Format:Score
 *  FormatType=VALUE
 *
 *  Lookup:Song
 *  1-3=Same value
 *  *=Unknown value
 *
 *  Lookup:Mode
 *  0x1=Mode 1
 *  0x2=Mode 2
 *
 *  Display:
 *  ?0x cafe=1?Cafe at value 1, Song: ＠Song(0x100), Mode: ＠Mode(0x990)
 *  ?0xCAFE=2?Cafe at value 2, format example: ＠Score(0x600)
 *  ?0xCAFE=3?Default macro test @Score(0xfeed)
 *  Playing a good game`
 */
export const RichPresence = <
  L extends Record<
    string,
    {
      values: RichPresence.LookupParams['values']
      keyFormat?: RichPresence.LookupKeyFormat
      defaultAt?: RichPresence.LookupParams['defaultAt']
      compressRanges?: RichPresence.LookupParams['compressRanges']
    }
  >,
  F extends Record<string, RichPresence.Format>,
>(
  params: RichPresence.Params<L, F>,
) => {
  const { format = {} as F, lookup = {} as L, lookupDefaultParameters = {} } = params

  const mappedFormat = Object.keys(format).reduce((prev, key) => {
    prev[key] = makeRichPresenceFormat({
      name: key,
      type: format[key],
    })

    return prev
  }, {}) as {
    [x in keyof F]: ReturnType<typeof makeRichPresenceFormat>
  }

  const mappedLookup = Object.keys(lookup).reduce((prev, key) => {
    prev[key] = makeRichPresenceLookup({
      compressRanges: lookupDefaultParameters.compressRanges,
      ...lookup[key],
      name: key,
    })
    return prev
  }, {}) as {
    [x in keyof L]: ReturnType<typeof makeRichPresenceLookup>
  }

  const displays = params.displays({
    lookup: mappedLookup,
    format: mappedFormat,
    tag: taggedDisplayString,
    macro: RichPresence.macro,
  })

  if (displays.length === 0) {
    throw new Error(`Rich Presence displays must return at least one display string`)
  }

  const mappedDisplays = displays.map((display, i) => {
    if (typeof display === 'string') {
      return display
    }

    if (Array.isArray(display)) {
      if (display.length !== 2) {
        throw new Error(
          `Rich Presence displays[${i}] must be either a string or an array with two strings`,
        )
      }

      return makeRichPresenceDisplay(display[0], display[1])
    }

    throw new Error(
      `Rich Presence displays[${i}] must be either a string or an array with two strings`,
    )
  })

  return {
    lookup: mappedLookup,
    format: mappedFormat,
    displayStrings: mappedDisplays,
    macro: RichPresence.macro,
    toString() {
      return (
        [
          Object.values(mappedFormat).join('\n\n'),
          Object.values(mappedLookup)
            .map(l => l.toString(lookup[l.name].keyFormat || lookupDefaultParameters.keyFormat))
            .join('\n\n'),
        ]
          .join('\n\n')
          .trim() +
        '\n\nDisplay:\n' +
        mappedDisplays.join('\n')
      )
    },
  }
}

/**
 * Returns a string representing Rich Presence Display line
 *
 * Does not check if provided arguments are of correct type
 *
 * @example
 * import { RichPresence } from '@cruncheevos/core'
 * RichPresence.display('0=1', 'Nothing is happening'))
 * // '?0=1?Nothing is happening'
 */
RichPresence.display = makeRichPresenceDisplay

/**
 * Creates an object representing Rich Presence Format
 *
 * @example
 * import { RichPresence } from '@cruncheevos/core'
 *
 * const format = RichPresence.format({
 *   name: 'Score',
 *   type: 'VALUE',
 * })
 *
 * format.at('0xCAFE_v1') // '@Score(0xCAFE_v1)'
 * format.at($(['Measured', 'Mem', '16bit', 0xCAFE])) // '@Score(0xcafe)'
 * format.toString() // 'Format:Score\nFormatType=VALUE'
 */
RichPresence.format = makeRichPresenceFormat

/**
 * Creates an object representing Rich Presence Lookup
 *
 * @example
 * import { RichPresence } from '@cruncheevos/core'
 *
 * const lookup = RichPresence.lookup({
 *   name: 'Car',
 *   keyFormat: 'hex',
 *   values: {
 *     1: 'First!',
 *     2: 'Second!',
 *     4: 'Same',
 *     5: 'Same',
 *   },
 *   defaultAt: 0xfeed,
 *   compressRanges: true
 * })
 *
 * lookup.at() // '@Car(0xfeed)'
 * lookup.at('0xCAFE_v1') // '@Score(0xCAFE_v1)'
 * lookup.at($(['Measured', 'Mem', 'Float', 0xCAFE])) // '@Car(fFcafe)'
 * lookup.toString() // `Lookup:Car\n0x1=First!\n0x2=Second!\n0x4-0x5=Same'
 */
RichPresence.lookup = makeRichPresenceLookup

/**
 * Tagged template literal function which can accept Rich Presence Lookup instances.
 * This allows for less noisy display strings.
 *
 * @example
 * import { RichPresence } from '@cruncheevos/core'
 *
 * const lookup = RichPresence.lookup({ name: 'Song', defaultAddress: 0xfeed, values: { ... } })
 *
 * RichPresence.tag`${lookup} - now playing` // '@Song(0xfeed) - now playing'
 */
RichPresence.tag = taggedDisplayString

/**
 * Provides an object containing default Rich Presence Macros
 *
 * @example
 * import { RichPresence } from '@cruncheevos/core'
 *
 * RichPresence.macro.Score.at('0xCAFE') // '@Score(0xCAFE)'
 * RichPresence.macro.ASCIIChar.at('0xCAFE') // '@ASCIIChar(0xCAFE)'
 */
RichPresence.macro = {
  Number: _makeRichPresenceFormat({ name: 'Number', type: 'VALUE' }),
  Unsigned: _makeRichPresenceFormat({ name: 'Unsigned', type: 'UNSIGNED' }),
  Score: _makeRichPresenceFormat({ name: 'Score', type: 'SCORE' }),
  Centiseconds: _makeRichPresenceFormat({ name: 'Centiseconds', type: 'MILLISECS' }),
  Seconds: _makeRichPresenceFormat({ name: 'Seconds', type: 'SECS' }),
  Minutes: _makeRichPresenceFormat({ name: 'Minutes', type: 'MINUTES' }),
  Fixed1: _makeRichPresenceFormat({ name: 'Fixed1', type: 'FIXED1' }),
  Fixed2: _makeRichPresenceFormat({ name: 'Fixed2', type: 'FIXED2' }),
  Fixed3: _makeRichPresenceFormat({ name: 'Fixed3', type: 'FIXED3' }),
  Float1: _makeRichPresenceFormat({ name: 'Float1', type: 'FLOAT1' }),
  Float2: _makeRichPresenceFormat({ name: 'Float2', type: 'FLOAT2' }),
  Float3: _makeRichPresenceFormat({ name: 'Float3', type: 'FLOAT3' }),
  Float4: _makeRichPresenceFormat({ name: 'Float4', type: 'FLOAT4' }),
  Float5: _makeRichPresenceFormat({ name: 'Float5', type: 'FLOAT5' }),
  Float6: _makeRichPresenceFormat({ name: 'Float6', type: 'FLOAT6' }),
  ASCIIChar: _makeRichPresenceFormat({ name: 'ASCIIChar', type: 'ASCIIChar' }),
  UnicodeChar: _makeRichPresenceFormat({ name: 'UnicodeChar', type: 'UnicodeChar' }),
}
