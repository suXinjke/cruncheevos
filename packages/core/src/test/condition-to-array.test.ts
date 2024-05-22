import { describe, expect, test } from 'vitest'
import { Condition } from '../index.js'

function stringInputTest({ raw, array }: { raw: string; array: string[] }) {
  return [
    `${raw} ${JSON.stringify(array)}`,
    () => expect(new Condition(raw).toArrayPretty()).toEqual(array),
  ] as const
}

describe('condition pretty arrays', () => {
  test(
    ...stringInputTest({
      raw: '0=1',
      array: ['', 'Value', '', '0', '=', 'Value', '', '1', ''],
    }),
  )

  test(
    ...stringInputTest({
      raw: 'P:fFfeedcafe>f1.25.22.',
      array: ['PauseIf', 'Mem', 'Float', '0xfeedcafe', '>', 'Float', '', '1.25', '22'],
    }),
  )

  test(
    ...stringInputTest({
      raw: '0=-2',
      array: ['', 'Value', '', '0', '=', 'Value', '', '-2', ''],
    }),
  )

  test(
    ...stringInputTest({
      raw: 'I:0xWfeedcafe',
      array: ['AddAddress', 'Mem', '24bit', '0xfeedcafe', '', '', '', '', ''],
    }),
  )
})
