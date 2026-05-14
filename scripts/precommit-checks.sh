#!/usr/bin/env bash
# Dukanchi precommit file-level checks — Day 6 / Session 93 / Phase 1.
#
# Invoked by lint-staged via .lintstagedrc.json on every staged file
# (one invocation per pre-commit; staged paths passed as $@).
#
# Checks per file:
#   1. Block real .env files. Matches `.env` or `.env.<env>` where
#      <env> is lowercase letters (e.g., .env.local, .env.production).
#      EXPLICITLY allows .env.example (the documented contract).
#   2. Reject high-entropy secret patterns: AWS access keys, GitHub
#      tokens, OpenAI keys, Slack tokens, JWT-like blobs. Conservative
#      regex — false positives can be bypassed with `git commit
#      --no-verify` (used sparingly).
#
# Exit non-zero on ANY hit. lint-staged surfaces the script's stderr
# verbatim, so devs see the offending file + reason inline at commit.
#
# Hooks chain: husky pre-commit → lint-staged → this script.

set -euo pipefail

EXIT=0

for f in "$@"; do
  # Skip deleted files (lint-staged passes paths but file may be gone)
  [ -e "$f" ] || continue

  # ── (1) Real .env file guard ─────────────────────────────────────────
  basename=$(basename "$f")
  case "$basename" in
    .env)
      echo "❌ Refusing to commit .env file: $f" >&2
      echo "   .env contains secrets and must never enter git history." >&2
      echo "   Tip: keep secrets in your local .env and document the" >&2
      echo "        public contract in .env.example." >&2
      EXIT=1
      ;;
    .env.example)
      # documented public contract — allowed
      ;;
    .env.*)
      echo "❌ Refusing to commit env-variant file: $f" >&2
      echo "   Any .env.<environment> file likely carries secrets." >&2
      echo "   If this is a public template, rename to .env.example." >&2
      EXIT=1
      ;;
  esac

  # ── (2) High-entropy secret patterns ─────────────────────────────────
  # Only scan text files (skip binaries, images, lockfiles).
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf|*.zip|*.tar*|*.apk|*.aab) continue ;;
    package-lock.json|admin-panel/package-lock.json) continue ;;
  esac

  # Patterns (conservative, well-known prefixes):
  #   AWS access key:       AKIA[0-9A-Z]{16}
  #   GitHub PAT:           ghp_[A-Za-z0-9]{36}
  #   GitHub OAuth:         gho_[A-Za-z0-9]{36}
  #   OpenAI / Anthropic:   sk-[A-Za-z0-9]{32,}
  #   Slack bot/user:       xox[bpas]-[A-Za-z0-9-]{10,}
  #   Stripe live key:      sk_live_[A-Za-z0-9]{20,}
  #   JWT-like (3-part b64): eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}
  if grep -qE 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{32,}|xox[bpas]-[A-Za-z0-9-]{10,}|sk_live_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}' "$f" 2>/dev/null; then
    echo "❌ High-entropy secret pattern detected in: $f" >&2
    echo "   Looks like one of: AWS/GitHub/OpenAI/Slack/Stripe key, or JWT." >&2
    echo "   If this is intentional (test fixture, example, etc.) bypass" >&2
    echo "   with: git commit --no-verify" >&2
    EXIT=1
  fi
done

exit $EXIT
