# Implementation Plan: Channel Stats and Video Metrics

## Overview

Rozszerzenie dashboardu o trzy powiązane funkcjonalności: (1) formatPercentChange + badge procentowej zmiany obok sparkline, (2) statystyki kanału w nagłówku ChannelCard, (3) polubienia i komentarze na kartach filmów. Implementacja przebiega od warstwy utils (formatowanie), przez warstwę API (youtube.js, tiktok.js), hook (useChannelData), aż po warstwę prezentacji (VideoCard, ChannelCard).

## Tasks

- [x] 1. Implement formatPercentChange utility function
  - [x] 1.1 Add `formatPercentChange(value)` function to `src/utils/formatters.js`
    - Implement the function as specified in design: rounds to 1 decimal, uses comma as separator, prefixes with +/- or returns "0%" for neutral zone (|value| < 1)
    - Handle edge cases: NaN, Infinity → treat as 0
    - Export the function
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 1.2 Write property tests for formatPercentChange (Property 1: Format output pattern)
    - **Property 1: Percent change format output matches specification pattern**
    - Test that for any numeric value, output starts with "+"/"-" or equals "0%", uses comma separator, has at most 1 decimal digit, ends with "%"
    - File: `src/utils/formatters.test.js`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.2, 8.2**

  - [ ]* 1.3 Write property tests for formatPercentChange (Property 2: Neutral zone)
    - **Property 2: Neutral zone values produce "0%"**
    - Test that for any value where |value| < 1, output is exactly "0%"
    - File: `src/utils/formatters.test.js`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.3, 8.3**

  - [ ]* 1.4 Write property tests for formatPercentChange (Property 3: Round-trip)
    - **Property 3: Percent change format round-trip**
    - Test that formatting then parsing back yields value equal to original rounded to 1 decimal (±0.05 tolerance)
    - File: `src/utils/formatters.test.js`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 8.4**

- [x] 2. Extend YouTube API client with channel stats and engagement metrics
  - [x] 2.1 Modify `fetchYouTubeVideos()` in `src/utils/youtube.js` to return channel stats and video engagement
    - Add `part=statistics` to the existing `channels` request (where handle/ID is resolved) to fetch subscriberCount and viewCount
    - Map `likeCount` and `commentCount` from the existing `videos` statistics response into each video object
    - Handle `hiddenSubscriberCount === true` by setting subscriberCount to null
    - Change return format from array to `{ videos, channelStats }` object
    - _Requirements: 3.1, 3.2, 3.4, 6.1, 6.2, 6.3_

  - [ ]* 2.2 Write property test for YouTube video mapping (Property 4)
    - **Property 4: YouTube video mapping preserves engagement metrics**
    - Test that for any valid statistics response with likeCount and commentCount, the mapping produces correct numeric values
    - File: `src/utils/youtube.test.js`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 6.2**

- [x] 3. Extend TikTok API client with channel stats and engagement metrics
  - [x] 3.1 Modify `mapToUnifiedFormat()` in `src/utils/tiktok.js` to include engagement metrics
    - Map `digg_count` → `likeCount` and `comment_count` → `commentCount` in the unified video object
    - Fallback to 0 when fields are missing
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.2 Modify `fetchTikTokVideos()` in `src/utils/tiktok.js` to extract and return channel stats
    - Extract `follower_count` and `heart_count` from the `author` field of the first video in the response
    - Change return format from array to `{ videos, channelStats }` object
    - `fetchTikTokVideoByUrl` adds likeCount/commentCount to video but does NOT return channelStats
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 3.3 Write property test for TikTok video mapping (Property 5)
    - **Property 5: TikTok video mapping preserves engagement metrics**
    - Test that for any valid TikTok response item with digg_count and comment_count, mapToUnifiedFormat produces correct likeCount and commentCount
    - File: `src/utils/tiktok.test.js`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 7.1, 7.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend useChannelData hook to return channel stats
  - [x] 5.1 Modify `useChannelData` hook in `src/hooks/useChannelData.js` to handle new return format
    - Add `channelStats` state (initialized from cache)
    - Update fetchData to destructure `{ videos, channelStats }` from youtube.js/tiktok.js responses
    - For TikTok manual mode (fetchTikTokVideoByUrl), set channelStats to null
    - Save channelStats to localStorage cache alongside videos
    - Return channelStats in the hook's return object
    - Handle backward compatibility: if cached data has no channelStats field, default to null
    - _Requirements: 3.3, 4.2, 2.6, 2.7_

- [x] 6. Extend VideoCard with engagement metrics and percent change badge
  - [x] 6.1 Add likeCount and commentCount display to `src/components/VideoCard.jsx`
    - Import ThumbsUp and MessageCircle icons from lucide-react
    - Add like count and comment count to the stats row (same style as existing view count: icon 12px h-3 w-3, text xs font-semibold text-secondary)
    - Use formatViewCount for formatting; display "0" when value is null/undefined
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 Add PercentChangeBadge inline in `src/components/VideoCard.jsx`
    - Import calculatePercentChange from trendCalculator.js and formatPercentChange from formatters.js
    - Render badge only when dataPoints.length >= 2
    - Wrap SparklineChart and badge in a flex row (sparkline flex-1, badge fixed width)
    - Apply color classes: green (--color-trend-up) for >= 1%, red (--color-trend-down) for <= -1%, gray (--color-trend-neutral) for neutral zone
    - Style: text-[11px] font-semibold
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 7. Extend ChannelCard with Channel Stats Section
  - [x] 7.1 Add Channel Stats Section to `src/components/ChannelCard.jsx`
    - Destructure channelStats from useChannelData hook
    - Import Users and Eye icons from lucide-react, import formatViewCount from formatters.js
    - Render section below channel name in header: Users icon + subscriber/follower count + label, Eye icon + view/heart count + label
    - Use platform-specific labels: "subskrybentów"/"obserwujących" and "wyświetleń"/"polubień"
    - Do not render section when channelStats is null or undefined (graceful degradation)
    - Style: text-[12px], text-muted for labels/icons, text-secondary font-semibold for values
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All changes extend existing files — no new files are created
- The return format change in youtube.js and tiktok.js (array → object) requires updating useChannelData in the same sequence

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["6.1", "6.2", "7.1"] }
  ]
}
```
