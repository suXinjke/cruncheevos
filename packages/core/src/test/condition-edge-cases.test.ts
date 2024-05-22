import { describe, expect, test } from 'vitest'
import { Condition } from '../index.js'

test('array lacking cmp and rvalue results in proper fallbacks', () => {
  const cond = new Condition(['AddAddress', 'Mem', '32bit', 0x404])

  expect(cond.cmp).toBe('')
  expect(cond.rvalue).toEqual({
    type: '',
    size: '',
    value: 0,
  })
  expect(cond.hits).toBe(0)
})

describe('passing negative values makes them underflow correctly', () => {
  test('as string', () => expect(new Condition('0=-2').rvalue.value).toBe(4294967294))
  test('as array', () =>
    expect(new Condition(['', 'Value', '', 0, '=', 'Value', '', -2]).rvalue.value).toBe(4294967294))
  test('as object', () =>
    expect(
      new Condition({
        flag: '',
        lvalue: {
          type: 'Value',
          size: '',
          value: 0,
        },
        cmp: '=',
        rvalue: {
          type: 'Value',
          size: '',
          value: -2,
        },
        hits: 0,
      }).rvalue.value,
    ).toBe(4294967294))
})

test('putting comparison operators on calculations suppresses the operator and rvalue', () => {
  for (const operator of [
    '=',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
  ] satisfies Condition.OperatorComparison[]) {
    expect(new Condition(`A:0xhfe24${operator}hcafe`)).toEqual({
      flag: 'AddSource',
      lvalue: {
        type: 'Mem',
        size: '8bit',
        value: 0xfe24,
      },
      cmp: '',
      rvalue: {
        type: '',
        size: '',
        value: 0,
      },
      hits: 0,
    })
  }
})
