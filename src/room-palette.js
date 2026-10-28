export const ROOM_PALETTE = {
  wall: '#66516F',
  wallShade: '#9C8AA8',
  bedWood: '#916A53' // Table's authored wood color.
};

// Keep wall edits scoped: trim shares its material with the floor.
export function applyRoomPalette(app, room) {
  const walls = room.getObjectByName('Walls');
  for (const name of ['Wall', 'Cube 5', 'Cube 4', 'Cube 3', 'Cube 7', 'Cube']) {
    const object = walls?.getObjectByName(name);
    if (object?.type !== 'Mesh') continue;
    const handle = app.findObjectById(object.uuid);
    // Layer edits reliably refresh Spline 2.0.60; the color shorthand does not.
    for (const layer of handle?.material?.layers || []) {
      if (layer.type === 'color') layer.color = ROOM_PALETTE.wall;
      if (layer.type === 'depth') layer.colors[0] = ROOM_PALETTE.wallShade;
    }
  }

  // This group contains only the wooden frame, including duplicate child names.
  room.getObjectByName('Bed')?.getObjectByName('Empty Object 2')?.traverse(object => {
    if (object.type !== 'Mesh') return;
    for (const layer of app.findObjectById(object.uuid)?.material?.layers || []) {
      if (layer.type === 'color') layer.color = ROOM_PALETTE.bedWood;
      // Remove the frame's extra red tint so the table's wood color carries through.
      if (layer.type === 'depth') layer.colors[0] = '#FFFFFF';
    }
  });
}
