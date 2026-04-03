import GithubSlugger from 'github-slugger'
import { SyntaxKind, TypeFormatFlags } from 'ts-morph'
import type {
  ArrowFunction,
  ClassDeclaration,
  ConstructorDeclaration,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  InterfaceDeclaration,
  JSDoc,
  MethodDeclaration,
  MethodSignature,
  Node,
  ParameterDeclaration,
  Project,
  PropertyDeclaration,
  PropertySignature,
  VariableStatement,
} from 'ts-morph'

function formatParameters(params: ParameterDeclaration[]) {
  return (
    params
      .map(x => {
        if (x.getDotDotDotToken()) {
          return `...${x.getName()}`
        }

        const t = x.getType()
        if (t.getTypeArguments().length > 0) {
          const ref = x.getTypeNodeOrThrow().asKind(SyntaxKind.TypeReference)
          if (ref) {
            return `${x.getName()}: ${ref.getTypeName().getText()}`
          }
        }

        return x.getText()
      })
      // remove default parameters at the end
      .map(x => x.replace(/\s*=.+$/, ''))
  )
}

function formatFunction(
  p:
    | ConstructorDeclaration
    | FunctionDeclaration
    | MethodDeclaration
    | ArrowFunction
    | FunctionExpression,

  meta: ProjectEntryMeta = {},
) {
  const { returnType = true } = meta

  let res = `(${formatParameters(p.getParameters()).join(', ')})`
  if (returnType) {
    res += `: ${p.getReturnType().getText(p)}`
  }

  return res
}

function findJsDocs(
  p:
    | PropertyDeclaration
    | PropertySignature
    | ConstructorDeclaration
    | MethodDeclaration
    | MethodSignature
    | VariableStatement
    | ExpressionStatement,
) {
  let docs = p.getJsDocs()
  if (docs.length > 0) {
    return docs
  }

  if (p.isKind(SyntaxKind.PropertyDeclaration) || p.isKind(SyntaxKind.MethodDeclaration)) {
    docs = p
      .findReferencesAsNodes()
      .map(x => x.getPreviousSiblingIfKind(SyntaxKind.JSDoc))
      .filter(Boolean) as JSDoc[]
  }

  return docs
}

function splitJsDocs(docs: JSDoc[]) {
  if (docs.length === 0) {
    return { description: '', example: '' }
  }

  if (docs.length > 1) {
    throw new Error('unexpected jdocs more than 1')
  }

  const jsDoc = docs[0]
  return {
    description: (jsDoc.getCommentText() || '').replace(/{@link (.+)}/g, '$1'),
    example:
      jsDoc
        .getTags()
        .find(x => x.getTagName() === 'example')
        ?.getCommentText() || '',
  }
}

function formatProperty(p: PropertyDeclaration | PropertySignature) {
  return `${p.getName()}: ${p.getType().getText(p)}`
}

function extractUnionMaybe(p: Node) {
  const t = p.getType()
  if (t.isUnion() && t.isBoolean() === false) {
    return t
      .getUnionTypes()
      .map(x => x.getText(undefined, TypeFormatFlags.UseSingleQuotesForStringLiteralType))
  }

  return undefined
}

function filterIgnoredMembers(
  x:
    | PropertyDeclaration
    | ConstructorDeclaration
    | MethodDeclaration
    | MethodSignature
    | PropertySignature,
) {
  const ignoreTag = x.getJsDocs().find(d => d.getTags().find(t => t.getTagName() === 'ignore'))
  if (ignoreTag) {
    return false
  }

  return true
}

export type ProjectEntryType =
  | ClassDeclaration
  | VariableStatement
  | ExpressionStatement
  | InterfaceDeclaration

type ProjectEntryMeta = { returnType?: boolean; isChild?: boolean }

export type ProjectEntry = [ProjectEntryType, ProjectEntryMeta]
export type ProjectFunction = (p: Project) => Array<ProjectEntry>

interface Entry {
  header: string
  tocLabel: string
  description: string
  union?: string[]
  example?: string
}

interface ParsedEntryClass extends Entry {
  type: 'class'
  properties: Entry[]
  methods: Entry[]
}

interface ParsedEntrySimple extends Entry {
  type: 'simple'
}

