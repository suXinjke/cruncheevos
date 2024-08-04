type Check = [string, any, ExpectedValue | '', 'range-check'?]
const expectedValues = [
  'number',
  'integer',
  'unsigned-integer',
  'string',
  'object',
  'array',
  'undefined',
  'boolean',
  'null',
] as const
type ExpectedValue = (typeof expectedValues)[number]

const regularChecks: Check[] = [
  ['cannot be string', 'baobab', 'string'],
  ['cannot be object', {}, 'object'],
  ['cannot be function', () => () => {}, ''],
  ['cannot be boolean', true, 'boolean'],
  ['cannot be symbol', Symbol(), ''],
  ['cannot be null', null, 'null'],
  ['cannot be undefined', undefined, 'undefined'],
  ['cannot be NaN', NaN, ''],
  ['cannot be Infinity', Infinity, ''],
  ['cannot be Promise', () => Promise.resolve(), ''],
]

export function giveValuesNotMatching(
  expected: ExpectedValue | ExpectedValue[],
  cb: (t: { assertion: string; value: any; type: 'type-check' | 'range-check' }) => void,
) {
  const expectedArray = new Set(Array.isArray(expected) ? expected : [expected])

  const checksToDo = regularChecks.filter(
    check => check[2] === '' || expectedArray.has(check[2]) === false,
  )

  const unsignedIntegerWanted = expectedArray.has('unsigned-integer')
  const integerWanted = unsignedIntegerWanted || expectedArray.has('integer')
  const numberWanted = unsignedIntegerWanted || integerWanted || expectedArray.has('number')
  if (numberWanted) {
    checksToDo.push(['cannot exceed number limits', Number.MAX_SAFE_INTEGER, '', 'range-check'])
    if (integerWanted) {
      checksToDo.push(['cannot be float number', 3.5, ''])
    }
    if (unsignedIntegerWanted) {
      checksToDo.push(['cannot be negative number', -1, '', 'range-check'])
    }
  } else {
    checksToDo.push(['cannot be number', 47, ''])
  }

  for (const check of checksToDo) {
    cb({
      assertion: check[0],
      value: typeof check[1] === 'function' ? check[1]() : check[1],
      type: check[3] ?? 'type-check',
    })
  }
}

export function twistedASCIICase(str: string) {
  return str
    .replace(/([a-zA-Z])/g, res => {
      return res.charCodeAt(0) < 97 ? res.toLowerCase() : res.toUpperCase()
    })
    .replace(/recall/gi, 'recall')
}
