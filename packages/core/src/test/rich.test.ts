import { describe, expect, test } from 'vitest'
import { define as $, RichPresence } from '../index.js'
import { eatSymbols } from '../util.js'

test('RichPresence.Display', () => {
  expect(RichPresence.display($('0=1'), 'Nothing is happening')).toMatchInlineSnapshot(
    `"?0=1?Nothing is happening"`,
  )
})

describe('RichPresence.Format', () => {
  test('Works as expected', () => {
    const format = RichPresence.format({
      name: 'Score',
      type: 'VALUE',
    })

    expect(format.name).toBe('Score')
    expect(format.type).toBe('VALUE')
    expect(format.at('0xcafe')).toBe('@Score(0xcafe)')
    expect(format.at($('M:0xcafe'))).toBe('@Score(0xcafe)')
    expect(format.at('fFcafe')).toBe('@Score(fFcafe)')
    expect(format.at($('M:fFcafe'))).toBe('@Score(fFcafe)')
    expect(format.at('0xH0*2_0xH4')).toBe('@Score(0xH0*2_0xH4)')
    expect(format.at('0xH0$0xH4')).toBe('@Score(0xH0$0xH4)')
    expect(format.at('0xCAFE_v1')).toBe('@Score(0xCAFE_v1)')
    expect(
      format.at($(['AddAddress', 'Mem', '32bit', 0xcafe], ['Measured', 'Mem', '32bit', 0x0])),
    ).toBe('@Score(I:0xXcafe_M:0xX0)')
    expect(
      format.at($(['AddAddress', 'Mem', '32bit', 0xcafe], ['Measured', 'Mem', 'Float', 0x100])),
    ).toBe('@Score(I:0xXcafe_M:fF100)')
    expect(format.toString()).toMatchInlineSnapshot(`
      "Format:Score
      FormatType=VALUE"
    `)
  })

  test('Does not allow to specify bad name', () => {
    expect(() =>
      RichPresence.format({
        name: 9999 as any,
        type: 'SCORE',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Format expected to have a name as string, but got 9999]`,
    )
  })

  test('Does not allow to specify incorrect type', () => {
    expect(() =>
      RichPresence.format({
        name: 'Score',
        type: '__INVALID__' as any,
      }),
    ).toThrowError(`Rich Presence Format "Score" got unexpected type: "__INVALID__"`)
  })

  test('Does not allow to call .at with invalid address', () => {
    const format = RichPresence.format({
      name: 'Score',
      type: 'VALUE',
    })

    for (const invalidAddress of [-5, 5.3, () => {}, null]) {
      expect(() => format.at(invalidAddress as any)).toThrowError(
        eatSymbols`Rich Presence Format "Score" got invalid input: ${invalidAddress}`,
      )
    }

    expect(() => format.at('invalid')).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Format "Score" got invalid string input: "Core, condition 1: lvalue: expected proper definition, but got "invali""]`,
    )

    expect(() => format.at($.one('0xCAFE=0'))).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Format "Score" got invalid input: must have at least one condition with Measured flag, but got "0x cafe=0"]`,
    )

    expect(() => format.at($('A:0xCAFE').also('0x0=0'))).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Format "Score" got invalid input: must have at least one condition with Measured flag, but got "A:0x cafe_0x 0=0"]`,
    )
  })
})

