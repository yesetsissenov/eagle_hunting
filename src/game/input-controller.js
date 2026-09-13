import { createPointerState, joystickVector, releasePointer } from "./input-math.js";

export class InputController {
  constructor({ canvas, onTarget, onPause }) {
    this.canvas = canvas;
    this.onTarget = onTarget;
    this.onPause = onPause;
    this.mobile = matchMedia("(pointer: coarse)").matches || innerWidth <= 760;
    this.state = { steerX: 0, steerY: 0, boost: false, dive: false, vision: false };
    this.pointerSteer = { x: 0, y: 0 };
    this.keys = new Set();
    this.pointers = createPointerState();
    this.joystickOrigin = { x: 0, y: 0 };
    this.bound = [];
    this.setupCommon();
    this.setupDesktop();
    this.setupTouch();
  }

  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.bound.push(() => target.removeEventListener(event, handler, options));
  }

  setupCommon() {
    this.listen(window, "keydown", (event) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (event.code === "Escape") {
        this.onPause?.();
        return;
      }
      this.keys.add(event.code);
      if (event.code === "KeyV") this.setVision(true);
      this.syncKeys();
    });
    this.listen(window, "keyup", (event) => {
      this.keys.delete(event.code);
      if (event.code === "KeyV") this.setVision(false);
      this.syncKeys();
    });
    this.listen(window, "blur", () => this.clearTransient());
    this.listen(this.canvas, "contextmenu", (event) => event.preventDefault());
  }

  setupDesktop() {
    this.listen(this.canvas, "pointermove", (event) => {
      if (event.pointerType === "touch" || this.mobile) return;
      this.pointerSteer.x = event.clientX / innerWidth * 2 - 1;
      this.pointerSteer.y = event.clientY / innerHeight * 2 - 1;
      this.syncKeys();
    });
    this.listen(this.canvas, "pointerdown", (event) => {
      if (event.pointerType === "touch" || this.mobile) {
        if (this.state.vision) this.onTarget?.(event.clientX, event.clientY);
        return;
      }
      if (this.state.vision) this.onTarget?.(event.clientX, event.clientY);
      else this.state.dive = true;
    });
    this.listen(window, "pointerup", (event) => {
      if (event.pointerType !== "touch") this.state.dive = false;
    });
    this.listen(this.canvas, "wheel", (event) => {
      if (event.deltaY < 0) {
        this.state.boost = true;
        clearTimeout(this.wheelTimer);
        this.wheelTimer = setTimeout(() => { if (!this.keys.has("KeyW")) this.state.boost = false; }, 420);
      }
    }, { passive: true });
  }

  setupTouch() {
    const zone = document.querySelector("#joystickZone");
    const base = zone?.querySelector(".joystick-base");
    const knob = document.querySelector("#joystickKnob");
    const dive = document.querySelector("#diveButton");
    const boost = document.querySelector("#boostButton");
    this.visionButton = document.querySelector("#visionButton");
    if (!zone || !base || !knob || !dive || !boost || !this.visionButton) return;

    this.listen(zone, "pointerdown", (event) => {
      if (this.pointers.joystickPointer !== null) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = base.getBoundingClientRect();
      this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.pointers.joystickPointer = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      this.moveJoystick(event, knob);
    });
    this.listen(zone, "pointermove", (event) => {
      if (event.pointerId === this.pointers.joystickPointer) this.moveJoystick(event, knob);
    });

    const endJoystick = (event) => {
      if (event.pointerId !== this.pointers.joystickPointer) return;
      this.pointers = releasePointer(this.pointers, event.pointerId);
      this.state.steerX = 0;
      this.state.steerY = 0;
      knob.style.transform = "translate(-50%, -50%)";
    };
    this.listen(zone, "pointerup", endJoystick);
    this.listen(zone, "pointercancel", endJoystick);

    this.bindHoldButton(dive, "divePointers", "dive");
    this.bindHoldButton(boost, "boostPointers", "boost");
    this.listen(this.visionButton, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.setVision(!this.state.vision);
    });
  }

  moveJoystick(event, knob) {
    const vector = joystickVector(this.joystickOrigin, { x: event.clientX, y: event.clientY }, 55);
    this.state.steerX = vector.x;
    this.state.steerY = vector.y;
    knob.style.transform = `translate(calc(-50% + ${vector.knobX}px), calc(-50% + ${vector.knobY}px))`;
  }

  bindHoldButton(button, pointerSet, stateKey) {
    const end = (event) => {
      this.pointers = releasePointer(this.pointers, event.pointerId);
      this.state[stateKey] = this.pointers[pointerSet].size > 0;
      button.classList.toggle("active", this.state[stateKey]);
    };
    this.listen(button, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      this.pointers[pointerSet].add(event.pointerId);
      this.state[stateKey] = true;
      button.classList.add("active");
    });
    this.listen(button, "pointerup", end);
    this.listen(button, "pointercancel", end);
  }

  syncKeys() {
    if (!this.mobile) {
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) this.state.steerX = -.9;
      else if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) this.state.steerX = .9;
      else this.state.steerX = this.pointerSteer.x;
      this.state.steerY = this.pointerSteer.y;
    }
    this.state.boost = this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.pointers.boostPointers.size > 0;
    this.state.dive = this.keys.has("Space") || this.keys.has("KeyS") || this.keys.has("ArrowDown") || this.pointers.divePointers.size > 0;
  }

  setVision(active) {
    this.state.vision = Boolean(active);
    this.visionButton?.classList.toggle("active", this.state.vision);
    this.visionButton?.setAttribute("aria-pressed", String(this.state.vision));
  }

  clearTransient() {
    this.keys.clear();
    this.pointers = createPointerState();
    this.state.boost = false;
    this.state.dive = false;
    this.state.steerX = 0;
    this.state.steerY = 0;
  }

  destroy() {
    clearTimeout(this.wheelTimer);
    this.bound.forEach((remove) => remove());
  }
}
