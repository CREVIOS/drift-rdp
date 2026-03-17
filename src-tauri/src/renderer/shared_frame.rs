use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex, Condvar,
};

/// Immutable snapshot of a frame. The renderer holds an `Arc<FrameSnapshot>`
/// without blocking the session actor from writing new data.
pub struct FrameSnapshot {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

struct SharedFrameInner {
    width: u32,
    height: u32,
    write_buf: Vec<u8>,
    read_snapshot: Arc<FrameSnapshot>,
}

/// High-performance shared frame buffer between the RDP session actor and the GPU renderer.
///
/// Optimizations:
/// - Lock-free dirty check via AtomicBool (render thread doesn't lock when idle)
/// - Condvar wakes render thread on new frame (no busy-spin)
/// - `begin_write()`/`end_write()` batch multiple dirty rects under one lock
/// - `publish()` swaps buffers via `std::mem::swap` (zero-copy)
/// - `Arc::try_unwrap` reclaims old snapshot's allocation
pub struct SharedFrame {
    inner: Mutex<SharedFrameInner>,
    dirty: AtomicBool,
    version: AtomicU64,
    /// Condvar to wake the render thread when a new frame is published
    notify: Condvar,
}

/// Guard for batched writes. Holds the mutex for the duration of multiple update_rect calls.
/// Drops automatically, releasing the lock.
pub struct WriteGuard<'a> {
    inner: std::sync::MutexGuard<'a, SharedFrameInner>,
}

impl WriteGuard<'_> {
    /// Write a dirty rectangle into the frame buffer.
    /// `rgba_data` starts at the rect's first pixel; rows are `stride` bytes apart.
    pub fn update_rect(&mut self, x: u16, y: u16, w: u16, h: u16, rgba_data: &[u8], stride: usize) {
        let fw = self.inner.width as usize;
        let fh = self.inner.height as usize;
        let row_bytes = w as usize * 4;

        for row in 0..h as usize {
            let dy = y as usize + row;
            if dy >= fh { break; }
            let src_offset = row * stride;
            let dst_offset = (dy * fw + x as usize) * 4;
            if src_offset + row_bytes <= rgba_data.len()
                && dst_offset + row_bytes <= self.inner.write_buf.len()
            {
                self.inner.write_buf[dst_offset..dst_offset + row_bytes]
                    .copy_from_slice(&rgba_data[src_offset..src_offset + row_bytes]);
            }
        }
    }

    pub fn width(&self) -> u32 { self.inner.width }
    pub fn height(&self) -> u32 { self.inner.height }
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
            notify: Condvar::new(),
        })
    }

    /// Begin a batched write. Locks the mutex ONCE for multiple update_rect calls.
    /// Call `end_write()` when done to mark dirty and wake the renderer.
    pub fn begin_write(&self) -> WriteGuard<'_> {
        WriteGuard {
            inner: self.inner.lock().unwrap(),
        }
    }

    /// Mark the frame as dirty and wake the render thread.
    /// Call after dropping the WriteGuard or after update_full.
    pub fn mark_dirty(&self) {
        self.dirty.store(true, Ordering::Release);
        self.version.fetch_add(1, Ordering::Relaxed);
        self.notify.notify_one();
    }

    /// Called by the session actor to update the entire frame.
    pub fn update_full(&self, width: u32, height: u32, data: &[u8]) {
        let mut inner = self.inner.lock().unwrap();
        let expected = (width * height * 4) as usize;
        if data.len() < expected { return; }
        if inner.width != width || inner.height != height {
            inner.width = width;
            inner.height = height;
            inner.write_buf.resize(expected, 0);
        }
        inner.write_buf[..expected].copy_from_slice(&data[..expected]);
        drop(inner);
        self.mark_dirty();
    }

    /// Single rect update (for simple cases). For multiple rects, use begin_write().
    pub fn update_rect(&self, x: u16, y: u16, w: u16, h: u16, rgba_data: &[u8], stride: usize) {
        let mut guard = self.begin_write();
        guard.update_rect(x, y, w, h, rgba_data, stride);
        drop(guard);
        self.mark_dirty();
    }

    /// Publish the write buffer as a new immutable snapshot.
    /// Zero-copy: swaps write_buf into snapshot, reclaims old snapshot's Vec.
    pub fn publish(&self) -> Option<Arc<FrameSnapshot>> {
        if !self.dirty.swap(false, Ordering::AcqRel) {
            return None;
        }
        let mut inner = self.inner.lock().unwrap();

        let mut snapshot_data = Vec::new();
        std::mem::swap(&mut inner.write_buf, &mut snapshot_data);

        let snapshot = Arc::new(FrameSnapshot {
            width: inner.width,
            height: inner.height,
            data: snapshot_data,
        });

        let old_snapshot = std::mem::replace(&mut inner.read_snapshot, snapshot.clone());

        // Reclaim old Vec allocation if renderer released it
        match Arc::try_unwrap(old_snapshot) {
            Ok(old) => {
                inner.write_buf = old.data;
                let expected = (inner.width * inner.height * 4) as usize;
                inner.write_buf.resize(expected, 0);
            }
            Err(_) => {
                let expected = (inner.width * inner.height * 4) as usize;
                inner.write_buf = vec![0u8; expected];
            }
        }

        Some(snapshot)
    }

    /// Block until a new frame is available or timeout (for render thread).
    pub fn wait_for_frame(&self, timeout: std::time::Duration) -> bool {
        if self.dirty.load(Ordering::Acquire) {
            return true;
        }
        let guard = self.inner.lock().unwrap();
        let (_guard, result) = self.notify.wait_timeout(guard, timeout).unwrap();
        result.timed_out() == false || self.dirty.load(Ordering::Acquire)
    }

    pub fn dimensions(&self) -> (u32, u32) {
        let inner = self.inner.lock().unwrap();
        (inner.width, inner.height)
    }

    pub fn version(&self) -> u64 {
        self.version.load(Ordering::Relaxed)
    }
}
