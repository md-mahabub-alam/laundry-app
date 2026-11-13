#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "🧺 Preparing FreshFold Laundry repository..."

# Initialize git if not already done
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

# Configure remote if not present
if ! git remote | grep -q "origin"; then
  echo "Checking GitHub authentication..."
  if command -v gh &> /dev/null && gh auth status &> /dev/null; then
    echo "Creating GitHub repository using gh CLI..."
    gh repo create laundry-app --public --source=. --remote=origin --push || true
  else
    echo "Adding remote origin..."
    git remote add origin https://github.com/md-mahabub-alam/laundry-app.git || true
  fi
fi

git add .
git commit -m "feat: complete FreshFold laundry platform with online payment, prepayment & COD" || echo "Nothing new to commit"

echo "Pushing to GitHub..."
git push -u origin main

echo "✅ Successfully pushed to GitHub!"

