// services/settings.js — API key store with .env file persistence
// Keys are read from .env at startup (via dotenv) and written back on update
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

// In-memory cache (initialized from process.env which dotenv already loaded)
const keys = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  tiktokApiKey: process.env.TIKTOK_RAPIDAPI_KEY || '',
};

/**
 * Returns the current YouTube API key.
 */
function getYouTubeApiKey() {
  return keys.youtubeApiKey;
}

/**
 * Returns the current TikTok RapidAPI key.
 */
function getTikTokApiKey() {
  return keys.tiktokApiKey;
}

/**
 * Updates API keys in memory AND persists them to server/.env file.
 * Preserves all existing variables in .env, only updates YOUTUBE_API_KEY and TIKTOK_RAPIDAPI_KEY.
 * @param {{ youtubeApiKey?: string, tiktokApiKey?: string }} newKeys
 */
function updateKeys(newKeys) {
  if (newKeys.youtubeApiKey && newKeys.youtubeApiKey.trim()) {
    keys.youtubeApiKey = newKeys.youtubeApiKey.trim();
  }
  if (newKeys.tiktokApiKey && newKeys.tiktokApiKey.trim()) {
    keys.tiktokApiKey = newKeys.tiktokApiKey.trim();
  }

  // Persist to .env file
  persistToEnvFile();
}

/**
 * Reads the current .env file, updates YOUTUBE_API_KEY and TIKTOK_RAPIDAPI_KEY,
 * preserves all other variables, and writes back.
 */
function persistToEnvFile() {
  let lines = [];

  // Read existing .env content
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    lines = content.split('\n');
  } catch {
    // File doesn't exist — start fresh
    lines = [];
  }

  // Track which keys we've updated
  let updatedYoutube = false;
  let updatedTiktok = false;

  // Update existing lines
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();

    // Match YOUTUBE_API_KEY=...
    if (trimmed.startsWith('YOUTUBE_API_KEY=') || trimmed === 'YOUTUBE_API_KEY=') {
      updatedYoutube = true;
      return `YOUTUBE_API_KEY=${keys.youtubeApiKey}`;
    }

    // Match TIKTOK_RAPIDAPI_KEY=...
    if (trimmed.startsWith('TIKTOK_RAPIDAPI_KEY=') || trimmed === 'TIKTOK_RAPIDAPI_KEY=') {
      updatedTiktok = true;
      return `TIKTOK_RAPIDAPI_KEY=${keys.tiktokApiKey}`;
    }

    return line;
  });

  // Append keys that weren't found in the file
  if (!updatedYoutube && keys.youtubeApiKey) {
    updatedLines.push(`YOUTUBE_API_KEY=${keys.youtubeApiKey}`);
  }
  if (!updatedTiktok && keys.tiktokApiKey) {
    updatedLines.push(`TIKTOK_RAPIDAPI_KEY=${keys.tiktokApiKey}`);
  }

  // Write back
  try {
    fs.writeFileSync(ENV_PATH, updatedLines.join('\n'), 'utf-8');
    console.log('[settings] Keys persisted to .env file');
  } catch (err) {
    console.error('[settings] Failed to write .env file:', err.message);
  }
}

module.exports = { getYouTubeApiKey, getTikTokApiKey, updateKeys };
