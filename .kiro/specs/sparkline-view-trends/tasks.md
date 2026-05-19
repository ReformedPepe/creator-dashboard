# Implementation Plan: Sparkline View Trends

## Overview

Implementacja mini-wykresów (sparkline) pod filmami w VideoCard, wizualizujących trend wyświetleń w czasie. Podejście: pure SVG bez zewnętrznej biblioteki chartingowej. Implementacja przebiega warstwami: test setup → CSS variables → History Store → Trend Calculator → hook → komponent SVG → integracja z istniejącymi komponentami.

## Tasks

- [x] 1. Set up test infrastructure
  - [x] 1.1 Install test dependencies and configure Vitest
    - Install vitest, fast-check, @testing-library/react, @testing-library/jest-dom, jsdom as dev dependencies
    - Add `test` script to package.json: `"test": "vitest --run"`
    - Add `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.js'] }` to vite.config.js
    - Create `src/test/setup.js` with `@testing-library/jest-dom` import
    - _Requirements: Testing Strategy from design_

- [x] 2. Add CSS variables for trend colors
  - [x] 2.1 Add trend color CSS variables to index.css
    - Add `--color-trend-up: #22C55E`, `--color-trend-down: #EF4444`, `--color-trend-neutral: #6B7280` to `@theme` block
    - Add `--color-trend-up: #4ADE80`, `--color-trend-down: #F87171`, `--color-trend-neutral: #9CA3AF` to `html.dark` block
    - _Requirements: 3.1, 3.2, 3.3, 4.2, 4.5_

- [x] 3. Implement History Store module
  - [x] 3.1 Create src/utils/viewHistory.js with core functions
    - Implement `saveSnapshot(videoId, viewCount)` — appends DataPoint to localStorage, skips duplicates, enforces 50-point cap
    - Implement `saveSnapshots(videos)` — batch save for array of `{id, viewCount}`
    - Implement `loadHistory(videoId)` — returns sorted DataPoint array from localStorage
    - Implement `removeHistories(videoIds)` — deletes history entries for given video IDs
    - Implement `pruneOldestEntries()` — removes 25% oldest points from all histories on QuotaExceededError, retry max 3×
    - Use localStorage key pattern: `creator-dashboard-view-history-{videoId}`
    - Handle JSON.parse errors gracefully (return empty array, log warning)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.2, 5.4_

  - [ ]* 3.2 Write property test: Save snapshot appends to history (Property 1)
    - **Property 1: Save snapshot appends to history**
    - **Validates: Requirements 1.1**

  - [ ]* 3.3 Write property test: Duplicate viewCount is not saved (Property 2)
    - **Property 2: Duplicate viewCount is not saved**
    - **Validates: Requirements 1.3**

  - [ ]* 3.4 Write property test: History never exceeds 50 points (Property 3)
    - **Property 3: History never exceeds 50 points**
    - **Validates: Requirements 1.4**

  - [ ]* 3.5 Write property test: QuotaExceeded pruning frees space (Property 4)
    - **Property 4: QuotaExceeded pruning frees space**
    - **Validates: Requirements 1.5**

  - [ ]* 3.6 Write property test: Remove histories deletes all specified entries (Property 5)
    - **Property 5: Remove histories deletes all specified entries**
    - **Validates: Requirements 1.6**

- [x] 4. Checkpoint - Ensure History Store tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Trend Calculator module
  - [x] 5.1 Create src/utils/trendCalculator.js
    - Implement `calculatePercentChange(dataPoints)` — formula: `((last - first) / first) * 100`, handle division by zero (return 0 when first === 0)
    - Implement `calculateTrend(dataPoints)` — returns `'up'` (≥1%), `'down'` (≤-1%), or `'neutral'` (between -1% and 1%), returns `'neutral'` for <2 points
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [ ]* 5.2 Write property test: Trend classification matches percent change formula (Property 8)
    - **Property 8: Trend classification matches percent change formula**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.6**

