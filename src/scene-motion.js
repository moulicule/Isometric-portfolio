import { Euler, Quaternion, Vector3 } from 'three';

const FULL_TURN = Math.PI * 2;
const CHAIR_SWIVEL_MS = 1200;

// These handles must come from Spline's public API so edits commit matrices
// and request a render, even when its renderer is idle.
export function createChairSwivel(parts, pivot) {
  const transforms = parts.map(part => ({
    part,
    position: new Vector3(part.position.x, part.position.y, part.position.z),
    rotation: new Euler(part.rotation.x, part.rotation.y, part.rotation.z),
    quaternion: new Quaternion().setFromEuler(new Euler(part.rotation.x, part.rotation.y, part.rotation.z))
  }));
  const axis = new Vector3(0, 1, 0);
  const turn = new Quaternion();
  const quaternion = new Quaternion();
  const rotation = new Euler();
  const position = new Vector3();
  let startedAt = null;
  let angle = 0;
  let startAngle = 0;
  let targetAngle = 0;

  function update(now) {
    if (startedAt === null) return;
    const progress = Math.min(1, Math.max(0, (now - startedAt) / CHAIR_SWIVEL_MS));
    const eased = 1 - (1 - progress) ** 3;
    angle = startAngle + (targetAngle - startAngle) * eased;
    turn.setFromAxisAngle(axis, angle);
    for (const initial of transforms) {
      if (progress === 1) {
        position.copy(initial.position);
        rotation.copy(initial.rotation);
      } else {
        position.copy(initial.position).sub(pivot).applyQuaternion(turn).add(pivot);
        rotation.setFromQuaternion(quaternion.copy(turn).multiply(initial.quaternion));
      }
      initial.part.position.x = position.x;
      initial.part.position.y = position.y;
      initial.part.position.z = position.z;
      initial.part.rotation.x = rotation.x;
      initial.part.rotation.y = rotation.y;
      initial.part.rotation.z = rotation.z;
    }
    if (progress === 1) {
      startedAt = null;
      angle = startAngle = targetAngle = 0;
    }
  }

  return {
    start(now) {
      if (!transforms.length) return false;
      // Add a turn from the current pose so rapid taps give immediate momentum.
      update(now);
      startAngle = angle;
      targetAngle += FULL_TURN;
      startedAt = now;
      return true;
    },
    update
  };
}

function createClockHand(hand, center) {
  if (!hand) return () => {};
  const initialAngle = hand.rotation.z;
  // Preserve the face's tilt and each hand's depth above it.
  const normal = new Vector3(0, 0, 1).applyEuler(new Euler(hand.rotation.x, hand.rotation.y, 0));
  const offset = new Vector3(hand.position.x, hand.position.y, hand.position.z).sub(center);
  const depth = offset.dot(normal);
  const pivot = center.clone().addScaledVector(normal, depth);
  offset.addScaledVector(normal, -depth);
  const position = new Vector3();

  return angle => {
    // The exported cylinders are centered along their lengths, not at the hub.
    position.copy(offset).applyAxisAngle(normal, angle - initialAngle).add(pivot);
    hand.position.x = position.x;
    hand.position.y = position.y;
    hand.position.z = position.z;
    hand.rotation.z = angle;
  };
}

export function createWallClock(clock, hourHand, minuteHand) {
  const center = new Vector3(clock.position.x, clock.position.y, clock.position.z);
  const setHour = createClockHand(hourHand, center);
  const setMinute = createClockHand(minuteHand, center);

  return {
    update(date) {
      const minutes = date.getMinutes() + date.getSeconds() / 60;
      const hours = date.getHours() % 12 + minutes / 60;
      setHour(-hours / 12 * FULL_TURN);
      setMinute(-minutes / 60 * FULL_TURN);
    }
  };
}
