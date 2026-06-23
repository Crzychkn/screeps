const MAX_CONSTRUCTION_SITES_PER_ROOM = 5;

const BUILD_ORDER = [
  STRUCTURE_SPAWN,
  STRUCTURE_CONTAINER,
  STRUCTURE_EXTENSION,
  STRUCTURE_TOWER,
  STRUCTURE_STORAGE,
  STRUCTURE_ROAD,
];

const WALKABLE_STRUCTURE_TYPES = [
  STRUCTURE_CONTAINER,
  STRUCTURE_ROAD,
  STRUCTURE_RAMPART,
];

const TRAFFIC_SAFE_STRUCTURE_TYPES = [
  STRUCTURE_CONTAINER,
  STRUCTURE_ROAD,
  STRUCTURE_RAMPART,
];

function getPositionKey(x, y) {
  return `${x},${y}`;
}

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

function getAnchor(room) {
  if (room.storage) {
    return room.storage;
  }

  return findSpawn(room);
}

function getTrafficReservedPositions(room) {
  if (room._trafficReservedPositions) {
    return room._trafficReservedPositions;
  }

  const reserved = {};
  const anchor = getAnchor(room);

  if (!anchor) {
    room._trafficReservedPositions = reserved;
    return room._trafficReservedPositions;
  }

  const targets = [];

  if (room.controller) {
    targets.push({
      pos: room.controller.pos,
      range: 3,
    });
  }

  const sources = room.find(FIND_SOURCES);

  for (const source of sources) {
    targets.push({
      pos: source.pos,
      range: 1,
    });
  }

  for (const target of targets) {
    const path = anchor.pos.findPathTo(target.pos, {
      range: target.range,
      ignoreCreeps: true,
      maxOps: 200,
    });

    for (const step of path) {
      reserved[getPositionKey(step.x, step.y)] = true;
    }
  }

  room._trafficReservedPositions = reserved;
  return room._trafficReservedPositions;
}

function isWalkableStructure(structure) {
  return WALKABLE_STRUCTURE_TYPES.indexOf(structure.structureType) !== -1;
}

function isWalkableConstructionSite(site) {
  return TRAFFIC_SAFE_STRUCTURE_TYPES.indexOf(site.structureType) !== -1;
}

function getBaseTrafficCostMatrix(room) {
  if (room._baseTrafficCostMatrix) {
    return room._baseTrafficCostMatrix;
  }

  const costs = new PathFinder.CostMatrix();

  const structures = room.find(FIND_STRUCTURES);

  for (const structure of structures) {
    if (!isWalkableStructure(structure)) {
      costs.set(structure.pos.x, structure.pos.y, 255);
    }
  }

  const sites = room.find(FIND_CONSTRUCTION_SITES);

  for (const site of sites) {
    if (!isWalkableConstructionSite(site)) {
      costs.set(site.pos.x, site.pos.y, 255);
    }
  }

  room._baseTrafficCostMatrix = costs;
  return room._baseTrafficCostMatrix;
}

function getTrafficCostMatrix(room, blockedX, blockedY) {
  const costs = getBaseTrafficCostMatrix(room).clone();

  costs.set(blockedX, blockedY, 255);

  return costs;
}

function wouldBlockCriticalPaths(room, x, y) {
  const spawns = room.find(FIND_MY_SPAWNS);

  if (spawns.length === 0) {
    return false;
  }

  const goals = [];

  if (room.controller) {
    goals.push({
      pos: room.controller.pos,
      range: 3,
    });
  }

  const sources = room.find(FIND_SOURCES);

  for (const source of sources) {
    goals.push({
      pos: source.pos,
      range: 1,
    });
  }

  if (goals.length === 0) {
    return false;
  }

  const costs = getTrafficCostMatrix(room, x, y);

  for (const spawn of spawns) {
    for (const goal of goals) {
      const result = PathFinder.search(spawn.pos, goal, {
        maxOps: 1000,
        roomCallback: (roomName) => {
          if (roomName !== room.name) {
            return false;
          }

          return costs;
        },
      });

      if (result.incomplete) {
        return true;
      }
    }
  }

  return false;
}

function isTrafficSafePlacement(room, structureType, x, y) {
  if (TRAFFIC_SAFE_STRUCTURE_TYPES.indexOf(structureType) !== -1) {
    return true;
  }

  const reserved = getTrafficReservedPositions(room);

  if (reserved[getPositionKey(x, y)]) {
    return false;
  }

  return !wouldBlockCriticalPaths(room, x, y);
}

function tryPlaceAt(room, structureType, x, y) {
  if (!isBuildablePosition(room, x, y)) {
    return false;
  }

  if (!isTrafficSafePlacement(room, structureType, x, y)) {
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

function placeSpawn(room) {
  const spawns = room.find(FIND_MY_SPAWNS);
  const spawnSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
    filter: (site) => site.structureType === STRUCTURE_SPAWN,
  });

  if (spawns.length > 0 || spawnSites.length > 0 || !room.controller) {
    return false;
  }

  const sources = room.find(FIND_SOURCES);
  const positions = [];

  for (let range = 4; range <= 8; range++) {
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx) !== range && Math.abs(dy) !== range) {
          continue;
        }

        const x = room.controller.pos.x + dx;
        const y = room.controller.pos.y + dy;

        if (isBuildablePosition(room, x, y)) {
          positions.push(new RoomPosition(x, y, room.name));
        }
      }
    }
  }

  if (positions.length === 0) {
    return false;
  }

  positions.sort((a, b) => {
    const scoreA = getSpawnPlacementScore(a, room.controller, sources);
    const scoreB = getSpawnPlacementScore(b, room.controller, sources);

    return scoreA - scoreB;
  });

  for (const pos of positions) {
    if (tryPlaceAt(room, STRUCTURE_SPAWN, pos.x, pos.y)) {
      return true;
    }
  }

  return false;
}

