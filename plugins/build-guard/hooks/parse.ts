// Pure command parsing and path classification, shared by the hook and the tests.

export type Verdict = { kind: 'safe' | 'guard' | 'pass'; why?: string }

// Reproducible caches: deleting these never loses work.
const SAFE =
  /(^|\/)(node_modules|\.next|\.turbo|\.cache|\.parcel-cache|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|DerivedData|\.expo|\.gradle|coverage|\.nyc_output|\.svelte-kit|\.wrangler|\.npm|_cacache)(\/|$)|^\/(private\/)?tmp\/|^\/private\/var\/folders\/|\/Library\/Caches\/|\/\.bun\/install\/cache/

// Build output and shipped binaries: can be the only copy of compiled code.
const BUILD = /(^|\/)(dist|build|out|output|\.output|release|releases|artifacts|archive|backups?|bin)(\/|$)|\.(ipa|apk|aab|app|xcarchive|dmg|zip)\/?$/

// Folders whose direct children are whole projects or notes.
const ROOTS = ['Live', 'live', 'Projects', 'projects', 'vault', 'Documents', 'Desktop', 'Downloads', 'code', 'dev']

/** Shell words per simple command: quotes, escapes and operators handled, heredoc bodies dropped. */
export function commands(line: string): string[][] {
  const text = stripHeredocs(line)
  const out: string[][] = []
  let words: string[] = []
  let word = ''
  let has = false
  const push = () => {
    if (has) words.push(word)
    word = ''
    has = false
  }
  const end = () => {
    push()
    if (words.length) out.push(words)
    words = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '$' && text[i + 1] === '(') {
      let depth = 0
      let j = i + 1
      for (; j < text.length; j++) {
        if (text[j] === '(') depth++
        else if (text[j] === ')' && --depth === 0) break
      }
      word += text.slice(i, j + 1)
      has = true
      i = j
    } else if (ch === '\\' && i + 1 < text.length) {
      word += text[++i]
      has = true
    } else if (ch === "'" || ch === '"') {
      const close = text.indexOf(ch, i + 1)
      const stop = close === -1 ? text.length : close
      word += text.slice(i + 1, stop)
      has = true
      i = stop
    } else if (ch === ' ' || ch === '\t') {
      push()
    } else if (ch === '\n' || ch === ';' || ch === '|' || ch === '&' || ch === '(' || ch === ')') {
      end()
    } else {
      word += ch
      has = true
    }
  }
  end()
  return out
}

function stripHeredocs(text: string): string {
  const lines = text.split('\n')
  const kept: string[] = []
  let term: string | null = null
  for (const l of lines) {
    if (term !== null) {
      if (l.trim() === term) term = null
      continue
    }
    kept.push(l)
    const m = l.match(/<<-?\s*['"]?(\w+)['"]?/)
    if (m) term = m[1]
  }
  return kept.join('\n')
}

const REDIRECT = /^\d*[<>]/

/** Every delete in a shell line, with targets resolved against `cd`s and VAR= assignments. */
export function deletions(command: string, cwd: string, home: string): { cmd: string; targets: string[] }[] {
  const found: { cmd: string; targets: string[] }[] = []
  const vars: Record<string, string> = { HOME: home }
  let dir = cwd
  for (const words of commands(command)) {
    while (/^\w+=/.test(words[0] ?? '')) {
      const [k, ...v] = words.shift()!.split('=')
      const val = v.join('=')
      if (/mktemp/.test(val)) vars[k] = '/tmp/' + k
      else if (/^\$\(/.test(val)) delete vars[k]
      else vars[k] = expand(val, vars)
    }
    while (['do', 'then', 'else', '{', '!', 'time', 'nohup'].includes(words[0] ?? '') || words[0] === 'sudo' || words[0] === 'command' || words[0] === 'xargs' || words[0] === 'exec') words.shift()
    const [head, ...rest] = words
    const args = rest.filter((w) => !REDIRECT.test(w) && w !== '/dev/null')
    if (head === 'cd' && args[0]) {
      dir = resolve(expand(args[0], vars), dir, home)
    } else if (head === 'rm' || head === 'rmdir') {
      const targets = args.filter((w) => !w.startsWith('-')).map((w) => resolve(expand(w, vars), dir, home))
      if (targets.length) found.push({ cmd: 'rm', targets })
    } else if (head === 'find' && (args.includes('-delete') || (args.includes('-exec') && args.includes('rm')))) {
      found.push({ cmd: 'find -delete', targets: [resolve(expand(args[0] ?? '.', vars), dir, home)] })
    } else if (head === 'git' && args[0] === 'clean' && args.some((w) => /^-\w*f/.test(w))) {
      found.push({ cmd: 'git clean', targets: [dir] })
    }
  }
  return found
}

function expand(word: string, vars: Record<string, string>): string {
  return word.replace(/\$\{?(\w+)\}?/g, (m, k) => (k in vars ? vars[k] : m))
}

export function resolve(p: string, cwd: string, home: string): string {
  let out = p.replace(/^~(?=\/|$)/, home).replace(/^\$\{?HOME\}?(?=\/|$)/, home)
  if (!out.startsWith('/')) out = cwd.replace(/\/$/, '') + '/' + out
  const parts: string[] = []
  for (const seg of out.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return '/' + parts.join('/')
}

/** Classifies one resolved target. `hasGit` says whether it holds a .git folder. */
export function classify(target: string, home: string, cwd: string, hasGit: boolean): Verdict {
  if (SAFE.test(target)) return { kind: 'safe' }
  if (target === '/' || target === home) return { kind: 'guard', why: 'root or home directory' }
  if (hasGit) return { kind: 'guard', why: 'a git repository' }
  if (target === cwd || cwd.startsWith(target + '/')) return { kind: 'guard', why: 'the working directory or a parent of it' }
  for (const r of ROOTS) {
    const base = `${home}/${r}/`
    if (target.startsWith(base) && target.slice(base.length).split('/').length <= 1) return { kind: 'guard', why: `a whole folder in ~/${r}` }
  }
  if (target.startsWith(home + '/') && target.slice(home.length + 1).split('/').length === 1) return { kind: 'guard', why: 'a top-level folder in your home directory' }
  const m = target.match(BUILD)
  if (m) return { kind: 'guard', why: 'build output or a shipped binary, possibly the only copy' }
  const dyn = target.search(/[*?$`]/)
  if (dyn !== -1) {
    const parent = target.slice(0, dyn).replace(/\/[^/]*$/, '')
    if (parent === '' || parent === home || ROOTS.some((r) => parent === `${home}/${r}`))
      return { kind: 'guard', why: 'a wildcard or variable over whole folders' }
  }
  return { kind: 'pass' }
}
