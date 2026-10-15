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

const INTERACTION_MS = 1200;
const HYDRATION_TICK_MS = 6000; // Ten percentage points per visible minute.
const clampProgress = (now, start, duration) => Math.min(1, Math.max(0, (now - start) / duration));

function snapshot(part) {
  return {
    part,
    position: new Vector3(part.position.x, part.position.y, part.position.z),
    rotation: new Euler(part.rotation.x, part.rotation.y, part.rotation.z)
  };
}

function setTransform(part, position, rotation) {
  for (const axis of ['x', 'y', 'z']) {
    part.position[axis] = position[axis];
    part.rotation[axis] = rotation[axis];
  }
}

export function createPlantInteraction(parts, pivot) {
  const foliage = parts.filter(Boolean).map(part => {
    const initial = snapshot(part);
    const offset = initial.position.clone().sub(pivot);
    const axis = new Vector3(offset.z, 0, -offset.x).normalize();
    if (!axis.lengthSq()) axis.set(0, 0, 1);
    return { ...initial, offset, axis, quaternion: new Quaternion().setFromEuler(initial.rotation) };
  });
  const turn = new Quaternion(), quaternion = new Quaternion(), rotation = new Euler(), position = new Vector3();
  let hydration = 50, elapsedVisible = 0, lastUpdate = null, wasVisible = false;
  let startedAt = null, progress = 1, watering = false, reducedMotion = false;
  let startHydration = hydration, posedHydration = null;

  function pose() {
    const eased = 1 - (1 - progress) ** 3;
    const visibleHydration = startedAt === null ? hydration : startHydration + (hydration - startHydration) * eased;
    const sway = startedAt === null || reducedMotion ? 0 : Math.sin(progress * Math.PI * 4) * (1 - progress) * (watering ? 0.05 : 0.025);
    for (const initial of foliage) {
      // Lean each blade outward around the pot rim; the ceramic never moves.
      const angle = (1 - visibleHydration / 100) * 0.07 + sway;
      if (angle === 0) {
        setTransform(initial.part, initial.position, initial.rotation);
        continue;
      }
      turn.setFromAxisAngle(initial.axis, angle);
      position.copy(initial.offset).applyQuaternion(turn).add(pivot);
      rotation.setFromQuaternion(quaternion.copy(turn).multiply(initial.quaternion));
      setTransform(initial.part, position, rotation);
    }
    posedHydration = hydration;
  }

  function settle() {
    startedAt = null;
    progress = 1;
    pose();
  }

  function update(now, { visible = true, reduced = false } = {}) {
    if (lastUpdate !== null && wasVisible) elapsedVisible += Math.max(0, now - lastUpdate);
    lastUpdate = now;
    wasVisible = visible;
    const loss = Math.floor(elapsedVisible / HYDRATION_TICK_MS);
    elapsedVisible %= HYDRATION_TICK_MS;
    hydration = Math.max(0, hydration - loss);
    reducedMotion = reduced;
    if (!visible || reduced) {
      if (startedAt !== null || posedHydration !== hydration) settle();
      return;
    }
    if (startedAt !== null) {
      progress = clampProgress(now, startedAt, INTERACTION_MS);
      if (progress === 1) startedAt = null;
      pose();
    } else if (posedHydration !== hydration) pose();
  }

  return {
    get hydration() { return hydration; },
    get busy() { return startedAt !== null; },
    get progress() { return progress; },
    get watering() { return watering; },
    water(now, { reduced = false } = {}) {
      update(now, { reduced });
      if (startedAt !== null) return null;
      watering = hydration < 100;
      startHydration = hydration;
      hydration = Math.min(100, hydration + 25);
      if (watering) elapsedVisible = 0;
      progress = 0;
      startedAt = now;
      if (reduced) settle();
      return watering ? 'water' : 'full';
    },
    update
  };
}

export function createCoffeeInteraction(mug, liquid, { top = 1, bottom = 0, lift = 15, tiltDirection = new Vector3(0, 0, 1) } = {}) {
  const initial = mug && snapshot(mug);
  const position = new Vector3(), rotation = new Euler();
  const initialQuaternion = initial && new Quaternion().setFromEuler(initial.rotation);
  const tilt = new Quaternion();
  // Direction is in the mug parent's coordinates, so orbiting the camera cannot change the sip.
  const tiltAxis = new Vector3(tiltDirection.z, 0, -tiltDirection.x).normalize();
  if (!tiltAxis.lengthSq()) tiltAxis.set(1, 0, 0);
  let sips = 4, startedAt = null, progress = 1, action = null, startLevel = 1;
  const level = () => sips / 4;

  function setLiquid(fill) {
    if (!liquid) return;
    liquid.position.y = bottom + (top - bottom) * fill;
    liquid.visible = fill > 0;
  }

  function settle() {
    startedAt = null;
    progress = 1;
    if (initial) setTransform(mug, initial.position, initial.rotation);
    setLiquid(level());
  }

  function update(now, { visible = true, reduced = false } = {}) {
    if (startedAt === null) return;
    if (!visible || reduced) return settle();
    progress = clampProgress(now, startedAt, action === 'refill' ? 1000 : INTERACTION_MS);
    if (progress === 1) return settle();
    if (initial && action === 'sip') {
      const raised = Math.sin(Math.PI * progress) ** 2;
      position.copy(initial.position);
      position.y += lift * raised;
      rotation.setFromQuaternion(tilt.setFromAxisAngle(tiltAxis, Math.PI / 12 * raised).multiply(initialQuaternion));
      setTransform(mug, position, rotation);
    }
    const poured = action === 'refill' ? 1 - (1 - progress) ** 3 : Math.min(1, Math.max(0, (progress - 0.3) / 0.4));
    setLiquid(startLevel + (level() - startLevel) * poured);
  }

  setLiquid(1);
  return {
    get sips() { return sips; },
    get busy() { return startedAt !== null; },
    get progress() { return progress; },
    get action() { return action; },
    drink(now, { reduced = false } = {}) {
      update(now, { reduced });
      if (startedAt !== null) return null;
      startLevel = level();
      action = sips === 0 ? 'refill' : 'sip';
      sips = action === 'refill' ? 4 : sips - 1;
      startedAt = now;
      progress = 0;
      if (reduced) settle();
      return action;
    },
    update
  };
}
