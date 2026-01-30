import { Condition } from './condition.js'
import { DeepPartial, stringToNumberLE } from './util.js'

type ConditionBuilderInput = Array<boolean | Condition.Input | ConditionBuilder>

type DefineFunction = ((...args: ConditionBuilderInput) => ConditionBuilder) & {
  /**
   * Same as calling `new Condition()`
   *
   * Can be useful if you need to reuse the condition but have it slightly different
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   *
   * const isNTSC = $.one(['', 'Mem', '24bit', 0x9e1e, '=', 'Value', '', 0x373030])
   * const notNTSC = isNTSC.with({ cmp: '!=' })
   */
  one: (arg: Condition.Input) => Condition

  /**
   * Allows to generate conditions for comparing strings
   *
   * The string is split into numeric chunks, little endian, up to 32bit,
   * which are provided to the supplied callback. The final result is also
   * wrapped with `andNext`
   *
   * Internally, TextEncoder is used and the input is treated as UTF-8
   *
   * If you need to treat input as UTF-16, currently you need to convert it to UTF-16 yourself
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   *
   * $.str(
   *   'abcde',
   *   (size, value) => $(
   *     ['AddAddress', 'Mem', '32bit', 0xcafe],
   *     ['AddAddress', 'Mem', '32bit', 0xfeed],
   *     ['', 'Mem', size, 0xabcd, '=', ...value],
   *   )
   * )
   * // "I:0xXcafe_I:0xXfeed_N:0xXabcd=1684234849_I:0xXcafe_I:0xXfeed_0xHabcd=101"
   * // abcd = 0x64636261 = 1684234849
   * //    e = 0x65       = 101
   */
  str: (
    input: string,
    callback: (s: Condition.Size, v: ['Value', '', number]) => ConditionBuilder,
  ) => ConditionBuilder
}

function makeBuilder(flag: Condition.Flag) {
  return function (...args: ConditionBuilderInput) {
    const builder = new ConditionBuilder()
    pushArgsToBuilder.call(builder, flag, ...args)
    return builder
  }
}

/**
 * Function providing versatile way to define conditions,
 * returns instance of ConditionBuilder class
 *
 * @example
 * import { define as $ } from '@cruncheevos/core'
 * let someParameter = false
 *
 * $(
 *  ['', 'Mem', '32bit', 0xCAFE, '=', 'Value', '', 1],
 *  '0=2'
 * ).trigger(
 *  '0=3',
 *  // condition below will not be included because
 *  // the expression evaluated to falsy value
 *  someParameter && '0=4',
 * ).toString() // 0xXcafe=1_0=2_T:0=3
 */
export const define = makeBuilder('') as DefineFunction
define.one = function (arg) {
  if (arguments.length > 1) {
    throw new Error('expected only one condition argument, but got ' + arguments.length)
  }
  return new Condition(arg)
}

define.str = function (
  input: string,
  cb: (s: Condition.Size, v: ['Value', '', number]) => ConditionBuilder,
) {
  return andNext(
    ...stringToNumberLE(input).map((value, index) => {
      let c = cb(
        // prettier-ignore
        value > 0xFFFFFF ? '32bit' :
        value > 0xFFFF ? '24bit' :
        value > 0xFF ? '16bit' :
        '8bit',

        ['Value', '', value],
      )
      if (index > 0) {
        return c.withLast({
          lvalue: { value: c.conditions[c.conditions.length - 1].lvalue.value + index * 4 },
        })
      }

      return c
    }),
  )
}

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with Trigger flag
 *
 * @example
 * import { trigger } from '@cruncheevos/core'
 * trigger('0=1', '0=2').toString() // T:0=1_T:0=2
 */
export const trigger = makeBuilder('Trigger')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with ResetIf flag
 *
 * @example
 * import { resetIf } from '@cruncheevos/core'
 * resetIf('0=1', '0=2').toString() // R:0=1_R:0=2
 */
