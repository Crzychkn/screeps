const MIN_DROPPED_ENERGY = 25;

function getHomeRoom(creep) {
  const homeRoomName = creep.memory.homeRoom || creep.room.name;
  return Game.rooms[homeRoomName] || creep.room;
}

function moveToTarget(creep, target) {
  creep.moveTo(target, {
    visualizePathStyle: {
      stroke: "#ffffff",
    },
  });
}

function moveOffRoomEdge(creep) {
  const x = creep.pos.x;
  const y = creep.pos.y;

  if (x > 0 && x < 49 && y > 0 && y < 49) {
    return false;
  }

  creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
    reusePath: 0,
    visualizePathStyle: {
      stroke: "#ffaa00",
    },
  });

  return true;
}

function withdrawFromStorage(creep, room) {
  if (!room.storage || room.storage.store[RESOURCE_ENERGY] === 0) {
    return false;
  }

  const result = creep.withdraw(room.storage, RESOURCE_ENERGY);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, room.storage);
    return true;
  }

  return false;
}

function isControllerContainer(container, room) {
  if (container.structureType !== STRUCTURE_CONTAINER || !room.controller) {
    return false;
  }

  return container.pos.getRangeTo(room.controller) <= 3;
}

function withdrawFromControllerContainer(creep, room) {
  const controllerContainers = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        isControllerContainer(structure, room) &&
        structure.store[RESOURCE_ENERGY] > 0
      );
    },
  });

  if (controllerContainers.length === 0) {
    return false;
  }

  const target = creep.pos.findClosestByPath(controllerContainers);

  if (!target) {
    return false;
  }

  const result = creep.withdraw(target, RESOURCE_ENERGY);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target);
    return true;
  }

  return false;
}

function withdrawFromContainer(creep, room) {
  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store[RESOURCE_ENERGY] > 0
      );
    },
  });

  if (containers.length === 0) {
    return false;
  }

  const target = creep.pos.findClosestByPath(containers);

  if (!target) {
    return false;
  }

  const result = creep.withdraw(target, RESOURCE_ENERGY);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target);
    return true;
  }

  return false;
}

function pickupDroppedEnergy(creep, room) {
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) => {
      return (
        resource.resourceType === RESOURCE_ENERGY &&
        resource.amount >= MIN_DROPPED_ENERGY
      );
    },
  });

  if (droppedEnergy.length === 0) {
    return false;
  }

  const target = creep.pos.findClosestByPath(droppedEnergy);

  if (!target) {
    return false;
  }

  const result = creep.pickup(target);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target);
    return true;
  }

  return false;
}

function harvestSource(creep, room) {
  const sources = room.find(FIND_SOURCES_ACTIVE);

  if (sources.length === 0) {
    return false;
  }

  const source = creep.pos.findClosestByPath(sources);

  if (!source) {
    return false;
  }

  const result = creep.harvest(source);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source);
    return true;
  }

  return false;
}

function getEnergy(creep) {
  const homeRoom = getHomeRoom(creep);

  if (!creep.memory.homeRoom) {
    creep.memory.homeRoom = homeRoom.name;
  }

  if (creep.room.name !== homeRoom.name) {
    creep.moveTo(new RoomPosition(25, 25, homeRoom.name), {
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
    return;
  }

  if (moveOffRoomEdge(creep)) {
    return;
  }

  if (pickupDroppedEnergy(creep, homeRoom)) {
    return;
  }

  if (
    creep.memory.role === "upgrader" &&
    withdrawFromControllerContainer(creep, homeRoom)
  ) {
    return;
  }

  if (withdrawFromContainer(creep, homeRoom)) {
    return;
  }

  if (withdrawFromStorage(creep, homeRoom)) {
    return;
  }

  harvestSource(creep, homeRoom);
}

function getRepairQueue(room) {
  const repairSites = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      if (
        structure.structureType === STRUCTURE_WALL ||
        structure.structureType === STRUCTURE_RAMPART
      ) {
        return false;
      }

      if (structure.structureType === STRUCTURE_ROAD) {
        return structure.hits < structure.hitsMax * 0.9;
      }

      if (structure.structureType === STRUCTURE_CONTAINER) {
        return structure.hits < structure.hitsMax * 0.85;
      }

      return structure.hits < structure.hitsMax * 0.75;
    },
  });

  const repairPriorities = {
    [STRUCTURE_ROAD]: 1,
    [STRUCTURE_CONTAINER]: 2,
    [STRUCTURE_TOWER]: 3,
    [STRUCTURE_SPAWN]: 4,
    [STRUCTURE_EXTENSION]: 5,
    [STRUCTURE_STORAGE]: 6,
  };

  return repairSites.sort((a, b) => {
    const healthA = a.hits / a.hitsMax;
    const healthB = b.hits / b.hitsMax;

    if (healthA < 0.25 || healthB < 0.25) {
      return healthA - healthB;
    }

    const priorityA = repairPriorities[a.structureType] || 99;
    const priorityB = repairPriorities[b.structureType] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return healthA - healthB;
  });
}

module.exports = {
  getEnergy,
  getHomeRoom,
  moveOffRoomEdge,
  getRepairQueue,
};
