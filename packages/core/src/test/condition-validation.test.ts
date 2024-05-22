import { describe, expect, test } from 'vitest'
import { Condition } from '../index.js'
import { eatSymbols } from '../util.js'
import { giveValuesNotMatching } from './test-util.js'

const sizedValueTypes = ['Mem', 'Delta', 'Prior', 'BCD', 'Invert'] as const
const flagsForReading = [
  'PauseIf',
  'ResetIf',
  'ResetNextIf',
  'AddHits',
  'SubHits',
  'AndNext',
  'OrNext',
  // 'Measured' - does not need operator tests, checked by Achievement constructor instead
  'MeasuredIf',
  'Trigger',
] as const
const flagsForCalc = ['AddSource', 'SubSource', 'AddAddress'] as const

describe('Condition validations', () => {
  describe('parsing', () => {
    // Mem address checks
    describe(`Value type - ${sizedValueTypes.join(', ')}`, () => {
      giveValuesNotMatching('unsigned-integer', t => {
        test(t.assertion, () => {
          for (const type of sizedValueTypes) {
            expect(
              () => new Condition(['', type, '32bit', t.value, '=', 'Mem', '32bit', 0xcafe]),
            ).toThrowError(
              t.type === 'type-check'
                ? `expected lvalue memory address as unsigned integer, but got ` +
                    eatSymbols`${t.value}`
                : /^expected lvalue memory address to be within the range of 0x0 \.\. 0xFFFFFFFF, but got /,
            )

            expect(
              () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', type, '32bit', t.value]),
            ).toThrowError(
              t.type === 'type-check'
                ? `expected rvalue memory address as unsigned integer, but got ` +
                    eatSymbols`${t.value}`
                : /^expected rvalue memory address to be within the range of 0x0 \.\. 0xFFFFFFFF, but got /,
            )
          }
        })
      })
    })

    describe('Value type - Value', () => {
      giveValuesNotMatching('integer', t => {
        if (t.type === 'range-check') {
          return
        }

        test(t.assertion, () => {
          expect(
            () => new Condition(['', 'Value', '', t.value, '=', 'Mem', '32bit', 0xcafe]),
          ).toThrowError(`expected lvalue as integer, but got ` + eatSymbols`${t.value}`)

          expect(
            () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Value', '', t.value]),
          ).toThrowError(`expected rvalue as integer, but got ` + eatSymbols`${t.value}`)
        })
      })

      test('cannot underflow into positive value', () => {
        expect(
          () => new Condition(['', 'Value', '', -2147483648 - 5, '=', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(
          /^lvalue: -2147483653 \(-0x80000005\) underflows into positive 2147483643 \(0x7ffffffb\)/,
        )

        expect(
          () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Value', '', -2147483648 - 5]),
        ).toThrowError(
          /^rvalue: -2147483653 \(-0x80000005\) underflows into positive 2147483643 \(0x7ffffffb\)/,
        )
      })

      test('cannot have size specified', () => {
        expect(
          () => new Condition(['', 'Value', '32bit', 0xfeed, '=', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(/^lvalue value cannot have size specified/)

        expect(
          () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Value', '32bit', 0xcafe]),
        ).toThrowError(/^rvalue value cannot have size specified/)
      })

      test('cannot exceed limits', () => {
        const value = 0xffffffff + 2

        expect(
          () => new Condition(['', 'Value', '', value, '=', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(
          `expected lvalue to be within the range of 0x0 .. 0xFFFFFFFF, but got ${value}`,
        )

        expect(
          () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Value', '', value]),
        ).toThrowError(
          `expected rvalue to be within the range of 0x0 .. 0xFFFFFFFF, but got ${value}`,
        )
      })
    })

    describe('Value type - Float', () => {
      giveValuesNotMatching('number', t => {
        test(t.assertion, () => {
          expect(
            () => new Condition(['', 'Float', '', t.value, '=', 'Mem', '32bit', 0xcafe]),
          ).toThrowError(
            t.type === 'range-check'
              ? 'expected lvalue to be within the range of -294967040 .. 4294967040, but got ' +
                  eatSymbols`${t.value}`
              : `expected lvalue as float, but got ` + eatSymbols`${t.value}`,
          )

          expect(
            () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Float', '', t.value]),
          ).toThrowError(
            t.type === 'range-check'
              ? 'expected rvalue to be within the range of -294967040 .. 4294967040, but got ' +
                  eatSymbols`${t.value}`
              : `expected rvalue as float, but got ` + eatSymbols`${t.value}`,
          )
        })
      })

      test('cannot have size specified', () => {
        expect(
          () => new Condition(['', 'Float', '32bit', 0xfeed, '=', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(/^lvalue value cannot have size specified/)

        expect(
          () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Float', '32bit', 0xcafe]),
        ).toThrowError(/^rvalue value cannot have size specified/)
      })

      test('cannot exceed limits', () => {
        expect(
          () =>
            new Condition(['', 'Float', '', Number.MAX_SAFE_INTEGER, '=', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(/^expected lvalue to be within the range of -\d+ \.\. \d+, but got/)

        expect(
          () =>
            new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Float', '', -Number.MAX_SAFE_INTEGER]),
        ).toThrowError(/^expected rvalue to be within the range of -\d+ \.\. \d+, but got/)
      })
    })

    test('must have correct comparison operator', () =>
      expect(
        () => new Condition(['', 'Mem', '32bit', 0xfeed, 'GARBAGE' as any, 'Mem', '32bit', 0xfeed]),
      ).toThrowError('expected an operator or lack of it, but got "GARBAGE"'))

    // Memory comparison flag checks
    describe(`Flags - ${flagsForReading.map(x => (x ? x : '" "')).join(', ')}`, () => {
      test('must have correct operator', () => {
        for (const type of flagsForReading) {
          for (const operator of ['*', '/', '&', '^'] satisfies Condition.OperatorModifier[]) {
            expect(
              () => new Condition([type, 'Mem', '32bit', 0xfeed, operator, 'Mem', '32bit', 0xfeed]),
            ).toThrowError(`expected comparison operator (= != < <= > >=), but got "${operator}"`)
          }
        }
      })
    })

    // Accumulative flag checks
    describe(`Flags - ${flagsForCalc.join(', ')}`, () => {
      test("must have operator if there's right operand", () => {
        for (const type of flagsForCalc) {
          expect(
            () => new Condition([type, 'Mem', '32bit', 0xcafe, '', 'Mem', '32bit', 0xcafe]),
          ).toThrowError(`expected an accumulation operator (* / & ^), but got ""`)
        }
      })

      test('must have correct operator', () => {
        for (const type of flagsForCalc) {
          for (const operator of [
            '=',
            '!=',
            '<',
            '<=',
            '>',
            '>=',
          ] satisfies Condition.OperatorComparison[]) {
            expect(
              () => new Condition([type, 'Mem', '32bit', 0xcafe, operator, 'Mem', '32bit', 0xcafe]),
            ).toThrowError(`expected an accumulation operator (* / & ^), but got "${operator}"`)
          }
        }
      })

      test("must have right operand if there's operator", () => {
        for (const type of flagsForCalc) {
          expect(
            () => new Condition([type, 'Mem', '32bit', 0xcafe, '*', '', '32bit', 0xcafe]),
          ).toThrowError('rvalue must be fully provided if operator is specified')

          expect(
            () => new Condition([type, 'Mem', '32bit', 0xcafe, '*', 'Mem', '', 0xcafe]),
          ).toThrowError('rvalue must be fully provided if operator is specified')
        }
      })
    })

    describe('Enumeration checks', () => {
      test('must have correct condition flag', () =>
        expect(
          () =>
            new Condition(['GARBAGE' as any, 'Mem', '32bit', 0xcafe, '', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(`expected valid condition flag, but got "GARBAGE"`))

      test('must have correct lvalue operand types', () => {
        expect(
          () => new Condition(['', 'GARBAGE' as any, '32bit', 0xcafe, '=', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(`expected valid lvalue type, but got "GARBAGE"`)

        expect(
          () => new Condition(['', 'Mem', 'GARBAGE' as any, 0xcafe, '=', 'Mem', '32bit', 0xcafe]),
        ).toThrowError(`expected valid lvalue size, but got "GARBAGE"`)
      })

      test('must have correct rvalue operand types', () => {
        expect(
          () => new Condition(['', 'Mem', '32bit', 0xcafe, '=', 'GARBAGE' as any, '32bit', 0xcafe]),
        ).toThrowError(`expected valid rvalue type, but got "GARBAGE"`)

        expect(
          () => new Condition(['', 'Mem', '32bit', 0xcafe, '=', 'Mem', 'GARBAGE' as any, 0xcafe]),
        ).toThrowError(`expected valid rvalue size, but got "GARBAGE"`)
      })
    })

    describe('Hits', () => {
      giveValuesNotMatching(['unsigned-integer', 'null', 'undefined'], t => {
        test(t.assertion, () =>
          expect(
            () => new Condition(['', 'Mem', '32bit', 0xfeed, '=', 'Mem', '32bit', 0xcafe, t.value]),
          ).toThrowError(
            t.type === 'range-check'
              ? eatSymbols`expected hits to be within the range of 0x0 .. 0xFFFFFFFF, but got ${t.value}`
              : eatSymbols`expected hits as unsigned integer, but got ${t.value}`,
          ),
        )
      })

      test('cannot be specified on calculations', () => {
        for (const flag of flagsForCalc) {
          expect(
            () => new Condition([flag, 'Mem', '32bit', 0xfeed, '', '', '', 0, 100]),
          ).toThrowError(`hits value cannot be specified with ${flag} condition flag`)
        }
      })
    })
  })

  describe('malformed fromString', () => {
    describe('flag', () => {
      test('empty string', () =>
        expect(() => new Condition(':0xM47>d0xN47')).toThrowError(
          `expected a legal condition flag, but got ":"`,
        ))

      test('baobab', () =>
        expect(() => new Condition('baobab:0xM47>d0xN47')).toThrowError(
          `expected a legal condition flag, but got "baobab:"`,
        ))

      test('::', () =>
        expect(() => new Condition(':::0xM47>d0xN47')).toThrowError(
          `expected a legal condition flag, but got ":"`,
        ))
    })

    describe('hits', () => {
      test('.', () =>
        expect(() => new Condition('0xM47>d0xN47.')).toThrowError(
          `expected hits definition, but got "."`,
        ))

      test('.baobab', () =>
        expect(() => new Condition('0xM47>d0xN47.baobab')).toThrowError(
          `expected hits definition, but got ".baobab"`,
        ))

      test('rusty.', () =>
        expect(() => new Condition('0xM47>d0xN47rusty.')).toThrowError(
          `expected hits definition, but got "rusty."`,
        ))

      test('..', () =>
        expect(() => new Condition('0xM47>d0xN47..')).toThrowError(
          `expected hits as unsigned integer, but got ""`,
        ))

      test('. .', () =>
        expect(() => new Condition('0xM47>d0xN47. .')).toThrowError(
          `expected hits as unsigned integer, but got " "`,
        ))

      test('.baobab.', () =>
        expect(() => new Condition('0xM47>d0xN47.baobab.')).toThrowError(
          `expected hits as unsigned integer, but got "baobab"`,
        ))

      test('.baobab    .', () =>
        expect(() => new Condition('0xM47>d0xN47.baobab    .')).toThrowError(
          `expected hits as unsigned integer, but got "baobab    "`,
        ))

      test('.baobab. (trailing whitespace)', () =>
        expect(() => new Condition('0xM47>d0xN47.baobab.       ')).toThrowError(
          `expected hits as unsigned integer, but got "baobab"`,
        ))

      test('.51234567895123456789. (exceeds range)', () =>
        expect(() => new Condition('0xM47>d0xN47.51234567895123456789.')).toThrowError(
          `expected hits to be within the range of 0x0 .. 0xFFFFFFFF, but got 51234567895123456789`,
        ))
    })

    describe('operator', () => {
      test('none of it', () =>
        expect(() => new Condition('0xM47d0xN47.47.')).toThrowError(
          `expected an operator, but got "xN47.4"`,
        ))

      test('whitespace', () =>
        expect(() => new Condition('0xM47d    0xN47.47.')).toThrowError(
          `expected an operator, but got "    0x"`,
        ))

      test('{', () =>
        expect(() => new Condition('0xM47{d0xN47.47.')).toThrowError(
          `expected an operator, but got "{d0xN4"`,
        ))

      test('__RUSTY__', () =>
        expect(() => new Condition('0xM47__RUSTY__d0xN47.47.')).toThrowError(
          `expected an operator, but got "__RUST"`,
        ))

      test('calculation operator when doing reads', () => {
        for (const operator of ['*', '/', '&', '^'] satisfies Condition.OperatorModifier[]) {
          expect(() => new Condition(`0xX123${operator}5`)).toThrowError(
            eatSymbols`expected comparison operator (= != < <= > >=), but got ${operator}`,
          )
        }
      })
    })

    const valueTestCases = [
      [
        '0x(47',
        'invalid size specifier',
        placement =>
          placement +
          eatSymbols`: expected valid size specifier, but got ${
            placement === 'lvalue' ? '(47!=1' : '(47'
          }`,
      ],
      [
        'B047',
        'lack of 0x',
        placement =>
          placement +
          eatSymbols`: expected proper definition, but got ${
            placement === 'lvalue' ? '047!=1' : '047'
          }`,
      ],
      [
        'fFzoom',
        'invalid hex number',
        placement =>
          placement +
          eatSymbols`: expected memory address as hex number, but got ${
            placement === 'lvalue' ? 'zoom!=' : 'zoom'
          }`,
      ],
      [
        '-2147483658',
        'underflow',
        placement =>
          new RegExp(
            `^${placement}: -2147483658 \\(-0x8000000a\\) underflows into positive 2147483638 \\(0x7ffffff6\\)`,
          ),
      ],
      [
        0xffffffff + 5,
        'overflow',
        placement =>
          `expected ${placement} to be within the range of 0x0 .. 0xFFFFFFFF, but got ${
            0xffffffff + 5
          }`,
      ],
    ] as Array<[string, string, (string: 'lvalue' | 'rvalue') => string | RegExp]>

    for (const placement of ['lvalue', 'rvalue'] as const) {
      describe(placement, () => {
        for (const testCase of valueTestCases) {
          test(testCase[1], () => {
            const code = [
              placement === 'lvalue' ? testCase[0] : '12345',
              '!=',
              placement === 'rvalue' ? testCase[0] : '12345',
            ].join('')

            expect(() => new Condition(code)).toThrowError(testCase[2](placement))
          })
        }
      })
    }

    test('lack of rvalue on calculation with operator', () => {
      expect(() => new Condition('A:0xIfeedcafe*')).toThrowError(
        `expected proper definition, but got ""`,
      )
    })
  })

  describe('passing garbage to constructor', () => {
    giveValuesNotMatching(['object', 'string'], t => {
      test(t.assertion, () =>
        expect(() => new Condition(t.value as any)).toThrowError(
          eatSymbols`condition data must be an array, object or string with condition code, but got ${t.value}`,
        ),
      )
    })
  })
})