export const resetIf = makeBuilder('ResetIf')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with PauseIf flag
 *
 * @example
 * import { pauseIf } from '@cruncheevos/core'
 * pauseIf('0=1', '0=2').toString() // P:0=1_P:0=2
 */
export const pauseIf = makeBuilder('PauseIf')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with AddHits flag
 *
 * @example
 * import { addHits } from '@cruncheevos/core'
 * addHits('0=1', '0=2').toString() // C:0=1_C:0=2
 */
export const addHits = makeBuilder('AddHits')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with SubHits flag
 *
 * @example
 * import { subHits } from '@cruncheevos/core'
 * subHits('0=1', '0=2').toString() // D:0=1_D:0=2
 */
export const subHits = makeBuilder('SubHits')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with Measured flag
 *
 * @example
 * import { measured } from '@cruncheevos/core'
 * measured('0=1', '0=2').toString() // M:0=1_M:0=2
 */
export const measured = makeBuilder('Measured')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with Measured% flag
 *
 * RAIntegration converts Measured flags to Measured% if *Track as %* checkbox is ticked
 *
 * @example
 * import { measuredPercent } from '@cruncheevos/core'
 * measuredPercent('0=1', '0=2').toString() // G:0=1_G:0=2
 */
export const measuredPercent = makeBuilder('Measured%')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with MeasuredIf flag
 *
 * @example
 * import { measuredIf } from '@cruncheevos/core'
 * measuredIf('0=1', '0=2').toString() // Q:0=1_Q:0=2
 */
export const measuredIf = makeBuilder('MeasuredIf')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with ResetNextIf flag
 *
 * @example
 * import { resetNextIf } from '@cruncheevos/core'
 * resetNextIf('0=1', '0=2').toString() // Z:0=1_Z:0=2
 */
export const resetNextIf = makeBuilder('ResetNextIf')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with AndNext flag
 *
 * The final condition will not have AndNext flag applied
 * unless it's followed by a chained method call, otherwise
 * codition will not work correctly that way
 *
 * @example
 * import { andNext } from '@cruncheevos/core'
 * andNext('0=1', '0=2').toString() // N:0=1_0=2
 * andNext('0=1', '0=2').also('0=3').toString() // N:0=1_N:0=2_0=3
 */
export const andNext = makeBuilder('AndNext')

/**
 * Same as {@link define}, but starts the condition chain
 * by wrapping the passed conditions with OrNext flag
 *
 * The final condition will not have OrNext flag applied
 * unless it's followed by a chained method call, otherwise
 * codition will not work correctly that way
 *
 * @example
 * import { orNext } from '@cruncheevos/core'
 * orNext('0=1', '0=2').toString() // O:0=1_0=2
 * orNext('0=1', '0=2').also('0=3').toString() // O:0=1_O:0=2_0=3
 */
export const orNext = makeBuilder('OrNext')

/**
 * Same as {@link define}, but sets 1 hit to the final
 * condition that was passed to the function
 *
 * @example
 * $('0=1').once(
 *   andNext('0=2', '0=3')
 * ).toString() // 0=1_N:0=2_0=3.1.
 */
export const once = (...args: ConditionBuilderInput) => new ConditionBuilder().also('once', ...args)

const lastCallTypes = new WeakMap<ConditionBuilder, Condition.Flag>()

export class ConditionBuilder {
  /**
   * Holds the conditions that were previously added
   * by calling the {@link define} function and class methods
   * @readonly
   */
  declare conditions: Condition[]

  constructor() {
    this.conditions = []
    lastCallTypes.set(this, '')
  }

