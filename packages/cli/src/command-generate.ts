import { Achievement, Condition, Leaderboard } from '@cruncheevos/core'
import { wrappedError } from '@cruncheevos/core/util'
import prettier from 'prettier'
import chalk from 'chalk'

import { RemoteData, getRemoteData } from './command-fetch.js'
import { confirm, getFs, log } from './mockable.js'
import { AssetFilter, filtersMatch } from './util.js'
const fs = getFs()

const quotedHexStringRegex = /"(0x[\dabcdef]+)"/g

function conditionIsSimple(condition: Condition) {
  const { lvalue, rvalue } = condition
  return (
    (lvalue.type === 'Float' || lvalue.type === 'Value') &&
    (rvalue.type === 'Float' || rvalue.type === 'Value')
  )
}

function conditionsToJsCode(conditions: Condition[]) {
  const formattedConditions = conditions.map(condition => {
    const array = condition.toArrayPretty()

    const result = [
      array[0],
      array[1],
      array[2],
      array[3].startsWith('0x') ? array[3] : Number(array[3]),
    ]

    const hasCmp = array[4]
    if (hasCmp) {
      result.push(
        array[4],
        array[5],
        array[6],
        array[7].startsWith('0x') ? array[7] : Number(array[7]),
      )

      if (condition.hits > 0) {
        result.push(condition.hits)
      }
    }

    return result
  })

  // Replace outer [ ] with function call of $
  return (
    '$(' +
    JSON.stringify(formattedConditions).slice(1, -1).replace(quotedHexStringRegex, '$1') +
    ')'
  )
}

function achievementConditionStringToJsCode(str: string) {
  const ach = new Achievement({
    id: 1,
    title: 'dummy',
    points: 0,
    conditions: str,
  })

  return templatedConditionGroupSet(ach.conditions)
}

function templatedConditionGroupSet(conditions: Condition.GroupNormalized) {
  // don't touch conditions like '1=1'
  if (
    conditions.length === 1 &&
    conditions[0].length === 1 &&
    conditionIsSimple(conditions[0][0])
  ) {
    return '"' + conditions[0].toString() + '"'
  }

  // conditions: [ ... ]
  if (conditions.length === 1) {
    return conditionsToJsCode(conditions[0])
  }

  /*
    conditions: {
      core: [ ... ],
      alt1: [ ... ]
    }
  */
  const prefix = '%'
  let res = ''

  const placeholders = {} as Record<string, string>
  const template = conditions.reduce((prev, group, i) => {
    const groupName = i === 0 ? 'core' : `alt${i}`
    const placeholder = prefix + groupName
    prev[groupName] = placeholder
    placeholders[placeholder] = conditionsToJsCode(group)
    return prev
  }, {})

  res = JSON.stringify(template)

  Object.keys(placeholders).forEach(group => {
    res = res.replace('"' + group + '"', placeholders[group])
  })

  return res
}

function leaderboardConditionStringToJsCode(str: string) {
  const lb = new Leaderboard({
    id: 1,
    title: 'dummy',
    type: 'VALUE',
    lowerIsBetter: true,
    conditions: str,
  })

  return JSON.stringify({
    start: 'lb_start',
    cancel: 'lb_cancel',
    submit: 'lb_submit',
    value: 'lb_value',
  })
    .replace('"lb_start"', templatedConditionGroupSet(lb.conditions.start))
    .replace('"lb_cancel"', templatedConditionGroupSet(lb.conditions.cancel))
    .replace('"lb_submit"', templatedConditionGroupSet(lb.conditions.submit))
    .replace('"lb_value"', templatedConditionGroupSet(lb.conditions.value))
}

