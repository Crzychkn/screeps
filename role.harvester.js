const TOWER_REFILL_THRESHOLD = 700;

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
  const source =
    creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE) ||
    creep.pos.findClosestByPath(FIND_SOURCES);

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
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      harvestEnergy(creep);
      return;
    }

    deliverEnergy(creep);
  },
};