Analyze the staged git changes and create a comprehensive commit message, then commit with co-authorship.

## Steps

1. Run `git diff --cached` to see all staged changes
2. Run `git status` to see which files are staged
3. Run `git log --oneline -5` to understand the commit message style used in this repo
4. Analyze the diff to understand:
   - What files changed and why
   - The nature of the change (feature, fix, refactor, chore, etc.)
   - The scope/impact of the changes
5. Draft a commit message following this structure:
   - Subject line: `<type>(<scope>): <imperative summary>` (max 72 chars)
   - Blank line
   - Body: explain _what_ and _why_ (not _how_), referencing packages/modules affected
   - If multiple logical concerns exist, list them as bullet points
6. Get the current git user with `git config user.name` and `git config user.email`
7. Commit using:

```bash
git commit -m "$(cat <<'EOF'
<subject line>

<body>

Co-Authored-By: <git user name> <<git user email>>
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Do not push. Show the commit message to the user before committing and ask for confirmation.
