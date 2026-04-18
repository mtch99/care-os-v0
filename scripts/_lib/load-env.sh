# Shared env loader for manual test scripts.
#
# Source this file from any script that needs DATABASE_URL (or other env
# vars pulled from the repo's .env files) to run correctly in both the
# root checkout and in worktrees.
#
# Usage (from a script at scripts/test-<branch>/00-setup.sh):
#
#   source "$(dirname "$0")/../_lib/load-env.sh"
#
# Why this exists: in a worktree, `pnpm db:up` assigns a dynamic host
# port for Postgres and rewrites packages/db/.env so the app can reach
# it. A hardcoded fallback like :5432 works in the root checkout but
# fails inside a worktree. Sourcing the .env file keeps scripts portable
# across both layouts without the caller having to know.
#
# When new env-sourced vars are needed in the future (e.g. an API key
# for a script that calls an external service), extend this file — not
# every individual script.

# Resolve the repo root via this file's location, so the loader works
# no matter where the sourcing script lives or which cwd it was invoked
# from. BASH_SOURCE[0] is the path to this loader, not the caller.
__loader_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
__repo_root="$(cd "$__loader_dir/.." && pwd)"
__repo_root="$(cd "$__repo_root/.." && pwd)"

# Pull DATABASE_URL from packages/db/.env if the caller hasn't set it.
# The -z check lets a user override inline (e.g. DATABASE_URL=... ./foo.sh
# to point at a staging DB) without the .env file silently clobbering it.
if [[ -z "${DATABASE_URL:-}" && -f "$__repo_root/packages/db/.env" ]]; then
  export "$(grep '^DATABASE_URL=' "$__repo_root/packages/db/.env")"
fi

# Final fallback for environments with no .env file yet (fresh clone
# before `pnpm db:up`, CI, etc.). The root checkout's fixed port.
: "${DATABASE_URL:=postgresql://postgres:careos@localhost:5432/careos}"

unset __loader_dir __repo_root
