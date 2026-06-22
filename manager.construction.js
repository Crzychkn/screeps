const MAX_CONSTRUCTION_SITES_PER_ROOM = 5;

const BUILD_ORDER = [
  STRUCTURE_CONTAINER,
  STRUCTURE_EXTENSION,
  STRUCTURE_TOWER,
  STRUCTURE_STORAGE,
];

function getStructureCount(room, structureType) {
  const existing = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === structureType,
  }).length;

  const sites = room.find(FIND_MY_CONSTRUCTION_SITES, {
    filter: (site) => site.structureType === structureType,
  }).length;

  return existing + sites;
}

function getAllowedStructureCount(room, structureType) {
  const rcl = room.controller.level;

  if (!CONTROLLER_STRUCTURES[structureType]) {
    return 0;
  }

  return CONTROLLER_STRUCTURES[structureType][rcl] || 0;
}

function hasConstructionCapacity(room) {
  const sites = room.find(FIND_MY_CONSTRUCTION_SITES);

  return sites.length < MAX_CONSTRUCTION_SITES_PER_ROOM;


}

function isBuildablePosition(room, x, y) {
  if (x <= 0 || x >= 49 || y <= 0 || y >= 49) {
    return false;
  }

  const terrain = room.getTerrain();

  if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
    return false;
  }

  const look = room.lookAt(x, y);

  for (const item of look) {
    if (item.type === LOOK_STRUCTURES) {
      return false;
    }

    if (item.type === LOOK_CONSTRUCTION_SITES) {
      return false;
    }
  }

  return true;
}

function tryPlaceAt(room, structureType, x, y) {
  if (!isBuildablePosition(room, x, y)) {
    return false;
  }

  const result = room.createConstructionSite(x, y, structureType);

  if (result === OK) {
    console.log(`Placed ${structureType} construction site in ${room.name} at ${x},${y}`);
    return true;
  }

  return false;
}

function findSpawn(room) {
  const spawns = room.find(FIND_MY_SPAWNS);

  if (spawns.length === 0) {
    return null;
  }

  return spawns[0];
}

function placeNearAnchor(room, structureType, anchorPos, minRange, maxRange) {
  for (let range = minRange; range <= maxRange; range++) {
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx) !== range && Math.abs(dy) !== range) {
          continue;
        }

        const x = anchorPos.x + dx;
        const y = anchorPos.y + dy;

        if (tryPlaceAt(room, structureType, x, y)) {
          return true;
        }
      }
    }
  }

  return false;
}

function placeExtensions(room) {
  const allowed = getAllowedStructureCount(room, STRUCTURE_EXTENSION);
  const current = getStructureCount(room, STRUCTURE_EXTENSION);

  if (current >= allowed) {
    return false;
  }

  const spawn = findSpawn(room);

  if (!spawn) {
    return false;
  }

  return placeNearAnchor(room, STRUCTURE_EXTENSION, spawn.pos, 2, 6);
}

function placeTowers(room) {
  const allowed = getAllowedStructureCount(room, STRUCTURE_TOWER);
  const current = getStructureCount(room, STRUCTURE_TOWER);

  if (current >= allowed) {
    return false;
  }

  const spawn = findSpawn(room);

  if (!spawn) {
    return false;
  }

  return placeNearAnchor(room, STRUCTURE_TOWER, spawn.pos, 3, 7);
}

function placeStorage(room) {
  const allowed = getAllowedStructureCount(room, STRUCTURE_STORAGE);
  const current = getStructureCount(room, STRUCTURE_STORAGE);

  if (current >= allowed) {
    return false;
  }

  const spawn = findSpawn(room);

  if (!spawn) {
    return false;
  }

  return placeNearAnchor(room, STRUCTURE_STORAGE, spawn.pos, 2, 5);
}

function getAdjacentBuildablePositions(room, pos) {
  const positions = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const x = pos.x + dx;
      const y = pos.y + dy;

      if (isBuildablePosition(room, x, y)) {
        positions.push(new RoomPosition(x, y, room.name));
      }
    }
  }

  return positions;
}

function hasContainerNear(pos) {
  const structures = pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
  });

  if (structures.length > 0) {
    return true;
  }

  const sites = pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {
    filter: (site) => site.structureType === STRUCTURE_CONTAINER,
  });

  return sites.length > 0;
}

function placeSourceContainers(room) {
  const allowed = getAllowedStructureCount(room, STRUCTURE_CONTAINER);
  const current = getStructureCount(room, STRUCTURE_CONTAINER);

  if (current >= allowed) {
    return false;
  }

  const sources = room.find(FIND_SOURCES);

  for (const source of sources) {
    if (hasContainerNear(source.pos)) {
      continue;
    }

    const positions = getAdjacentBuildablePositions(room, source.pos);

    if (positions.length === 0) {
      continue;
    }

    const spawn = findSpawn(room);

    if (spawn) {
      positions.sort((a, b) => {
        return a.getRangeTo(spawn) - b.getRangeTo(spawn);
      });
    }

    const pos = positions[0];

    if (tryPlaceAt(room, STRUCTURE_CONTAINER, pos.x, pos.y)) {
      return true;
    }
  }

  return false;
}

function tryBuild(room, structureType) {
  if (structureType === STRUCTURE_CONTAINER) {
    return placeSourceContainers(room);
  }

  if (structureType === STRUCTURE_EXTENSION) {
    return placeExtensions(room);
  }

  if (structureType === STRUCTURE_TOWER) {
    return placeTowers(room);
  }

  if (structureType === STRUCTURE_STORAGE) {
    return placeStorage(room);
  }

  return false;
}

module.exports = {
  run: function (room) {
    if (!room.controller || !room.controller.my) {
      return;
    }

    if (!hasConstructionCapacity(room)) {
      return;
    }

    for (const structureType of BUILD_ORDER) {
      if (tryBuild(room, structureType)) {
        return;
      }
    }
  },
};