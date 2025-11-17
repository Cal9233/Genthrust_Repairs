# Bundle Size Optimization Guide

## Overview

This document describes the bundle optimization strategies implemented for the GenThrust RO Tracker application.

---

## Implementation

### 1. Manual Chunk Splitting

The build is split into strategic chunks for optimal caching and parallel loading:

| Chunk | Contents | Why Separate? |
|-------|----------|---------------|
| **vendor-react** | React, ReactDOM | Core framework, rarely changes |
| **vendor-ui** | All @radix-ui components | UI library, stable dependency |
| **vendor-ms** | @azure/msal-*, microsoft-graph-client | Microsoft auth/API, large library |
| **vendor-ai** | @anthropic-ai/sdk | AI functionality, used in specific features |
| **vendor-query** | @tanstack/react-query | Data fetching library, used everywhere |
| **vendor-date** | date-fns | Date utilities, can be large |
| **vendor-ui-utils** | lucide-react, clsx, tailwind-merge, cva | UI utilities |
| **vendor-other** | All other node_modules | Smaller dependencies |
| **main** | Application code | Changes frequently |

### 2. Compression

- **Gzip compression**: `.gz` files for all assets > 10KB
- **Brotli compression**: `.br` files (15-20% better than gzip)
- Modern browsers auto-select best compression

### 3. Tree Shaking

Aggressive tree shaking configuration:
- `moduleSideEffects: 'no-external'` - Assume no side effects in node_modules
- `propertyReadSideEffects: false` - Remove unused object properties
- `target: 'es2020'` - Modern target for better optimization

### 4. Production Sourcemaps

- `sourcemap: 'hidden'` - Generated but not referenced
- Enables debugging in production without exposing source code
- Maps available in artifacts for error tracking

### 5. Bundle Analyzer

- Generates `dist/stats.html` after every build
- Visualizes bundle composition as treemap
- Shows gzipped and brotli sizes
- Helps identify optimization opportunities

---

## Installation

Install required dependencies:

```bash
cd repair-dashboard
npm install -D rollup-plugin-visualizer vite-plugin-compression
```

---

## Usage

### Build for Production

```bash
npm run build
```

This will:
1. Build optimized chunks
2. Generate gzip and brotli compressed files
3. Create sourcemaps
4. Generate bundle analysis at `dist/stats.html`

### Analyze Bundle

```bash
npm run build
open dist/stats.html
```

Or set `open: true` in vite.config.ts visualizer options to auto-open.

### Preview Production Build

```bash
npm run preview
```

### CI/CD Integration

Bundle size is automatically tracked on every PR via GitHub Actions:
- Compares bundle size with base branch
- Warns if size increases > 100KB
- Fails if total bundle > 5MB
- Uploads stats.html as artifact

---

## Expected Bundle Size Improvements

### Before Optimization (Estimated)

**Without chunk splitting:**
```
dist/
  assets/
    index-abc123.js           2.5 MB (entire app + all vendors)
    index-abc123.css          150 KB
Total: ~2.65 MB (uncompressed)
```

**Problems:**
- ❌ Large initial download
- ❌ Poor caching (entire bundle changes on any update)
- ❌ No parallel loading
- ❌ No compression

---

### After Optimization (Estimated)

**With chunk splitting + compression:**

```
dist/
  assets/
    js/
      index-abc123.js              80 KB  (15 KB gzip, 12 KB brotli)  - Main app
      vendor-react-def456.js      150 KB  (45 KB gzip, 38 KB brotli)  - React core
      vendor-ui-ghi789.js         200 KB  (60 KB gzip, 50 KB brotli)  - Radix UI
      vendor-ms-jkl012.js         400 KB (120 KB gzip, 95 KB brotli)  - MSAL/Graph
      vendor-ai-mno345.js         300 KB  (90 KB gzip, 75 KB brotli)  - Anthropic
      vendor-query-pqr678.js      120 KB  (35 KB gzip, 28 KB brotli)  - TanStack
      vendor-date-stu901.js        80 KB  (25 KB gzip, 20 KB brotli)  - date-fns
      vendor-ui-utils-vwx234.js   100 KB  (30 KB gzip, 25 KB brotli)  - UI utils
      vendor-other-yz567.js       150 KB  (45 KB gzip, 38 KB brotli)  - Other deps

    css/
      index-abc123.css            150 KB  (25 KB gzip, 20 KB brotli)

Total uncompressed: ~1.73 MB
Total gzipped:      ~490 KB (72% reduction!)
Total brotli:       ~401 KB (77% reduction!)
```

**Benefits:**
- ✅ **Initial load**: Only ~200 KB (main + vendor-react + CSS)
- ✅ **Caching**: Vendor chunks rarely change (cache hit rate ~90%)
- ✅ **Parallel loading**: Browser loads 6+ chunks simultaneously
- ✅ **Compression**: 72-77% size reduction
- ✅ **Code splitting**: AI chunk loaded only when needed

---

## Optimization Breakdown

### Size Reductions

| Optimization | Savings | Method |
|--------------|---------|--------|
| Gzip compression | ~65-70% | Compress all assets |
| Brotli compression | ~70-77% | Better compression algorithm |
| Tree shaking | ~10-15% | Remove unused code |
| Minification | ~30-40% | Remove whitespace, shorten names |
| Chunk splitting | N/A | Better caching, not size reduction |
| Drop console.log | ~1-2% | Remove debug code |

