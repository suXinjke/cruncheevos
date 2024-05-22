import { describe, expect, test } from 'vitest'
import { Achievement, Condition } from '../index.js'
import { eatSymbols } from '../util.js'
import { giveValuesNotMatching } from './test-util.js'

const achievementTypes = ['missable', 'progression', 'win_condition'] as const

const def: Achievement.InputObject = {
  id: 111000001,
  title: 'Achievement:Name',
  description: 'AchievementDescription',
  author: 'cheeseburger',
  points: 25,
  badge: '12345',
  conditions: [
    ['', 'Mem', '8bit', 0x0, '=', 'Value', '', 47],
    ['', 'Mem', '32bit', 0xcafe, '=', 'Value', '', 0xfeed],
  ],
}

describe('Achievement validations', () => {
  describe('parsing', () => {
    describe('id', () => {
      giveValuesNotMatching('number', t => {
        test(t.assertion, () => {
          expect(() => new Achievement({ ...def, id: t.value })).toThrowError(
            t.type === 'type-check'
              ? eatSymbols`expected id as unsigned integer, but got ${t.value}`
              : /^expected id to be within the range/,
          )
        })
      })
    })

    describe('title', () => {
      giveValuesNotMatching(['string'], t => {
        test(t.assertion, () => {
          expect(() => new Achievement({ ...def, title: t.value })).toThrowError(
            `expected title as non-empty string, but got ` + eatSymbols`${t.value}`,
          )
        })
      })

      test('cannot be empty string', () => {
        expect(() => new Achievement({ ...def, title: '' })).toThrowError(
          `expected title as non-empty string, but got ""`,
        )
      })
    })

    describe('description', () => {
      giveValuesNotMatching(['string', 'null', 'undefined'], t => {
        test(t.assertion, () => {
          expect(() => new Achievement({ ...def, description: t.value })).toThrowError(
            `expected description as string, but got ` + eatSymbols`${t.value}`,
          )
        })
      })
    })

    describe('author', () => {
      giveValuesNotMatching(['string', 'undefined', 'null'], t => {
        test(t.assertion, () => {
          expect(() => new Achievement({ ...def, author: t.value })).toThrowError(
            `expected author as string, but got ` + eatSymbols`${t.value}`,
          )
        })
      })

      test('null, undefined, empty strings are allowed', () => {
        for (const value of ['', null, undefined]) {
          const ach = new Achievement({ ...def, author: value })
          expect(ach.author).toBe('cruncheevos')
        }
      })
    })

    describe('badge', () => {
      giveValuesNotMatching(['string', 'unsigned-integer', 'null', 'undefined'], t => {
        test(t.assertion, () => {
          expect(() => new Achievement({ ...def, badge: t.value })).toThrowError(
            t.type === 'range-check'
              ? `expected badge id to be within the range of 0x0 .. 0xFFFFFFFF, but got ` +
                  eatSymbols`${t.value}`
              : `expected badge as unsigned integer or filepath starting with local\\\\ and going strictly down, but got ` +
                  eatSymbols`${t.value}`,
          )
        })
      })

      test('null, undefined, are allowed', () => {
        for (const value of [null, undefined]) {
          const ach = new Achievement({ ...def, badge: value })
          expect(ach.badge).toBe('00000')
        }
      })
    })

    describe('points', () => {
      giveValuesNotMatching('unsigned-integer', t => {
        // TODO: Should I care?
        if (t.value === Number.MAX_SAFE_INTEGER) {
          return
        }

        test(t.assertion, () => {
          expect(() => new Achievement({ ...def, points: t.value })).toThrowError(
            eatSymbols`expected points value to be a positive integer, but got ${t.value}`,
          )
        })
      })
    })

    describe('type', () => {
      giveValuesNotMatching(['string', 'undefined'], t => {
        test(t.assertion, () => {
          expect(
            () =>
              new Achievement({
                ...def,
                type: t.value,
              }),
          ).toThrowError(
            `expected type to be one of: [${achievementTypes.join(', ')}], or empty string, or undefined, but got ` +
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
              new Achievement({
                ...def,
                conditions: t.value,
              }),
          ).toThrowError(
            eatSymbols`expected conditions as object, array of arrays or string, but got ${t.value}`,
          )
        })
      })

      test('cannot have garbage in array of conditions', () => {
        giveValuesNotMatching(['object', 'string'], t => {
          expect(
            () =>
              new Achievement({
                ...def,
                conditions: [t.value, ['', 'Mem', '16bit', 0x1234, '=', 'Value', '', 0x567]],
              }),
          ).toThrowError(
            eatSymbols`conditions[0]: condition data must be an array, object or string with condition code, but got ${t.value}`,
          )

          expect(
            () =>
              new Achievement({
                ...def,
                conditions: [['', 'Mem', '16bit', 0x1234, '=', 'Value', '', 0x567], t.value],
              }),
          ).toThrowError(
            eatSymbols`conditions[1]: condition data must be an array, object or string with condition code, but got ${t.value}`,
          )
        })
      })

      test('cannot have garbage as core condition group', () => {
        giveValuesNotMatching(['object', 'string'], t => {
          expect(
            () =>
              new Achievement({
                ...def,
                conditions: {
                  core: t.value,
                },
              }),
          ).toThrowError(
            eatSymbols`conditions.core: expected an array of conditions or string, but got ${t.value}`,
          )
        })
      })

      test('cannot have garbage as alt condition group', () => {
        giveValuesNotMatching(['object', 'string'], t => {
          expect(
            () =>
              new Achievement({
                ...def,
                conditions: {
                  core: '1=0',
                  alt1: t.value,
                },
              }),
          ).toThrowError(
            eatSymbols`conditions.alt1: expected an array of conditions or string, but got ${t.value}`,
          )
        })
      })

      test('cannot have empty conditions object', () => {
        expect(
          () =>
            new Achievement({
              ...def,
              conditions: {} as any,
            }),
        ).toThrowError('conditions: expected "core" group')
      })

      test('cannot have array of array of conditions', () => {
        expect(
          () =>
            new Achievement({
              ...def,
              conditions: [['0=1'], ['0=1']] as any,
            }),
        ).toThrowError('conditions[0]: expected valid condition flag, but got "0=1"')
      })

      test('cannot have empty conditions object with just an alt', () => {
        expect(
          () =>
            new Achievement({
              ...def,
              conditions: {
                alt1: ['0=1'],
              } as any,
            }),
        ).toThrowError('conditions: expected "core" group')
      })

      test('cannot have invalid group names', () => {
        expect(
          () =>
            new Achievement({
              ...def,
              conditions: {
                core: ['0=1'],
                invalidGroup: ['0=1'],
              } as any,
            }),
        ).toThrowError('conditions.invalidGroup: group name must be "core" or "alt1", "alt2"...')
      })

      test('cannot have gaps in alt conditions groups', () => {
        expect(
          () =>
            new Achievement({
              ...def,
              conditions: {
                core: ['0=1'],
                alt1: ['0=1'],
                alt3: ['0=1'],
              },
            }),
        ).toThrowError(
          'conditions: expected "alt2" group, but got "alt3", make sure there are no gaps',
        )
      })

      test('cannot have bare and calculating Measured conditions', () => {
        expect(
          () =>
            new Achievement({
              ...def,
              conditions: {
                core: ['0=1'],
                alt1: ['M:0xH4'],
              },
            }),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Error: Alt 1, condition 1: cannot have Measured condition without rvalue specified]`,
        )

        for (const operator of ['*', '/', '&', '^'] satisfies Condition.OperatorModifier[]) {
          expect(
            () =>
              new Achievement({
                ...def,
                conditions: {
                  core: ['0=1'],
                  alt1: [`M:0xH4${operator}3`],
                },
              }),
          ).toThrowError(
            `Alt 1, condition 1: expected comparison operator (= != < <= > >=), but got "${operator}"`,
          )
        }
      })
    })
  })

  describe('malformed fromString', () => {
    describe('id', () => {
      test('empty string', () => {
        for (const value of ['', '       ']) {
          expect(
            () => new Achievement(`${value}:"0=1":Name:Description::::cheeseburger:5:::::00000`),
          ).toThrowError(`expected id as unsigned integer, but got ""`)
        }
      })

      test('garbage', () =>
        expect(
          () => new Achievement('garbage:"0=1":Name:Description::::cheeseburger:5:::::00000'),
        ).toThrowError(`expected id as unsigned integer, but got "garbage"`))

      test('36.6', () =>
        expect(
          () => new Achievement('36.6:"0=1":Name:Description::::cheeseburger:5:::::00000'),
        ).toThrowError(`expected id as unsigned integer, but got "36.6"`))

      test('-1', () =>
        expect(
          () => new Achievement('-1:"0=1":Name:Description::::cheeseburger:5:::::00000'),
        ).toThrowError(`expected id to be within the range of 0x0 .. 0xFFFFFFFF, but got "-1"`))

      test('"""""""""""', () =>
        expect(
          () => new Achievement('":"0=1":Name:Description::::cheeseburger:5:::::00000'),
        ).toThrowError(/^got an unexpected amount of data when parsing raw achievement string/))
    })

    describe('conditions', () => {
      test('malformed Core code', () => {
        expect(
          () =>
            new Achievement(
              `111000001:"baobab:0xM47>d0xN47":Name:Description::::cheeseburger:5:::::00000`,
            ),
        ).toThrowError(`Core, condition 1: expected a legal condition flag, but got "baobab:"`)
      })

      test('malformed Alt 2 code', () => {
        expect(
          () =>
            new Achievement(
              `111000001:"0=1S5423!=5423S0xM47(d0xN47":Name:Description::::cheeseburger:5:::::00000`,
            ),
        ).toThrowError(`Alt 2, condition 1: expected an operator, but got "(d0xN4"`)
      })
    })

    describe('badge', () => {
      for (const testCase of [
        '',
        'GARBAGE',
        'local',
        'focal\\\\peepy.png',
        'local/peepy.png',
        './local/peepy.png',
        '../local/peepy.png',
        '..\\\\local\\\\peepy.png',
        '.\\\\local\\\\peepy.png',
        '.\\\\local\\\\peepy.png',
        '.\\\\local\\\\peepy\\\\',
      ]) {
        test(testCase || 'empty string', () => {
          expect(
            () =>
              new Achievement(`111000001:"0=1":Name:Description::::cheeseburger:5:::::${testCase}`),
          ).toThrowError(
            `expected badge as unsigned integer or filepath starting with local\\\\ and going strictly down, but got "${testCase}"`,
          )
        })
      }

      for (const [testCase, dingus] of [
        ['local\\\\peepy'],
        ['local\\\\peepy\\\\', ''],
        ['local\\\\peepy.abc'],
        ['local\\\\peepy.boba.abc'],
        ['local\\\\.peepy'],
      ]) {
        test(testCase, () => {
          expect(
            () =>
              new Achievement(`111000001:"0=1":Name:Description::::cheeseburger:5:::::${testCase}`),
          ).toThrowError(
            `expected badge filename to be *.(png|jpg|jpeg|gif) but got "${
              dingus ?? testCase.split('\\\\')[1]
            }"`,
          )
        })
      }

      for (const [testCase, dingus] of [
        ['local\\\\..\\\\local\\\\peepy.png', '..'],
        ['local\\\\.\\\\local\\\\peepy.png', '.'],
      ]) {
        test(testCase, () => {
          expect(
            () =>
              new Achievement(`111000001:"0=1":Name:Description::::cheeseburger:5:::::${testCase}`),
          ).toThrowError(`encountered ${dingus} within ${testCase}, path can only go down`)
        })
      }
    })
  })

  describe('passing garbage to constructor', () => {
    giveValuesNotMatching(['object', 'string'], t => {
      test(t.assertion, () =>
        expect(() => new Achievement(t.value as any)).toThrowError(
          eatSymbols`achievement data must be an object or string with achievement code, but got ${t.value}`,
        ),
      )
    })

    test('cannot accept another Achievement instance', () => {
      expect(() => new Achievement(new Achievement(def) as any)).toThrowError(
        `achievement data must be an object or string with achievement code, but got another Achievement instance`,
      )
    })

    test('correctly reports error when passing invalid conditions in array', () => {
      expect(
        () =>
          new Achievement({
            ...def,
            conditions: ['0=1', 47] as any,
          }),
      ).toThrowError(/^conditions\[1\]:/)
    })

    test('correctly reports error when passing invalid conditions in conditions.core', () => {
      expect(
        () =>
          new Achievement({
            ...def,
            conditions: {
              core: '47',
            },
          }),
      ).toThrowError(/^conditions\.core:/)

      expect(
        () =>
          new Achievement({
            ...def,
            conditions: {
              core: ['0=1', 47 as any],
            },
          }),
      ).toThrowError(/^conditions\.core\[1\]:/)
    })

    test('correctly reports error when passing invalid conditions in conditions.alt', () => {
      expect(
        () =>
          new Achievement({
            ...def,
            conditions: {
              core: '0=1',
              alt1: ['4=4', '5=5', 47 as any],
            },
          }),
      ).toThrowError(/^conditions\.alt1\[2\]:/)

      expect(
        () =>
          new Achievement({
            ...def,
            conditions: {
              core: '0=1',
              alt1: ['4=4', '5=5'],
              alt2: ['5=5', '4=4'],
              alt3: [47 as any, '4=4', '5=5'],
            },
          }),
      ).toThrowError(/^conditions\.alt3\[0\]:/)
    })
  })

  test('does not allow mixing Measured and Measured%', () => {
    expect(
      () =>
        new Achievement({
          ...def,
          conditions: {
            core: '0=1',
            alt1: [['Measured', 'Mem', '32bit', 0xcafe, '=', 'Value', '', 0, 5]],
            alt2: [['Measured%', 'Mem', '32bit', 0xfeed, '=', 'Value', '', 0, 5]],
          },
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Alt 1, condition 1: Measured conflicts with Alt 2, condition 1 Measured%, make sure you exclusively use Measured or Measured%]`,
    )
  })
})
