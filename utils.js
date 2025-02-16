function getEnergy(creep) {
  let storage = creep.room.storage;
  // TODO: Check that storage has enough in it here probably.
  if (storage) {
    if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, {
        visualizePathStyle: { stroke: "#ffffff" },
      });
    }
  } else {
    let sources = creep.room.find(FIND_SOURCES);
    if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
      creep.moveTo(sources[0], {
        visualizePathStyle: { stroke: "#ffffff" },
      });
    }
  }
}

export function getRepairQueue(room) {
  const repairSites = room.find(FIND_STRUCTURES, {
    filter: (object) => object.hits < object.hitsMax,
  });

  const repairPriorities = {
    [STRUCTURE_TOWER]: 1,
    [STRUCTURE_RAMPART]: 3,
    [STRUCTURE_ROAD]: 2,
    [STRUCTURE_WALL]: 4
  };

  return repairSites.sort((a, b) => {
    const priorityA = repairPriorities[a.structureType] || 99;
    const priorityB = repairPriorities[b.structureType] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
  })
}

function loadBalance(creep) {
  // Assign the creep either a 0 or 1 based on its index or name hash
  const index = creep.name.length % 4; // Use name length or another unique identifier

  // Map the index to 0 or 1 in a balanced way
  return index % 2; // This will alternate between 0 and 1
}

module.exports = {
  getEnergy,
  loadBalance,
};
