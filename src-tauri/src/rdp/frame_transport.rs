use ironrdp::pdu::geometry::{InclusiveRectangle, Rectangle as _};
use ironrdp::session::image::DecodedImage;

use crate::rdp::display::FrameBuffer;

pub const PACKET_KIND_FULL_FRAME: u8 = 1;
pub const PACKET_KIND_DIRTY_RECTS: u8 = 2;

const PACKET_HEADER_LEN: usize = 1 + 2 + 2 + 2;
const RECT_HEADER_LEN: usize = 2 + 2 + 2 + 2;
const BYTES_PER_PIXEL: usize = 4;

pub fn encode_full_frame_packet(frame_buffer: &FrameBuffer) -> Vec<u8> {
    let rect = InclusiveRectangle {
        left: 0,
        top: 0,
        right: frame_buffer.width.saturating_sub(1) as u16,
        bottom: frame_buffer.height.saturating_sub(1) as u16,
    };

    encode_packet(
        PACKET_KIND_FULL_FRAME,
        frame_buffer.width as u16,
        frame_buffer.height as u16,
        &[rect],
        &frame_buffer.data,
    )
}

pub fn encode_image_update_packet(
    image: &DecodedImage,
    rects: &[InclusiveRectangle],
    scratch: &mut Vec<u8>,
) -> Vec<u8> {
    debug_assert_eq!(image.bytes_per_pixel(), BYTES_PER_PIXEL);

    scratch.clear();
    scratch.reserve(
        rects
            .iter()
            .map(|rect| usize::from(rect.width()) * usize::from(rect.height()) * BYTES_PER_PIXEL)
            .sum(),
    );

    let stride = image.stride();
    let image_data = image.data();

    for rect in rects {
        let row_bytes = usize::from(rect.width()) * BYTES_PER_PIXEL;
        let x_offset = usize::from(rect.left) * BYTES_PER_PIXEL;

        for y in rect.top..=rect.bottom {
            let start = usize::from(y) * stride + x_offset;
            let end = start + row_bytes;
            scratch.extend_from_slice(&image_data[start..end]);
        }
    }

    encode_packet(
        PACKET_KIND_DIRTY_RECTS,
        image.width(),
        image.height(),
        rects,
        scratch,
    )
}

fn encode_packet(
    kind: u8,
    surface_width: u16,
    surface_height: u16,
    rects: &[InclusiveRectangle],
    pixels: &[u8],
) -> Vec<u8> {
    let mut packet =
        Vec::with_capacity(PACKET_HEADER_LEN + rects.len() * RECT_HEADER_LEN + pixels.len());

    packet.push(kind);
    packet.extend_from_slice(&surface_width.to_le_bytes());
    packet.extend_from_slice(&surface_height.to_le_bytes());
    packet.extend_from_slice(&(rects.len() as u16).to_le_bytes());

    for rect in rects {
        packet.extend_from_slice(&rect.left.to_le_bytes());
        packet.extend_from_slice(&rect.top.to_le_bytes());
        packet.extend_from_slice(&rect.width().to_le_bytes());
        packet.extend_from_slice(&rect.height().to_le_bytes());
    }

    packet.extend_from_slice(pixels);
    packet
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_frame_packet_contains_header_and_pixels() {
        let frame = FrameBuffer {
            width: 2,
            height: 1,
            data: vec![1, 2, 3, 4, 5, 6, 7, 8],
        };

        let packet = encode_full_frame_packet(&frame);

        assert_eq!(packet[0], PACKET_KIND_FULL_FRAME);
        assert_eq!(u16::from_le_bytes([packet[1], packet[2]]), 2);
        assert_eq!(u16::from_le_bytes([packet[3], packet[4]]), 1);
        assert_eq!(u16::from_le_bytes([packet[5], packet[6]]), 1);
        assert_eq!(u16::from_le_bytes([packet[7], packet[8]]), 0);
        assert_eq!(u16::from_le_bytes([packet[9], packet[10]]), 0);
        assert_eq!(u16::from_le_bytes([packet[11], packet[12]]), 2);
        assert_eq!(u16::from_le_bytes([packet[13], packet[14]]), 1);
        assert_eq!(&packet[15..], frame.data.as_slice());
    }
}
