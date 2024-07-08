import { describe, expect, test } from 'vitest'
import { Leaderboard, define as $ } from '../index.js'
import { Condition, normalizedConditionGroupSetFromString } from '../condition.js'
import { deepObjectCopy } from '../util.js'

function checkie(str: string, def: Leaderboard.InputObject) {
  const result = new Leaderboard(def).toString()

  expect(result).toBe(str)
  expect(new Leaderboard(result).toString()).toBe(result)
}

describe('Leaderboards', () => {
  const def: Leaderboard.InputObject = {
    id: 111000001,
    title: 'Name',
    description: 'Description',
    lowerIsBetter: false,
    type: 'SCORE',
    conditions: {
      start: [
        ['', 'Mem', '8bit', 0xcafe, '=', 'Value', '', 47],
        ['', 'Delta', '8bit', 0xcafe, '=', 'Value', '', 0],
      ],
      cancel: '0=1',
      submit: [['', 'Mem', '8bit', 0xcafe, '=', 'Value', '', 48]],
      value: [['Measured', 'Mem', '32bit', 0xfeed]],
    },
  }

  describe('Quoting / Escaping in raw definitions', () => {
    describe('name', () => {
      test('double quote', () =>
        checkie(
          'L111000001:"0xHcafe=47_d0xHcafe=0":"0=1":"0xHcafe=48":"M:0xXfeed":SCORE:"Na\\"me":Description:0',
          {
            ...def,
            title: 'Na"me',
          },
        ))

      test('delimiter', () =>
        checkie(
          'L111000001:"0xHcafe=47_d0xHcafe=0":"0=1":"0xHcafe=48":"M:0xXfeed":SCORE:"Na:me":Description:0',
          {
            ...def,
            title: 'Na:me',
          },
        ))

      test('double quote + delimiter', () =>
        checkie(
          'L111000001:"0xHcafe=47_d0xHcafe=0":"0=1":"0xHcafe=48":"M:0xXfeed":SCORE:"Na:m\\"e":Description:0',
          {
            ...def,
            title: 'Na:m"e',
          },
        ))
    })

    describe('description', () => {
      test('double quote', () =>
        checkie(
          'L111000001:"0xHcafe=47_d0xHcafe=0":"0=1":"0xHcafe=48":"M:0xXfeed":SCORE:Name:"Descri\\"ption":0',
          {
            ...def,
            description: 'Descri"ption',
          },
        ))

      test('delimiter', () =>
        checkie(
          'L111000001:"0xHcafe=47_d0xHcafe=0":"0=1":"0xHcafe=48":"M:0xXfeed":SCORE:Name:"Descri:ption":0',
          {
            ...def,
            description: 'Descri:ption',
          },
        ))

      test('double quote + delimiter', () =>
        checkie(
          'L111000001:"0xHcafe=47_d0xHcafe=0":"0=1":"0xHcafe=48":"M:0xXfeed":SCORE:Name:"Descri:pt\\"ion":0',
          {
            ...def,
            description: 'Descri:pt"ion',
          },
        ))
    })
  })

  test('passing conditions as string', () => {
    const conditions = {
      start: '0xfe10=h0000_0xhf601=h0c_d0xhf601!=h0c_0xH00ffe0=0_0xH00ffe3=0',
      cancel: '0xhfe13<d0xhfe13',
      submit: '0xh00d5c1=h3a_A:0xhfe24=0_A:0xhfe25=0_0xhfe22!=0',
      value: 'A:0xXb00_A:0xXb04_M:0xXb04$M:0xXcafe',
    }

    const lb = new Leaderboard({
      ...def,
      conditions: `STA:${conditions.start}::CAN:${conditions.cancel}::SUB:${conditions.submit}::VAL:${conditions.value}`,
    })

    expect(normalizedConditionGroupSetFromString(conditions.start)).toEqual(lb.conditions.start)

    expect(normalizedConditionGroupSetFromString(conditions.cancel)).toEqual(lb.conditions.cancel)

    expect(normalizedConditionGroupSetFromString(conditions.submit)).toEqual(lb.conditions.submit)

    expect(
      normalizedConditionGroupSetFromString(conditions.value, {
        considerLegacyValueFormat: true,
      }),
    ).toEqual(lb.conditions.value)
  })

  test('passing conditions as string, value is multiplied by float', () => {
    const lb = new Leaderboard({
      ...def,
      conditions: `STA:0=1::CAN:0=1::SUB:1=1::VAL:0xX1d5e90*0.1`,
    })

    expect(lb.conditions.value[0].toString()).toMatchInlineSnapshot(`"M:0xX1d5e90*f0.1"`)
  })

  describe('passing legacy value conditions', () => {
    const expectedResult = [
      [
        {
          flag: 'AddSource',
          lvalue: {
            type: 'Mem',
            size: '8bit',
            value: 1,
          },
          cmp: '',
          rvalue: {
            size: '',
            type: '',
            value: 0,
          },
          hits: 0,
        },
        {
          flag: 'Measured',
          lvalue: {
            type: 'Mem',
            size: '8bit',
            value: 4,
          },
          cmp: '*',
          rvalue: {
            type: 'Value',
            size: '',
            value: 3,
          },
          hits: 0,
        },
      ],
      [
        {
          flag: 'Measured',
          lvalue: {
            type: 'Mem',
            size: '8bit',
            value: 2,
          },
          cmp: '*',
          rvalue: {
            type: 'Mem',
            size: 'Lower4',
            value: 3,
          },
          hits: 0,
        },
      ],
    ]

    test('as string', () => {
      const lb = new Leaderboard(
        'L111000001:"0=1":"0=1":"0=1":0xH1_0xH4*3$0xH2*0xL3:SCORE:NaMe:Description:0',
      )

      expect(lb.conditions.value).toEqual(expectedResult)
    })

    test('as object', () => {
      const lb = new Leaderboard({
        ...def,
        conditions: {
          start: '0=1',
          cancel: '0=1',
          submit: '0=1',
          value: '0xH1_0xH4*3$0xH2*0xL3',
        },
      })

      expect(lb.conditions.value).toEqual(expectedResult)
    })
  })

  test('automatically injects measured flag in the value group', () => {
    for (const value of [
      [
        ['', 'Value', '', 1, '=', 'Value', '', 1],
        ['', 'Value', '', 2, '=', 'Value', '', 2],
      ] as Condition.Group,
      $('1=1', '2=2'),
    ] as const) {
      const lb = new Leaderboard({
        id: 1,
        title: 'title',
        type: 'VALUE',
        lowerIsBetter: false,
        conditions: {
          start: '1=0',
          cancel: '1=0',
          submit: '1=0',
          value: {
            core: value,
            alt1: value,
          },
        },
      })

      const expectedValue1 = ['Measured', 'Value', '', 1, '=', 'Value', '', 1, 0]
      const expectedValue2 = ['', 'Value', '', 2, '=', 'Value', '', 2, 0]
      expect(lb.conditions.value[0][0].toArray()).toEqual(expectedValue1)
      expect(lb.conditions.value[0][1].toArray()).toEqual(expectedValue2)

      expect(lb.conditions.value[1][0].toArray()).toEqual(expectedValue1)
      expect(lb.conditions.value[1][1].toArray()).toEqual(expectedValue2)
      expect(new Leaderboard(lb.toString())).toEqual(lb)
    }
  })

  test('with different id', () => {
    const lb = new Leaderboard({
      ...def,
      id: 444,
      conditions: {
        start: '0=1',
        cancel: '0=1',
        submit: '0=1',
        value: '0xH1_0xH4*3$0xH2*0xL3',
      },
    })
    const newLb = lb.with({ id: 999 })
    expect(newLb.id).toBe(999)
    expect(newLb.conditions).toEqual(lb.conditions)
  })

  test('cannot mutate data within leaderboard', () => {
    const lb = new Leaderboard(def)
    for (const assignment of [
      () => (lb.title = 'aaaaaa'),
      () => (lb.description = 'aaaaaa'),
      () => (lb.id = 12345),
      () => (lb.type = 'MILLISECS'),
      () => (lb.lowerIsBetter = true),
      () => (lb.conditions = null),
      () => (lb.conditions.value = null),
      () => (lb.conditions.start = null),
      () => (lb.conditions.submit = null),
      () => (lb.conditions.cancel = null),
      () => (lb.conditions.value[0] = null),
      () => (lb.conditions.value[0][0] = null),
    ]) {
      expect(assignment).toThrowError(/^Cannot assign to read only property/)
    }
  })

  test(`passing leaderboard data definition and mutating it afterwards doesn't affect data within class instance`, () => {
    const original = { ...def }
    // HACK: the leaderboard class converts the conditions, they won't ever match when passed in toContain
    delete original.conditions
    const mutated: Leaderboard.InputObject = deepObjectCopy({
      ...original,
      conditions: {
        start: '1=1',
        cancel: '0=1',
        submit: '0=1',
        value: '0x cafe',
      },
    })
    const lb = new Leaderboard(mutated)

    mutated.title = 'aaaaaa'
    mutated.description = 'aaaaaa'
    mutated.id = 12345
    mutated.type = 'MILLISECS'
    mutated.lowerIsBetter = true

    expect(lb).not.toMatchObject(mutated)
    expect(lb).toMatchObject(original)
  })
})
