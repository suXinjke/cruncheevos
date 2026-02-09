import * as typedoc from 'typedoc'
import { ContainerReflection, ReflectionKind } from 'typedoc'
import * as fs from 'fs'
import GithubSlugger from 'github-slugger'

function joinTextPieces(p, { inline } = {}) {
  return p.reduce((str, { text }) => {
    return str + (inline ? text.replaceAll('\n', ' ') : text)
  }, '')
}

function getSummary(s, opts = {}) {
  if (s.comment?.summary) {
    return joinTextPieces(s.comment.summary, opts)
  } else if (s.type?.type === 'reference' && s.type.reflection.type) {
    return getSummary(s.type.reflection, opts)
  } else {
    return ''
  }
}

function explodeUnion(u) {
  return u.type.types
    .flatMap(t => {
      if (t.type === 'reference' && t.reflection.type.type === 'union') {
        return explodeUnion(t.reflection)
      }
      return `'${t.value}'`
    })
    .join(' | ')
}

function getPropertyType(p) {
  const rootAlias = p.comment?.getTag('@alias')
  if (rootAlias) {
    return joinTextPieces(rootAlias.content)
  }

  if (p.type.type === 'reference') {
    if (p.type.reflection.type?.type === 'union') {
      return explodeUnion(p.type.reflection)
    }

    const referencedAlias = p.type.reflection.comment?.getTag('@alias')?.content
    if (referencedAlias) {
      return joinTextPieces(referencedAlias)
    }
  }

  return p.type.qualifiedName || p.type.name
}

function getParams(parameters) {
  return parameters.map(p => {
    let type = p.type.qualifiedName || p.type.name
    if (p.type.type === 'union') {
      type = p.type.types
        .map(t => {
          if (t.type === 'reference') {
            return t.qualifiedName || t.name
          }

          return `'${t.value}'`
        })
        .join(' | ')
    } else if (p.comment?.summary) {
      type = p.comment.summary[0].text
    }

    return `${p.name}: ${type}`
  })
}

/**
 * What one tries to do instead of figuring typedoc-plugin-markdown
 *
 * @param {typedoc.Application} app
 * @param {typedoc.ProjectReflection} ref
 */
export default async function (app, ref) {
  const classes = []
  let tableOfContents = ''
  let content = ''

  // await app.generateJson(ref, `${import.meta.dirname}/docs.json`)
  ref.getReflectionsByKind(ReflectionKind.Class).forEach(myClass => {
    const methods = []
    const propertyGroups = [{ title: '', properties: [] }]
    const classTitle = myClass.name
    if (classTitle === 'ConditionBuilder') {
      return
    }

    myClass.traverse(c => {
      if (
        c.kindOf(ReflectionKind.Constructor) === false &&
        c.kindOf(ReflectionKind.Method) === false
      ) {
        return
      }

      c.traverse(s => {
        const isMethod = s.kindOf(ReflectionKind.CallSignature)
        if (s.kindOf(ReflectionKind.ConstructorSignature) === false && isMethod === false) {
          return
        }

        const params = getParams(s.parameters)

        let signature = `${s.name}(${params.join(', ')})`
        if (isMethod && s.type) {
          let type = s.type.qualifiedName || s.type.name
          if (s.type.type === 'array') {
            type = `${s.type.elementType.name}[]`
          }
          signature += `: ${type}`
        }

        if (c.name === '[iterator]') {
          signature = '[Symbol.iterator]()'
        }

        methods.push({
          isMethod,
          signature,
          summary: getSummary(s),
          example: s.comment?.blockTags[0]?.content[0]?.text,
        })
      })
    })

    myClass.traverse(p => {
      if (p.kindOf(ReflectionKind.Property) === false) {
        return
      }

      propertyGroups[0].properties.push({
        name: p.name,
        type: getPropertyType(p),
        summary: getSummary(p),
      })
    })

    if (classTitle === 'Condition') {
      const valueType = myClass.getChildByName('lvalue').type.reflection

      const properties = valueType.children.map(c => {
        return {
          name: c.name,
          type: getPropertyType(c),
          summary: getSummary(c),
        }
      })

      propertyGroups.push({
        title: valueType.name,
        properties,
      })
    }

    classes.push({
      title: classTitle,
      summary: getSummary(myClass),
      methods,
      propertyGroups,
    })
  })

  /** @type ContainerReflection */
  const rp = ref
    .getReflectionsByKind(ReflectionKind.Function)
    .filter(x => x.name.includes('Rich'))[0]
  const rpParams = getParams(rp.signatures[0].parameters)

  classes.push({
    title: `RichPresence(${rpParams.join(', ')})`,
    summary: getSummary(rp),
    example: rp.comment?.blockTags[0]?.content[0]?.text,
    methods: rp.children.map(c => {
      let signature = `RichPresence.${c.name}`
      if (c.type.declaration.signatures) {
        const params = getParams(c.type.declaration.signatures[0].parameters)
        signature += `(${params.join(', ')})`
      }

      return {
        isMethod: false,
        signature,
        summary: getSummary(c),
        example: c.comment?.blockTags[0]?.content[0]?.text,
      }
    }),
    propertyGroups: [],
  })

  const slugger = new GithubSlugger()
  function wrapSlug(str, slug) {
    return `[${str}](#${slug})`
  }

  for (const { title, summary, propertyGroups, methods, example } of classes) {
    tableOfContents += `- ${wrapSlug(title, slugger.slug(title))}\n`
    content += `## ${title}\n\n`
    content += `${summary}\n\n`

    for (const pg of propertyGroups) {
      const indent = pg.title ? '  ' : ''

      content += '---\n\n'

      if (pg.title) {
        const fullTitle = `${title}.${pg.title}`
        const slug = slugger.slug(fullTitle)

        tableOfContents += `  - ${wrapSlug(fullTitle, slug)}\n`

        content += `### ${fullTitle}\n\n`
      }

      for (const p of pg.properties) {
        const header = `${p.name}: ${p.type}`
        const slug = slugger.slug(header)

        tableOfContents += `${indent}  - ${wrapSlug('`' + p.name + '`', slug)}\n`

        content += `#### \`${header}\`\n\n`
        content += p.summary + '\n\n'
      }
    }

    if (example) {
      content += example + '\n'
    }

    content += '---\n'

    for (const m of methods) {
      let signaturePrefix = ''
      if (m.isMethod) {
        // replace first character with lowercase
        signaturePrefix += title.replace(/^(.)/, (c, s) => c.toLowerCase() + s.slice(1))
        if (m.signature.startsWith('[') === false) {
          signaturePrefix += '.'
        }
      } else {
        signaturePrefix += 'new '
      }

      const newKeywordMaybe = m.isMethod ? '' : 'new '
      const fullTitle = `${signaturePrefix}${m.signature}`
      const slug = slugger.slug(fullTitle)

      tableOfContents += `  - ${wrapSlug('`' + newKeywordMaybe + m.signature + '`', slug)}\n`

      content += `#### \`${fullTitle}\`\n\n`
      content += `${m.summary}\n\n`
      if (m.example) {
        content += m.example + '\n'
      }
    }

    content += '\n'
  }

  const finalResult = `# @cruncheevos/core API\n\n` + tableOfContents + content
  fs.writeFileSync(`${import.meta.dirname}/../packages/core/api-core.md`, finalResult)
}
