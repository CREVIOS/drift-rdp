use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use std::io::Cursor;
use image::{ImageEncoder, codecs::jpeg::JpegEncoder, codecs::png::PngEncoder};

/// Raw frame buffer holding pixel data.
#[derive(Debug, Clone)]
pub struct FrameBuffer {
    pub width: u32,
    pub height: u32,
    /// RGBA pixel data, length = width * height * 4
    pub data: Vec<u8>,
}

impl FrameBuffer {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            data: vec![0u8; (width * height * 4) as usize],
        }
    }

    /// Generate a mock frame with a gradient pattern for testing.
    /// Creates a simple blue-to-purple gradient with a green rectangle in the center.
    pub fn generate_mock_frame(width: u32, height: u32) -> Self {
        let mut fb = Self::new(width, height);

        for y in 0..height {
            for x in 0..width {
                let idx = ((y * width + x) * 4) as usize;

                // Blue-to-purple gradient background
                let r = ((x as f32 / width as f32) * 100.0) as u8;
                let g = 30;
                let b = ((y as f32 / height as f32) * 200.0 + 55.0) as u8;
                let a = 255u8;

                // Draw a green rectangle in the center
                let cx = width / 2;
                let cy = height / 2;
                let rect_w = width / 4;
                let rect_h = height / 4;

                if x >= cx - rect_w / 2
                    && x <= cx + rect_w / 2
                    && y >= cy - rect_h / 2
                    && y <= cy + rect_h / 2
                {
                    fb.data[idx] = 40;
                    fb.data[idx + 1] = 200;
                    fb.data[idx + 2] = 80;
                    fb.data[idx + 3] = 255;
                } else {
                    fb.data[idx] = r;
                    fb.data[idx + 1] = g;
                    fb.data[idx + 2] = b;
                    fb.data[idx + 3] = a;
                }
            }
        }

        fb
    }

    /// Encode the frame buffer as a base64-encoded PNG image.
    pub fn to_base64_png(&self) -> String {
        let mut png_bytes: Vec<u8> = Vec::new();
        {
            let cursor = Cursor::new(&mut png_bytes);
            let encoder = PngEncoder::new(cursor);
            encoder
                .write_image(&self.data, self.width, self.height, image::ExtendedColorType::Rgba8)
                .expect("Failed to encode PNG");
        }
        BASE64.encode(&png_bytes)
    }

    /// Encode the frame buffer as a base64-encoded JPEG image.
    pub fn to_base64_jpeg(&self, quality: u8) -> String {
        let mut rgb_bytes = Vec::with_capacity((self.width * self.height * 3) as usize);
        for rgba in self.data.chunks_exact(4) {
            rgb_bytes.extend_from_slice(&rgba[..3]);
        }

        let mut jpeg_bytes = Vec::with_capacity((self.width * self.height) as usize);
        {
            let cursor = Cursor::new(&mut jpeg_bytes);
            let encoder = JpegEncoder::new_with_quality(cursor, quality);
            encoder
                .write_image(
                    &rgb_bytes,
                    self.width,
                    self.height,
                    image::ExtendedColorType::Rgb8,
                )
                .expect("Failed to encode JPEG");
        }

        BASE64.encode(&jpeg_bytes)
    }

    /// Encode the frame buffer as a base64-encoded BMP image.
    /// Using BMP since it requires no external image encoding library.
    #[allow(dead_code)]
    pub fn to_base64_bmp(&self) -> String {
        let bmp_data = self.encode_bmp();
        BASE64.encode(&bmp_data)
    }

    /// Encode raw RGBA data into a BMP file (simple, no compression).
    #[allow(dead_code)]
    fn encode_bmp(&self) -> Vec<u8> {
        let w = self.width;
        let h = self.height;
        // BMP rows are padded to 4-byte boundaries; with 3 bytes/pixel (BGR):
        let row_size = ((w * 3 + 3) / 4) * 4;
        let pixel_data_size = row_size * h;
        let file_size = 54 + pixel_data_size;

        let mut bmp = Vec::with_capacity(file_size as usize);

        // -- BMP File Header (14 bytes) --
        bmp.extend_from_slice(b"BM");
        bmp.extend_from_slice(&(file_size).to_le_bytes());
        bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved
        bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved
        bmp.extend_from_slice(&54u32.to_le_bytes()); // pixel data offset

        // -- DIB Header (BITMAPINFOHEADER, 40 bytes) --
        bmp.extend_from_slice(&40u32.to_le_bytes()); // header size
        bmp.extend_from_slice(&(w as i32).to_le_bytes());
        bmp.extend_from_slice(&(h as i32).to_le_bytes()); // positive = bottom-up
        bmp.extend_from_slice(&1u16.to_le_bytes()); // color planes
        bmp.extend_from_slice(&24u16.to_le_bytes()); // bits per pixel
        bmp.extend_from_slice(&0u32.to_le_bytes()); // no compression
        bmp.extend_from_slice(&pixel_data_size.to_le_bytes());
        bmp.extend_from_slice(&2835u32.to_le_bytes()); // h resolution (72 DPI)
        bmp.extend_from_slice(&2835u32.to_le_bytes()); // v resolution
        bmp.extend_from_slice(&0u32.to_le_bytes()); // palette colors
        bmp.extend_from_slice(&0u32.to_le_bytes()); // important colors

        // -- Pixel Data (bottom-up, BGR) --
        for y in (0..h).rev() {
            let mut row_bytes = 0u32;
            for x in 0..w {
                let idx = ((y * w + x) * 4) as usize;
                let r = self.data[idx];
                let g = self.data[idx + 1];
                let b = self.data[idx + 2];
                // BMP uses BGR order
                bmp.push(b);
                bmp.push(g);
                bmp.push(r);
                row_bytes += 3;
            }
            // Pad row to 4-byte boundary
            while row_bytes % 4 != 0 {
                bmp.push(0);
                row_bytes += 1;
            }
        }

        bmp
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_mock_frame() {
        let fb = FrameBuffer::generate_mock_frame(10, 10);
        assert_eq!(fb.width, 10);
        assert_eq!(fb.height, 10);
        assert_eq!(fb.data.len(), 10 * 10 * 4);
    }

    #[test]
    fn test_bmp_encoding() {
        let fb = FrameBuffer::generate_mock_frame(10, 10);
        let bmp = fb.encode_bmp();
        // BMP files start with "BM" magic bytes
        assert_eq!(&bmp[0..2], b"BM");
        // Verify file size in header matches actual size
        let file_size = u32::from_le_bytes([bmp[2], bmp[3], bmp[4], bmp[5]]) as usize;
        assert_eq!(file_size, bmp.len());
    }

    #[test]
    fn test_base64_encoding() {
        let fb = FrameBuffer::generate_mock_frame(10, 10);
        let b64 = fb.to_base64_bmp();
        // Verify it's valid base64 by decoding
        let decoded = BASE64.decode(&b64);
        assert!(decoded.is_ok());
        // Decoded should start with BM
        let bytes = decoded.unwrap();
        assert_eq!(&bytes[0..2], b"BM");
    }

    #[test]
    fn test_png_encoding() {
        let fb = FrameBuffer::generate_mock_frame(10, 10);
        let b64 = fb.to_base64_png();
        // Verify it's valid base64 by decoding
        let decoded = BASE64.decode(&b64).expect("Invalid base64");
        // PNG files start with the 8-byte PNG signature
        assert_eq!(&decoded[0..4], &[0x89, 0x50, 0x4E, 0x47]);
    }

    #[test]
    fn test_png_base64_roundtrip() {
        let fb = FrameBuffer::generate_mock_frame(64, 48);
        let b64 = fb.to_base64_png();
        let decoded = BASE64.decode(&b64).expect("Invalid base64");
        // Verify PNG signature (first 8 bytes)
        assert_eq!(&decoded[0..8], &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        // PNG should be smaller than raw RGBA data for non-trivial images
        assert!(decoded.len() < fb.data.len(), "PNG should compress the data");
    }
}
