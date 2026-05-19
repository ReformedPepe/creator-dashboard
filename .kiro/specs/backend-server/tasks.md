# Implementation Plan: Backend Server

## Overview

Build a Node.js + Express backend server in the `/server` directory that collects YouTube and TikTok video view snapshots hourly via cron, stores them in SQLite, and exposes a REST API. The frontend gains a `useBackend` hook for backend-powered data fetching with localStorage fallback. Implementation uses JavaScript (CommonJS for server, ESM for frontend).

## Tasks

- [x] 1. Initialize server project
  - [x] 1.1 Create `server/package.json` with dependencies (better-sqlite3, axios, cheerio, cors, dotenv, express, node-cron) and scripts (start, dev)
    - _Requirements: 8.1_
  - [x] 1.2 Create `server/.env` with YOUTUBE_API_KEY and PORT=3001 placeholders
    - _Requirements: 8.1, 8.2_
  - [x] 1.3 Update root `.gitignore` to add `server/data/`, `server/.env`, `server/node_modules/`
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 2. Database module
  - [x] 2.1 Create `server/db/index.js` — initialize better-sqlite3, create `data/` directory if missing, enable WAL mode and foreign keys, create channels/videos/snapshots tables with proper constraints and UNIQUE(channel_id, video_id) on videos
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ]* 2.2 Write property test for CASCADE delete behavior
    - **Property 2: CASCADE delete removes all associated data**
    - **Validates: Requirements 2.4**

- [x] 3. Channel routes
  - [x] 3.1 Create `server/routes/channels.js` — implement GET /api/channels (list all), POST /api/channels (create with validation), DELETE /api/channels/:id (delete with 404 handling)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 3.2 Write property test for channel CRUD round-trip
    - **Property 1: Channel CRUD round-trip**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 3.3 Write property test for invalid channel creation rejection
    - **Property 6: Invalid channel creation rejection**
    - **Validates: Requirements 2.3**

- [x] 4. YouTube service
  - [x] 4.1 Create `server/services/youtube.js` — resolve @handles to channel IDs, fetch uploads playlist, get video statistics, return normalized array [{video_id, title, thumbnail, published_at, view_count}]
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. TikTok scraping service
  - [x] 5.1 Create `server/services/tiktok.js` — axios GET to TikTok profile with browser User-Agent, cheerio parsing of __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag, extract up to 3 videos [{video_id, title, thumbnail, view_count}]
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Cron job collector
  - [x] 6.1 Create `server/cron/collector.js` — collectAll() iterates channels, calls YouTube/TikTok service per type, upserts videos, inserts snapshots, isolates errors per channel with try/catch, logs progress
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 7.3_
  - [ ]* 6.2 Write property test for channel isolation during collection
    - **Property 5: Channel isolation during collection**
    - **Validates: Requirements 5.3, 5.5, 4.3**
  - [ ]* 6.3 Write property test for snapshot accumulation
    - **Property 3: Snapshot accumulation preserves history**
    - **Validates: Requirements 3.1, 3.4, 5.3**
  - [ ]* 6.4 Write property test for video upsert idempotence
    - **Property 4: Video upsert idempotence on metadata**
    - **Validates: Requirements 6.2, 7.3**

- [x] 7. Video and snapshot routes
  - [x] 7.1 Create `server/routes/videos.js` — implement GET /api/channels/:id/videos returning 3 most recent videos with snapshots array, handle 404 for non-existent channel, return empty array for channel with no videos
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 7.2 Write property test for video retrieval limit
    - **Property 7: Video retrieval limit**
    - **Validates: Requirements 3.1, 3.4**

- [x] 8. Refresh and health endpoints
  - [x] 8.1 Create `server/routes/refresh.js` — implement POST /api/refresh (calls collectAll, returns results summary), GET /api/health (returns {status: "ok", timestamp})
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 9. Server entry point
  - [x] 9.1 Create `server/index.js` — require dotenv, express, cors, node-cron; configure middleware (cors, express.json); mount routes; schedule cron '0 * * * *'; run immediate collectAll(); listen on PORT
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 5.1, 5.2_

- [x] 10. Checkpoint — Verify server runs
  - Ensure `cd server && npm install && node index.js` starts without errors, ask the user if questions arise.

- [x] 11. Frontend useBackend hook
  - [x] 11.1 Create `src/hooks/useBackend.js` — check GET {VITE_API_URL}/api/health on mount, expose isBackendAvailable, backendUrl, channels, fetchChannels, fetchVideos, addChannel, deleteChannel, refresh methods
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 12. Frontend integration
  - [x] 12.1 Wire `useBackend` into `App.jsx` — when isBackendAvailable is true, use backend methods for channel CRUD and video fetching; when false, fall back to existing useChannels + useChannelData hooks unchanged
    - _Requirements: 9.2, 9.3_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The server uses CommonJS (`require`) since better-sqlite3 works best with it
- The frontend hook uses ESM (`import`) consistent with the Vite project
- Property tests validate universal correctness properties from the design document
- Run `cd server && npm install` before starting the server
- The server is independent of the frontend build — they run as separate processes
