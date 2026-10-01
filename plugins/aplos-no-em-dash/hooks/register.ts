// no-em-dash: Claude Code mod that keeps em dashes out of everything Claude writes.
//
// 1. Write / Edit / NotebookEdit that ADD em dashes are refused, so Claude rewrites the copy.
// 2. Bash commands that write text (commits, PRs, heredocs, redirects) with an em dash are refused.
// 3. Outbound MCP calls (send, draft, post, comment...) with an em dash are refused.
// 4. Claude's own replies are rewritten as they stream, on screen and in the transcript.
import type { Register } from 'claude-code'
import { EM, HOW, OUTBOUND, WRITES, count, stream } from './fix.ts'

let blocked = 0
let rewritten = 0

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'em-dash', description: 'Show what aplos-no-em-dash has blocked and rewritten' })
    return next(e)
  })

  on('command.run', { command: 'em-dash' }, async () => ({
    text: `blocked ${blocked} write(s), rewrote ${rewritten} em dash(es) in replies since load`,
  }))

  on('tool.call', { tool: ['Write', 'Edit', 'NotebookEdit'] }, async ($, e, next) => {
    let added = 0
    if (e.tool === 'Edit') {
      added = count(e.new_string) - count(e.old_string)
    } else if (e.tool === 'Write') {
      let before = ''
      if (await $.fs.exists(e.file_path)) before = String(await $.fs.read(e.file_path))
      added = count(e.content) - count(before)
    } else if (e.tool === 'NotebookEdit') {
      added = count(e.new_source ?? '')
    }
    if (added <= 0) return next(e)
    blocked += 1
    return { deny: `no-em-dash: this ${e.tool} adds ${added} em dash(es) to ${e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path}. ${HOW}` }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!e.command.includes(EM) || !WRITES.test(e.command)) return next(e)
    blocked += 1
    return { deny: `no-em-dash: this command writes text containing ${count(e.command)} em dash(es). ${HOW}` }
  })

  on('tool.call', { tool: /^mcp__/ }, async ($, e, next) => {
    const name = e.tool.split('__').pop() ?? ''
    if (!OUTBOUND.test(name)) return next(e)
    const n = count(JSON.stringify(e))
    if (n === 0) return next(e)
    blocked += 1
    return { deny: `no-em-dash: ${e.tool} would send ${n} em dash(es). ${HOW}` }
  })

  on('turn.step', async function* ($, e, next) {
    const s = next(e)
    const fixers = new Map<number, (t: string) => string>()
    for await (const chunk of s) {
      if (chunk.kind === 'text') {
        let f = fixers.get(chunk.index)
        if (!f) fixers.set(chunk.index, (f = stream()))
        rewritten += count(chunk.text)
        yield { ...chunk, text: f(chunk.text) }
      } else {
        yield chunk
      }
    }
    return await s.result
  })
}
