import * as THREE from "../../three.module.js";

const projected = new THREE.Vector3();

function toScreen(position, camera, width, height) {
  projected.copy(position).project(camera);
  if (projected.z < -1 || projected.z > 1) return null;
  return {
    x: (projected.x + 1) * .5 * width,
    y: (1 - projected.y) * .5 * height,
    behind: projected.z > 1,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function marker(context, x, y, color, radius, protectedAnimal = false) {
  context.strokeStyle = color;
  context.lineWidth = 1.6;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(x - radius - 5, y);
  context.lineTo(x - radius + 2, y);
  context.moveTo(x + radius - 2, y);
  context.lineTo(x + radius + 5, y);
  context.stroke();
  if (protectedAnimal) {
    context.fillStyle = color;
    context.font = "700 10px system-ui";
    context.textAlign = "center";
    context.fillText("НАБЛЮДЕНИЕ", x, y + radius + 15);
  }
}

function drawTarget(context, camera, state, width, height) {
  const target = state.target;
  if (!target || target.mode === "gone") return;
  const position = target.model.position.clone().add({ x: 0, y: target.definition.size * 1.6, z: 0 });
  const screen = toScreen(position, camera, width, height);
  const distance = Math.hypot(state.eagle.position.x - target.x, state.eagle.position.z - target.z);
  if (screen && screen.x > 20 && screen.x < width - 20 && screen.y > 20 && screen.y < height - 20) {
    const pulse = 19 + Math.sin(state.time * 7) * 3;
    marker(context, screen.x, screen.y, "rgba(239,197,91,.98)", pulse);
    context.fillStyle = "rgba(245,239,219,.96)";
    context.font = "700 12px system-ui";
    context.textAlign = "center";
    context.fillText(`${target.definition.name} · ${Math.round(distance)} м`, screen.x, screen.y - pulse - 10);
    if (distance < 95 && !state.eagle.diving) {
      context.fillStyle = "#f2c960";
      context.font = "800 13px system-ui";
      context.fillText("ПИКЕ", screen.x, screen.y + pulse + 18);
    }
  } else {
    let angle = Math.atan2(target.x - state.eagle.position.x, target.z - state.eagle.position.z) - state.eagle.yaw;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    const x = width / 2 + THREE.MathUtils.clamp(Math.sin(angle) * width * .38, -width * .4, width * .4);
    context.save();
    context.translate(x, height * .22);
    context.rotate(-angle);
    context.fillStyle = "rgba(239,197,91,.95)";
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(8, 7);
    context.lineTo(0, 2);
    context.lineTo(-8, 7);
    context.closePath();
    context.fill();
    context.restore();
  }
}

export function drawOverlay(context, camera, world, state, width, height) {
  context.clearRect(0, 0, width, height);
  if (state.eagle.vision) {
    const vignette = context.createRadialGradient(width / 2, height / 2, height * .16, width / 2, height / 2, height * .72);
    vignette.addColorStop(0, "rgba(17,25,24,.04)");
    vignette.addColorStop(1, "rgba(5,13,18,.48)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(226,189,104,.42)";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(width / 2, height / 2, Math.min(width * .36, height * .42), height * .34, 0, 0, Math.PI * 2);
    context.stroke();

    const candidates = world.animals
      .filter((animal) => animal.mode !== "gone")
      .map((animal) => ({
        animal,
        distance: Math.hypot(state.eagle.position.x - animal.x, state.eagle.position.z - animal.z),
        screen: toScreen(animal.model.position.clone().add({ x: 0, y: animal.definition.size * 1.5, z: 0 }), camera, width, height),
      }))
      .filter((item) => item.screen && item.distance < 720 && item.screen.x > 34 && item.screen.x < width - 34 && item.screen.y > 34 && item.screen.y < height - 34)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, width < 600 ? 6 : 12);
    const occupied = [];
    for (const item of candidates) {
      const { animal, screen, distance } = item;
      const protectedAnimal = animal.definition.kind === "wildlife";
      const color = protectedAnimal ? "rgba(139,201,151,.95)" : "rgba(226,189,104,.95)";
      marker(context, screen.x, screen.y, color, protectedAnimal ? 13 : 11, protectedAnimal);
      const label = `${animal.definition.name} · ${Math.round(distance)} м`;
      context.font = "600 11px system-ui";
      const textWidth = context.measureText(label).width;
      const labelX = THREE.MathUtils.clamp(screen.x, textWidth / 2 + 8, width - textWidth / 2 - 8);
      const box = { x: labelX - textWidth / 2 - 5, y: screen.y - 29, width: textWidth + 10, height: 17 };
      if (occupied.some((other) => overlaps(box, other))) continue;
      occupied.push(box);
      context.fillStyle = "rgba(8,14,12,.68)";
      context.fillRect(box.x, box.y, box.width, box.height);
      context.fillStyle = color;
      context.textAlign = "center";
      context.fillText(label, labelX, screen.y - 17);
    }
  }
  drawTarget(context, camera, state, width, height);
  if (state.hitFlash > 0) {
    const gradient = context.createRadialGradient(width / 2, height / 2, height * .2, width / 2, height / 2, height * .75);
    gradient.addColorStop(0, "rgba(171,52,37,0)");
    gradient.addColorStop(1, `rgba(171,52,37,${Math.min(.5, state.hitFlash)})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
}
