import { describe, it, expect } from 'vitest';
import { validateYouTubeUrl } from './youtubeUrlValidator.js';

describe('validateYouTubeUrl', () => {
  describe('valid URLs - youtube.com/watch?v=', () => {
    it('accepts https://www.youtube.com/watch?v=VIDEO_ID', () => {
      const result = validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts http://www.youtube.com/watch?v=VIDEO_ID', () => {
      const result = validateYouTubeUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts https://youtube.com/watch?v=VIDEO_ID', () => {
      const result = validateYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts http://youtube.com/watch?v=VIDEO_ID', () => {
      const result = validateYouTubeUrl('http://youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts www.youtube.com/watch?v=VIDEO_ID', () => {
      const result = validateYouTubeUrl('www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts youtube.com/watch?v=VIDEO_ID (no prefix)', () => {
      const result = validateYouTubeUrl('youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts VIDEO_ID with underscores and hyphens', () => {
      const result = validateYouTubeUrl('https://youtube.com/watch?v=a_b-c_D-E1F');
      expect(result).toEqual({ valid: true, videoId: 'a_b-c_D-E1F' });
    });
  });

  describe('valid URLs - youtu.be/', () => {
    it('accepts https://youtu.be/VIDEO_ID', () => {
      const result = validateYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts http://youtu.be/VIDEO_ID', () => {
      const result = validateYouTubeUrl('http://youtu.be/dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts youtu.be/VIDEO_ID (no prefix)', () => {
      const result = validateYouTubeUrl('youtu.be/dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });
  });

  describe('valid URLs - youtube.com/shorts/', () => {
    it('accepts https://www.youtube.com/shorts/VIDEO_ID', () => {
      const result = validateYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });

    it('accepts youtube.com/shorts/VIDEO_ID (no prefix)', () => {
      const result = validateYouTubeUrl('youtube.com/shorts/dQw4w9WgXcQ');
      expect(result).toEqual({ valid: true, videoId: 'dQw4w9WgXcQ' });
    });
  });

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      expect(validateYouTubeUrl('')).toEqual({ valid: false, videoId: null });
    });

    it('rejects null/undefined', () => {
      expect(validateYouTubeUrl(null)).toEqual({ valid: false, videoId: null });
      expect(validateYouTubeUrl(undefined)).toEqual({ valid: false, videoId: null });
    });

    it('rejects random text', () => {
      expect(validateYouTubeUrl('hello world')).toEqual({ valid: false, videoId: null });
    });

    it('rejects VIDEO_ID shorter than 11 chars', () => {
      expect(validateYouTubeUrl('https://youtube.com/watch?v=abc123')).toEqual({ valid: false, videoId: null });
    });

    it('rejects VIDEO_ID longer than 11 chars', () => {
      expect(validateYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQx')).toEqual({ valid: false, videoId: null });
    });

    it('rejects VIDEO_ID with invalid characters', () => {
      expect(validateYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXc!')).toEqual({ valid: false, videoId: null });
    });

    it('rejects wrong domain', () => {
      expect(validateYouTubeUrl('https://vimeo.com/watch?v=dQw4w9WgXcQ')).toEqual({ valid: false, videoId: null });
    });

    it('rejects youtube.com without video path', () => {
      expect(validateYouTubeUrl('https://youtube.com/')).toEqual({ valid: false, videoId: null });
    });
  });
});
