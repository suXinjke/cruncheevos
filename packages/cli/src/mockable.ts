import { pathToFileURL } from 'url'

import * as fs from 'fs'
import * as path from 'path'

import prompts from 'prompts'

export function log(...args: any[]) {
  console.log(...args)
}

export function getFs() {
  return fs
}

export function confirm(message: string) {
  return prompts({
    type: 'confirm',
    name: 'value',
    message,
  }).then(x => x.value as boolean)
}

let RACACHE_PATH = ''

export function initRACachePath() {
  if (RACACHE_PATH) {
    return
  }

  const dir = process.env['RACACHE']
  if (!dir) {
    throw new Error('RACACHE environment variable is not defined')
  }

  if (path.isAbsolute(dir) === false) {
    throw new Error('RACACHE path must be absolute')
  }

  if (fs.existsSync(dir) === false) {
    throw new Error(`RACACHE path "${dir}" does not exist`)
  }

  RACACHE_PATH = dir
}

export function resolveRACache(relativePath: string) {
  return path.resolve(RACACHE_PATH, relativePath)
}

export async function achievementSetImport(absolutePath: string) {
  const module = await import(pathToFileURL(absolutePath).href)
  return module
}
