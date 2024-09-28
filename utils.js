function getEnergy(creep) {
  let storage = creep.room.storage;
  if (storage) {
    if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, {
        visualizePathStyle: { stroke: "#ffffff" },
      });
    }
  } else {
    let sources = creep.room.find(FIND_SOURCES);
    if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
      creep.moveTo(sources[0], {
        visualizePathStyle: { stroke: "#ffffff" },
      });
    }
  }
}

module.export = {
  getEnergy,
};
