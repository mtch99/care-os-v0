import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { sanitizeProjectName } from './worktree-context.mjs'

function listWorktreePaths() {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' })
  const paths = []
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) paths.push(line.slice('worktree '.length).trim())
  }
  return paths
}

function resolveTarget(argument) {
  const worktrees = listWorktreePaths()
  if (worktrees.length === 0) {
    console.error('[worktree:remove] No worktrees registered with git.')
    process.exit(1)
  }
  const mainRoot = worktrees[0]
  const candidates = worktrees.slice(1)

  const absoluteArg = path.isAbsolute(argument) ? argument : null
  const matchedPath = absoluteArg && candidates.includes(absoluteArg) ? absoluteArg : null
  const matchedBySlug = candidates.find((p) => path.basename(p) === argument)
  const target = matchedPath ?? matchedBySlug

  if (!target) {
    console.error(
      `[worktree:remove] No worktree matching "${argument}". Known worktrees:\n${candidates
        .map((p) => `  - ${path.basename(p)} (${p})`)
        .join('\n')}`,
    )
    process.exit(1)
  }

  if (target === mainRoot) {
    console.error('[worktree:remove] Refusing to act on the main repository.')
    process.exit(1)
  }

  return {
    worktreePath: target,
    projectName: sanitizeProjectName(`careos-${path.basename(target)}`),
  }
}

function nukeComposeProject(projectName) {
  const result = spawnSync('docker', ['compose', '--project-name', projectName, 'down', '-v'], {
    stdio: 'inherit',
  })
  return result.status === 0
}

function gitWorktreeRemove(worktreePath) {
  const result = spawnSync('git', ['worktree', 'remove', worktreePath], { stdio: 'inherit' })
  return result.status === 0
}

function runPrune() {
  spawnSync('node', ['scripts/db-prune.mjs', '--yes'], { stdio: 'inherit' })
}

const argument = process.argv[2]
if (!argument) {
  console.error('Usage: pnpm worktree:remove <slug-or-path>')
  process.exit(1)
}

const { worktreePath, projectName } = resolveTarget(argument)

console.log(`[worktree:remove] target=${worktreePath}`)
console.log(`[worktree:remove] compose project=${projectName}`)

const gitRemoved = gitWorktreeRemove(worktreePath)
if (!gitRemoved) {
  console.error(
    '[worktree:remove] git worktree remove failed. Nothing nuked yet. Resolve and retry.',
  )
  process.exit(1)
}

const composeNuked = nukeComposeProject(projectName)
if (!composeNuked) {
  console.warn(
    `[worktree:remove] compose down -v for ${projectName} returned non-zero; continuing.`,
  )
}

if (existsSync(worktreePath)) {
  console.warn(`[worktree:remove] Directory still exists at ${worktreePath}; inspect manually.`)
}

runPrune()

console.log(
  `[worktree:remove] Done. Removed worktree ${path.basename(worktreePath)} and project ${projectName}.`,
)
