// Illustrative metres for the playground; this is not RSSI-to-distance calibration.
export function proximity(separation, homeSeparation) {
  const ratio = Math.max(0, Math.min(1, separation / Math.max(1, homeSeparation)));
  const metres = .25 + 4.75 * ratio;
  return { metres, rssi: -45 - 40 * ratio, active: ratio < .95 };
}
export function returnMotion(travel, span) {
  const pull = Math.max(0, Math.min(1, travel / Math.max(1, span)));
  return { duration: .24 + pull * .3, amplitude: 1 + pull * .08, period: .75 - pull * .08 };
}
