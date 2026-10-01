import { describe, expect, test } from 'claude-code/testing'
import { fix } from '../hooks/fix.ts'

const D = '—'

describe('fix', () => {
  test('rewrites clause dashes, table cells, bullets and post-punctuation dashes', async () => {
    expect(fix(`foo ${D} bar`)).toBe('foo. Bar')
    expect(fix(`done${D}next`)).toBe('done. Next')
    expect(fix(`| a | ${D} |`)).toBe('| a | - |')
    expect(fix(`${D} item`)).toBe('- item')
    expect(fix(`ok, ${D} then`)).toBe('ok, then')
    expect(fix(`end ${D}\nnext`)).toBe("end.\nNext")
    expect(fix('no dash here  \nkeep')).toBe('no dash here  \nkeep')
  })
})

describe('register', () => {
  test('Edit adding an em dash is denied, removing one passes', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    const bad = await $.tool.call({ tool: 'Edit', file_path: 'a.md', old_string: 'x', new_string: `x ${D} y` })
    expect(bad.deny).toContain('no-em-dash')
    const good = await $.tool.call({ tool: 'Edit', file_path: 'a.md', old_string: `x ${D} y`, new_string: 'x. Y' })
    expect(good.deny).toBeUndefined()
  })

  test('Write compares against the existing file', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    on('fs.exists', () => ({ value: true }))
    on('fs.read', () => ({ value: `old ${D} copy` }))
    const same = await $.tool.call({ tool: 'Write', file_path: 'a.md', content: `old ${D} copy plus more` })
    expect(same.deny).toBeUndefined()
    const more = await $.tool.call({ tool: 'Write', file_path: 'a.md', content: `old ${D} copy ${D} more` })
    expect(more.deny).toContain('adds 1 em dash')
  })

  test('git commit with an em dash is denied, grep for one is not', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    const commit = await $.tool.call({ tool: 'Bash', command: `git commit -m "fix ${D} thing"` })
    expect(commit.deny).toContain('no-em-dash')
    const grep = await $.tool.call({ tool: 'Bash', command: `grep -rn "${D}" src` })
    expect(grep.deny).toBeUndefined()
  })

  test('outbound MCP send is denied, MCP read is not', async ($, on) => {
    on('tool.call', () => ({ result: 'ok' }))
    const send = await $.tool.call({ tool: 'mcp__gmail__send_message', body: `hi ${D} there` })
    expect(send.deny).toContain('no-em-dash')
    const read = await $.tool.call({ tool: 'mcp__gmail__search_threads', query: D })
    expect(read.deny).toBeUndefined()
  })

  test('streamed reply text is rewritten across chunk boundaries', async ($, on) => {
    on('turn.step', async function* ($, e) {
      yield { kind: 'text', index: 0, text: 'shipped ' }
      yield { kind: 'text', index: 0, text: `${D} next` }
      yield { kind: 'text', index: 0, text: ' up' }
      return { turnId: e.turnId, index: e.index, answer: `shipped ${D} next up`, toolUses: [], stopReason: 'end_turn', usage: null }
    })
    const s = $.turn.step({ turnId: 't', index: 0, model: 'claude-test', messageCount: 1 })
    let text = ''
    let step = await s.next()
    while (step.done !== true) {
      if (step.value.kind === 'text') text += step.value.text
      step = await s.next()
    }
    expect(text).toBe('shipped. Next up')
  })
})
