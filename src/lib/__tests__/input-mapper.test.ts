import { describe, it, expect } from 'vitest';
import { mapKeyEvent, mapMouseEvent } from '../input-mapper';

const mockKeyEvent = (overrides: Partial<KeyboardEvent>) =>
  ({
    code: 'KeyA',
    key: 'a',
    type: 'keydown',
    ...overrides,
  }) as unknown as KeyboardEvent;

const mockMouseEvent = (overrides: Partial<MouseEvent>) =>
  ({
    clientX: 100,
    clientY: 200,
    button: 0,
    ...overrides,
  }) as unknown as MouseEvent;

describe('mapKeyEvent', () => {
  it('maps letter keys correctly', () => {
    const result = mapKeyEvent(mockKeyEvent({ code: 'KeyA', type: 'keydown' }));
    expect(result.keyCode).toBe(0x41);
    expect(result.isDown).toBe(true);
  });

  it('maps keyup events', () => {
    const result = mapKeyEvent(mockKeyEvent({ code: 'KeyA', type: 'keyup' }));
    expect(result.keyCode).toBe(0x41);
    expect(result.isDown).toBe(false);
  });

  it('maps Enter key', () => {
    const result = mapKeyEvent(mockKeyEvent({ code: 'Enter', key: 'Enter' }));
    expect(result.keyCode).toBe(0x0d);
  });

  it('maps F1 key', () => {
    const result = mapKeyEvent(mockKeyEvent({ code: 'F1', key: 'F1' }));
    expect(result.keyCode).toBe(0x70);
  });

  it('maps ShiftLeft modifier', () => {
    const result = mapKeyEvent(mockKeyEvent({ code: 'ShiftLeft', key: 'Shift' }));
    expect(result.keyCode).toBe(0x10);
  });

  it('maps ControlLeft modifier', () => {
    const result = mapKeyEvent(mockKeyEvent({ code: 'ControlLeft', key: 'Control' }));
    expect(result.keyCode).toBe(0x11);
  });

  it('maps AltLeft modifier', () => {
    const result = mapKeyEvent(mockKeyEvent({ code: 'AltLeft', key: 'Alt' }));
    expect(result.keyCode).toBe(0x12);
  });
});

describe('mapMouseEvent', () => {
  it('maps left click (button 0 -> 1)', () => {
    const result = mapMouseEvent(mockMouseEvent({ button: 0 }), 'down');
    expect(result.button).toBe(1);
  });

  it('maps right click (button 2 -> 2)', () => {
    const result = mapMouseEvent(mockMouseEvent({ button: 2 }), 'down');
    expect(result.button).toBe(2);
  });

  it('maps middle click (button 1 -> 3)', () => {
    const result = mapMouseEvent(mockMouseEvent({ button: 1 }), 'down');
    expect(result.button).toBe(3);
  });

  it('computes coordinates relative to canvas rect', () => {
    const rect = { left: 10, top: 20 } as DOMRect;
    const result = mapMouseEvent(
      mockMouseEvent({ clientX: 100, clientY: 200 }),
      'move',
      rect
    );
    expect(result.x).toBe(90);
    expect(result.y).toBe(180);
  });

  it('uses clientX/clientY without rect', () => {
    const result = mapMouseEvent(
      mockMouseEvent({ clientX: 100, clientY: 200 }),
      'move'
    );
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('sets the correct eventType', () => {
    const result = mapMouseEvent(mockMouseEvent({}), 'scroll');
    expect(result.eventType).toBe('scroll');
  });
});
