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
