#!/usr/bin/env node
// PreToolUse hook: refuse Bash commands that `git add` the real .env file (secrets), as a
// deterministic backstop on top of .gitignore.
let input = ''
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const command = (payload.tool_input && payload.tool_input.command) || ''
  const stagesEnv =
    /\bgit\s+add\b/.test(command) &&
    /(^|[\s"'])\.env(\s|["'`]|$)/.test(command) &&
    !/\.env\.(example|sample|template)\b/.test(command)

  if (!stagesEnv) process.exit(0)

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Refusing to stage .env — it holds real secrets/credentials. Stage it yourself outside Claude Code if this is genuinely intentional.',
      },
    })
  )
  process.exit(0)
})
