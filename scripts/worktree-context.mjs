import { execSync } from 'node:child_process'
import path from 'node:path'

const COMPOSE_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/

export function sanitizeProjectName(raw) {
  if (typeof raw !== 'string') throw new Error('sanitizeProjectName: input must be a string')
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('sanitizeProjectName: input must not be empty')
  let s = trimmed.toLowerCase()
  s = s.replace(/[^a-z0-9_-]+/g, '-')
  s = s.replace(/-+/g, '-')
  s = s.replace(/^[-_]+|[-_]+$/g, '')
  s = s.replace(/^[^a-z0-9]+/, '')
  if (!s || !COMPOSE_NAME_RE.test(s)) {
    throw new Error(
      `sanitizeProjectName: "${raw}" cannot be reduced to a valid Compose project name`,
    )
  }
  return s
}

function gitOutput(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim()
}

export function getWorktreeContext(cwd = process.cwd()) {
  const worktreeRoot = gitOutput('rev-parse --show-toplevel', cwd)
  const commonDir = path.resolve(worktreeRoot, gitOutput('rev-parse --git-common-dir', cwd))
  const gitDir = path.resolve(worktreeRoot, gitOutput('rev-parse --git-dir', cwd))
  const isWorktree = commonDir !== gitDir

  if (isWorktree) {
    const base = path.basename(worktreeRoot)
    return {
      isWorktree: true,
      projectName: sanitizeProjectName(`careos-${base}`),
      hostPortEnv: '0',
      worktreeRoot,
    }
  }

  return {
    isWorktree: false,
    projectName: 'careos',
    hostPortEnv: '5432',
    worktreeRoot,
  }
}