// Prefer ` if string has quotes, otherwise wrap into single quote
function quoted(str: string) {
  const stringHasQuotes = Boolean(str.match(/['"]/))
  return stringHasQuotes ? `\`${str.replace(/`/g, '\\`')}\`` : `'${str}'`
}

function makeFixmeComments(title: string, description: string) {
  const titleFixme = title ? '' : ' // FIXME'
  const descriptionFixme = description ? '' : ' // FIXME'

  const lackingPieces = [titleFixme && 'title', descriptionFixme && 'description']
    .filter(Boolean)
    .join(' and ')

  return { titleFixme, descriptionFixme, lackingPieces }
}

function remoteDataToJSCode(
  remoteData: RemoteData,
  { filter, includeUnofficial }: { filter: AssetFilter[]; includeUnofficial: boolean },
) {
  let src = ''
  src += `import { AchievementSet, define as $ } from '@cruncheevos/core'\n`
  src += `const set = new AchievementSet({ gameId: ${remoteData.ID}, title: ${quoted(
    remoteData.Title,
  )} })\n\n`

  for (const ach of remoteData.Achievements) {
    if (ach.Flags !== 3 && !(ach.Flags === 5 && includeUnofficial)) {
      continue
    }

    if (
      filter.length > 0 &&
      filtersMatch({ id: ach.ID, title: ach.Title, description: ach.Description }, filter) === false
    ) {
      continue
    }

    try {
      const { titleFixme, descriptionFixme, lackingPieces } = makeFixmeComments(
        ach.Title,
        ach.Description,
      )

      let achType = ach.Type || ''
      achType = achType ? `\n      type: ${quoted(achType)},` : ''

      src += `set.addAchievement({
      title: ${quoted(ach.Title)},${titleFixme}
      description: ${quoted(ach.Description)},${descriptionFixme}
      points: ${ach.Points},${achType}
      conditions: ${achievementConditionStringToJsCode(ach.MemAddr)},
      badge: ${quoted(ach.BadgeName)},
      id: ${ach.ID},
    })\n\n`

      if (lackingPieces) {
        log(
          chalk.yellowBright(
            `Achievement with ID ${ach.ID} lacks ${lackingPieces}, marked with FIXME`,
          ),
        )
      }
    } catch (err) {
      throw wrappedError(err, `Achievement ID ${ach.ID} (${ach.Title}): ${err.message}`)
    }
  }

  for (const lb of remoteData.Leaderboards) {
    if (lb.Hidden) {
      continue
    }

    if (
      filter.length > 0 &&
      filtersMatch({ id: lb.ID, title: lb.Title, description: lb.Description }, filter) === false
    ) {
      continue
    }

    const leaderboardType = lb.Format === 'TIME' ? 'FRAMES' : lb.Format
    const { titleFixme, descriptionFixme, lackingPieces } = makeFixmeComments(
      lb.Title,
      lb.Description,
    )

    try {
      src += `set.addLeaderboard({
        title: ${quoted(lb.Title)},${titleFixme}
        description: ${quoted(lb.Description)},${descriptionFixme}
        lowerIsBetter: ${Boolean(lb.LowerIsBetter)},
        type: ${quoted(leaderboardType)},
        conditions: ${leaderboardConditionStringToJsCode(lb.Mem)},
        id: ${lb.ID},
      })\n\n`
    } catch (err) {
      throw wrappedError(err, `Leaderboard ID ${lb.ID} (${lb.Title}): ${err.message}`)
    }

    if (lackingPieces) {
      log(
        chalk.yellowBright(
          `Leaderboard with ID ${lb.ID} lacks ${lackingPieces}, marked with FIXME`,
        ),
      )
    }
  }

  src += `export default set`

  return prettier.format(src, {
    semi: false,
    singleQuote: true,
    parser: 'typescript',
  })
}

export default async function generate(
  gameId: number,
  outputFilePath: string,
  opts: {
    refetch?: boolean
    includeUnofficial?: boolean
    timeout?: number
    filter?: AssetFilter[]
  },
) {
  const fileAlreadyExists = fs.existsSync(outputFilePath)
  if (fileAlreadyExists) {
    const agreedToOverwrite = await confirm(`file ${outputFilePath} already exists, overwrite?`)
    if (agreedToOverwrite === false) {
      return
    }
  }

  const { refetch, includeUnofficial, filter = [], timeout = 1000 } = opts
  const remoteData = await getRemoteData({ gameId, refetch, timeout })

  const code = await remoteDataToJSCode(remoteData, { filter, includeUnofficial })
  fs.writeFileSync(outputFilePath, code)

  log(`generated code for achievement set for gameId ${gameId}: ${outputFilePath}`)
}
