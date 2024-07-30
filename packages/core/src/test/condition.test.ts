import { describe, expect, test } from 'vitest'
import { Condition } from '../index.js'
import { deepObjectCopy } from '../util.js'
import { twistedASCIICase } from './test-util.js'

function arrayInputBackAndForthTest({
  msg,
  raw,
  condition,
}: {
  msg: string
  raw: string
  condition: Condition.Array
}) {
  return [
    `${msg} [${raw}]`,
    () => {
      const c = new Condition(condition)
      const stringResult = c.toString()
      expect(stringResult).toBe(raw)
      expect(c.toArray()).toEqual(expect.arrayContaining(condition))
      expect(new Condition(stringResult).toString()).toBe(raw)
      expect(new Condition(twistedASCIICase(raw)).toString()).toBe(raw)
    },
  ] as const
}

function objectInputBackAndForthTest({
  msg,
  raw,
  condition,
}: {
  msg: string
  raw: string
  condition: Condition.Data
}) {
  return [
    `${msg} [${raw}]`,
    () => {
      const result = new Condition(condition).toString()
      expect(result).toBe(raw)

      const conditionFromString = new Condition(result)
      expect(conditionFromString.toString()).toBe(raw)
      expect(conditionFromString).toEqual(condition)
    },
  ] as const
}

function stringInputTest({
  msg,
  raw,
  condition,
}: {
  msg: string
  raw: string
  condition: Condition.Data
}) {
  return [
    `${msg} [${raw}]`,
    () => {
      expect(new Condition(raw)).toEqual(condition)
      expect(new Condition(twistedASCIICase(raw))).toEqual(condition)
    },
  ] as const
}

