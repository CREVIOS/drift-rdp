/**
 * Hardware-accelerated H.264 decoder using the WebCodecs API.
 *
 * Decodes H.264 NAL unit bitstreams produced by the openh264 encoder on the
 * backend and renders decoded VideoFrames directly to a canvas element.
 *
 * Falls back gracefully: if WebCodecs is not available the caller should
 * continue using the raw RGBA frame path.
 */
export class H264HardwareDecoder {
  private decoder: VideoDecoder | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private ready = false;
  private frameCount = 0;

  constructor() {}

  /**
   * Initialize the decoder for a given canvas and resolution.
   * Returns `true` if WebCodecs is available and the decoder was configured,
   * `false` otherwise (caller should fall back to raw RGBA).
   */
  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!('VideoDecoder' in window)) {
      console.warn('[H264Decoder] WebCodecs VideoDecoder not available');
      return false;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        this.renderFrame(frame);
      },
      error: (e: DOMException) => {
        console.error('[H264Decoder] VideoDecoder error:', e);
      },
    });

    // H.264 Constrained Baseline Profile, Level 3.1 — suitable for up to 1080p
    this.decoder.configure({
      codec: 'avc1.42C01F',
      optimizeForLatency: true,
      hardwareAcceleration: 'prefer-hardware',
    });

    this.ready = true;
    return true;
  }

  /**
   * Decode an H.264 bitstream chunk.
   *
   * @param h264Data  Raw H.264 bitstream bytes (with Annex B NAL start codes).
   * @param timestamp Presentation timestamp in microseconds.
   * @param isKeyframe Whether the chunk contains an IDR / keyframe.
   */
  decode(h264Data: Uint8Array, timestamp: number, isKeyframe: boolean): void {
    if (!this.decoder || !this.ready || this.decoder.state === 'closed') {
      return;
    }

    const chunk = new EncodedVideoChunk({
      type: isKeyframe ? 'key' : 'delta',
      timestamp,
      data: h264Data,
    });

    this.decoder.decode(chunk);
  }

  private renderFrame(frame: VideoFrame): void {
    if (!this.canvas || !this.ctx) {
      frame.close();
      return;
    }

    // Resize canvas to match decoded frame dimensions
    if (
      this.canvas.width !== frame.displayWidth ||
      this.canvas.height !== frame.displayHeight
    ) {
      this.canvas.width = frame.displayWidth;
      this.canvas.height = frame.displayHeight;
    }

    // Draw the decoded video frame directly (GPU composited)
    this.ctx.drawImage(frame, 0, 0);
    frame.close(); // Release the VideoFrame immediately
    this.frameCount++;
  }

  /** Shut down the decoder and release resources. */
  destroy(): void {
    if (this.decoder && this.decoder.state !== 'closed') {
      this.decoder.close();
    }
    this.decoder = null;
    this.ready = false;
    this.canvas = null;
    this.ctx = null;
  }

  get isReady(): boolean {
    return this.ready;
  }

  get framesDecoded(): number {
    return this.frameCount;
  }
}

/**
 * Detect whether an H.264 Annex B bitstream starts with a keyframe.
 *
 * Scans for the first NAL unit and checks if it is an IDR slice (type 5)
 * or SPS (type 7), which indicates a keyframe / random access point.
 */
export function isH264Keyframe(data: Uint8Array): boolean {
  // Find the first NAL start code (0x00 0x00 0x01 or 0x00 0x00 0x00 0x01)
  for (let i = 0; i < data.length - 4; i++) {
    if (data[i] === 0x00 && data[i + 1] === 0x00) {
      let nalStart: number;

      if (data[i + 2] === 0x01) {
        nalStart = i + 3;
      } else if (data[i + 2] === 0x00 && data[i + 3] === 0x01) {
        nalStart = i + 4;
      } else {
        continue;
      }

      if (nalStart < data.length) {
        const nalType = data[nalStart] & 0x1f;
        // NAL type 5 = IDR slice, 7 = SPS (always precedes IDR in keyframes)
        return nalType === 5 || nalType === 7;
      }
    }
  }
  return false;
}
