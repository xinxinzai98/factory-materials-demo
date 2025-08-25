#!/usr/bin/env bash
set -euo pipefail

# 一键推送：在仓库根目录下提交当前更改并推送到 origin 的当前分支
# 用法：
#   scripts/push-git.sh "feat: 更新入/出库列表"
# 若不传 message，将使用默认消息（含日期时间）

# 进入仓库根目录
if git rev-parse --git-dir >/dev/null 2>&1; then
  REPO_ROOT=$(git rev-parse --show-toplevel)
  cd "$REPO_ROOT"
else
  echo "当前目录不是 Git 仓库，请在项目根目录或其子目录中执行。" >&2
  exit 1
fi

MSG="${1:-}"
if [ -z "$MSG" ]; then
  MSG="chore: update $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 确认远端
if ! git remote get-url origin >/dev/null 2>&1; then
  if [ -n "${GIT_REMOTE:-}" ]; then
    echo "未检测到 origin，使用 GIT_REMOTE 设置远端：$GIT_REMOTE"
    git remote add origin "$GIT_REMOTE"
  else
    echo "未检测到 origin 远端。请设置 GIT_REMOTE 环境变量或手动执行：git remote add origin <url>" >&2
    exit 1
  fi
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 暂存并判断是否有变更
git add -A
if git diff --cached --quiet; then
  echo "没有新的变更需要提交，直接推送分支 $BRANCH。"
else
  echo "提交变更：$MSG"
  git commit -m "$MSG" || true
fi

# 推送（首次推送会添加 upstream）
echo "推送到 origin/$BRANCH ..."
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git push
else
  git push -u origin "$BRANCH"
fi

echo "推送完成。"