describe('Basic conditions, condition array into string into condition into string again matches expected string', () => {
  test(
    ...arrayInputBackAndForthTest({
      msg: 'Mem 32-bit = Value',
      raw: '0xX123=5',
      condition: ['', 'Mem', '32bit', 291, '=', 'Value', '', 5],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'ResetIf Mem Bit0 > Delta Bit1',
      raw: 'R:0xM47>d0xN47',
      condition: ['ResetIf', 'Mem', 'Bit0', 71, '>', 'Delta', 'Bit1', 71],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'PauseIf Mem Float > Float (22)',
      raw: 'P:fFfeedcafe>f1.0.22.',
      condition: ['PauseIf', 'Mem', 'Float', 4276996862, '>', 'Float', '', 1, 22],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'PauseIf Mem Float BE <= Float (4)',
      raw: 'P:fBfeedcafe>f-30.01.4.',
      condition: ['PauseIf', 'Mem', 'FloatBE', 0xfeedcafe, '>', 'Float', '', -30.01, 4],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'PauseIf Mem Double32 >= Float',
      raw: 'P:fHfeedcafe>f123.4',
      condition: ['PauseIf', 'Mem', 'Double32', 0xfeedcafe, '>', 'Float', '', 123.4],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'PauseIf Mem Double32BE <= Float (8)',
      raw: 'P:fIfeedcafe>f404.0.8.',
      condition: ['PauseIf', 'Mem', 'Double32BE', 0xfeedcafe, '>', 'Float', '', 404, 8],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'AndNext Mem Upper4 > Mem Lower4 (100)',
      raw: 'N:0xUfeedcafe>0xLfeedcafe.100.',
      condition: ['AndNext', 'Mem', 'Upper4', 4276996862, '>', 'Mem', 'Lower4', 4276996862, 100],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'OrNext Mem MBF32 = Mem MBF32LE',
      raw: 'O:fMfeedcafe=fLfeedcafe',
      condition: ['OrNext', 'Mem', 'MBF32', 4276996862, '=', 'Mem', 'MBF32LE', 4276996862],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'ResetNextIf Mem Bit2 <= Prior Bit3',
      raw: 'Z:0xO47<=p0xPcafe',
      condition: ['ResetNextIf', 'Mem', 'Bit2', 71, '<=', 'Prior', 'Bit3', 51966],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'AddHits Mem Bit4 > BCD Bit5',
      raw: 'C:0xQ8888>b0xRfeed',
      condition: ['AddHits', 'Mem', 'Bit4', 34952, '>', 'BCD', 'Bit5', 65261],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'SubHits Mem Bit6 >= Invert Bit7',
      raw: 'D:0xS1>=~0xT2',
      condition: ['SubHits', 'Mem', 'Bit6', 1, '>=', 'Invert', 'Bit7', 2],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'Trigger Mem BitCount != Mem Bitcount',
      raw: 'T:0xKfeedcafe!=0xKfeedcafe',
      condition: ['Trigger', 'Mem', 'BitCount', 4276996862, '!=', 'Mem', 'BitCount', 4276996862],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'Measured Mem 24-bit BE = Value',
      raw: 'M:0xJfeedcafe=5',
      condition: ['Measured', 'Mem', '24bitBE', 4276996862, '=', 'Value', '', 5],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'MeasuredIf Mem 32-bit BE = Delta 32-bit',
      raw: 'Q:0xXfeedcafe=d0xXfeedcafe',
      condition: ['MeasuredIf', 'Mem', '32bit', 4276996862, '=', 'Delta', '32bit', 4276996862],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'AddAddress Mem 24-bit',
      raw: 'I:0xWfeedcafe',
      condition: ['AddAddress', 'Mem', '24bit', 4276996862],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'AddSource Mem 8-bit',
      raw: 'A:0xHfeedcafe',
      condition: ['AddSource', 'Mem', '8bit', 4276996862],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'SubSource Mem 16-bit',
      raw: 'B:0x feedcafe',
      condition: ['SubSource', 'Mem', '16bit', 4276996862],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'AddSource Mem 16-bit BE * Value 47',
      raw: 'A:0xIfeedcafe*47',
      condition: ['AddSource', 'Mem', '16bitBE', 4276996862, '*', 'Value', '', 47],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'SubSource Mem 32-bit BE / Delta 32-bit BE',
      raw: 'B:0xGfeedcafe/d0xGfeedcafe',
      condition: ['SubSource', 'Mem', '32bitBE', 4276996862, '/', 'Delta', '32bitBE', 4276996862],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'AddSource Value 1 + Value 2',
      raw: 'A:1+2',
      condition: ['AddSource', 'Value', '', 1, '+', 'Value', '', 2],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'SubSource Value 2 - Value 1',
      raw: 'B:2-1',
      condition: ['SubSource', 'Value', '', 2, '-', 'Value', '', 1],
    }),
  )

  test(
    ...arrayInputBackAndForthTest({
      msg: 'AddSource Mem 32-bit % Value 2',
      raw: 'A:0xXcafe%2',
      condition: ['AddSource', 'Mem', '32bit', 0xcafe, '%', 'Value', '', 2],
    }),
  )
})

