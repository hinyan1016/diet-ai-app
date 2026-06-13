import { describe, it, expect } from 'vitest';
import { fitDimensions, splitDataUrl } from '../js/camera.js';

describe('fitDimensions', () => {
  it('長辺をmaxに縮小し比率を保つ', () => {
    expect(fitDimensions(4000, 3000, 1024)).toEqual({ w: 1024, h: 768 });
  });
  it('縦長も正しく縮小', () => {
    expect(fitDimensions(3000, 4000, 1024)).toEqual({ w: 768, h: 1024 });
  });
  it('max以下なら拡大しない', () => {
    expect(fitDimensions(800, 600, 1024)).toEqual({ w: 800, h: 600 });
  });
});

describe('splitDataUrl', () => {
  it('mediaTypeとbase64を分離する', () => {
    expect(splitDataUrl('data:image/jpeg;base64,AAAA')).toEqual({ mediaType: 'image/jpeg', base64: 'AAAA' });
  });
  it('不正形式は例外', () => {
    expect(() => splitDataUrl('notadataurl')).toThrow();
  });
});
