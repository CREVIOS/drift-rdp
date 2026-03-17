use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};

/// Immutable snapshot of a frame. The renderer can hold an `Arc<FrameSnapshot>`
/// without blocking the session actor from writing new data.
pub struct FrameSnapshot {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

struct SharedFrameInner {
    width: u32,
    height: u32,
    write_buf: Vec<u8>,                 // session actor writes here
    read_snapshot: Arc<FrameSnapshot>,  // renderer reads this
}

/// Shared frame buffer between the RDP session actor and the GPU renderer.
///
/// Uses a double-buffer design:
/// - The session actor writes into `write_buf` via `update_full` / `update_rect`.
/// - `publish()` swaps the write buffer into an immutable `Arc<FrameSnapshot>` (zero-copy
///   when the renderer has released the previous snapshot).
/// - The renderer holds the `Arc<FrameSnapshot>` for as long as it needs — no lock is held
///   during GPU upload.
pub struct SharedFrame {
    inner: Mutex<SharedFrameInner>,
    dirty: AtomicBool,
    version: AtomicU64,
}

impl SharedFrame {
    pub fn new(width: u32, height: u32) -> Arc<Self> {
        let size = (width * height * 4) as usize;
        Arc::new(Self {
            inner: Mutex::new(SharedFrameInner {
                width,
                height,
                write_buf: vec![0u8; size],
                read_snapshot: Arc::new(FrameSnapshot {
                    width,
                    height,
                    data: vec![0u8; size],
                }),
            }),
            dirty: AtomicBool::new(false),
            version: AtomicU64::new(0),
        })
    }

    /// Called by the session actor to update the entire frame.
    pub fn update_full(&self, width: u32, height: u32, data: &[u8]) {
        let mut inner = self.inner.lock().unwrap();
        let expected = (width * height * 4) as usize;
        if data.len() < expected {
            return;
        }
        if inner.width != width || inner.height != height {
            inner.width = width;
            inner.height = height;
            inner.write_buf.resize(expected, 0);
        }
        inner.write_buf[..expected].copy_from_slice(&data[..expected]);
        self.dirty.store(true, Ordering::Release);
        self.version.fetch_add(1, Ordering::Relaxed);
    }

    /// Called by the session actor to update a dirty rectangle.
    ///
    /// `rgba_data` starts at the first pixel of the rect and each subsequent row
    /// is `stride` bytes apart.
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
                && dst_offset + row_bytes <= inner.write_buf.len()
            {
                inner.write_buf[dst_offset..dst_offset + row_bytes]
                    .copy_from_slice(&rgba_data[src_offset..src_offset + row_bytes]);
            }
        }
        self.dirty.store(true, Ordering::Release);
        self.version.fetch_add(1, Ordering::Relaxed);
    }

    /// Publish the write buffer as a new immutable snapshot.
    ///
    /// Zero-copy path: swaps the write buffer into the snapshot via `std::mem::swap`,
    /// then tries to reclaim the old snapshot's `Vec` as the new write buffer (reusing
    /// the allocation). Falls back to a fresh allocation only if the renderer still
    /// holds a reference to the previous snapshot.
    pub fn publish(&self) -> Option<Arc<FrameSnapshot>> {
        if !self.dirty.swap(false, Ordering::AcqRel) {
            return None;
        }
        let mut inner = self.inner.lock().unwrap();

        // Take the write buffer (zero-copy move)
        let mut snapshot_data = Vec::new();
        std::mem::swap(&mut inner.write_buf, &mut snapshot_data);

        let snapshot = Arc::new(FrameSnapshot {
            width: inner.width,
            height: inner.height,
            data: snapshot_data,
        });

        // Replace the read snapshot with the new one
        let old_snapshot = std::mem::replace(&mut inner.read_snapshot, snapshot.clone());

        // Try to reclaim the old snapshot's Vec for the write buffer (reuse allocation)
        match Arc::try_unwrap(old_snapshot) {
            Ok(old) => {
                inner.write_buf = old.data;
                // Ensure correct size after a resolution change
                let expected = (inner.width * inner.height * 4) as usize;
                inner.write_buf.resize(expected, 0);
            }
            Err(_) => {
                // Renderer still holds a reference; allocate a fresh buffer
                let expected = (inner.width * inner.height * 4) as usize;
                inner.write_buf = vec![0u8; expected];
            }
        }

        Some(snapshot)
    }

    /// Get the latest published snapshot without checking the dirty flag.
    pub fn latest_snapshot(&self) -> Arc<FrameSnapshot> {
        self.inner.lock().unwrap().read_snapshot.clone()
    }

    pub fn dimensions(&self) -> (u32, u32) {
        let inner = self.inner.lock().unwrap();
        (inner.width, inner.height)
    }

    pub fn version(&self) -> u64 {
        self.version.load(Ordering::Relaxed)
    }
}