describe('RichPresence.lookup', () => {
  test('Works as expected', () => {
    const lookup = RichPresence.lookup({
      name: 'Car',
      values: {
        1: 'First!',
        2: 'Second!',
        10: 'Same',
        11: 'Same',
      },

      defaultAt: $.one(['Measured', 'Mem', '16bit', 0xfeed]),
    })

    expect(lookup.name).toBe('Car')
    expect(lookup.at()).toBe('@Car(0xfeed)')
    expect(lookup.at('0xcafe')).toBe('@Car(0xcafe)')
    expect(lookup.at($('M:0xcafe'))).toBe('@Car(0xcafe)')
    expect(lookup.at('fFcafe')).toBe('@Car(fFcafe)')
    expect(lookup.at($('M:fFcafe'))).toBe('@Car(fFcafe)')
    expect(lookup.at('0xH0*2_0xH4')).toBe('@Car(0xH0*2_0xH4)')
    expect(lookup.at('0xH0$0xH4')).toBe('@Car(0xH0$0xH4)')
    expect(lookup.at('0xCAFE_v1')).toBe('@Car(0xCAFE_v1)')

    expect(
      lookup.at($(['AddAddress', 'Mem', '32bit', 0xcafe], ['Measured', 'Mem', '32bit', 0x0])),
    ).toBe('@Car(I:0xXcafe_M:0xX0)')
    expect(
      lookup.at($(['AddAddress', 'Mem', '32bit', 0xcafe], ['Measured', 'Mem', 'Float', 0x100])),
    ).toBe('@Car(I:0xXcafe_M:fF100)')
    expect(lookup.toString()).toMatchInlineSnapshot(`
      "Lookup:Car
      1=First!
      2=Second!
      10-11=Same"
    `)
    expect(lookup.toString('hex')).toMatchInlineSnapshot(`
      "Lookup:Car
      0x1=First!
      0x2=Second!
      0xA-0xB=Same"
    `)
    expect(lookup.toString('hex-lowercase')).toMatchInlineSnapshot(`
      "Lookup:Car
      0x1=First!
      0x2=Second!
      0xa-0xb=Same"
    `)

    expect(RichPresence.tag`${lookup}`).toMatchInlineSnapshot(`"@Car(0xfeed)"`)
  })

  test('Does not allow to specify bad name', () => {
    expect(() =>
      RichPresence.lookup({
        name: 9999 as any,
        values: {},
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup expected to have a name as string, but got 9999]`,
    )
  })

  test('Does not allow to specify no values', () => {
    for (const invalidValue of [{}, undefined]) {
      expect(() =>
        RichPresence.lookup({
          name: 'Car',
          values: invalidValue,
        }),
      ).toThrowError(`Rich Presence Lookup "Car" must define at least one key-value pair`)
    }
  })

  test('Does not allow to specify incorrect values', () => {
    expect(() =>
      RichPresence.lookup({
        name: 'Car',
        values: {
          '-1': 'Faulty One',
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid key-value pair "-1": "Faulty One", value must be positive integer or "*"]`,
    )

    expect(() =>
      RichPresence.lookup({
        name: 'Car',
        values: {
          letter: 'Faulty One',
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid key-value pair "letter": "Faulty One", value must be positive integer or "*"]`,
    )
  })

  test('Does not allow for invalid default address', () => {
    for (const invalidAddress of [-5, 5.3, () => {}, null]) {
      expect(() =>
        RichPresence.lookup({
          name: 'Car',
          values: {
            1: 'one',
          },
          defaultAt: invalidAddress as any,
        }),
      ).toThrowError(
        eatSymbols`Rich Presence Lookup "Car" defaultAt expected to be a string, Condition or ConditionBuilder, but got ${invalidAddress}`,
      )
    }

    expect(() =>
      RichPresence.lookup({
        name: 'Car',
        values: {
          1: 'one',
        },
        defaultAt: $('0=1'),
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid defaultAt: must have at least one condition with Measured flag, but got 0=1]`,
    )

    expect(() =>
      RichPresence.lookup({
        name: 'Car',
        values: {
          1: 'one',
        },
        defaultAt: 'invalid',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid defaultAt: "Core, condition 1: lvalue: expected proper definition, but got "invali""]`,
    )

    expect(() =>
      RichPresence.lookup({
        name: 'Car',
        values: {
          1: 'one',
        },
        defaultAt: 'A:0xCAFE_0=1',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid input: must have at least one condition with Measured flag, but got "A:0xCAFE_0=1"]`,
    )
  })

  test('Does not allow to call .at without arguments and without defaultAt specified', () => {
    const lookup = RichPresence.lookup({
      name: 'Car',
      values: {
        1: 'one',
      },
    })

    expect(() => lookup.at()).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup Car got no input, neither defaultAt specified]`,
    )
  })

  test('Does not allow to call .at with invalid address', () => {
    const lookup = RichPresence.lookup({
      name: 'Car',
      values: {
        1: 'one',
      },
    })

    for (const invalidAddress of [-5, 5.3, () => {}, null]) {
      expect(() => lookup.at(invalidAddress as any)).toThrowError(
        eatSymbols`Rich Presence Lookup "Car" got invalid input: ${invalidAddress}`,
      )
    }
    expect(() => lookup.at('invalid')).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got error when parsing input: "Core, condition 1: lvalue: expected proper definition, but got "invali""]`,
    )

    expect(() => lookup.at('A:0xCAFE_0=1')).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid input: must have at least one condition with Measured flag, but got "A:0xCAFE_0=1"]`,
    )

    expect(() => lookup.at($.one('0xCAFE=0'))).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid input: must have at least one condition with Measured flag, but got 0x cafe=0]`,
    )

    expect(() => lookup.at($('A:0xCAFE').also('0x0=0'))).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence Lookup "Car" got invalid input: must have at least one condition with Measured flag, but got A:0x cafe_0x 0=0]`,
    )
  })
})

describe('RichPresence', () => {
  test('Works as expected', () => {
    const rp = RichPresence({
      lookupDefaultParameters: { keyFormat: 'hex' },
      format: {
        Score: 'VALUE',
      },
      lookup: {
        Car: {
          values: {
            '*': '- -',
            3: 'Car no. 3',
            1: 'Car no. 1',
            4: 'Car no. 4',
            7: 'Same value',
            8: 'Same value',
            9: 'Same value',
            11: 'Same value',
          },
          keyFormat: 'dec',
          defaultAt: $.one(['Measured', 'Mem', '16bit', 0x100]),
        },
        Mode: {
          values: {
            1: 'Mode 1',
            2: 'Mode 2',
          },
          keyFormat: 'dec',
          defaultAt: $.one(['Measured', 'Mem', '16bit', 0x104]),
          compressRanges: false,
        },
        Track: {
          values: {
            10: 'Track no. 10',
            22: 'Track no. 22',
            33: 'Track no. 33',
            35: 'Odd',
            36: 'Odd',
          },
          defaultAt: '0x200',
        },
      },
      displays: ({ lookup, format, macro, tag }) => [
        [
          $(['', 'Mem', '16bit', 0xcafe, '=', 'Value', '', 1]),
          tag`Cafe at value 1, Car: ${lookup.Car}, Track: ${lookup.Track}`,
        ],
        ['0xCAFE=2', tag`Cafe at value 2, Track: ${lookup.Track}`],
        ['0xCAFE=3', tag`Format test ${format.Score.at('0xfeed')}`],
        ['0xCAFE=4', tag`Default macro test ${macro.Score.at('0xfeed')}`],

        'Playing a good game',
      ],
    })

    expect(rp.toString()).toMatchInlineSnapshot(`
      "Format:Score
      FormatType=VALUE

      Lookup:Car
      1=Car no. 1
      3=Car no. 3
      4=Car no. 4
      7-9,11=Same value
      *=- -

      Lookup:Mode
      1=Mode 1
      2=Mode 2

      Lookup:Track
      0xA=Track no. 10
      0x16=Track no. 22
      0x21=Track no. 33
      0x23-0x24=Odd

      Display:
      ?0x cafe=1?Cafe at value 1, Car: @Car(0x100), Track: @Track(0x200)
      ?0xCAFE=2?Cafe at value 2, Track: @Track(0x200)
      ?0xCAFE=3?Format test @Score(0xfeed)
      ?0xCAFE=4?Default macro test @Score(0xfeed)
      Playing a good game"
    `)
  })

  test('Does not allow for invalid display strings', () => {
    expect(() =>
      RichPresence({
        lookupDefaultParameters: { keyFormat: 'hex' },
        displays: () => [] as any,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence displays must return at least one display string]`,
    )

    expect(() =>
      RichPresence({
        lookupDefaultParameters: { keyFormat: 'hex' },
        displays: () => ['test', 47] as any,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence displays[1] must be either a string or an array with two strings]`,
    )

    expect(() =>
      RichPresence({
        lookupDefaultParameters: { keyFormat: 'hex' },
        displays: () => [[], 'test'] as any,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Rich Presence displays[0] must be either a string or an array with two strings]`,
    )
  })
})
