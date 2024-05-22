import { Command, Argument, Option } from '@commander-js/extra-typings'

import * as commands from './index.js'
import { initRACachePath } from './mockable.js'
import { AssetFilter, availableFilterTypes, makeAssetFilter } from './util.js'

const argument = {
  gameId: new Argument('<game_id>', 'numeric game ID as specified on retroachievements.org')
    .argRequired()
    .argParser(str => {
      const value = Number(str)
      if (Number.isNaN(value) || Number.isInteger(value) === false || value < 0) {
        throw new Error(`expected game_id to be positive integer, but got ${str}`)
      }

      return value
    }),
  inputFilePath: new Argument(
    '<input_file_path>',
    'path to the JavaScript module which default exports AchievementSet or (async) function returning AchievementSet',
  ).argRequired(),
}

const options = {
  timeout: new Option(
    '-t --timeout <number>',
    'amount of milliseconds after which the remote data fetching is considered failed',
  )
    .default(3000)
    .argParser(str => {
      const value = Number(str)
      if (Number.isNaN(value) || Number.isInteger(value) === false || value < 0) {
        throw new Error(`expected timeout to be positive integer, but got ${str}`)
      }

      return value
    }),

  contextLines: new Option(
    '-c --context-lines <amount>',
    'how much conditions to show around the changed conditions, 10 max',
  ).argParser(str => {
    let value = Number(str)
    if (Number.isNaN(value) || Number.isInteger(value) === false || value < 0) {
      throw new Error(`expected context-lines to be positive integer, but got ${str}`)
    }

    if (value > 10) {
      value = 10
    }

    return value
  }),

  refetch: new Option('-r --refetch', 'force refetching of remote data'),

  forceRewrite: new Option(
    '--force-rewrite',
    'completely overwrite the local data instead of updating only matching assets, THIS MAY RESULT IN LOSS OF LOCAL DATA!',
  ),

  filter: new Option(
    '-f, --filter <filter:value...>',
    `only output assets that matches the filter. available filters are: ${[...availableFilterTypes].join(', ')}\nid accepts comma separated list of ids, everything else accepts a regular expression`,
  ).argParser((str, filters: AssetFilter[] = []) => {
    return filters.concat(makeAssetFilter(str))
  }),

  includeUnofficial: new Option(
    '--include-unofficial',
    'do not ignore unofficial achievements on the server when executing this operation',
  ),
}

export function makeCLI() {
  let RACacheDescriptionHelp =
    "\n\nassumes that RACACHE environment variable is set - it must contain absolute path to emulator directory containing the RACache directory. If there's .env file locally available - RACACHE value will be read from that."
  let savingDescriptionHelp =
    "\n\nsave command will try it's best to preserve the existing local assets that are not part of your JavaScript module"

  initRACachePath()

  const program = new Command()
    .name('cruncheevos')
    .description('CLI utility to manage achievement sets made with @cruncheevos/core')

  program
    .command('diff')
    .description(
      'shows the difference between achievement set exported by JavaScript module and set defined in remote and/or local files' +
        RACacheDescriptionHelp,
    )
    .addArgument(argument.inputFilePath)
    .addOption(options.filter)
    .addOption(options.includeUnofficial)
    .addOption(options.contextLines)
    .addOption(options.refetch)
    .addOption(options.timeout)
    .action(async (inputFilePath, opts) => {
      await commands.diff(inputFilePath, opts)
    })

  program
    .command('save')
    .description(
      `saves the achievement set exported by JavaScript module into local file in RACache directory` +
        savingDescriptionHelp +
        RACacheDescriptionHelp,
    )
    .addArgument(argument.inputFilePath)
    .addOption(options.filter)
    .addOption(options.includeUnofficial)
    .addOption(options.refetch)
    .addOption(options.timeout)
    .addOption(options.forceRewrite)
    .action(async (inputFilePath, opts) => {
      await commands.save(inputFilePath, opts)
    })

  program
    .command('diff-save')
    .description(
      `shows output of 'diff' command first, if there are any changes - prompts to issue 'save' command` +
        savingDescriptionHelp +
        RACacheDescriptionHelp,
    )
    .addArgument(argument.inputFilePath)
    .addOption(options.filter)
    .addOption(options.includeUnofficial)
    .addOption(options.contextLines)
    .addOption(options.refetch)
    .addOption(options.timeout)
    .addOption(options.forceRewrite)
    .action(async (inputFilePath, opts) => {
      await commands.diffSave(inputFilePath, opts)
    })

  program
    .command('fetch')
    .description(
      'fetches the remote data about achievement set into RACache directory' +
        +`\n\nthis command may be implicitly ran by other commands if RACache directory lacks remote data for the game` +
        RACacheDescriptionHelp,
    )
    .addArgument(argument.gameId)
    .addOption(options.timeout)
    .action(async (gameId, { timeout }) => {
      await commands.fetch({
        gameId,
        timeout,
      })
    })

  program
    .command('generate')
    .description(
      'generates JavaScript module based on the remote data about achievement set' +
        RACacheDescriptionHelp,
    )
    .addArgument(argument.gameId)
    .argument('<output_file_path>')
    .addOption(options.filter)
    .addOption(options.includeUnofficial)
    .addOption(options.refetch)
    .addOption(options.timeout)
    .action(async (gameId, outputFilePath, opts) => {
      await commands.generate(gameId, outputFilePath, opts)
    })

  return program
}

export function runTestCLI(args: any[]) {
  return makeCLI()
    .exitOverride()
    .parseAsync(
      args.map(x => x.toString()),
      { from: 'user' },
    )
}
