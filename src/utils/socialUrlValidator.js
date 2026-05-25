// Walidacja linków TikTok i X/Twitter dla pobieracza social

/**
 * Waliduje URL TikTok lub X/Twitter.
 * Obsługiwane formaty:
 *   TikTok:
 *     - tiktok.com/@user/video/VIDEO_ID
 *     - vm.tiktok.com/SHORT_ID
 *     - tiktok.com/t/SHORT_ID
 *   X / Twitter:
 *     - twitter.com/user/status/STATUS_ID
 *     - x.com/user/status/STATUS_ID
 *     - mobile.twitter.com/... mobile.x.com/...
 *
 * Obsługiwane prefiksy: https://, http://, www., bez prefiksu
 *
 * @param {string} url
 * @returns {{ valid: boolean, platform: 'tiktok' | 'x' | null }}
 */
export function validateSocialUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return { valid: false, platform: null };
  }

  const trimmed = url.trim();

  // TikTok patterns
  const tiktokPatterns = [
    /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.\-]+\/video\/\d+/i,
    /^(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\/[\w-]+/i,
    /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/[\w-]+/i,
  ];
  for (const p of tiktokPatterns) {
    if (p.test(trimmed)) return { valid: true, platform: 'tiktok' };
  }

  // X / Twitter patterns
  const xPatterns = [
    /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter|x)\.com\/[\w]+\/status\/\d+/i,
  ];
  for (const p of xPatterns) {
    if (p.test(trimmed)) return { valid: true, platform: 'x' };
  }

  return { valid: false, platform: null };
}
