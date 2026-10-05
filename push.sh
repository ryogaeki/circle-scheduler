#!/usr/bin/env bash

set -u

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
commit_message="${*:-}"

show_usage() {
  echo "Usage:"
  echo "  ./push.sh"
  echo "      未コミット変更がないときだけ push する"
  echo ""
  echo "  ./push.sh \"commit message\""
  echo "      git add . -> git commit -> git push する"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  show_usage
  exit 0
fi

if ! git -C "$repo_dir" remote get-url origin >/dev/null 2>&1; then
  echo "origin が未設定です。先に remote を設定してください。"
  echo "例: git remote add origin git@github.com:ryogaeki/circle-scheduler.git"
  exit 1
fi

branch_name="$(git -C "$repo_dir" branch --show-current)"
if [[ -z "$branch_name" ]]; then
  echo "現在のブランチ名を取得できません。"
  exit 1
fi

if [[ -n "$commit_message" ]]; then
  git -C "$repo_dir" add .

  if git -C "$repo_dir" diff --cached --quiet; then
    echo "コミットする変更はありません。"
  else
    git -C "$repo_dir" commit -m "$commit_message" || exit 1
  fi
else
  has_uncommitted_changes=0
  git -C "$repo_dir" diff --quiet || has_uncommitted_changes=1
  git -C "$repo_dir" diff --cached --quiet || has_uncommitted_changes=1
  [[ -z "$(git -C "$repo_dir" ls-files --others --exclude-standard)" ]] || has_uncommitted_changes=1

  if [[ "$has_uncommitted_changes" -ne 0 ]]; then
    echo "未コミット変更があります。コミットメッセージを付けて再実行してください。"
    echo "例: ./push.sh \"Update scheduler\""
    git -C "$repo_dir" status --short
    exit 1
  fi
fi

git -C "$repo_dir" push -u origin "$branch_name"