- [x] 6. Implement useViewHistory hook
  - [x] 6.1 Create src/hooks/useViewHistory.js
    - Import `loadHistory` from viewHistory.js and `calculateTrend` from trendCalculator.js
    - Load history synchronously from localStorage on mount
    - Return `{ dataPoints, trend }` where dataPoints is sliced to max 30 most recent points
    - _Requirements: 2.1, 3.1, 3.2, 3.3_

  - [ ]* 6.2 Write property test: Display uses at most 30 most recent points (Property 6)
    - **Property 6: Display uses at most 30 most recent points**
    - **Validates: Requirements 2.1**

- [x] 7. Implement SparklineChart component
  - [x] 7.1 Create src/components/SparklineChart.jsx with SVG rendering
    - Render SVG element with width 100% and height 32px
    - Implement Y-coordinate scaling with 10% margin: `adjustedMin = min - range*0.1`, `adjustedMax = max + range*0.1`
    - Handle edge cases: 0 points (return null), 1 point (circle 4px + "Za mało danych" text), identical values (horizontal centered line)
    - Render polyline with stroke-width 1.5px, no axes/labels/legend
    - Apply trend color via CSS variables (`--color-trend-up`, `--color-trend-down`, `--color-trend-neutral`)
    - Add gradient fill under line with opacity 0.1
    - Implement stroke-dashoffset animation (300ms ease-out) on mount
    - Apply border-radius via `--radius-video` (14px), margin-top 8px
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.2 Implement tooltip and hover interaction in SparklineChart
    - Implement `findNearestPoint(cursorX, points)` — snap to closest point on X axis
    - Render vertical indicator line at cursor X position on hover
    - Render tooltip with format: `"{formatViewCount(viewCount)} — {DD.MM.YYYY HH:mm}"`
    - Position tooltip to avoid overflow (flip to left side when right edge exceeded)
    - Hide tooltip and indicator within 150ms on mouse leave
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 7.3 Write property test: Y-coordinate scaling correctness (Property 7)
    - **Property 7: Y-coordinate scaling correctness**
    - **Validates: Requirements 2.6, 2.7**

  - [ ]* 7.4 Write property test: Snap to nearest point (Property 9)
    - **Property 9: Snap to nearest point**
    - **Validates: Requirements 6.1**

  - [ ]* 7.5 Write property test: Tooltip positioning within bounds (Property 10)
    - **Property 10: Tooltip positioning within bounds**
    - **Validates: Requirements 6.6**

- [x] 8. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integration with existing components
  - [x] 9.1 Modify VideoCard.jsx to include SparklineChart
    - Import `useViewHistory` hook and `SparklineChart` component
    - Call `useViewHistory(video.id || video.videoId)` to get dataPoints and trend
    - Render `<SparklineChart dataPoints={dataPoints} trend={trend} />` below the stats section (after the flex div with views/date)
    - Only render when dataPoints.length > 0
    - _Requirements: 2.1, 2.2, 2.3, 5.3_

  - [x] 9.2 Modify useChannelData.js to save view history snapshots
    - Import `saveSnapshots` from viewHistory.js
    - After successful fetch and `saveChannelData()`, call `saveSnapshots(fetchedVideos.map(v => ({ id: v.id || v.videoId, viewCount: v.viewCount })))`
    - _Requirements: 1.1, 5.1, 5.2, 5.4_

  - [x] 9.3 Implement channel deletion cleanup for view history
    - In the channel removal flow, read cached channel data to get video IDs
    - Call `removeHistories(videoIds)` to clean up localStorage entries for deleted channel's videos
    - _Requirements: 1.6_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses JavaScript (React 19 + Vite 8) — no TypeScript
- CSS variables ensure automatic dark/light mode support without component logic
- All new modules are standalone files — existing `storage.js` is not modified

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3"] },
    { "id": 6, "tasks": ["7.4", "7.5"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3"] }
  ]
}
```
