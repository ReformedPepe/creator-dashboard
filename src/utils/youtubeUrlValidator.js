// Walidacja linków YouTube

/**
 * Waliduje URL YouTube i wyodrębnia VIDEO_ID.
 * Obsługiwane formaty:
 *   - youtube.com/watch?v=VIDEO_ID
 *   - youtu.be/VIDEO_ID
 *   - youtube.com/shorts/VIDEO_ID
 * Obsługiwane prefiksy: https://, http://, https://www., http://www., www., brak
 * VIDEO_ID: dokładnie 11 znaków z [a-zA-Z0-9_-]
 *
 * @param {string} url — link do sprawdzenia
 * @returns {{ valid: boolean, videoId: string | null }}
 */
export function validateYouTubeUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return { valid: false, videoId: null };
  }

  const videoIdPattern = '[a-zA-Z0-9_-]{11}';

  // Pattern: youtube.com/watch?v=VIDEO_ID
  const watchPattern = new RegExp(
    `^(?:https?://)?(?:www\\.)?youtube\\.com/watch\\?v=(${videoIdPattern})(?:[&?#].*)?$`
  );

  // Pattern: youtu.be/VIDEO_ID
  const shortPattern = new RegExp(
    `^(?:https?://)?(?:www\\.)?youtu\\.be/(${videoIdPattern})(?:[?#/].*)?$`
  );

  // Pattern: youtube.com/shorts/VIDEO_ID
  const shortsPattern = new RegExp(
    `^(?:https?://)?(?:www\\.)?youtube\\.com/shorts/(${videoIdPattern})(?:[?#/].*)?$`
  );

  const patterns = [watchPattern, shortPattern, shortsPattern];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return { valid: true, videoId: match[1] };
    }
  }

  return { valid: false, videoId: null };
}
