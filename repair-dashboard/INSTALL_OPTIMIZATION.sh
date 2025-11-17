#!/bin/bash

# GenThrust RO Tracker - Bundle Optimization Installation
# This script installs required dependencies for bundle optimization

echo "📦 Installing bundle optimization dependencies..."
echo ""

cd "$(dirname "$0")"

# Install required dev dependencies
npm install -D \
  rollup-plugin-visualizer \
  vite-plugin-compression

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "Next steps:"
echo "1. Build the project: npm run build"
echo "2. Check bundle stats: open dist/stats.html"
echo "3. Preview production build: npm run preview"
echo ""
echo "See BUNDLE_OPTIMIZATION.md for full documentation."
