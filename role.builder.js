const utils = require("utils");

module.exports = {
  run: function (creep) {
    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.building = false;
      creep.say("🔄 empty");
    }
    // If the creep is currently harvesting and is full of energy, switch to building mode
    if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // If the creep is in building mode, find sites to build
    if (creep.memory.building) {
      const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (constructionSites.length > 0) {
        if (creep.build(constructionSites[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(constructionSites[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      } else {
          creep.say("🚧 repair");

          const repairQueue = utils.getRepairQueue(creep.room);

          if (repairQueue.length > 0 && creep.repair(repairQueue[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(repairQueue[0]);
          }
      }
    }
    // If the creep is not in building mode, find energy sources and harvest them
    if (!creep.memory.building) {
      utils.getEnergy(creep);
    }
  },
};
