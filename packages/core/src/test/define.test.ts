import { describe, test, expect } from 'vitest'
import { Condition, define, Achievement, Leaderboard, andNext, orNext } from '../index.js'

describe('define', () => {
  test('works as expected', () => {
    const result = define(
      '0xcafe>0xcafe',
      ['PauseIf', 'Mem', '8bit', 0x34444, '!=', 'Value', '', 0],
      '0=1',
      {
        flag: 'AndNext',
        lvalue: {
          type: 'Mem',
          size: '32bit',
          value: 0xcafe,
        },
        cmp: '>',
        rvalue: {
          type: 'Delta',
          size: '32bit',
          value: 0xcafe,
        },
        hits: 0,
      },
    )

    result.conditions.forEach(c => expect(c).toBeInstanceOf(Condition))
    expect(result.toString()).toMatchInlineSnapshot(
      `"0x cafe>0x cafe_P:0xH34444!=0_0=1_N:0xXcafe>d0xXcafe"`,
    )

    expect(define('0=1').toString()).toMatchInlineSnapshot('"0=1"')

    expect(
      define.one(['PauseIf', 'Mem', '32bit', 0xcafe, '=', 'Value', '', 47]).toString(),
    ).toMatchInlineSnapshot('"P:0xXcafe=47"')
  })

  test('conditional definitions', () => {
    function wrapper(opts: { ship?: number } = {}) {
      return define(
        opts.ship >= 0 && ['AndNext', 'Mem', '8bit', 0x41ff4, '=', 'Value', '', opts.ship],
        '' && ['', 'Mem', '32bit', 0x34a68, '=', 'Value', '', 132],
        null && ['', 'Mem', '32bit', 0x34a68, '=', 'Value', '', 132],
        ['', 'Mem', '32bit', 0x34a68, '=', 'Value', '', 132, 1],
      )
    }

    expect(define(wrapper()).toString()).toMatchInlineSnapshot('"0xX34a68=132.1."')

    expect(
      define(
        ...wrapper({
          ship: 1,
        }),
        false && ['', 'Mem', '32bit', 0x34a68, '=', 'Value', '', 132, 1],
      ).toString(),
    ).toMatchInlineSnapshot(`"N:0xH41ff4=1_0xX34a68=132.1."`)
  })

  test('withLast', () => {
    expect(
      define(
        ['AddAddress', 'Mem', '32bit', 0xcafe],
        ['AddAddress', 'Mem', '32bit', 0xbeef],
        ['', 'Mem', '32bit', 0, '=', 'Value', '', 120],
      )
        .withLast({ cmp: '!=', rvalue: { value: 9 } })
        .toString(),
    ).toMatchInlineSnapshot(`"I:0xXcafe_I:0xXbeef_0xX0!=9"`)
  })

  test(`AndNext and OrNext must not leave its flag in the final condition`, () => {
    expect(orNext('1=1', '2=2').toString()).toMatchInlineSnapshot(`"O:1=1_2=2"`)

    expect(andNext('1=1', '2=2').toString()).toMatchInlineSnapshot(`"N:1=1_2=2"`)

    expect(andNext('1=1', 'C:2=2').toString()).toMatchInlineSnapshot(`"N:1=1_C:2=2"`)

    expect(orNext('1=1', '2=2').also('3=3').toString()).toMatchInlineSnapshot(`"O:1=1_O:2=2_3=3"`)

    expect(
      orNext('1=1', '2=2')
        .also(false && '3=3')
        .toString(),
    ).toMatchInlineSnapshot(`"O:1=1_2=2"`)

    expect(
      orNext('1=1', '2=2')
        .also(false && '3=3')
        .also('4=4')
        .toString(),
    ).toMatchInlineSnapshot(`"O:1=1_O:2=2_4=4"`)

    expect(andNext('1=1', '2=2').also('3=3').toString()).toMatchInlineSnapshot(`"N:1=1_N:2=2_3=3"`)

    expect(
      orNext('1=1').andNext('2=2', '3=3').addHits('once', '8=8').also('hits 3', '9=9').toString(),
    ).toMatchInlineSnapshot(`"O:1=1_N:2=2_N:3=3_C:8=8.1._9=9.3."`)

    expect(
      andNext('1=1').orNext('2=2', '3=3').addHits('8=8').also('9=9').toString(),
    ).toMatchInlineSnapshot(`"N:1=1_O:2=2_O:3=3_C:8=8_9=9"`)

    expect(
      define('1=1').orNext('2=2', '3=3').andNext('8=8', '9=9').toString(),
    ).toMatchInlineSnapshot(`"1=1_O:2=2_O:3=3_N:8=8_9=9"`)
  })

  test('empty define calls must actually be treated as such', () => {
    expect(orNext('1=0', '1=0', define()).toString()).toMatchInlineSnapshot(`"O:1=0_1=0"`)
    expect(andNext('1=0', '1=0', define()).toString()).toMatchInlineSnapshot(`"N:1=0_1=0"`)
    expect(andNext('1=0', '1=0', define(false && '1=0')).toString()).toMatchInlineSnapshot(
      `"N:1=0_1=0"`,
    )
  })

  describe('allow to put define into achievement conditions', () => {
    test('as core implicitly', () => {
      const ach = new Achievement({
        id: 1,
        title: 'Achievement',
        description: 'Description',
        points: 1,
        conditions: define('0xcafe>0xcafe', '0=1'),
      })
      expect(ach.toString('conditions')).toMatchInlineSnapshot('"0x cafe>0x cafe_0=1"')
    })

    test('as core explicitly', () => {
      const ach = new Achievement({
        id: 1,
        title: 'Achievement',
        description: 'Description',
        points: 1,
        conditions: {
          core: define('0xcafe>0xcafe', '0=1'),
        },
      })
      expect(ach.toString('conditions')).toMatchInlineSnapshot('"0x cafe>0x cafe_0=1"')
    })
  })

  describe('allow to put define into leaderboard conditions', () => {
    test('as start.core implicitly', () => {
      const lb = new Leaderboard({
        id: 1,
        title: 'Leaderboard',
        description: 'Description',
        lowerIsBetter: false,
        type: 'VALUE',
        conditions: {
          start: define('0xcafe>0xcafe', '0=1'),
          cancel: ['2=3', define('0=1')],
          submit: '0=1',
          value: '0xfeed',
        },
      })
      expect(lb.toString('conditions')).toMatchInlineSnapshot(
        `""0x cafe>0x cafe_0=1":"2=3_0=1":"0=1":"M:0x feed""`,
      )
    })

    test('as start.core explicitly', () => {
      const lb = new Leaderboard({
        id: 1,
        title: 'Leaderboard',
        description: 'Description',
        lowerIsBetter: false,
        type: 'VALUE',
        conditions: {
          start: {
            core: define('0xcafe>0xcafe', '0=1'),
          },
          cancel: ['2=3', define('0=1')],
          submit: '0=1',
          value: '0xfeed',
        },
      })
      expect(lb.toString('conditions')).toMatchInlineSnapshot(
        `""0x cafe>0x cafe_0=1":"2=3_0=1":"0=1":"M:0x feed""`,
      )
    })
  })

  test('works with JSON.stringify', () => {
    const conditions = andNext('1=1', '2=2').also('3=3')
    const myObj = {
      title: 'peepy',
      conditions,
    }

    const stringified = JSON.stringify(myObj)
    expect(stringified).toMatchInlineSnapshot(`"{"title":"peepy","conditions":"N:1=1_N:2=2_3=3"}"`)
  })

  test('define.one throws if you pass more than one condition', () => {
    expect(() =>
      define.one(
        ['', 'Value', '', 0, '=', 'Value', '', 1],

        // @ts-expect-error
        ['', 'Value', '', 0, '=', 'Value', '', 2],
        ['', 'Value', '', 0, '=', 'Value', '', 3],
      ),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: expected only one condition argument, but got 3]`)
  })
})
