module.exports = {
  header: '# Changelog',
  skip: {
    commit: true,
    tag: true,
  },
  types: [
    {
      type: 'feat',
      section: 'Features',
      scope: 'cli',
    },
    {
      type: 'fix',
      section: 'Fixes',
      scope: 'cli',
    },
  ],

  writerOpts: {
    finalizeContext(ctx) {
      for (const group of ctx.commitGroups) {
        for (const commit of group.commits) {
          commit.scope = ''
        }
      }

      return ctx
    },
  },
}
