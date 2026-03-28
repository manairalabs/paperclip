---
name: cli-power-tools
description: >
  Use modern CLI tools (ripgrep, fd, jq) for fast file search, content search,
  and JSON processing. Prefer these over built-in tools for large codebases.
---

# CLI Power Tools

You have access to modern CLI tools that are faster and more powerful than built-in alternatives.

## Available Tools

### ripgrep (rg) — Fast content search
```bash
rg "pattern" path/           # Search for pattern
rg -t py "def main"          # Search only Python files
rg -l "TODO"                 # List files containing TODO
rg -C 3 "error"              # Show 3 lines of context
rg --json "pattern"          # Output as JSON
```

### fd — Fast file finder
```bash
fd "pattern"                 # Find files matching pattern
fd -e ts                     # Find all .ts files
fd -e test.ts                # Find test files
fd -t d node_modules         # Find directories named node_modules
fd -H .env                   # Include hidden files
```

### jq — JSON processor
```bash
cat file.json | jq '.key'         # Extract key
cat file.json | jq '.items[]'     # Iterate array
cat file.json | jq 'length'       # Count items
curl -s url | jq '.data.name'     # Process API response
```

### gh — GitHub CLI
```bash
gh pr list                   # List pull requests
gh pr create --title "..."   # Create PR
gh issue list                # List issues
gh repo clone owner/repo     # Clone repo
gh api repos/owner/repo      # API calls
```

## When to Use

- **rg** instead of grep — 10x faster, respects .gitignore
- **fd** instead of find — simpler syntax, faster, respects .gitignore
- **jq** for any JSON processing in shell
- **gh** for all GitHub operations

Do NOT use these tools for tasks outside their domain. Use the appropriate built-in tools (Read, Edit, Bash) for normal file operations.