### Load Time Improvements (Estimated)

**Before:**
- First load: 2.65 MB download = ~21s on 3G (~1 Mbps)
- Subsequent loads: Same (no caching benefit)

**After (with brotli):**
- First load: 401 KB download = ~3.2s on 3G
- Subsequent loads: ~80 KB (main chunk only) = ~0.6s on 3G

**Improvement: 85% faster initial load, 97% faster subsequent loads**

---

## Performance Metrics

### Expected Lighthouse Scores

**Before:**
- Performance: ~60-70
- First Contentful Paint: ~3.5s
- Time to Interactive: ~8s
- Speed Index: ~5s

**After:**
- Performance: ~85-95
- First Contentful Paint: ~1.2s
- Time to Interactive: ~2.5s
- Speed Index: ~2.0s

---

## Chunk Loading Strategy

### Critical Path (Initial Load)

```
1. index.html (5 KB)
2. vendor-react.js (38 KB brotli) - Parallel
3. main.js (12 KB brotli)         - Parallel
4. index.css (20 KB brotli)       - Parallel
-----------------------------------------
Total: ~75 KB for app shell
```

### Secondary Load (After Parse)

```
5. vendor-ui.js (50 KB brotli)       - Parallel
6. vendor-query.js (28 KB brotli)    - Parallel
7. vendor-ms.js (95 KB brotli)       - Parallel
8. vendor-date.js (20 KB brotli)     - Parallel
9. vendor-ui-utils.js (25 KB brotli) - Parallel
-----------------------------------------
Total: ~218 KB for core functionality
```

### Lazy Load (On Demand)

```
10. vendor-ai.js (75 KB brotli)      - When AI assistant opened
11. Other route chunks               - When navigating
-----------------------------------------
Total: Loaded only when needed
```

---

## Monitoring Bundle Size

### Local Development

```bash
# Build and check sizes
npm run build
ls -lh dist/assets/js/

# Visualize bundle
open dist/stats.html
```

### CI/CD (GitHub Actions)

- Automatic bundle size check on every PR
- Compares with base branch
- Warns if increase > 100KB
- Fails if total > 5MB
- Uploads stats.html artifact

### Setting Up Alerts

Add to `.github/workflows/bundle-size.yml`:

```yaml
- name: Check bundle size limits
  run: |
    MAX_TOTAL_SIZE=5000  # 5MB
    MAX_CHUNK_SIZE=1000  # 1MB per chunk
    # ... (already implemented)
```

---

## Best Practices

### 1. Regular Monitoring

- Check `dist/stats.html` after major changes
- Review bundle size in PR comments
- Set up alerts for size increases

### 2. Code Splitting

```typescript
// ❌ Bad - loads all code upfront
import { HeavyComponent } from './heavy'

// ✅ Good - loads on demand
const HeavyComponent = lazy(() => import('./heavy'))
```

### 3. Tree Shaking Friendly Imports

```typescript
// ❌ Bad - imports entire library
import _ from 'lodash'

// ✅ Good - imports only what's needed
import { debounce } from 'lodash-es'

// ✅ Better - individual import
import debounce from 'lodash-es/debounce'
```

### 4. Analyze Dependencies

```bash
# Check what's importing a package
npm run build
# Review stats.html to see dependency sizes
```

### 5. Use Dynamic Imports for Heavy Features

```typescript
// AI assistant - only load when user opens it
const openAIAssistant = async () => {
  const { AnthropicAgent } = await import('./services/anthropicAgent')
  // Use agent
}
```

---

## Troubleshooting

### Build Errors

**Error: `rollup-plugin-visualizer` not found**
```bash
npm install -D rollup-plugin-visualizer
```

**Error: `vite-plugin-compression` not found**
```bash
npm install -D vite-plugin-compression
```

### Large Bundle Size

1. Check `dist/stats.html` for culprits
2. Review dependencies in package.json
3. Use dynamic imports for large features
4. Consider lighter alternatives

### Sourcemap Issues

If sourcemaps too large:
```typescript
// In vite.config.ts
build: {
  sourcemap: false, // Disable completely
  // or
  sourcemap: 'hidden', // Generate but don't reference
}
```

---

## Advanced Optimizations (Future)

### 1. Route-based Code Splitting

```typescript
const Dashboard = lazy(() => import('./components/Dashboard'))
const ShopDirectory = lazy(() => import('./components/ShopDirectory'))
```

### 2. Preloading Critical Chunks

```html
<link rel="preload" href="/assets/js/vendor-react.js" as="script">
```

### 3. Service Worker Caching

```typescript
// Cache vendor chunks aggressively
workbox.precaching.precacheAndRoute([
  { url: '/assets/js/vendor-react.js', revision: 'v1' }
])
```

### 4. Module Federation (Micro-frontends)

For very large apps, consider splitting into separate apps:
- Main app (Dashboard, ROs)
- Admin app (Analytics, Settings)
- Mobile app (iOS/Android)

---

## Resources

- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)
- [Bundle Size Best Practices](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting)

---

## Version History

**v1.0** (2025-11-17)
- Initial implementation
- Manual chunk splitting (9 chunks)
- Gzip + Brotli compression
- Bundle analyzer
- CI/CD integration
- Expected 72-77% size reduction

---

**Maintained by:** Cal9233/Claude Code
