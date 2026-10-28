export const DAY_NIGHT_CYCLE_MS = 10 * 60 * 1000;
export const DAY_NIGHT_PHASES = ['night', 'day', 'sunset'];

export function getDayNightPhase(elapsed) {
  const position = ((elapsed % DAY_NIGHT_CYCLE_MS + DAY_NIGHT_CYCLE_MS) % DAY_NIGHT_CYCLE_MS)
    / (DAY_NIGHT_CYCLE_MS / DAY_NIGHT_PHASES.length);
  const index = Math.floor(position);
  const progress = position - index;
  return {
    from: DAY_NIGHT_PHASES[index],
    to: DAY_NIGHT_PHASES[(index + 1) % DAY_NIGHT_PHASES.length],
    blend: progress * progress * (3 - 2 * progress)
  };
}
