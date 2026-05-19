# Requirements Document

## Introduction

Backend server (Node.js + Express) for the Creator Stats Dashboard that collects video view snapshots hourly via cron job, independent of whether the browser is open. The server stores data in SQLite, exposes a REST API for the frontend, and replaces the RapidAPI TikTok integration with direct scraping via axios + cheerio. The frontend gains a new `useBackend` hook that prefers backend data when available, falling back to existing localStorage logic when the server is unreachable.

## Glossary

- **Backend_Server**: Node.js + Express application running in the `/server` directory, responsible for data collection, storage, and API endpoints
- **Cron_Job**: Scheduled task using node-cron that runs every hour (0 * * * *) to collect view snapshots for all registered channels
- **Database**: SQLite database file at `server/data/dashboard.db` managed via better-sqlite3
- **Channel**: A YouTube or TikTok creator profile registered for tracking, stored in the `channels` table
- **Video**: A single video belonging to a Channel, stored in the `videos` table
- **Snapshot**: A point-in-time record of a video's view count, stored in the `snapshots` table
- **Scraper**: Module using axios + cheerio with browser User-Agent to extract TikTok video data from public profile pages
- **Frontend_Backend_Hook**: React hook (`useBackend.js`) that checks backend availability and routes data fetching through the backend API when available
- **Health_Check**: GET /api/health endpoint returning server status for availability detection

## Requirements

### Requirement 1: Database Schema and Initialization

**User Story:** As a developer, I want a well-structured SQLite database that stores channels, videos, and view snapshots, so that historical data persists across server restarts.

#### Acceptance Criteria

1. WHEN the Backend_Server starts, THE Database SHALL create the `channels` table with columns: id (INTEGER PRIMARY KEY AUTOINCREMENT), type (TEXT NOT NULL, 'youtube' or 'tiktok'), name (TEXT NOT NULL), identifier (TEXT NOT NULL), created_at (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)
2. WHEN the Backend_Server starts, THE Database SHALL create the `videos` table with columns: id (INTEGER PRIMARY KEY AUTOINCREMENT), channel_id (INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE), video_id (TEXT NOT NULL), title (TEXT), thumbnail (TEXT), published_at (TEXT), updated_at (TEXT)
3. WHEN the Backend_Server starts, THE Database SHALL create the `snapshots` table with columns: id (INTEGER PRIMARY KEY AUTOINCREMENT), video_id (INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE), view_count (INTEGER NOT NULL), timestamp (INTEGER NOT NULL)
4. WHEN the Backend_Server starts and the `server/data/` directory does not exist, THE Database SHALL create the directory before initializing the database file
5. THE Database SHALL enable WAL mode and foreign keys pragma on initialization

### Requirement 2: REST API — Channel Management

**User Story:** As a frontend application, I want to manage channels via REST API, so that the backend tracks which creators to monitor.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/channels, THE Backend_Server SHALL return a JSON array of all channels with their id, type, name, identifier, and created_at fields
2. WHEN a POST request is made to /api/channels with a valid body containing type ('youtube' or 'tiktok'), name, and identifier, THE Backend_Server SHALL insert the channel into the Database and return the created channel object with its assigned id
3. WHEN a POST request is made to /api/channels with missing or invalid fields, THE Backend_Server SHALL return HTTP 400 with a descriptive error message
4. WHEN a DELETE request is made to /api/channels/:id, THE Backend_Server SHALL delete the channel and all associated videos and snapshots (via CASCADE) and return HTTP 200
5. WHEN a DELETE request is made to /api/channels/:id with a non-existent id, THE Backend_Server SHALL return HTTP 404 with a descriptive error message

### Requirement 3: REST API — Video and Snapshot Retrieval

**User Story:** As a frontend application, I want to fetch the latest videos and their view history for a channel, so that I can display sparkline charts and current stats.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/channels/:id/videos, THE Backend_Server SHALL return the 3 most recent videos for that channel, each including their full list of snapshots ordered by timestamp ascending
2. WHEN a GET request is made to /api/channels/:id/videos for a channel with no videos, THE Backend_Server SHALL return an empty JSON array
3. WHEN a GET request is made to /api/channels/:id/videos with a non-existent channel id, THE Backend_Server SHALL return HTTP 404 with a descriptive error message
4. THE Backend_Server SHALL include for each video: video_id, title, thumbnail, published_at, and an array of snapshots each containing view_count and timestamp

### Requirement 4: REST API — Manual Refresh and Health Check

**User Story:** As a user, I want to manually trigger a data refresh and check if the backend is running, so that I can get fresh data on demand and the frontend can detect backend availability.

#### Acceptance Criteria

1. WHEN a POST request is made to /api/refresh, THE Backend_Server SHALL trigger an immediate data collection for all registered channels and return HTTP 200 with a summary of results
2. WHEN a GET request is made to /api/health, THE Backend_Server SHALL return HTTP 200 with a JSON object containing status "ok" and the current server timestamp
3. WHEN the /api/refresh endpoint encounters errors for some channels, THE Backend_Server SHALL still process remaining channels and include error details in the response summary

