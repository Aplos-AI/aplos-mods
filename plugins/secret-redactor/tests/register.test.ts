import { expect, test } from 'claude-code/testing'

const OUT = [
  'RESEND_API_KEY=re_' + 'a1B2c3D4e5F6g7H8i9J0kLmN',
  'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJlc2lnbmF0dXJl',
  'TWILIO_API_SECRET=SK' + '0123456789abcdef0123456789abcdef',
  'SB=sb_secret_' + 'AbCdEfGhIjKlMnOpQrStUv',
  'PORT=3000',
].join('\n')

test('redacts upstream and Aplos-added formats, keeps the rest', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: OUT, stderr: '', interrupted: false } }))
  const r: any = await $.tool.call({ tool: 'Bash', command: 'cat .env' })
  const text = r.result.stdout
  expect(text).toContain('[REDACTED:jwt]')
  expect(text).not.toContain('re_a1B2')
  expect(text).not.toContain('SK0123')
  expect(text).not.toContain('sb_secret_AbCd')
  expect(text).toContain('PORT=3000')
})

test('refuses a placeholder pasted back into a command', async ($, on) => {
  on('tool.call', () => ({ result: 'ran' }))
  const r: any = await $.tool.call({ tool: 'Bash', command: 'curl -H "Authorization: [REDACTED:jwt]" x' })
  expect(r.deny).toContain('placeholder')
})
