import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveSnapshot,
  saveSnapshots,
  loadHistory,
  removeHistories,
  pruneOldestEntries,
  HISTORY_PREFIX,
  MAX_POINTS,
} from './viewHistory.js';

describe('viewHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveSnapshot', () => {
    it('appends a data point to empty history', () => {
      const result = saveSnapshot('vid1', 100);
      expect(result).toBe(true);
      const history = loadHistory('vid1');
      expect(history).toHaveLength(1);
      expect(history[0].viewCount).toBe(100);
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it('skips duplicate viewCount', () => {
      saveSnapshot('vid1', 100);
      saveSnapshot('vid1', 100);
      const history = loadHistory('vid1');
      expect(history).toHaveLength(1);
    });

    it('appends when viewCount differs', () => {
      saveSnapshot('vid1', 100);
      saveSnapshot('vid1', 200);
      const history = loadHistory('vid1');
      expect(history).toHaveLength(2);
      expect(history[1].viewCount).toBe(200);
    });

    it('enforces 50-point cap', () => {
      for (let i = 0; i < 60; i++) {
        saveSnapshot('vid1', i * 10);
      }
      const history = loadHistory('vid1');
      expect(history).toHaveLength(MAX_POINTS);
      // Oldest entries should have been removed
      expect(history[0].viewCount).toBe(100); // entries 0-9 removed (10 oldest)
    });

    it('uses correct localStorage key pattern', () => {
      saveSnapshot('abc123', 500);
      const raw = localStorage.getItem(HISTORY_PREFIX + 'abc123');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].viewCount).toBe(500);
    });
  });

  describe('saveSnapshots', () => {
    it('saves snapshots for multiple videos', () => {
      saveSnapshots([
        { id: 'v1', viewCount: 100 },
        { id: 'v2', viewCount: 200 },
        { id: 'v3', viewCount: 300 },
      ]);
      expect(loadHistory('v1')).toHaveLength(1);
      expect(loadHistory('v2')).toHaveLength(1);
      expect(loadHistory('v3')).toHaveLength(1);
    });

    it('handles non-array input gracefully', () => {
      expect(() => saveSnapshots(null)).not.toThrow();
      expect(() => saveSnapshots(undefined)).not.toThrow();
    });
  });

  describe('loadHistory', () => {
    it('returns empty array for non-existent video', () => {
      expect(loadHistory('nonexistent')).toEqual([]);
    });

    it('returns sorted array chronologically', () => {
      // Manually write unsorted data
      const data = [
        { timestamp: 3000, viewCount: 300 },
        { timestamp: 1000, viewCount: 100 },
        { timestamp: 2000, viewCount: 200 },
      ];
      localStorage.setItem(HISTORY_PREFIX + 'vid1', JSON.stringify(data));
      const history = loadHistory('vid1');
      expect(history[0].timestamp).toBe(1000);
      expect(history[1].timestamp).toBe(2000);
      expect(history[2].timestamp).toBe(3000);
    });

    it('handles corrupted JSON gracefully', () => {
      localStorage.setItem(HISTORY_PREFIX + 'vid1', 'not-json{{{');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const history = loadHistory('vid1');
      expect(history).toEqual([]);
      warnSpy.mockRestore();
    });

    it('handles non-array JSON gracefully', () => {
      localStorage.setItem(HISTORY_PREFIX + 'vid1', JSON.stringify({ foo: 'bar' }));
      const history = loadHistory('vid1');
      expect(history).toEqual([]);
    });
  });

  describe('removeHistories', () => {
    it('removes history for specified video IDs', () => {
      saveSnapshot('v1', 100);
      saveSnapshot('v2', 200);
      saveSnapshot('v3', 300);
      removeHistories(['v1', 'v3']);
      expect(loadHistory('v1')).toEqual([]);
      expect(loadHistory('v2')).toHaveLength(1);
      expect(loadHistory('v3')).toEqual([]);
    });

    it('handles non-array input gracefully', () => {
      expect(() => removeHistories(null)).not.toThrow();
    });
  });

  describe('pruneOldestEntries', () => {
    it('removes 25% oldest points from all histories', () => {
      // Create history with 8 points for vid1
      const data = Array.from({ length: 8 }, (_, i) => ({
        timestamp: (i + 1) * 1000,
        viewCount: (i + 1) * 100,
      }));
      localStorage.setItem(HISTORY_PREFIX + 'vid1', JSON.stringify(data));

      const result = pruneOldestEntries();
      expect(result).toBe(true);

      const history = loadHistory('vid1');
      // floor(8 * 0.25) = 2 removed, 6 remaining
      expect(history).toHaveLength(6);
      // Oldest 2 should be removed
      expect(history[0].timestamp).toBe(3000);
    });

    it('returns false when no histories exist', () => {
      const result = pruneOldestEntries();
      expect(result).toBe(false);
    });

    it('handles histories with 1-3 points (floor(n*0.25) = 0, skip)', () => {
      const data = [
        { timestamp: 1000, viewCount: 100 },
        { timestamp: 2000, viewCount: 200 },
        { timestamp: 3000, viewCount: 300 },
      ];
      localStorage.setItem(HISTORY_PREFIX + 'vid1', JSON.stringify(data));

      const result = pruneOldestEntries();
      // floor(3 * 0.25) = 0, nothing to prune
      expect(result).toBe(false);
      expect(loadHistory('vid1')).toHaveLength(3);
    });
  });

  describe('QuotaExceededError handling', () => {
    it('retries with pruning on QuotaExceededError', () => {
      // Pre-populate some history to prune
      const data = Array.from({ length: 8 }, (_, i) => ({
        timestamp: (i + 1) * 1000,
        viewCount: (i + 1) * 100,
      }));
      localStorage.setItem(HISTORY_PREFIX + 'other', JSON.stringify(data));

      let callCount = 0;
      const originalSetItem = Storage.prototype.setItem;
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        callCount++;
        if (callCount === 1 && key === HISTORY_PREFIX + 'newvid') {
          const error = new DOMException('quota exceeded', 'QuotaExceededError');
          throw error;
        }
        return originalSetItem.call(this, key, value);
      });

      const result = saveSnapshot('newvid', 999);
      expect(result).toBe(true);

      spy.mockRestore();
    });
  });
});
