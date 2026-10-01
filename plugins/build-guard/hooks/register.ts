// build-guard: Claude Code mod that asks, one item at a time, before Claude deletes
// build output, binaries, git repos or whole project folders. Known caches pass.
// Where nobody can answer (claude -p, cloud), guarded deletes are refused.
import type { Register } from 'claude-code'
import { classify, deletions } from './parse.ts'

export const register: Register = (on) => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!/\b(rm|rmdir|find|git)\b/.test(e.command)) return next(e)
    const cwd = await $.session.cwd()
    const home = (await $.env.get('HOME')) ?? ''
    const guarded: { target: string; why: string; cmd: string }[] = []
    for (const { cmd, targets } of deletions(e.command, cwd, home)) {
      for (const target of targets) {
        const hasGit = !/[*?$`]/.test(target) && (await $.fs.exists(target + '/.git'))
        const v = classify(target, home, cwd, hasGit)
        if (v.kind === 'guard') guarded.push({ target, why: v.why ?? '', cmd })
      }
    }
    if (guarded.length === 0) return next(e)

    const kept: string[] = []
    for (const g of guarded) {
      const shown = g.target.replace(home, '~')
      let answer = 'Keep'
      try {
        answer = await $.ui.ask(`${g.cmd} ${shown} (${g.why})?`, { header: 'build-guard', options: ['Delete', 'Keep'] })
      } catch {
        answer = 'Keep'
      }
      if (answer !== 'Delete') kept.push(`${shown} (${g.why})`)
    }
    if (kept.length === 0) return next(e)
    $.ui.log(`[build-guard] refused delete of ${kept.length} item(s)`)
    return {
      deny:
        `build-guard: the user did not approve deleting ${kept.join(', ')}. ` +
        'Nothing in this command ran. Rerun it without those paths, or ask the user to delete them by hand.',
    }
  })
}