function parseClassOrInterface([e]: ProjectEntry): ParsedEntryClass | undefined {
  if (
    e.isKind(SyntaxKind.ClassDeclaration) === false &&
    e.isKind(SyntaxKind.InterfaceDeclaration) === false
  ) {
    return undefined
  }

  const name = e.getName()
  if (!name) {
    throw new Error('unexpected no name')
  }

  const parentModule = e.getParentModule()
  const header = parentModule ? `${parentModule.getName()}.${name}` : name

  const res: ParsedEntryClass = {
    type: 'class',
    header,
    tocLabel: header,
    methods: [],
    properties: [],
    ...splitJsDocs(e.getJsDocs()),
  }

  const properties = e.getProperties().filter(filterIgnoredMembers)
  const methods = [
    ...(e.asKind(SyntaxKind.ClassDeclaration)?.getConstructors() || []).flatMap(c =>
      c.getOverloads(),
    ),
    ...e.getMethods(),
  ].filter(filterIgnoredMembers)

  for (const p of properties) {
    const pName = p.getName()
    let nameFull = name[0].toLowerCase() + name.slice(1) + '.' + formatProperty(p)

    res.properties.push({
      header: nameFull,
      tocLabel: pName,
      union: extractUnionMaybe(p),
      ...splitJsDocs(findJsDocs(p)),
    })
  }

  for (const m of methods) {
    let sig = ''
    let sigFull = ''
    if (m.isKind(SyntaxKind.Constructor)) {
      sig = `new ${name}${formatFunction(m, { returnType: false })}`
    }
    if (m.isKind(SyntaxKind.MethodDeclaration)) {
      const hasAsterisk = Boolean(m.getAsteriskToken())
      const dotMaybe = hasAsterisk ? '' : '.'
      sig = `${m.getName()}${formatFunction(m, { returnType: hasAsterisk === false })}`
      sigFull = name[0].toLowerCase() + name.slice(1) + dotMaybe + sig
    }

    res.methods.push({
      header: sigFull || sig,
      tocLabel: sig,
      ...splitJsDocs(findJsDocs(m)),
    })
  }

  return res
}

function parseVariableStatement(entry: ProjectEntry): ParsedEntrySimple | undefined {
  const [e, meta] = entry

  if (e.isKind(SyntaxKind.VariableStatement) === false) {
    return undefined
  }

  const decls = e.getDeclarationList().getDeclarations()
  if (decls.length > 1) {
    throw new Error('unexpected more than 1 var declaration')
  }

  const decl = decls[0]
  const init = decl.getInitializer()
  if (!init || init.isKind(SyntaxKind.ArrowFunction) === false) {
    throw new Error('expected arrow function')
  }

  const name = decl.getName() + formatFunction(init, meta)
  return { type: 'simple', header: name, tocLabel: name, ...splitJsDocs(findJsDocs(e)) }
}

function parseExpressionStatement([e]: ProjectEntry): ParsedEntrySimple | undefined {
  if (e.isKind(SyntaxKind.ExpressionStatement) === false) {
    return undefined
  }

  const exp = e.getExpressionIfKindOrThrow(SyntaxKind.BinaryExpression)

  const name = exp.getLeft().getText()
  const decl = exp.getRight().getType().getCallSignatures()[0]?.getDeclaration()
  if (decl && decl.isKind(SyntaxKind.FunctionDeclaration)) {
    const sig = `${name}${formatFunction(decl, { returnType: false })}`
    return { type: 'simple', header: sig, tocLabel: sig, ...splitJsDocs(findJsDocs(e)) }
  }

  return { type: 'simple', header: name, tocLabel: name, ...splitJsDocs(findJsDocs(e)) }
}

export function generateMarkdownDoc(title: string, entries: Array<ProjectEntry>) {
  const slugger = new GithubSlugger()
  const toc: string[] = []
  const mdEntries: string[] = []

  for (const entry of entries) {
    const wrapIfChild = (str: string, isChild: boolean) => (isChild ? `\`${str}\`` : str)

    function getTocEntry(entry: Entry, params: { isChild?: boolean } = {}) {
      const { isChild = false } = params
      const tocWhitespaceMaybe = isChild ? '  ' : ''
      const tocLabel = wrapIfChild(entry.tocLabel, isChild)
      return tocWhitespaceMaybe + `- [${tocLabel}](#${slugger.slug(entry.header)})`
    }

    function getMdEntry(entry: Entry, params: { isChild?: boolean } = {}) {
      const { isChild = false } = params

      const hash = isChild ? '####' : '##'
      const res = [`${hash} ${wrapIfChild(entry.header, isChild)}`, entry.description]

      if (entry.union) {
        res.push(`Possible values are: \`${entry.union.join(' | ')}\``)
      }

      if (entry.example) {
        res.push('```ts\n' + entry.example + '\n```')
      }

      return res.filter(Boolean).join('\n\n')
    }

    const c = parseClassOrInterface(entry)
    if (c) {
      toc.push(getTocEntry(c))
      mdEntries.push(getMdEntry(c))

      if (c.properties.length > 0) {
        mdEntries.push('---')
      }

      for (const p of c.properties) {
        toc.push(getTocEntry(p, { isChild: true }))
        mdEntries.push(getMdEntry(p, { isChild: true }))
      }

      if (c.methods.length > 0) {
        mdEntries.push('---')
      }

      for (const m of c.methods) {
        toc.push(getTocEntry(m, { isChild: true }))
        mdEntries.push(getMdEntry(m, { isChild: true }))
      }
    }

    const s = parseVariableStatement(entry) || parseExpressionStatement(entry)
    if (s) {
      const isChild = entry[1].isChild
      toc.push(getTocEntry(s, { isChild }))

      mdEntries.push(getMdEntry(s, { isChild }))
    }
  }

  return `# ${title}\n\n` + toc.join('\n') + '\n\n' + mdEntries.join('\n\n')
}
