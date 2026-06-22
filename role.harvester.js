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
  if (creep.memory.sourceId) {
    const source = Game.getObjectById(creep.memory.sourceId);

    if (source) {
      return source;
    }
  }

  const source =
    creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE) ||
    creep.pos.findClosestByPath(FIND_SOURCES);

  if (source) {
    creep.memory.sourceId = source.id;
  }

  return source;
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
