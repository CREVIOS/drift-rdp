export type FramePayload = ArrayBuffer | Uint8Array;

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface FramePacket {
  kind: 'full-frame' | 'dirty-rects';
  surfaceWidth: number;
  surfaceHeight: number;
  rects: FrameRect[];
}

const PACKET_KIND_FULL_FRAME = 1;
const PACKET_KIND_DIRTY_RECTS = 2;
const PACKET_HEADER_LEN = 7;
const RECT_HEADER_LEN = 8;
const BYTES_PER_PIXEL = 4;

export function toFrameBytes(payload: FramePayload): Uint8Array {
  return payload instanceof Uint8Array ? payload : new Uint8Array(payload);
}

export function parseFramePacket(payload: FramePayload): FramePacket {
  const bytes = toFrameBytes(payload);

  if (bytes.byteLength < PACKET_HEADER_LEN) {
    throw new Error('Frame packet too short');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kindValue = view.getUint8(0);
  const surfaceWidth = view.getUint16(1, true);
  const surfaceHeight = view.getUint16(3, true);
  const rectCount = view.getUint16(5, true);
  const metadataLength = PACKET_HEADER_LEN + rectCount * RECT_HEADER_LEN;

  if (bytes.byteLength < metadataLength) {
    throw new Error('Frame packet metadata is truncated');
  }

  const rects: FrameRect[] = [];
  let rectOffset = PACKET_HEADER_LEN;
  let pixelOffset = metadataLength;

  for (let index = 0; index < rectCount; index += 1) {
    const x = view.getUint16(rectOffset, true);
    const y = view.getUint16(rectOffset + 2, true);
    const width = view.getUint16(rectOffset + 4, true);
    const height = view.getUint16(rectOffset + 6, true);
    const pixelLength = width * height * BYTES_PER_PIXEL;
    const pixelEnd = pixelOffset + pixelLength;

    if (pixelEnd > bytes.byteLength) {
      throw new Error('Frame packet pixel payload is truncated');
    }

    rects.push({
      x,
      y,
      width,
      height,
      pixels: bytes.subarray(pixelOffset, pixelEnd),
    });

    rectOffset += RECT_HEADER_LEN;
    pixelOffset = pixelEnd;
  }

  if (pixelOffset !== bytes.byteLength) {
    throw new Error('Frame packet has trailing bytes');
  }

  const kind =
    kindValue === PACKET_KIND_FULL_FRAME
      ? 'full-frame'
      : kindValue === PACKET_KIND_DIRTY_RECTS
        ? 'dirty-rects'
        : null;

  if (!kind) {
    throw new Error(`Unknown frame packet kind: ${kindValue}`);
  }

  return {
    kind,
    surfaceWidth,
    surfaceHeight,
    rects,
  };
}