  /**
   * Adds conditions wrapped with Trigger flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').trigger('0=2', '0=3').toString() // 0=1_T:0=2_T:0=3
   */
  trigger(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'Trigger', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with ResetIf flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').resetIf('0=2', '0=3').toString() // 0=1_R:0=2_R:0=3
   */
  resetIf(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'ResetIf', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with PauseIf flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').pauseIf('0=2', '0=3').toString() // 0=1_P:0=2_P:0=3
   */
  pauseIf(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'PauseIf', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with AddHits flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').addHits('0=2', '0=3').toString() // 0=1_C:0=2_C:0=3
   */
  addHits(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'AddHits', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with SubHits flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').subHits('0=2', '0=3').toString() // 0=1_D:0=2_D:0=3
   */
  subHits(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'SubHits', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with Measured flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').measured('0=2', '0=3').toString() // 0=1_M:0=2_M:0=3
   */
  measured(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'Measured', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with Measured% flag to the chain
   *
   * RAIntegration converts Measured flags to Measured% if *Track as %* checkbox is ticked
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').measuredPercent('0=2', '0=3').toString() // 0=1_G:0=2_G:0=3
   */
  measuredPercent(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'Measured%', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with Measured flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').measuredIf('0=2', '0=3').toString() // 0=1_Q:0=2_Q:0=3
   */
  measuredIf(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'MeasuredIf', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with ResetNextIf flag to the chain
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').resetNextIf('0=2', '0=3').toString() // 0=1_Z:0=2_Z:0=3
   */
  resetNextIf(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'ResetNextIf', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with AndNext flag to the chain
   *
   * The final condition in the chain will not have AndNext flag
   * applied, because the condition will not work correctly that way
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').andNext('0=2', '0=3').toString() // 0=1_N:0=2_0=3
   * $('0=1')
   *  .andNext('0=2', '0=3')
   *  .resetIf('0=4').toString() // 0=1_N:0=2_N:0=3_R:0=4
   */
  andNext(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'AndNext', ...args)
    return this
  }

  /**
   * Adds conditions wrapped with OrNext flag to the chain
   *
   * The final condition in the chain will not have OrNext flag
   * applied, because the condition will not work correctly that way
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1').orNext('0=2', '0=3').toString() // 0=1_O:0=2_0=3
   * $('0=1')
   *  .orNext('0=2', '0=3')
   *  .resetIf('0=4').toString() // 0=1_O:0=2_O:0=3_R:0=4
   */
  orNext(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, 'OrNext', ...args)
    return this
  }

  /**
   * Adds conditions to the chain as is
   *
   * @example
   * import { define as $, resetIf } from '@cruncheevos/core'
   * resetIf('0=1', '0=2')
   *  .also('0=3')
   *  .toString() // R:0=1_R:0=2_0=3
   */
  also(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, '', ...args)
    return this
  }

  /**
   * Adds conditions as is with final condition set to have 1 hit
   *
   * @example
   * import { define as $ } from '@cruncheevos/core'
   * $('0=1')
   *  .once(
   *    andNext('0=2', '0=3')
   *  ).toString() // 0=1_N:0=2_0=3.1.
   */
  once(...args: ConditionBuilderInput) {
    pushArgsToBuilder.call(this, '', 'once', ...args)
    return this
  }

  *[Symbol.iterator]() {
    for (const piece of this.conditions) {
      yield piece
    }
  }

  /**
   * Returns new instance of ConditionBuilder with mapped conditions
   *
   * Accepts a callback function that acts similar to Array.prototype.map
   *
   * If any conditional condition was ignored, it will not appear in the callback
   *
   * @example
   * $('0=1', false && '0=2', '0=3')
   *  .map((c, i) => c.with({ hits: i + 1 }))
   *  .toString() // 0=1.1._0=3.2.
   */
  map(cb: (c: Condition, idx: number, array: Condition[]) => Condition) {
    const mappedConditions = this.conditions.map(cb)
    return new ConditionBuilder().also(...mappedConditions)
  }

  /**
   * Returns new instance of ConditionBuilder with different
   * values merged into last condition
   *
   * `lvalue` and `rvalue` can be specified as partial array, which can be less verbose
   *
   * Useful when combined with pointer chains
   *
   * @param {Condition.PartialMergedData} data Condition.PartialMergedData
   *
   * @example
   * $(
   *   ['AddAddress', 'Mem', '32bit', 0xcafe],
   *   ['AddAddress', 'Mem', '32bit', 0xbeef],
   *   ['', 'Mem', '32bit', 0, '=', 'Value', '', 120],
   * ).withLast({ cmp: '!=', rvalue: { value: 9 } })
   *  .toString() // I:0xXcafe_I:0xXbeef_0xX0!=9
   *
   * $(
   *   ['AddAddress', 'Mem', '32bit', 0xcafe],
   *   ['AddAddress', 'Mem', '32bit', 0xbeef],
   *   ['', 'Mem', '32bit', 0, '=', 'Value', '', 120],
   * ).withLast({ cmp: '!=', rvalue: rvalue: ['Delta', '32bit', 0] })
   *  .toString() // I:0xXcafe_I:0xXbeef_0xX0!=d0xX0
   */
  withLast(data: Condition.PartialMergedData): ConditionBuilder {
    return this.map((c, idx, array) => {
      if (idx !== array.length - 1) {
        return c
      }

      return c.with(data)
    })
  }

  /**
   * Returns a string with raw condition code
   *
   * @example
   * $(
   *  ['AndNext', 'Mem', '32bit', 0xCAFE, '=', 'Value', '', 5],
   *  ['', 'Delta', '32bit', 0xCAFE, '=', 'Value', '', 4]
   * ).toString() // N:0xXcafe=5_d0xXcafe=4
   */
  toString() {
    return this.conditions.join('_')
  }

  /**
   * Same as {@link ConditionBuilder.prototype.toString toString()}
   *
   * @example
   * JSON.stringify({ conditions: $('0=1', '0=2') })
   * // {"conditions":"0=1_0=2"}
   */
  toJSON() {
    return this.toString()
  }
}

const whiteSpaceRegex = /\s+/
function pushArgsToBuilder(
  this: ConditionBuilder,
  flag: Condition.Flag,
  ...args: ConditionBuilderInput
) {
  let hits = 0

  const filteredArgs = args.filter((arg, i) => {
    if (typeof arg === 'string' && (arg === 'once' || arg.startsWith('hits'))) {
      if (i > 0) {
        throw new Error(`strings 'once' and 'hits %number%' must be placed before any conditions`)
      }

      if (arg === 'once') {
        hits = 1
      }

      if (arg.startsWith('hits')) {
        hits = parseInt(arg.split(whiteSpaceRegex)[1])
      }

      return false
    }

    if (arg instanceof ConditionBuilder && arg.conditions.length === 0) {
      return false
    }

    return Boolean(arg)
  }) as Array<Condition.Input | ConditionBuilder>

  if (filteredArgs.length === 0) {
    return
  }

  const lastCallType = lastCallTypes.get(this)
  if (lastCallType === 'AndNext' || lastCallType === 'OrNext') {
    const lastCondition = this.conditions[this.conditions.length - 1]
    if (lastCondition.flag === '') {
      this.conditions[this.conditions.length - 1] = lastCondition.with({
        flag: lastCallType,
      })
    }
  }

  for (let i = 0; i < filteredArgs.length; i++) {
    const variantArg = filteredArgs[i]

    if (variantArg instanceof ConditionBuilder) {
      filteredArgs.splice(i, 1, ...variantArg)
      i--
      continue
    }

    let arg = new Condition(variantArg)

    const isLastArgument = i === filteredArgs.length - 1
    const settingOperatorOnFinalCondition =
      isLastArgument && (flag === 'AndNext' || flag === 'OrNext')

    if (isLastArgument && hits > 0) {
      arg = arg.with({ hits })
    }

    if (flag && arg.flag === '' && settingOperatorOnFinalCondition === false) {
      arg = arg.with({ flag })
    }

    this.conditions.push(arg)
  }

  lastCallTypes.set(this, flag)
}
