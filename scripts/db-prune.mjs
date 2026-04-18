import { execFileSync, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import path from 'node:path'

import { sanitizeProjectName } from './worktree-context.mjs'

const ROOT_PROJECT = 'careos'
const CAREOS_PROJECT_RE = /^careos(-.+)?$/

function listComposeProjects() {
  const out = execFileSync('docker', ['compose', 'ls', '-a', '--format', 'json'], {
    encoding: 'utf8',
  })
  const parsed = JSON.parse(out)
  return parsed
    .map((entry) => entry.Name)
    .filter((name) => CAREOS_PROJECT_RE.test(name))
}

function listWorktreePaths() {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' })
  const paths = []
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) paths.push(line.slice('worktree '.length).trim())
  }
  return paths
}

function expectedProjectNames() {
  const names = new Set([ROOT_PROJECT])
  const paths = listWorktreePaths()
  if (paths.length === 0) return names
  // First worktree in the list is the main checkout -> root project name.
  for (const p of paths.slice(1)) {
    names.add(sanitizeProjectName(`careos-${path.basename(p)}`))
  }
  return names
}

async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await new Promise((resolve) => rl.question(`${message} [y/N] `, resolve))
    return answer.trim().toLowerCase() === 'y'
  } finally {
    rl.close()
  }
}

function removeProject(name) {
  const result = spawnSync('docker', ['compose', '--project-name', name, 'down', '-v'], {
    stdio: 'inherit',
  })
  return result.status === 0
}

const autoYes = process.argv.includes('--yes') || process.argv.includes('-y')

const projects = listComposeProjects()
const expected = expectedProjectNames()
const orphans = projects.filter((name) => !expected.has(name))

if (orphans.length === 0) {
  console.log('[db:prune] No orphaned DB projects found.')
  process.exit(0)
}

console.log(`[db:prune] Orphan Compose projects:\n${orphans.map((n) => `  - ${n}`).join('\n')}`)

const proceed = autoYes || (await confirm(`Remove ${orphans.length} orphan(s) and their volumes?`))
if (!proceed) {
  console.log('[db:prune] Cancelled.')
  process.exit(0)
}

let failures = 0
for (const name of orphans) {
  console.log(`\n[db:prune] Removing ${name}...`)
  if (!removeProject(name)) failures += 1
}

process.exit(failures === 0 ? 0 : 1)
