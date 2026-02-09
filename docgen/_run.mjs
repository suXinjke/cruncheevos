import * as typedoc from 'typedoc'

const interactive = process.argv.includes('-i')

const app = await typedoc.Application.bootstrapWithPlugins({
  entryPoints: ['packages/core/src/index.ts'],
  sort: 'source-order',
  tsconfig: './packages/core/tsconfig.build.json',
  plugin: ['typedoc-plugin-missing-exports'],
})

const project = await app.convert()
console.log('typedoc initialized')

let count = 0
function emit() {
  return import(`./generate.mjs?q=${count++}`)
    .then(x => x.default(app, project))
    .then(() => {
      console.log('done')
    })
    .catch(err => console.error(err))
}

if (interactive) {
  let waiting = false

  console.log('press enter to emit the docs')
  process.stdin.on('data', buf => {
    if (waiting) {
      return
    }

    if (buf[0] === 0xa || buf[1] === 0xa) {
      waiting = true
      emit().then(() => (waiting = false))
    }
  })
} else {
  emit()
}
