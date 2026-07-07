const TOWER_REFILL_THRESHOLD = 700;
const MIN_DROPPED_ENERGY = 50;
const SOURCE_DROPPED_RANGE = 1;

function moveToTarget(creep, target, stroke) {
  creep.moveTo(target, {
    maxRooms: 1,
    reusePath: 5,
    visualizePathStyle: {
      stroke: stroke,
    },
  });
}

function hasEnergy(structure) {
  return structure.store && structure.store[RESOURCE_ENERGY] > 0;
}

function hasFreeEnergyCapacity(structure) {
  return (
    structure.store &&
    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  );
}

function isSourceContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  const sources = container.pos.findInRange(FIND_SOURCES, 1);

  return sources.length > 0;
}

function getSourceRangeDroppedEnergy(resource) {
  const sources = resource.pos.findInRange(FIND_SOURCES, SOURCE_DROPPED_RANGE);

  return sources.length > 0;
}

function sortByEnergyThenRange(creep, targets, getEnergyAmount) {
  return targets.sort((a, b) => {
    const energyA = getEnergyAmount(a);
    const energyB = getEnergyAmount(b);

    if (energyA !== energyB) {
      return energyB - energyA;
    }

    return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
  });
}

function isControllerContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  if (!container.room.controller) {
    return false;
  }

  return container.pos.getRangeTo(container.room.controller) <= 3;
}

function findPriorityDeliveryTarget(creep) {
  const spawnOrExtension = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return (
        (
          structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION
        ) &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });

  if (spawnOrExtension) {
    return spawnOrExtension;
  }

  return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_TOWER &&
        structure.store[RESOURCE_ENERGY] < TOWER_REFILL_THRESHOLD &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });
}

function findDeliveryTarget(creep) {
  const priorityTarget = findPriorityDeliveryTarget(creep);

  if (priorityTarget) {
    return priorityTarget;
  }

  const controllerContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        isControllerContainer(structure) &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });

  if (controllerContainer) {
    return controllerContainer;
  }

  if (creep.room.storage && hasFreeEnergyCapacity(creep.room.storage)) {
    return creep.room.storage;
  }

  return creep.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        !isSourceContainer(structure) &&
        !isControllerContainer(structure) &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });
}

function findSourceContainer(creep) {
  const sourceContainers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        isSourceContainer(structure) &&
        hasEnergy(structure)
      );
    },
  });

  if (sourceContainers.length === 0) {
    return null;
  }

  return sortByEnergyThenRange(creep, sourceContainers, (container) => {
    return container.store[RESOURCE_ENERGY];
  })[0];
}

function findDroppedEnergy(creep) {
  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) => {
      return (
        resource.resourceType === RESOURCE_ENERGY &&
        resource.amount >= MIN_DROPPED_ENERGY
      );
    },
  });

  if (droppedEnergy.length === 0) {
    return null;
  }

  const sourceDroppedEnergy = droppedEnergy.filter(getSourceRangeDroppedEnergy);

  return sortByEnergyThenRange(
    creep,
    sourceDroppedEnergy.length > 0 ? sourceDroppedEnergy : droppedEnergy,
    (resource) => resource.amount
  )[0];
}

function findStorageWithdrawTarget(creep) {
  if (!creep.room.storage || !hasEnergy(creep.room.storage)) {
    return null;
  }

  const priorityTarget = findPriorityDeliveryTarget(creep);

  if (!priorityTarget) {
    return null;
  }

  return creep.room.storage;
}

function harvestFallback(creep) {
  const source =
    creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE) ||
    creep.pos.findClosestByPath(FIND_SOURCES);

  if (!source) {
    creep.say("🚫 energy");
    return;
  }

  const result = creep.harvest(source);

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source, "#ffaa00");
  }
}

function collectEnergy(creep) {
  const sourceContainer = findSourceContainer(creep);

  if (sourceContainer) {
    creep.say("🚚 load");

    const result = creep.withdraw(sourceContainer, RESOURCE_ENERGY);

    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, sourceContainer, "#ffaa00");
    }

    return;
  }

  const droppedEnergy = findDroppedEnergy(creep);

  if (droppedEnergy) {
    creep.say("🚚 pickup");

    const result = creep.pickup(droppedEnergy);

    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, droppedEnergy, "#ffaa00");
    }

    return;
  }

  const storage = findStorageWithdrawTarget(creep);

  if (storage) {
    creep.say("🚚 storage");

    const result = creep.withdraw(storage, RESOURCE_ENERGY);

    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, storage, "#ffaa00");
    }

    return;
  }

  harvestFallback(creep);
}

function deliverEnergy(creep) {
  const target = findDeliveryTarget(creep);

  if (!target) {
    const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);

    if (spawn) {
      moveToTarget(creep, spawn, "#ffffff");
    }

    creep.say("🚫 target");
    return;
  }

  creep.say("🚚 fill");

  const result = creep.transfer(target, RESOURCE_ENERGY);

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target, "#ffffff");
  }
}

module.exports = {
  /** @param {Creep} creep **/
  run: function (creep) {
    try {
      if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.withdraw = true;
      }

      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        creep.memory.withdraw = false;
      }

      if (creep.memory.withdraw) {
        collectEnergy(creep);
        return;
      }

      deliverEnergy(creep);
    } catch (error) {
      console.log(`Error running tractor ${creep.name}:`, error);
    }
  },
};
