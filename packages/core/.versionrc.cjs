module.exports = {
  header: '# Changelog',
  skip: {
    commit: true,
    tag: true,
  },
  tagPrefix: 'core/',
  types: [
    {
      type: 'feat',
      section: 'Features',
      scope: 'core',
    },
    {
      type: 'fix',
      section: 'Fixes',
      scope: 'core',
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
