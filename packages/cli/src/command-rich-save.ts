import chalk from 'chalk'
import * as path from 'path'

import { log, confirm, getFs, achievementSetImport, resolveRACache } from './mockable.js'
import { extractAchievementSetFromModule } from './util.js'

const fs = getFs()

function invalidRichPresenceExport(rich: any) {
  const valid =
    typeof rich === 'string' ||
    (typeof rich?.lookup === 'object' &&
      typeof rich?.format === 'object' &&
      Array.isArray(rich?.displayStrings))

  return valid === false
}

export default async function richSave(
  inputFilePath: string,
  opts: {
    forceRewrite?: boolean
  },
) {
  const { forceRewrite } = opts

  const absoluteModulePath = path.resolve(inputFilePath)
  const module = await achievementSetImport(absoluteModulePath)
  const inputSet = await extractAchievementSetFromModule(module, absoluteModulePath)
  if (!Object.getOwnPropertyDescriptor(module, 'rich')) {
    log(chalk.yellowBright(`set doesn't export a string named 'rich', rich-save aborted`))
    return
  }

  if (invalidRichPresenceExport(module.rich)) {
    log(
      chalk.yellowBright(
        `expected set to export a string named 'rich' or object returned by RichPresence, but it exported a ${typeof module.rich} instead, rich-save aborted`,
      ),
    )
    return
  }

  const rich = module.rich.toString()

  const outputFilePath = resolveRACache(`./RACache/Data/${inputSet.gameId}-Rich.txt`)
  if (!forceRewrite) {
    const fileAlreadyExists = fs.existsSync(outputFilePath)
    if (fileAlreadyExists) {
      const agreedToOverwrite = await confirm(`file ${outputFilePath} already exists, overwrite?`)
      if (agreedToOverwrite === false) {
        return
      }
    }
  }

  fs.writeFileSync(outputFilePath, rich)
  log(`dumped Rich Presence for gameId: ${inputSet.gameId}: ${outputFilePath}`)
}
