import { SyntaxKind } from 'ts-morph'
import type { ProjectEntryType, ProjectFunction, ProjectEntry } from './generate.ts'

function pack(a: Array<ProjectEntryType | ProjectEntry>): ProjectEntry[] {
  return a.map(x => (Array.isArray(x) ? x : [x, {}]))
}

export const apiCoreEntries: ProjectFunction = p => {
  const condition = p.getSourceFileOrThrow('condition.ts')
  const richRoot = p.getSourceFileOrThrow('rich.ts').getVariableStatementOrThrow('RichPresence')

  return pack([
    condition.getClassOrThrow('Condition'),
    condition.getModuleOrThrow('Condition').getInterfaceOrThrow('Value'),
    p.getSourceFileOrThrow('achievement.ts').getClassOrThrow('Achievement'),
    p.getSourceFileOrThrow('leaderboard.ts').getClassOrThrow('Leaderboard'),
    p.getSourceFileOrThrow('set.ts').getClassOrThrow('AchievementSet'),
    [richRoot, { returnType: false }],
    ...p
      .getSourceFileOrThrow('rich.ts')
      .getStatements()
      .filter(s => s.isKind(SyntaxKind.ExpressionStatement))
      .filter(s => {
        if (!s.getExpressionIfKind(SyntaxKind.BinaryExpression)) {
          return false
        }

        return s
          .getFirstDescendantByKindOrThrow(SyntaxKind.PropertyAccessExpression)
          .getText()
          .startsWith('RichPresence')
      })
      .map(x => [x, { isChild: true }] as ProjectEntry),
  ])
}
