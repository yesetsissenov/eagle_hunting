import { describe, expect, it } from "vitest";
import { createPointerState, joystickVector, releasePointer } from "../src/game/input-math.js";

describe("mobile input math", () => {
  it("clamps joystick movement without changing its direction", () => {
    const vector = joystickVector({ x: 100, y: 100 }, { x: 220, y: 160 }, 60);
    expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1);
    expect(vector.x).toBeGreaterThan(vector.y);
  });

  it("releases only the pointer that ended", () => {
    const state = createPointerState();
    state.joystickPointer = 7;
    state.divePointers.add(8);
    state.boostPointers.add(9);
    const next = releasePointer(state, 8);
    expect(next.joystickPointer).toBe(7);
    expect(next.divePointers.size).toBe(0);
    expect(next.boostPointers.has(9)).toBe(true);
  });
});
