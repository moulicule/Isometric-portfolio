// The LCD's connector distorts its bounding box; use only the front circular face.
export function screenSurface(points) {
  const y = Math.max(...points.map(p => p.y));
  const rim = points.filter(p => y - p.y < .000001);
  const minX = Math.min(...rim.map(p => p.x)), maxX = Math.max(...rim.map(p => p.x));
  const minZ = Math.min(...rim.map(p => p.z)), maxZ = Math.max(...rim.map(p => p.z));
  return { x: (minX + maxX) / 2, y: y + .000045, z: (minZ + maxZ) / 2, radius: Math.min(maxX - minX, maxZ - minZ) / 2 };
}
