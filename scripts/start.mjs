import { execSync, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

function isRunning(check) {
  try {
    execSync(check, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const running = []

if (isRunning("pgrep -f 'turbo run dev'")) running.push('turbo dev')
if (isRunning('lsof -ti tcp:3000')) running.push('API (port 3000)')
if (isRunning('lsof -ti tcp:9376')) running.push('Inngest webhook (port 9376)')
if (isRunning('docker compose ps --status running | grep -q postgres')) running.push('PostgreSQL')

if (running.length > 0) {
  console.log('\n⚠ Already running:')
  for (const svc of running) console.log(`  • ${svc}`)
  console.log()

  const answer = await new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question('Restart? [y/N] ', (ans) => {
      rl.close()
      resolve(ans.trim().toLowerCase())
    })
  })

  if (answer !== 'y') {
    console.log('Aborting.')
    process.exit(0)
  }

  console.log('Stopping services...')
  spawnSync('pnpm', ['stop'], { stdio: 'inherit' })
}

spawnSync('pnpm', ['bootstrap'], { stdio: 'inherit' })
spawnSync('pnpm', ['dev'], { stdio: 'inherit' })
