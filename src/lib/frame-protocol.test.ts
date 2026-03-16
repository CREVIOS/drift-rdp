import { describe, expect, it } from 'vitest';

import { parseFramePacket } from './frame-protocol';

describe('frame protocol', () => {
  it('parses a full-frame packet', () => {
    const packet = new Uint8Array([
      1,
      2, 0,
      1, 0,
      1, 0,
      0, 0,
      0, 0,
      2, 0,
      1, 0,
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);

    const parsed = parseFramePacket(packet);

    expect(parsed.kind).toBe('full-frame');
    expect(parsed.surfaceWidth).toBe(2);
    expect(parsed.surfaceHeight).toBe(1);
    expect(parsed.rects).toHaveLength(1);
    expect(parsed.rects[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 2,
      height: 1,
    });
    expect(Array.from(parsed.rects[0].pixels)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
