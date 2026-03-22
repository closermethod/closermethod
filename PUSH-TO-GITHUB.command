#!/bin/bash
clear
echo "🚀 PUSHING UGC CLOSER KIT TO GITHUB"
echo "====================================="
echo ""

export GH=/tmp/gh_install/gh_2.88.1_macOS_arm64/bin/gh
cd /Users/elisabeth/Desktop/LIVE-FUNNEL-SITE

# Check if already authenticated
if ! $GH auth status >/dev/null 2>&1; then
  echo "📱 GitHub needs you to verify in your browser."
  echo "   A browser window will open. Enter the code shown here."
  echo ""
  $GH auth login --hostname github.com --git-protocol https --web
fi

echo ""
echo "✅ Authenticated! Pushing all 51 files..."
echo ""

git remote set-url origin https://github.com/closermethod/closermethod.git 2>/dev/null
$GH repo set-default closermethod/closermethod 2>/dev/null

# Push using gh credential helper
git -c credential.helper='!/tmp/gh_install/gh_2.88.1_macOS_arm64/bin/gh auth git-credential' push -u origin main

echo ""
echo "✅✅✅ DONE! All files live at:"
echo "   https://github.com/closermethod/closermethod"
echo ""
read -p "Press Enter to close..."
