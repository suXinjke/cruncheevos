import { Achievement, Condition, Leaderboard } from '@cruncheevos/core'
import { wrappedError } from '@cruncheevos/core/util'
import chalk from 'chalk'

import { RemoteData, getRemoteData, getSetFromRemoteData } from './command-fetch.js'
import { confirm, getFs, log } from './mockable.js'
import { AssetFilter, filtersMatch } from './util.js'
const fs = getFs()

function conditionIsSimple(condition: Condition) {
  const { lvalue, rvalue } = condition
  return (
    (lvalue.type === 'Float' || lvalue.type === 'Value') &&
    (rvalue.type === 'Float' || rvalue.type === 'Value')
  )
}

// TODO: would be nice to skip calling toArrayPretty
// solely for extracting the formatted number
function conditionsToJsCodeLines(conditions: Condition[]) {
  return conditions.map((c, i, self) => {
    const a = c.toArrayPretty()
    const lValueFormatted = a[3].startsWith('0x') ? a[3] : Number(a[3])

    let line = `['${a[0]}', '${a[1]}', '${a[2]}', ${lValueFormatted}`

    const hasCmp = a[4]
    if (hasCmp) {
      const rValueFormatted = a[7].startsWith('0x') ? a[7] : Number(a[7])
      line += `, '${a[4]}', '${a[5]}', '${a[6]}', ${rValueFormatted}`
      if (c.hits > 0) {
        line += `, ${c.hits}`
      }
    }

    line += ']'
    if (i < self.length - 1) {
      line += ','
    }

    return line
  })
}

function groupSetToJsCode(groupSet: Condition.GroupNormalized, spaces: number) {
  // don't touch conditions like '1=1'
  if (groupSet.length === 1 && groupSet[0].length === 1 && conditionIsSimple(groupSet[0][0])) {
    return `'${groupSet[0].toString()}'`
  }

  const groups = groupSet.map(x => {
    const lines = conditionsToJsCodeLines(x)

    // $([...])
    if (lines.length <= 1) {
      return [`$(${lines[0]})`]
    }

    // $(
    //   [...],
    //   [...],
    // )
    return [
      `$(`,
      ...lines.map((line, i, self) => '  ' + line + (i === self.length - 1 ? ',' : '')),
      `)`,
    ]
  })

  const w = ' '.repeat(spaces)

  if (groups.length === 1) {
    return groups[0].map((x, i) => (i === 0 ? x : w + x)).join('\n')
  }

  // {
  //   core: $(
  //     [...],
  //     [...],
  //   ),
  //   alt1: $(
  //     [...],
  //     [...],
  //   ),
  // }
  return [
    '{',
    groups
      .map((x, i) => {
        const groupName = i === 0 ? 'core: ' : `alt${i}: `

        const total = x
          .map((y, i) => {
            if (i === 0) {
              y = groupName + y
            }

            return w + '  ' + y
          })
          .join('\n')
        return total
      })
      .join(',\n')
      .concat(','),
    w + '}',
  ].join('\n')
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

// TODO: add setId support
function remoteDataToJSCode(
  remoteData: RemoteData,
  { filter, includeUnofficial }: { filter: AssetFilter[]; includeUnofficial: boolean },
) {
  const { GameId, Achievements, Leaderboards } = getSetFromRemoteData(remoteData)

  let src = ''
  src += `import { AchievementSet, define as $ } from '@cruncheevos/core'\n`
  src += `const set = new AchievementSet({ gameId: ${GameId}, title: ${quoted(
    remoteData.Title,
  )} })\n\n`

  for (const ach of Achievements) {
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
      const { conditions } = new Achievement({
        id: 1,
        title: 'dummy',
        points: 0,
        conditions: ach.MemAddr,
      })

      const { titleFixme, descriptionFixme, lackingPieces } = makeFixmeComments(
        ach.Title,
        ach.Description,
      )

      const achType = ach.Type || ''

      src += [
        `set.addAchievement({`,
        `  title: ${quoted(ach.Title)},${titleFixme}`,
        `  description: ${quoted(ach.Description)},${descriptionFixme}`,
        `  points: ${ach.Points},`,
        achType ? `  type: ${quoted(achType)},` : ``,
        `  conditions: ${groupSetToJsCode(conditions, 2)},`,
        `  badge: ${quoted(ach.BadgeName)},`,
        `  id: ${ach.ID},`,
        `})\n\n`,
      ]
        .filter(Boolean)
        .join('\n')

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

  for (const lb of Leaderboards) {
    if (lb.Hidden && !includeUnofficial) {
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
      const { conditions } = new Leaderboard({
        id: 1,
        title: 'dummy',
        type: 'VALUE',
        lowerIsBetter: true,
        conditions: lb.Mem,
      })

      src += [
        `set.addLeaderboard({`,
        `  title: ${quoted(lb.Title)},${titleFixme}`,
        `  description: ${quoted(lb.Description)},${descriptionFixme}`,
        `  lowerIsBetter: ${Boolean(lb.LowerIsBetter)},`,
        `  type: ${quoted(leaderboardType)},`,
        `  conditions: {`,
        `    start: ${groupSetToJsCode(conditions.start, 4)},`,
        `    cancel: ${groupSetToJsCode(conditions.cancel, 4)},`,
        `    submit: ${groupSetToJsCode(conditions.submit, 4)},`,
        `    value: ${groupSetToJsCode(conditions.value, 4)},`,
        `  },`,
        `  id: ${lb.ID},`,
        `})\n\n`,
      ].join('\n')
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

  return src + `export default set\n`
}

// TODO: add setId support
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

  const code = remoteDataToJSCode(remoteData, { filter, includeUnofficial })
  fs.writeFileSync(outputFilePath, code)

  log(`generated code for achievement set for gameId ${gameId}: ${outputFilePath}`)
}
