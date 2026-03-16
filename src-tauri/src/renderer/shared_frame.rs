use std::sync::{Arc, Mutex};

/// Shared frame buffer between the RDP session actor and the GPU renderer.
/// The session actor writes RGBA pixel data here.
/// The render loop reads from here and uploads to a GPU texture.
pub struct SharedFrame {
    inner: Mutex<SharedFrameInner>,
}

struct SharedFrameInner {
    width: u32,
    height: u32,
    data: Vec<u8>, // RGBA pixels
    dirty: bool,   // true if data has changed since last read
    version: u64,  // monotonically increasing version counter
}

impl SharedFrame {
    pub fn new(width: u32, height: u32) -> Arc<Self> {
        let size = (width * height * 4) as usize;
        Arc::new(Self {
            inner: Mutex::new(SharedFrameInner {
                width,
                height,
                data: vec![0u8; size],
                dirty: true,
                version: 0,
            }),
        })
    }

    /// Called by the session actor to update the frame.
    /// Writes the entire RGBA buffer.
    pub fn update_full(&self, width: u32, height: u32, data: &[u8]) {
        let mut inner = self.inner.lock().unwrap();
        let expected_size = (width * height * 4) as usize;
        if data.len() < expected_size {
            return;
        }

        if inner.width != width || inner.height != height {
            inner.width = width;
            inner.height = height;
            inner.data.resize(expected_size, 0);
        }
        inner.data[..expected_size].copy_from_slice(&data[..expected_size]);
        inner.dirty = true;
        inner.version += 1;
    }

    /// Called by the session actor to update a dirty rectangle.
    pub fn update_rect(&self, x: u16, y: u16, w: u16, h: u16, rgba_data: &[u8], stride: usize) {
        let mut inner = self.inner.lock().unwrap();
        let fw = inner.width as usize;
        let fh = inner.height as usize;
        let row_bytes = w as usize * 4;

        for row in 0..h as usize {
            let dy = y as usize + row;
            if dy >= fh {
                break;
            }
            let src_offset = row * stride;
            let dst_offset = (dy * fw + x as usize) * 4;
            if src_offset + row_bytes <= rgba_data.len()
                && dst_offset + row_bytes <= inner.data.len()
            {
                inner.data[dst_offset..dst_offset + row_bytes]
                    .copy_from_slice(&rgba_data[src_offset..src_offset + row_bytes]);
            }
        }
        inner.dirty = true;
        inner.version += 1;
    }

    /// Called by the renderer to check if there's a new frame and get the data.
    /// Returns (width, height, data, version) if dirty, None otherwise.
    pub fn read_if_dirty(&self) -> Option<(u32, u32, Vec<u8>, u64)> {
        let mut inner = self.inner.lock().unwrap();
        if !inner.dirty {
            return None;
        }
        inner.dirty = false;
        Some((inner.width, inner.height, inner.data.clone(), inner.version))
    }

    pub fn dimensions(&self) -> (u32, u32) {
        let inner = self.inner.lock().unwrap();
        (inner.width, inner.height)
    }
}
