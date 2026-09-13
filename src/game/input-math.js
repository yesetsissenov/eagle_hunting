export function joystickVector(origin, point, radius = 56) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.hypot(dx, dy);
  const scale = length > radius ? radius / length : 1;
  return {
    x: (dx * scale) / radius,
    y: (dy * scale) / radius,
    knobX: dx * scale,
    knobY: dy * scale,
  };
}

export function createPointerState() {
  return { joystickPointer: null, divePointers: new Set(), boostPointers: new Set() };
}

export function releasePointer(state, pointerId) {
  const next = {
    joystickPointer: state.joystickPointer === pointerId ? null : state.joystickPointer,
    divePointers: new Set(state.divePointers),
    boostPointers: new Set(state.boostPointers),
  };
  next.divePointers.delete(pointerId);
  next.boostPointers.delete(pointerId);
  return next;
}
