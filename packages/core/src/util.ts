import type { Achievement } from './achievement.js'
import type { Leaderboard } from './leaderboard.js'

export interface AssetData<IdType = number> {
  /**
   * ID of an Asset matching the one on server.
   * If Asset does not exist on the server yet, `id` should be set
   * to a high number like 111000001, similar to what RAIntegration
   * does when creating local assets.
   */
  id: IdType

  /**
   * Title of an Asset, must be set.
   */
  title: string

  /**
   * Description of an Asset, required by server, but optional for library.
   */
  description?: string
}

export type Asset = Achievement | Leaderboard

export type PartialByKey<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

// TODO: figure out typings if possible, Record<X, Y> => Record<Y, X>
export function invertObject(obj: Record<string, string>) {
  return Object.entries(obj).reduce((prev, cur) => {
    prev[cur[1] as string] = cur[0]
    return prev
  }, {} as any)
}

export function capitalizeWord(word: string) {
  return word[0].toUpperCase() + word.slice(1)
}

export function formatNumberAsHex(num: number, upperCase = false) {
  let rvalue = Math.abs(num).toString(16)
  if (upperCase) {
    rvalue = rvalue.toUpperCase()
  }
  return `${num < 0 ? '-' : ''}0x` + rvalue
}

export function eatSymbols(str: TemplateStringsArray, ...args: any[]) {
  return str
    .map((x, i) => {
      let arg = args[i]
      if (typeof arg === 'string') {
        arg = `"${arg}"`
      } else if (typeof arg === 'symbol') {
        arg = String(arg)
      } else if (i >= args.length) {
        arg = ''
      }

      return x + arg
    })
    .join('')
}

export function isObject(val: any): val is object {
  return Object.prototype.toString.call(val) === '[object Object]'
}

export function isNumber(
  val: any,
  opts: { isInteger?: boolean; isPositive?: boolean } = {},
): val is number {
  if (
    val === null ||
    typeof val === 'symbol' ||
    typeof val === 'boolean' ||
    (typeof val === 'string' && val.trim().length === 0)
  ) {
    return false
  }

  val = Number(val)
  if (Number.isNaN(val) || Number.isFinite(val) === false) {
    return false
  }

  if (opts.isInteger && Number.isInteger(val) === false) {
    return false
  }

  if (opts.isPositive && val < 0) {
    return false
  }

  return true
}

export function deepFreeze<T extends Record<string, any> | any[]>(obj: T) {
  for (const key in obj) {
    const value = obj[key]

    if (isObject(value)) {
      deepFreeze(value)
    } else if (Array.isArray(value)) {
      for (const x of value) {
        if (isObject(x) || Array.isArray(x)) {
          deepFreeze(x)
        }
      }
      Object.freeze(value)
    }
  }

  return Object.freeze(obj)
}

export function deepObjectCopy<T extends Record<string, any>>(obj: T): T {
  const copy = {} as T
  for (const key in obj) {
    const value = obj[key]
    copy[key] = isObject(value) ? deepObjectCopy(value) : value
  }

  return copy
}

export function wrappedError(err: Error, message: string) {
  const wrappedError = new Error(message)
  ;(wrappedError as any).cause = err
  return wrappedError
}

// based on: https://stackoverflow.com/a/14991797
export function parseCSV(str: string) {
  const arr: string[] = []
  let inQuotes = false
  let col = 0

  for (let i = 0; i < str.length; i++) {
    const cur = str[i]
    arr[col] = arr[col] || ''

    if (inQuotes && cur == '\\' && str[i + 1] == '"') {
      arr[col] += '"'
      i++
      continue
    }

    if (cur == '"') {
      inQuotes = !inQuotes
      continue
    }

    if (cur == ':' && !inQuotes) {
      col++
      continue
    }

    arr[col] += cur
  }
  return arr
}

export function quoteIfHaveTo(str: string) {
  return str.match(/[:"]/g) ? `"${str.replace(/"/g, '\\"')}"` : str
}

export const validate = {
  andNormalizeId(id: number | string, propertyName = 'id') {
    const origId = id

    if (typeof id === 'string') {
      if (id.trim().length === 0) {
        throw new Error(`expected ${propertyName} as unsigned integer, but got ""`)
      }

      id = Number(id)
    }

    if (Number.isInteger(id) === false) {
      throw new Error(
        `expected ${propertyName} as unsigned integer, but got ` + eatSymbols`${origId}`,
      )
    }

    if (id < 0 || id >= Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `expected ${propertyName} to be within the range of 0x0 .. 0xFFFFFFFF, but got ` +
          eatSymbols`${origId}`,
      )
    }

    return id
  },

  title(title: string, propertyName = 'title') {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new Error(
        `expected ${propertyName} as non-empty string, but got ` + eatSymbols`${title}`,
      )
    }
  },

  andNormalizeDescription(description: string) {
    if (description === undefined || description === null) {
      return ''
    }

    if (typeof description !== 'string') {
      throw new Error(eatSymbols`expected description as string, but got ${description}`)
    }

    return description
  },
}

export function indexToConditionGroupName(index: number) {
  return index === 0 ? 'Core' : `Alt ${index}`
}
