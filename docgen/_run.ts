import * as fs from 'fs'
import { Project } from 'ts-morph'
import type { generateMarkdownDoc } from './generate.ts'
import type { apiCoreEntries } from './projects.ts'

const project = new Project({
  tsConfigFilePath: './packages/core/tsconfig.build.json',
})
console.log('press enter to emit the docs')

let count = 0
let waiting = false
async function emit() {
  const imports = await Promise.all([
    import(`./generate.ts?q=${count}`),
    import(`./projects.ts?q=${count}`),
  ])

  try {
    const _generateMarkdownDoc: typeof generateMarkdownDoc = imports[0].generateMarkdownDoc
    const _apiCoreEntries: typeof apiCoreEntries = imports[1].apiCoreEntries
    const entries = _apiCoreEntries(project)
    const str = _generateMarkdownDoc('@cruncheevos/core API', entries)
    fs.writeFileSync('./packages/core/api-core.md', str)
    console.log('done')
  } catch (err) {
    console.error(err)
  }

  count++
}

process.stdin.on('data', buf => {
  if (waiting) {
    return
  }

  if (buf[0] === 0xa || buf[1] === 0xa) {
    waiting = true
    emit().then(() => (waiting = false))
  }
})
