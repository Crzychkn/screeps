const TOWER_REFILL_THRESHOLD = 700;

function getHomeRoom(creep) {
  const homeRoomName = creep.memory.homeRoom || creep.room.name;
  return Game.rooms[homeRoomName] || creep.room;
}

function moveToTarget(creep, target, stroke) {
  creep.moveTo(target, {
    visualizePathStyle: {
      stroke: stroke,
    },
  });
}

function hasFreeEnergyCapacity(structure) {
  return (
    structure.store &&
    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  );
}

function hasLogisticsSupport(room) {
  return _.some(Game.creeps, (creep) => {
    return creep.memory.role === "tractor" && creep.memory.homeRoom === room.name;
  });
}

function getRoomMemory(room) {
  if (!Memory.rooms) {
    Memory.rooms = {};
  }

  if (!Memory.rooms[room.name]) {
    Memory.rooms[room.name] = {};
  }

  return Memory.rooms[room.name];
}

function getSourceSlotCount(room, source) {
  const roomMemory = getRoomMemory(room);

  if (!roomMemory.sourceSlots) {
    roomMemory.sourceSlots = {};
  }

  if (roomMemory.sourceSlots[source.id]) {
    return roomMemory.sourceSlots[source.id];
  }

  const terrain = room.getTerrain();
  let slotCount = 0;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const x = source.pos.x + dx;
      const y = source.pos.y + dy;

      if (x <= 0 || x >= 49 || y <= 0 || y >= 49) {
        continue;
      }

      if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
        slotCount++;
      }
    }
  }

  roomMemory.sourceSlots[source.id] = Math.max(slotCount, 1);
  return roomMemory.sourceSlots[source.id];
}

function countAssignedHarvesters(room, creepName) {
  const counts = {};

  for (const name in Game.creeps) {
    const other = Game.creeps[name];

    if (
      other.name === creepName ||
      other.memory.role !== "harvester" ||
      other.memory.homeRoom !== room.name ||
      !other.memory.sourceId
    ) {
      continue;
    }

    counts[other.memory.sourceId] = (counts[other.memory.sourceId] || 0) + 1;
  }

  return counts;
}

function chooseLeastLoadedSource(creep, room, sources, assignedCounts) {
  return sources.reduce((best, source) => {
    if (!best) {
      return source;
    }

    const sourceLoad =
      (assignedCounts[source.id] || 0) / getSourceSlotCount(room, source);
    const bestLoad =
      (assignedCounts[best.id] || 0) / getSourceSlotCount(room, best);

    if (sourceLoad !== bestLoad) {
      return sourceLoad < bestLoad ? source : best;
    }

    return creep.pos.getRangeTo(source) < creep.pos.getRangeTo(best)
      ? source
      : best;
  }, null);
}

function findClosestOwnedStructureToFill(creep, structureType) {
  return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      if (structure.structureType !== structureType) {
        return false;
      }

      if (!hasFreeEnergyCapacity(structure)) {
        return false;
      }

      if (structure.structureType === STRUCTURE_TOWER) {
        return structure.store[RESOURCE_ENERGY] < TOWER_REFILL_THRESHOLD;
      }

      return true;
    },
  });
}

function getAssignedSource(creep) {
  const room = getHomeRoom(creep);
  const sources = room.find(FIND_SOURCES);

  if (sources.length === 0) {
    delete creep.memory.sourceId;
    return null;
  }

  const assignedCounts = countAssignedHarvesters(room, creep.name);
  let currentSource = creep.memory.sourceId
    ? Game.getObjectById(creep.memory.sourceId)
    : null;
  const bestSource = chooseLeastLoadedSource(creep, room, sources, assignedCounts);

  if (!bestSource) {
    delete creep.memory.sourceId;
    return null;
  }

  if (currentSource && !sources.some((source) => source.id === currentSource.id)) {
    currentSource = null;
  }

  if (!currentSource) {
    creep.memory.sourceId = bestSource.id;
    return bestSource;
  }

  const currentLoad =
    ((assignedCounts[currentSource.id] || 0) + 1) /
    getSourceSlotCount(room, currentSource);
  const bestLoad =
    ((assignedCounts[bestSource.id] || 0) + 1) /
    getSourceSlotCount(room, bestSource);

  if (creep.store[RESOURCE_ENERGY] === 0 && currentLoad > bestLoad + 0.5) {
    creep.memory.sourceId = bestSource.id;
    return bestSource;
  }

  return currentSource;
}

function findAssignedSourceContainer(creep) {
  const source = getAssignedSource(creep);

  if (!source) {
    return null;
  }

  const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });

  if (containers.length === 0) {
    return null;
  }

  return containers[0];
}

function findNearbyContainerToFill(creep) {
  const containers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });

  if (containers.length === 0) {
    return null;
  }

  return containers[0];
}

function findClosestContainerToFill(creep) {
  return creep.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });
}

function findDeliveryTarget(creep) {
  const room = getHomeRoom(creep);

  if (hasLogisticsSupport(room)) {
    const sourceContainer = findAssignedSourceContainer(creep);

    if (sourceContainer) {
      return sourceContainer;
    }
  }

  const priorityTypes = [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    STRUCTURE_TOWER,
  ];

  for (const structureType of priorityTypes) {
    const target = findClosestOwnedStructureToFill(creep, structureType);

    if (target) {
      return target;
    }
  }

  const nearbyContainer = findNearbyContainerToFill(creep);

  if (nearbyContainer) {
    return nearbyContainer;
  }

  if (creep.room.storage && hasFreeEnergyCapacity(creep.room.storage)) {
    return creep.room.storage;
  }

  return findClosestContainerToFill(creep);
}

function harvestEnergy(creep) {
  const source = getAssignedSource(creep);

  if (!source) {
    creep.say("🚫 source");
    return;
  }

  const result = creep.harvest(source);

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source, "#ffaa00");
  }
}

function deliverEnergy(creep) {
  const target = findDeliveryTarget(creep);

  if (!target) {
    const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);

    if (spawn) {
      moveToTarget(creep, spawn, "#ffffff");
    }

    creep.say("🚫 storage");
    return;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, "#ffffff");
  }
}

module.exports = {
  run: function (creep) {
    const homeRoom = getHomeRoom(creep);

    if (!creep.memory.homeRoom) {
      creep.memory.homeRoom = homeRoom.name;
    }

    if (creep.room.name !== homeRoom.name) {
      moveToTarget(creep, new RoomPosition(25, 25, homeRoom.name), "#ffffff");
      return;
    }

    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      harvestEnergy(creep);
      return;
    }

    deliverEnergy(creep);
  },
};
