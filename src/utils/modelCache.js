// Model cache management for @huggingface/transformers
// Models are stored in browser's Cache Storage under 'transformers-cache'

const TRANSFORMERS_CACHE_NAME = 'transformers-cache';

/**
 * Check if any files for a given model ID exist in the cache.
 * @param {string} modelId — e.g. 'onnx-community/whisper-small'
 * @returns {Promise<boolean>}
 */
export async function isModelCached(modelId) {
  try {
    if (!('caches' in window)) return false;
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const requests = await cache.keys();
    // Check if any cached request URL contains the model ID
    return requests.some(req => req.url.includes(modelId));
  } catch {
    return false;
  }
}

/**
 * Delete all cached files for a given model ID.
 * @param {string} modelId
 * @returns {Promise<number>} number of deleted entries
 */
export async function deleteModelCache(modelId) {
  try {
    if (!('caches' in window)) return 0;
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const requests = await cache.keys();
    const matching = requests.filter(req => req.url.includes(modelId));

    let deleted = 0;
    for (const req of matching) {
      const ok = await cache.delete(req);
      if (ok) deleted++;
    }
    return deleted;
  } catch (err) {
    console.error('[modelCache] delete failed:', err);
    return 0;
  }
}
