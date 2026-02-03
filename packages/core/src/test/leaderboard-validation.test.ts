import { describe, expect, test } from 'vitest'
import { Leaderboard } from '../index.js'
import { eatSymbols } from '../util.js'
import { giveValuesNotMatching } from './test-util.js'

const leaderboardTypes = [
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
] as const

const allowedLeaderboardConditions = ['start', 'cancel', 'submit', 'value'] as const

describe('Leaderboard validations', () => {
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

  describe('toString', () => {
    describe('id', () => {
      giveValuesNotMatching('number', t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Leaderboard({
                ...def,
                id: typeof t.value === 'string' ? 'L' + t.value : t.value,
              }),
          ).toThrowError(
            t.type === 'type-check'
              ? eatSymbols`expected id as unsigned integer, but got ${t.value}`
              : /^expected id to be within the range/,
          )
        })
      })
    })

    describe('setId', () => {
      giveValuesNotMatching(['number', 'undefined'], t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Leaderboard({
                ...def,
                setId: t.value,
              }),
          ).toThrowError(
            t.type === 'type-check'
              ? eatSymbols`expected setId as unsigned integer, but got ${t.value}`
              : /^expected setId to be within the range/,
          )
        })
      })
    })

    describe('title', () => {
      giveValuesNotMatching(['string'], t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Leaderboard({
                ...def,
                title: t.value,
              }),
          ).toThrowError(`expected title as non-empty string, but got ` + eatSymbols`${t.value}`)
        })
      })
    })

    describe('description', () => {
      giveValuesNotMatching(['string', 'undefined', 'null'], t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Leaderboard({
                ...def,
                description: t.value,
              }),
          ).toThrowError(`expected description as string, but got ` + eatSymbols`${t.value}`)
        })
      })

      test('null, undefined, empty strings are allowed', () => {
        for (const value of ['', null, undefined]) {
          const lb = new Leaderboard({ ...def, description: value })
          expect(lb.description).toBe('')
        }
      })
    })

    describe('lowerIsBetter', () => {
      giveValuesNotMatching(['boolean', 'string'], t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Leaderboard({
                ...def,
                lowerIsBetter: t.value,
              }),
          ).toThrowError(
            eatSymbols`expected lowerIsBetter as boolean or string, but got ${t.value}`,
          )
        })
      })
    })

    describe('type', () => {
      giveValuesNotMatching(['string'], t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Leaderboard({
                ...def,
                type: t.value,
              }),
          ).toThrowError(
            `expected type to be one of: [${leaderboardTypes.join(', ')}], but got ` +
              eatSymbols`${t.value}`,
          )
        })
      })
    })

    describe('conditions', () => {
      giveValuesNotMatching(['object', 'string'], t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Leaderboard({
                ...def,
                conditions: t.value,
              }),
          ).toThrowError(eatSymbols`expected conditions to be an object, but got ${t.value}`)
        })
      })

      test('cannot have unexpected properties', () =>
        expect(
          () =>
            new Leaderboard({
              ...def,

              conditions: {
                ...(def.conditions as Leaderboard.InputConditions),
                baobab: [],
              } as any,
            }),
        ).toThrowError(
          `expected leaderboard condition group name to be one of: [${allowedLeaderboardConditions.join(
            ', ',
          )}], but got "baobab"`,
        ))

      test('cannot have bare and calculating Measured conditions in groups other than Value', () => {
        expect(
          () => new Leaderboard('L111000001:"M:0xH4":"0=1":"0=1":"M:0xXfeed":SCORE:Name:Desc:0'),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Error: Start, Core, condition 1: cannot have Measured condition without rvalue specified]`,
        )

        expect(
          () => new Leaderboard('L111000001:"0=1":"M:0xH4":"0=1":"M:0xXfeed":SCORE:Name:Desc:0'),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Error: Cancel, Core, condition 1: cannot have Measured condition without rvalue specified]`,
        )

        expect(
          () => new Leaderboard('L111000001:"0=1":"0=1":"M:0xH4":"M:0xXfeed":SCORE:Name:Desc:0'),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Error: Submit, Core, condition 1: cannot have Measured condition without rvalue specified]`,
        )

        expect(
          () => new Leaderboard('L111000001:"M:0xH4*3":"0=1":"0=1":"M:0xXfeed":SCORE:Name:Desc:0'),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Error: Start, Core, condition 1: expected comparison operator (= != < <= > >=), but got "*"]`,
        )

        expect(
          () => new Leaderboard('L111000001:"0=1":"M:0xH4/3":"0=1":"M:0xXfeed":SCORE:Name:Desc:0'),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Error: Cancel, Core, condition 1: expected comparison operator (= != < <= > >=), but got "/"]`,
        )

        expect(
          () => new Leaderboard('L111000001:"0=1":"0=1":"M:0xH4&3":"M:0xXfeed":SCORE:Name:Desc:0'),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Error: Submit, Core, condition 1: expected comparison operator (= != < <= > >=), but got "&"]`,
        )
      })
    })
  })

  // Only tests specific to Leaderboard, assuming
  // most of the CSV parse tests are done within achievement-validation.test.ts
  describe('malformed fromString', () => {
    describe('id', () => {
      test('lack of L', () =>
        expect(
          () => new Leaderboard('111000001:"0=1":"0=1":"0=1":"M:0xXfeed":SCORE:Name:Description:0'),
        ).toThrowError(`expected id to start with L, but got "111000001"`))

      test('lowercase L', () =>
        expect(
          () =>
            new Leaderboard('l111000001:"0=1":"0=1":"0=1":"M:0xXfeed":SCORE:Name:Description:0'),
        ).toThrowError(`expected id to start with L, but got "l111000001"`))

      test('just L', () =>
        expect(
          () => new Leaderboard('L:"0=1":"0=1":"0=1":"M:0xXfeed":SCORE:Name:Description:0'),
        ).toThrowError(`expected id as unsigned integer, but got ""`))

      test('some garbage instead of L', () =>
        expect(
          () =>
            new Leaderboard(
              'pacman111000001:"0=1":"0=1":"0=1":"M:0xXfeed":SCORE:Name:Description:0',
            ),
        ).toThrowError(`expected id to start with L, but got "pacman111000001"`))
    })

    test('forgot something', () =>
      expect(
        () =>
          new Leaderboard('pacman111000001:"0=1":"0=1":"0=1":"M:0xXfeed":SCORE:Name:Description'),
      ).toThrowError(
        `got an unexpected amount of data when parsing raw leaderboard string, either there's not enough data or it's not escaped/quoted correctly`,
      ))
  })

  describe('invalid value condition group as string', () => {
    describe('passing S instead of $', () => {
      test('as string', () => {
        expect(
          () =>
            new Leaderboard(
              'L111000001:"0=1":"0=1":"0=1":"M:0xXb04SM:0xXcafe":SCORE:Name:Description:0',
            ),
        ).toThrowError('Core, condition 1: expected an operator, but got "SM:0xX"')
      })

      test('as object', () => {
        expect(
          () =>
            new Leaderboard({
              ...def,
              conditions: {
                start: '0=1',
                cancel: '0=1',
                submit: '0=1',
                value: 'M:0xXb04SM:0xXcafe',
              },
            }),
        ).toThrowError('Core, condition 1: expected an operator, but got "SM:0xX"')
      })
    })

    test('mixed legacy value format with regular one', () => {
      expect(
        () =>
          new Leaderboard(
            'L111000001:"0=1":"0=1":"0=1":"0xH1_M:0xH4*3$0xH2*0xL3":SCORE:Name:Description:0',
          ),
      ).toThrowError('Core, condition 1: expected comparison operator (= != < <= > >=), but got ""')
    })
  })

  test('does not allow Measured%', () => {
    expect(
      () =>
        new Leaderboard({
          ...def,
          conditions: {
            start: '0=1',
            cancel: '0=1',
            submit: '0=1',
            value: 'G:0xXb04=0',
          },
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Value, Core, condition 1: Measured% conditions are not allowed in leaderboards]`,
    )
  })

  describe('passing garbage to constructor', () => {
    giveValuesNotMatching(['object', 'string'], t => {
      test(t.assertion, () =>
        expect(() => new Leaderboard(t.value as any)).toThrowError(
          eatSymbols`leaderboard data must be an object or string with leaderboard code, but got ${t.value}`,
        ),
      )
    })

    test('cannot accept another Achievement instance', () => {
      expect(() => new Leaderboard(new Leaderboard(def) as any)).toThrowError(
        `leaderboard data must be an object or string with leaderboard code, but got another Leaderboard instance`,
      )
    })
  })
})
