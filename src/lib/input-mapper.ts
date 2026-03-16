import type { KeyEvent, MouseEvent as RdpMouseEvent } from '../types';

/**
 * Maps a browser KeyboardEvent to the RDP key event format.
 * Uses standard virtual key codes compatible with RDP protocol.
 */
export function mapKeyEvent(e: globalThis.KeyboardEvent): KeyEvent {
  return {
    keyCode: mapBrowserKeyToVK(e.code, e.key),
    isDown: e.type === 'keydown',
  };
}

/**
 * Maps a browser MouseEvent to the RDP mouse event format.
 */
export function mapMouseEvent(
  e: globalThis.MouseEvent,
  type: 'move' | 'down' | 'up' | 'scroll',
  canvasRect?: DOMRect
): RdpMouseEvent {
  const x = canvasRect ? e.clientX - canvasRect.left : e.clientX;
  const y = canvasRect ? e.clientY - canvasRect.top : e.clientY;

  return {
    x: Math.round(x),
    y: Math.round(y),
    button: mapMouseButton(e.button),
    eventType: type,
  };
}

function mapMouseButton(button: number): number {
  switch (button) {
    case 0: return 1; // Left
    case 1: return 3; // Middle
    case 2: return 2; // Right
    default: return 0;
  }
}

/**
 * Map browser key codes to Windows Virtual Key codes.
 */
function mapBrowserKeyToVK(code: string, key: string): number {
  const map: Record<string, number> = {
    // Letters
    KeyA: 0x41, KeyB: 0x42, KeyC: 0x43, KeyD: 0x44,
    KeyE: 0x45, KeyF: 0x46, KeyG: 0x47, KeyH: 0x48,
    KeyI: 0x49, KeyJ: 0x4a, KeyK: 0x4b, KeyL: 0x4c,
    KeyM: 0x4d, KeyN: 0x4e, KeyO: 0x4f, KeyP: 0x50,
    KeyQ: 0x51, KeyR: 0x52, KeyS: 0x53, KeyT: 0x54,
    KeyU: 0x55, KeyV: 0x56, KeyW: 0x57, KeyX: 0x58,
    KeyY: 0x59, KeyZ: 0x5a,

    // Numbers
    Digit0: 0x30, Digit1: 0x31, Digit2: 0x32, Digit3: 0x33,
    Digit4: 0x34, Digit5: 0x35, Digit6: 0x36, Digit7: 0x37,
    Digit8: 0x38, Digit9: 0x39,

    // Function keys
    F1: 0x70, F2: 0x71, F3: 0x72, F4: 0x73,
    F5: 0x74, F6: 0x75, F7: 0x76, F8: 0x77,
    F9: 0x78, F10: 0x79, F11: 0x7a, F12: 0x7b,

    // Modifiers
    ShiftLeft: 0x10, ShiftRight: 0x10,
    ControlLeft: 0x11, ControlRight: 0x11,
    AltLeft: 0x12, AltRight: 0x12,
    MetaLeft: 0x5b, MetaRight: 0x5c,

    // Navigation
    ArrowUp: 0x26, ArrowDown: 0x28, ArrowLeft: 0x25, ArrowRight: 0x27,
    Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22,

    // Editing
    Backspace: 0x08, Delete: 0x2e, Insert: 0x2d,
    Enter: 0x0d, NumpadEnter: 0x0d,
    Tab: 0x09, Escape: 0x1b, Space: 0x20,

    // Punctuation
    Comma: 0xbc, Period: 0xbe, Slash: 0xbf,
    Semicolon: 0xba, Quote: 0xde,
    BracketLeft: 0xdb, BracketRight: 0xdd,
    Backslash: 0xdc, Backquote: 0xc0,
    Minus: 0xbd, Equal: 0xbb,

    // Lock keys
    CapsLock: 0x14, NumLock: 0x90, ScrollLock: 0x91,

    // Misc
    PrintScreen: 0x2c, Pause: 0x13, ContextMenu: 0x5d,

    // Numpad
    Numpad0: 0x60, Numpad1: 0x61, Numpad2: 0x62, Numpad3: 0x63,
    Numpad4: 0x64, Numpad5: 0x65, Numpad6: 0x66, Numpad7: 0x67,
    Numpad8: 0x68, Numpad9: 0x69,
    NumpadMultiply: 0x6a, NumpadAdd: 0x6b,
    NumpadSubtract: 0x6d, NumpadDecimal: 0x6e, NumpadDivide: 0x6f,
  };

  return map[code] ?? key.charCodeAt(0);
}
