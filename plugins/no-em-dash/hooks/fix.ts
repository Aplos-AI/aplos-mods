// Pure text helpers, shared by the hooks and the tests.

export const EM = '—'

export function count(text: string): number {
  return text.split(EM).length - 1
}

/**
 * Streaming em dash remover. Feed it text pieces in order; it returns the
 * rewritten pieces. Trailing spaces are held back until the next piece so a
 * dash split across pieces is still handled.
 *
 *   "foo — bar"   -> "foo. Bar"
 *   "done—next"   -> "done. Next"
 *   "| — |"       -> "| - |"
 *   "— item"      -> "- item"   (dash opening a line)
 *   "ok, — then"  -> "ok, then" (dash after punctuation is dropped)
 */
export function stream() {
  let ws = ''
  let prev = '\n'
  let afterDash = false
  let capNext = false
  return (piece: string): string => {
    let out = ''
    for (const ch of piece) {
      if (ch === ' ' || ch === '\t') {
        ws += ch
        continue
      }
      if (ch === '\n') {
        out += (afterDash ? '' : ws) + '\n'
        ws = ''
        afterDash = false
        prev = '\n'
        continue
      }
      if (ch === EM) {
        if (prev === '\n' || prev === '|') {
          out += ws + '-'
          ws = ''
          prev = '-'
        } else if (/[.,;:!?(]/.test(prev)) {
          afterDash = true
        } else {
          out += '.'
          ws = ''
          prev = '.'
          afterDash = true
          capNext = true
        }
        continue
      }
      out += afterDash ? ' ' : ws
      ws = ''
      afterDash = false
      out += capNext && /[a-z]/.test(ch) ? ch.toUpperCase() : ch
      capNext = false
      prev = ch
    }
    return out
  }
}

export function fix(text: string): string {
  return stream()(text)
}

// Bash commands that write text somewhere: commits, PRs, issues, heredocs, redirects.
export const WRITES =
  /\bgit\s+(commit|tag|notes)\b|\bgh\s+(\w+\s+(create|edit|comment|review)|api)\b|<<|\btee\b|(^|[^0-9&>])>{1,2}\s*[^&\s|]/

// MCP tools that send or store text for someone else.
export const OUTBOUND = /(send|create|draft|post|reply|comment|update|publish|write|forward|edit|batch)/i

export const HOW =
  'Rewrite each of those clauses without an em dash: split it into two sentences or restructure it. ' +
  'Do not swap in a comma, hyphen or en dash mechanically. In code, refer to the character as \\u2014.'
