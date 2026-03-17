use openh264::encoder::{EncodedBitStream, Encoder, EncoderConfig};
use openh264::formats::{RgbaSliceU8, YUVBuffer};
use openh264::OpenH264API;

pub struct H264FrameEncoder {
    encoder: Encoder,
    width: u32,
    height: u32,
}

impl H264FrameEncoder {
    pub fn new(width: u32, height: u32) -> Result<Self, String> {
        let api = OpenH264API::from_source();
        let config = EncoderConfig::new()
            .set_bitrate_bps(2_000_000)
            .max_frame_rate(60.0)
            .enable_skip_frame(false);

        let encoder = Encoder::with_api_config(api, config)
            .map_err(|e| format!("Failed to create H.264 encoder: {}", e))?;

        Ok(Self {
            encoder,
            width,
            height,
        })
    }

    /// Encode an RGBA frame to H.264 bitstream bytes.
    /// Returns the encoded H.264 bitstream (with NAL start codes).
    pub fn encode_rgba(
        &mut self,
        rgba_data: &[u8],
        width: u32,
        height: u32,
    ) -> Result<Vec<u8>, String> {
        // Resize encoder if dimensions changed
        if width != self.width || height != self.height {
            *self = Self::new(width, height)?;
        }

        // Wrap RGBA data as an RGBSource (openh264 handles RGBA -> YUV internally)
        let rgba_source = RgbaSliceU8::new(rgba_data, (width as usize, height as usize));

        // Convert to YUV420 (the library handles the color space conversion)
        let yuv = YUVBuffer::from_rgb_source(rgba_source);

        // Encode the YUV frame
        let bitstream: EncodedBitStream<'_> = self
            .encoder
            .encode(&yuv)
            .map_err(|e| format!("H.264 encode failed: {}", e))?;

        // Extract encoded bytes (includes NAL start codes)
        Ok(bitstream.to_vec())
    }

    /// Force the next encoded frame to be a keyframe (IDR).
    #[allow(dead_code)]
    pub fn force_keyframe(&mut self) {
        self.encoder.force_intra_frame();
    }
}
