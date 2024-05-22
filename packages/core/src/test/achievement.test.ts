import { describe, expect, test } from 'vitest'
import { Achievement, Condition } from '../index.js'
import { deepObjectCopy } from '../util.js'

function checkie(str: string, def: Achievement.InputObject) {
  const result = new Achievement(def).toString()

  expect(result).toBe(str)
  expect(new Achievement(result).toString()).toBe(result)
}

describe('Achievements', () => {
  const def: Achievement.InputObject = {
    id: 111000001,
    title: 'Achievement:Name',
    description: 'AchievementDescription',
    author: 'cheeseburger',
    points: 25,
    badge: '12345',
    conditions: null,
  }

  const defWithType: Achievement.InputObject = {
    ...def,
    type: 'progression',
  }

  describe('Different ways to specify condition set', () => {
    const expectedRaw = (code: string) =>
      `111000001:"${code}":"Achievement:Name":AchievementDescription:::progression:cheeseburger:25:::::12345`

    test('string', () => {
      checkie(expectedRaw('0xH0=47_0xXcafe=65261'), {
        ...defWithType,
        conditions: '0xH0=47_0xXcafe=65261',
      })
    })

    test('Object with core', () => {
      checkie(expectedRaw('0xH0=47_0xXcafe=65261'), {
        ...defWithType,
        conditions: {
          core: ['0xH0=47', ['', 'Mem', '32bit', 0xcafe, '=', 'Value', '', 0xfeed]],
        },
      })
    })

    test('Array as core', () => {
      checkie(expectedRaw('0xH0=47_0xXcafe=65261'), {
        ...defWithType,
        conditions: [['', 'Mem', '8bit', 0x0, '=', 'Value', '', 47], '0xXcafe=65261'],
      })
    })

    test('Object with core and two alts', () => {
      checkie(expectedRaw('0xH0=47_0xXcafe=65261S0xXbeef=3244S0x 1234=1383'), {
        ...defWithType,
        conditions: {
          core: [
            ['', 'Mem', '8bit', 0x0, '=', 'Value', '', 47],
            ['', 'Mem', '32bit', 0xcafe, '=', 'Value', '', 0xfeed],
          ],
          alt1: [['', 'Mem', '32bit', 0xbeef, '=', 'Value', '', 0xcac]],
          alt2: '0x 1234=1383',
        },
      })
    })

    test('Array of arrays/strings as core and two alts, all conditions are strings', () => {
      checkie(expectedRaw('0xH0=47_0xXcafe=65261S0xXbeef=3244S0x 1234=1383'), {
        ...defWithType,
        conditions: {
          core: ['0xH0=47', '0xXcafe=65261'],
          alt1: '0xXbeef=3244',
          alt2: ['0x 1234=1383'],
        },
      })
    })

    test('Bit6 with S character that does not conflict with group split', () => {
      checkie(expectedRaw(`0x cafe=0x cafeSI:0xX75c278_0xS1600=1`), {
        ...defWithType,
        conditions: {
          core: '0x cafe=0x cafe',
          alt1: 'I:0xX75c278_0xS1600=1',
        },
      })
    })

    test('empty core, with two alts', () => {
      checkie(expectedRaw('S0xXbeef=3244S0xXcafe=65261'), {
        ...defWithType,
        conditions: {
          core: [],
          alt1: '0xXbeef=3244',
          alt2: '0xXcafe=65261',
        },
      })
    })

    test('empty core, with one empty alt in-between', () => {
      checkie(expectedRaw('S0xXbeef=3244SS0xXcafe=65261'), {
        ...defWithType,
        conditions: {
          core: [],
          alt1: '0xXbeef=3244',
          alt2: '',
          alt3: '0xXcafe=65261',
        },
      })
    })

    test('literally nothing', () => {
      checkie(expectedRaw(''), {
        ...defWithType,
        conditions: {
          core: [],
        },
      })
    })
  })

  describe('Quoting / Escaping in raw definitions', () => {
    const def: Achievement.InputObject = {
      id: 111000001,
      title: 'Name',
      description: 'Description',
      author: 'cheeseburger',
      points: 5,
      badge: '00000',
      conditions: [['', 'Value', '', 0, '=', 'Value', '', 1]],
    }

    describe('name', () => {
      test('double quote', () =>
        checkie('111000001:"0=1":"Na\\"m\\"e":Description::::cheeseburger:5:::::00000', {
          ...def,
          title: 'Na"m"e',
        }))

      test('delimiter', () =>
        checkie('111000001:"0=1":"Na:me":Description::::cheeseburger:5:::::00000', {
          ...def,
          title: 'Na:me',
        }))

      test('double quote + delimiter', () =>
        checkie('111000001:"0=1":"N\\"a:m\\"e":Description::::cheeseburger:5:::::00000', {
          ...def,
          title: 'N"a:m"e',
        }))
    })

    describe('description', () => {
      test('double quote', () =>
        checkie('111000001:"0=1":Name:"Descri\\"pti\\"on"::::cheeseburger:5:::::00000', {
          ...def,
          description: 'Descri"pti"on',
        }))

      test('delimiter', () =>
        checkie('111000001:"0=1":Name:"Descri:ption"::::cheeseburger:5:::::00000', {
          ...def,
          description: 'Descri:ption',
        }))

      test('double quote + delimiter', () =>
        checkie('111000001:"0=1":Name:"De\\"scri:pt\\"ion"::::cheeseburger:5:::::00000', {
          ...def,
          description: 'De"scri:pt"ion',
        }))
    })

    describe('author', () => {
      test('double quote', () =>
        checkie('111000001:"0=1":Name:Description::::"cheese\\"burg\\"er":5:::::00000', {
          ...def,
          author: 'cheese"burg"er',
        }))

      test('delimiter', () =>
        checkie('111000001:"0=1":Name:Description::::"cheese:burger":5:::::00000', {
          ...def,
          author: 'cheese:burger',
        }))

      test('double quote + delimiter', () =>
        checkie('111000001:"0=1":Name:Description::::"chee\\"se:bur\\"ger":5:::::00000', {
          ...def,
          author: 'chee"se:bur"ger',
        }))
    })

    describe('badge', () => {
      test('local\\\\ paths are quoted', () => {
        checkie('111000001:"0=1":Name:Description::::cheeseburger:5:::::"local\\\\peepy.png"', {
          ...def,
          badge: 'local\\\\peepy.png',
        })

        checkie(
          '111000001:"0=1":Name:Description::::cheeseburger:5:::::"local\\\\sub\\\\peepy.png"',
          {
            ...def,
            badge: 'local\\\\sub\\\\peepy.png',
          },
        )
      })
    })
  })

  test('with different id', () => {
    const ach = new Achievement({ ...def, conditions: '0=1', id: 444 })
    const newAch = ach.with({ id: 999 })
    expect(newAch.id).toBe(999)
    expect(newAch.conditions).toEqual(ach.conditions)
  })

  test('badge id is padded by zeroes', () => {
    const ach = new Achievement({ ...def, conditions: [], badge: 47 })
    expect(ach.badge).toBe('00047')
  })

  test('correctly parses weird whitespace and values that RATools can produce', () => {
    const ach1 = new Achievement(
      `111000001:"1=0":"Achievement:Name":AchievementDescription: : : :cheeseburger:25:0:0:0:0:12345`,
    )
    const ach2 = new Achievement(
      `111000001:"1=0":"Achievement:Name":AchievementDescription::::cheeseburger:25:::::12345`,
    )
    expect(ach1).toEqual(ach2)
    expect(ach1.toString()).toEqual(ach2.toString())
  })

  test('cannot mutate data within achievement', () => {
    const ach = new Achievement({
      ...def,
      conditions: {
        core: [
          ['', 'Mem', '8bit', 0x0, '=', 'Value', '', 47],
          ['', 'Mem', '32bit', 0xcafe, '=', 'Value', '', 0xfeed],
        ],
        alt1: [['', 'Mem', '32bit', 0xbeef, '=', 'Value', '', 0xcac]],
        alt2: [['', 'Mem', '16bit', 0x1234, '=', 'Value', '', 0x567]],
      },
    })

    for (const assignment of [
      () => (ach.author = 'aaaaaaa'),
      () => (ach.badge = 'aaaaaa'),
      () => (ach.conditions = []),
      () => (ach.conditions[0] = []),
      () => (ach.conditions[0][0] = new Condition('1=2')),
      () => (ach.description = 'aaaaaa'),
      () => (ach.id = 1322312312321),
      () => (ach.title = 'aaaaaaaaaa'),
      () => (ach.points = 100),
    ]) {
      expect(assignment).toThrowError(/^Cannot assign to read only property/)
    }
  })

  test(`passing achievement data definition and mutating it afterwards doesn't affect data within class instance`, () => {
    const original = { ...def }
    // HACK: the achievement class converts the conditions, they won't ever match when passed in toContain
    delete original.conditions

    const mutated: Achievement.InputObject = deepObjectCopy({
      ...original,
      conditions: [['', 'Mem', '8bit', 0x0, '=', 'Value', '', 47]],
    })

    const ach = new Achievement(mutated)

    mutated.author = 'aaaaaaa'
    mutated.badge = 'aaaaaa'
    mutated.conditions = null
    mutated.description = 'aaaaaa'
    mutated.id = 1322312312321
    mutated.title = 'aaaaaaaaaa'
    mutated.type = 'win_condition'
    mutated.points = 100

    expect(ach).not.toMatchObject(mutated)
    expect(ach).toMatchObject(original)
  })
})
