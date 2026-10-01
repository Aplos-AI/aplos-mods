import { describe, expect, test } from 'claude-code/testing'
import { classify, deletions } from '../hooks/parse.ts'

const H = '/Users/z'
const C = '/Users/z/Live/app'

// Answers Bash with 'ran' and the AskUserQuestion dialog with pick(question).
function world(on: any, pick: (q: string) => string | null, asked: string[] = []) {
  on('tool.call', ($: any, e: any) => {
    if (e.tool !== 'AskUserQuestion') return { result: 'ran' }
    const q = e.questions[0].question
    asked.push(q)
    const a = pick(q)
    return a === null ? { deny: 'no one to ask' } : { result: { questions: e.questions, answers: { [q]: a } } }
  })
  on('session.cwd', () => ({ value: C }))
  on('env.get', () => ({ value: H }))
}
const kinds = (cmd: string) =>
  deletions(cmd, C, H).flatMap((d) => d.targets.map((t) => classify(t, H, C, false).kind))

describe('parse', () => {
  test('caches pass, build output and projects are guarded', async () => {
    expect(kinds('rm -rf node_modules/.cache .next')).toEqual(['safe', 'safe'])
    expect(kinds('rm -rf ~/Library/Caches/UnityHub/*')).toEqual(['safe'])
    expect(kinds('rm -rf dist build')).toEqual(['guard', 'guard'])
    expect(kinds('rm -rf ~/Live/NineFold')).toEqual(['guard'])
    expect(kinds('rm -rf ../other-app')).toEqual(['guard'])
    expect(kinds('rm -f App.ipa')).toEqual(['guard'])
    expect(kinds('rm -rf .')).toEqual(['guard'])
    expect(kinds('rm -rf src/old.ts')).toEqual(['pass'])
  })

  test('cd is followed, chains are split', async () => {
    const d = deletions('cd ~/Live/x && npm i; rm -rf build', C, H)
    expect(d[0].targets).toEqual(['/Users/z/Live/x/build'])
  })

  test('find -delete and git clean are caught', async () => {
    expect(deletions('find dist -name "*.map" -delete', C, H)[0].cmd).toBe('find -delete')
    expect(deletions('git clean -fdx', C, H)[0].targets).toEqual([C])
  })
})

describe('noise from real sessions', () => {
  test('temp vars, redirects, escaped spaces and ssh strings do not prompt', async () => {
    expect(kinds('FIX=$(mktemp -d /private/tmp/x.XXXX); rm -rf $FIX')).toEqual(['safe'])
    expect(kinds('SP=/private/tmp/claude-501/s; rm -f $SP/cookies.txt 2>/dev/null')).toEqual(['safe'])
    expect(kinds('rm -rf ~/Library/Application\\ Support/Claude/Cache')).toEqual(['pass'])
    expect(kinds(`ssh box "rm -rf /etc/x; ls"`)).toEqual([])
    expect(kinds("python3 - <<'EOF'\nrm -rf dist\nEOF")).toEqual([])
  })

  test('a loop over whole project folders still prompts', async () => {
    expect(kinds('for d in a b; do rm -rf ~/Live/$d; done')).toEqual(['guard'])
  })
})

describe('register', () => {
  test('safe cache delete runs without asking', async ($, on) => {
    const asked: string[] = []
    world(on, () => 'Delete', asked)
    on('fs.exists', () => ({ value: false }))
    const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf .next node_modules/.cache' })
    expect(r.result).toBe('ran')
    expect(asked.length).toBe(0)
  })

  test('asks per item and refuses when one is kept', async ($, on) => {
    const asked: string[] = []
    world(on, (q) => (q.includes('dist') ? 'Delete' : 'Keep'), asked)
    on('fs.exists', () => ({ value: false }))
    const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf dist build' })
    expect(asked.length).toBe(2)
    expect(r.deny).toContain('~/Live/app/build')
    expect(r.deny).not.toContain('~/Live/app/dist')
  })

  test('approving every item lets the command run', async ($, on) => {
    world(on, () => 'Delete')
    on('fs.exists', () => ({ value: false }))
    const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf dist' })
    expect(r.result).toBe('ran')
  })

  test('a git repo is guarded, and with nobody to ask it is refused', async ($, on) => {
    world(on, () => null)
    on('fs.exists', () => ({ value: true }))
    const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf ~/scratch/thing' })
    expect(r.deny).toContain('a git repository')
  })
})
