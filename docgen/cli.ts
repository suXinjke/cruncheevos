/*
  Just iterate all available commands and output
  help on them that can be copy pasted into docs
*/

process.env.RACACHE = process.cwd()
import { makeCLI } from '../packages/cli/dist/cli.js'

const cli = makeCLI()

for (const command of cli.commands) {
  console.log('### ' + command.name() + '\n')
  console.log('```')
  console.log(
    command
      .configureHelp({ helpWidth: 120 })
      .helpInformation()
      .replace(/\s*.*--help.*\b/, '') + '```\n',
  )
}
