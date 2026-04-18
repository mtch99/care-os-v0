import { spawnSync } from 'node:child_process'

import { getWorktreeContext } from './worktree-context.mjs'

const { projectName, worktreeRoot, isWorktree } = getWorktreeContext()

console.log(`[db:down] project=${projectName} ${isWorktree ? '(worktree)' : '(root)'}`)

const result = spawnSync('docker', ['compose', '--project-name', projectName, 'down'], {
  cwd: worktreeRoot,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