### Requirement 5: Cron Job — Scheduled Data Collection

**User Story:** As a creator, I want the server to automatically collect view snapshots every hour, so that I have continuous historical data without needing to keep the browser open.

#### Acceptance Criteria

1. WHEN the Backend_Server starts, THE Cron_Job SHALL execute an immediate data collection run without waiting for the first scheduled interval
2. THE Cron_Job SHALL execute data collection every hour at minute 0 (cron expression: '0 * * * *')
3. WHEN the Cron_Job runs, THE Backend_Server SHALL process each channel independently so that an error in one channel does not block processing of other channels
4. WHEN a data collection run completes for a channel, THE Backend_Server SHALL log to console the channel name, each video title, and the collected view count
5. WHEN a data collection run encounters an error for a channel, THE Backend_Server SHALL log the error to console and continue with the next channel

### Requirement 6: YouTube Data Collection

**User Story:** As a creator tracking YouTube channels, I want the backend to fetch my latest video stats via YouTube Data API v3, so that view counts are recorded hourly.

#### Acceptance Criteria

1. WHEN collecting data for a YouTube channel, THE Backend_Server SHALL use YouTube Data API v3 with the YOUTUBE_API_KEY environment variable to fetch the 3 most recent videos
2. WHEN YouTube API returns video data, THE Backend_Server SHALL upsert each video in the `videos` table (matching on channel_id + video_id) and insert a new Snapshot with the current view_count and timestamp (Date.now())
3. WHEN the YouTube channel identifier is a handle (@username), THE Backend_Server SHALL resolve it to a channel ID via the YouTube channels API before fetching videos
4. IF the YOUTUBE_API_KEY environment variable is not set, THEN THE Backend_Server SHALL skip YouTube channels during data collection and log a warning

### Requirement 7: TikTok Data Collection via Scraping

**User Story:** As a creator tracking TikTok channels, I want the backend to scrape my public profile for video stats, so that I don't need a paid API subscription.

#### Acceptance Criteria

1. WHEN collecting data for a TikTok channel, THE Scraper SHALL make an HTTP GET request to `https://www.tiktok.com/@{identifier}` with a browser-like User-Agent header
2. WHEN the Scraper receives the TikTok profile page HTML, THE Scraper SHALL parse it using cheerio to extract video data (video IDs, titles, view counts) for the 3 most recent videos
3. WHEN TikTok video data is extracted, THE Backend_Server SHALL upsert each video in the `videos` table (matching on channel_id + video_id) and insert a new Snapshot with the current view_count and timestamp (Date.now())
4. IF the Scraper fails to parse the TikTok page (structure changed, blocked, or network error), THEN THE Backend_Server SHALL log the error and skip that channel without affecting other channels
5. THE Scraper SHALL include appropriate request headers (User-Agent, Accept-Language) to mimic a standard browser request

### Requirement 8: Server Configuration and Startup

**User Story:** As a developer, I want the server to be easily configurable and runnable, so that I can set it up quickly in development and production.

#### Acceptance Criteria

1. THE Backend_Server SHALL read configuration from environment variables loaded via dotenv from `server/.env`
2. THE Backend_Server SHALL listen on the port specified by the PORT environment variable, defaulting to 3001 if not set
3. THE Backend_Server SHALL enable CORS for all origins using the cors middleware
4. THE Backend_Server SHALL parse JSON request bodies using express.json() middleware
5. WHEN the Backend_Server starts successfully, THE Backend_Server SHALL log the port number and a startup confirmation message to console

### Requirement 9: Frontend Backend Integration Hook

**User Story:** As a user, I want the dashboard to automatically use the backend when it's running and fall back to direct API calls when it's not, so that I get the best experience regardless of server availability.

#### Acceptance Criteria

1. WHEN the frontend application loads, THE Frontend_Backend_Hook SHALL make a GET request to the backend health endpoint (VITE_API_URL/api/health, defaulting to http://localhost:3001) to determine availability
2. WHILE the backend is available, THE Frontend_Backend_Hook SHALL fetch channel and video data from the backend REST API instead of making direct YouTube/TikTok API calls
3. WHILE the backend is unavailable, THE Frontend_Backend_Hook SHALL allow the existing localStorage + direct API logic to function unchanged
4. THE Frontend_Backend_Hook SHALL expose a boolean `isBackendAvailable` state and a `backendUrl` value for use by other components
5. THE Frontend_Backend_Hook SHALL read the backend URL from the VITE_API_URL environment variable, defaulting to 'http://localhost:3001' if not set

### Requirement 10: Gitignore Updates

**User Story:** As a developer, I want sensitive and generated files excluded from version control, so that secrets and database files are not committed.

#### Acceptance Criteria

1. THE .gitignore file SHALL include `server/data/` to exclude the SQLite database directory
2. THE .gitignore file SHALL include `server/.env` to exclude backend environment variables
3. THE .gitignore file SHALL include `server/node_modules/` to exclude backend dependencies