describe('Basic conditions, condition data into string into condition into string again matches expected string', () => {
  test(
    ...objectInputBackAndForthTest({
      msg: 'Mem 32-bit = Value',
      raw: '0xX123=5',
      condition: {
        flag: '',
        lvalue: {
          type: 'Mem',
          size: '32bit',
          value: 291,
        },
        cmp: '=',
        rvalue: {
          type: 'Value',
          size: '',
          value: 5,
        },
        hits: 0,
      },
    }),
  )

  test(
    ...objectInputBackAndForthTest({
      msg: 'ResetIf Mem Bit0 > Delta Bit1 (123)',
      raw: 'R:0xM47>d0xN47.123.',
      condition: {
        flag: 'ResetIf',
        lvalue: {
          type: 'Mem',
          size: 'Bit0',
          value: 71,
        },
        cmp: '>',
        rvalue: {
          type: 'Delta',
          size: 'Bit1',
          value: 71,
        },
        hits: 123,
      },
    }),
  )

  test(
    ...stringInputTest({
      msg: 'Mem 16-bit (without whitespace in raw code) = Value',
      raw: '0xfe10=768',
      condition: {
        flag: '',
        lvalue: {
          type: 'Mem',
          size: '16bit',
          value: 0xfe10,
        },
        cmp: '=',
        rvalue: {
          type: 'Value',
          size: '',
          value: 0x300,
        },
        hits: 0,
      },
    }),
  )

  test(
    ...stringInputTest({
      msg: 'Mem 16-bit (without whitespace in raw code) = Value (specified with h prefix)',
      raw: '0xfe10=hcAfE',
      condition: {
        flag: '',
        lvalue: {
          type: 'Mem',
          size: '16bit',
          value: 0xfe10,
        },
        cmp: '=',
        rvalue: {
          type: 'Value',
          size: '',
          value: 0xcafe,
        },
        hits: 0,
      },
    }),
  )

  test(
    ...stringInputTest({
      msg: 'Mem 16-bit (without whitespace in raw code) = Value (specified with h prefix, negative)',
      raw: '0xfe10=-h10',
      condition: {
        flag: '',
        lvalue: {
          type: 'Mem',
          size: '16bit',
          value: 0xfe10,
        },
        cmp: '=',
        rvalue: {
          type: 'Value',
          size: '',
          value: 0xfffffff0,
        },
        hits: 0,
      },
    }),
  )

  test(
    ...stringInputTest({
      msg: 'Mem 8-bit = Value (specified with h prefix)',
      raw: '0xhf601=h0c',
      condition: {
        flag: '',
        lvalue: {
          type: 'Mem',
          size: '8bit',
          value: 0xf601,
        },
        cmp: '=',
        rvalue: {
          type: 'Value',
          size: '',
          value: 0xc,
        },
        hits: 0,
      },
    }),
  )
})

describe('Exclusive string -> condition data conversions', () => {
  test(
    ...stringInputTest({
      msg: 'Value (negative) != Value (negative) (123)',
      raw: '-1!=-5.123.',
      condition: {
        flag: '',
        lvalue: {
          type: 'Value',
          size: '',
          value: 0xffffffff,
        },
        cmp: '!=',
        rvalue: {
          type: 'Value',
          size: '',
          value: 0xfffffffb,
        },
        hits: 123,
      },
    }),
  )

  test(
    ...stringInputTest({
      msg: 'Mem 32-bit (random char case) = Value',
      raw: '0xXCaFe=47',
      condition: {
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
      },
    }),
  )

  test(
    ...stringInputTest({
      msg: 'AddSource Mem 16-bit BE',
      raw: 'A:0xIfeedcafe',
      condition: {
        flag: 'AddSource',
        lvalue: {
          type: 'Mem',
          size: '16bitBE',
          value: 0xfeedcafe,
        },
        cmp: '',
        rvalue: {
          type: '',
          size: '',
          value: 0,
        },
        hits: 0,
      },
    }),
  )
})

test('move constructor', () => {
  const original = new Condition('0xcafe=0xfeed')
  const copy = new Condition(original)
  expect(original).toEqual(copy)
})

test('cannot mutate data within condition', () => {
  const def: Condition.Data = {
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
  }

  const c = new Condition(def)

  for (const assignment of [
    () => (c.flag = 'AndNext'),
    () => (c.lvalue.type = 'Delta'),
    () => (c.lvalue.size = '16bit'),
    () => (c.lvalue.value = 0xfeed),
    () => (c.lvalue = null),
    () => (c.cmp = '!='),
    () => (c.lvalue.type = 'Delta'),
    () => (c.lvalue.size = '16bit'),
    () => (c.lvalue.value = 0xfeed),
    () => (c.rvalue = null),
    () => (c.hits = 30),
  ]) {
    expect(assignment).toThrowError(/^Cannot assign to read only property/)
  }
})

test(`passing condition data definition and mutating it afterwards doesn't affect data within class instance`, () => {
  const original: Condition.Data = {
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
  }
  const def = deepObjectCopy(original)
  const c = new Condition(def)

  def.flag = 'AndNext'
  def.lvalue.type = 'Delta'
  def.cmp = '*'
  def.rvalue.value = 999
  def.hits = 30

  expect(c).not.toEqual(def)
  expect(c).toEqual(original)
})
