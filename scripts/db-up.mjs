import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { getWorktreeContext } from './worktree-context.mjs'

const DATABASE_URL_LINE = /^DATABASE_URL=.*$/m
const ENV_FILES = ['apps/api/.env', 'packages/db/.env']

function composeUp({ projectName, hostPortEnv, worktreeRoot }) {
  const result = spawnSync(
    'docker',
    ['compose', '--project-name', projectName, 'up', '-d', '--wait'],
    {
      cwd: worktreeRoot,
      stdio: 'inherit',
      env: { ...process.env, POSTGRES_HOST_PORT: hostPortEnv },
    },
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function readAssignedHostPort({ projectName, worktreeRoot }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = execFileSync(
        'docker',
        ['compose', '--project-name', projectName, 'port', 'postgres', '5432'],
        { cwd: worktreeRoot, encoding: 'utf8' },
      ).trim()
      if (out) {
        const firstLine = out.split('\n')[0]
        const match = firstLine.match(/:(\d+)$/)
        if (match) return match[1]
      }
    } catch {
      // fall through and retry
    }
    spawnSync('sleep', ['0.5'])
  }
  console.error(`[db:up] Could not resolve host port for project ${projectName} after 3 attempts.`)
  process.exit(1)
}

function rewriteDatabaseUrl(worktreeRoot, port) {
  const newUrl = `DATABASE_URL=postgresql://postgres:careos@localhost:${port}/careos`
  const skipped = []
  for (const relativePath of ENV_FILES) {
    const envPath = path.join(worktreeRoot, relativePath)
    if (!existsSync(envPath)) {
      skipped.push(relativePath)
      continue
    }
    const original = readFileSync(envPath, 'utf8')
    const updated = DATABASE_URL_LINE.test(original)
      ? original.replace(DATABASE_URL_LINE, newUrl)
      : `${original.endsWith('\n') ? original : `${original}\n`}${newUrl}\n`
    writeFileSync(envPath, updated)
  }
  if (skipped.length > 0) {
    console.log(`[db:up] Skipped missing env files: ${skipped.join(', ')}`)
  }
  return newUrl
}

const context = getWorktreeContext()
console.log(
  `[db:up] project=${context.projectName} ${context.isWorktree ? '(worktree)' : '(root)'}`,
)

composeUp(context)

if (context.isWorktree) {
  const port = readAssignedHostPort(context)
  const url = rewriteDatabaseUrl(context.worktreeRoot, port)
  console.log(`[db:up] Postgres ready on host port ${port}`)
  console.log(`[db:up] ${url}`)
}