function getSpawnPlacementScore(pos, controller, sources) {
  let score = pos.getRangeTo(controller) * 2;

  for (const source of sources) {
    score += pos.getRangeTo(source);
  }

  return score;
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

function hasContainerInRange(pos, range) {
  const structures = pos.findInRange(FIND_STRUCTURES, range, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
  });

  if (structures.length > 0) {
    return true;
  }

  const sites = pos.findInRange(FIND_MY_CONSTRUCTION_SITES, range, {
    filter: (site) => site.structureType === STRUCTURE_CONTAINER,
  });

  return sites.length > 0;
}

function isSourceContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  const sources = container.pos.findInRange(FIND_SOURCES, 1);

  return sources.length > 0;
}

function isControllerContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER || !container.room.controller) {
    return false;
  }

  return container.pos.getRangeTo(container.room.controller) <= 3;
}

function findContainerTargets(room, filter) {
  const targets = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return structure.structureType === STRUCTURE_CONTAINER && filter(structure);
    },
  });

  const sites = room.find(FIND_MY_CONSTRUCTION_SITES, {
    filter: (site) => {
      return site.structureType === STRUCTURE_CONTAINER && filter(site);
    },
  });

  return targets.concat(sites);
}

function findSourceContainerTargets(room) {
  return findContainerTargets(room, isSourceContainer);
}

function findControllerContainerTargets(room) {
  return findContainerTargets(room, isControllerContainer);
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

function placeControllerContainer(room) {
  const allowed = getAllowedStructureCount(room, STRUCTURE_CONTAINER);
  const current = getStructureCount(room, STRUCTURE_CONTAINER);

  if (current >= allowed || !room.controller) {
    return false;
  }

  if (hasContainerInRange(room.controller.pos, 3)) {
    return false;
  }

  const anchor = getAnchor(room);
  const positions = [];

  for (let range = 2; range <= 3; range++) {
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx) !== range && Math.abs(dy) !== range) {
          continue;
        }

        const x = room.controller.pos.x + dx;
        const y = room.controller.pos.y + dy;

        if (isBuildablePosition(room, x, y)) {
          positions.push(new RoomPosition(x, y, room.name));
        }
      }
    }
  }

  if (positions.length === 0) {
    return false;
  }

  if (anchor) {
    positions.sort((a, b) => {
      return a.getRangeTo(anchor) - b.getRangeTo(anchor);
    });
  }

  const pos = positions[0];

  return tryPlaceAt(room, STRUCTURE_CONTAINER, pos.x, pos.y);
}

function placeContainers(room) {
  if (placeSourceContainers(room)) {
    return true;
  }

  return placeControllerContainer(room);
}

function isRoadBuildablePosition(room, x, y) {
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
      const structure = item.structure;

      if (structure.structureType === STRUCTURE_ROAD) {
        return false;
      }

      if (structure.structureType !== STRUCTURE_RAMPART) {
        return false;
      }
    }

    if (item.type === LOOK_CONSTRUCTION_SITES) {
      return false;
    }
  }

  return true;
}

function tryPlaceRoadAt(room, x, y) {
  if (!isRoadBuildablePosition(room, x, y)) {
    return false;
  }

  const result = room.createConstructionSite(x, y, STRUCTURE_ROAD);

  if (result === OK) {
    console.log(`Placed road construction site in ${room.name} at ${x},${y}`);
    return true;
  }

  return false;
}

function placeRoadAlongPath(room, targetPos, range) {
  const anchor = getAnchor(room);

  if (!anchor) {
    return false;
  }

  const path = anchor.pos.findPathTo(targetPos, {
    range: range,
    ignoreCreeps: true,
    maxOps: 200,
  });

  for (const step of path) {
    if (tryPlaceRoadAt(room, step.x, step.y)) {
      return true;
    }
  }

  return false;
}

function placeRoadToTarget(room, target, range) {
  if (!target) {
    return false;
  }

  return placeRoadAlongPath(room, target.pos, range);
}

function placeRoads(room) {
  if (room.controller.level < 2) {
    return false;
  }

  const anchor = getAnchor(room);

  if (!anchor) {
    return false;
  }

  const spawn = findSpawn(room);

  if (spawn && anchor.id !== spawn.id) {
    if (placeRoadAlongPath(room, spawn.pos, 1)) {
      return true;
    }
  }

  const controllerContainers = findControllerContainerTargets(room);

  for (const container of controllerContainers) {
    if (placeRoadToTarget(room, container, 1)) {
      return true;
    }
  }

  const sourceContainers = findSourceContainerTargets(room);

  for (const container of sourceContainers) {
    if (placeRoadToTarget(room, container, 1)) {
      return true;
    }
  }

  if (room.controller) {
    if (placeRoadAlongPath(room, room.controller.pos, 3)) {
      return true;
    }
  }

  const sources = room.find(FIND_SOURCES);

  for (const source of sources) {
    if (placeRoadAlongPath(room, source.pos, 1)) {
      return true;
    }
  }

  return false;
}

function tryBuild(room, structureType) {
  if (structureType === STRUCTURE_SPAWN) {
    return placeSpawn(room);
  }

  if (structureType === STRUCTURE_CONTAINER) {
    return placeContainers(room);
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

  if (structureType === STRUCTURE_ROAD) {
    return placeRoads(room);
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
