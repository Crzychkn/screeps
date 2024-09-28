const utils = "utils";

module.exports = {
  run: function (creep) {
    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.building = false;
      creep.say("🔄 withdraw");
    }
    // If the creep is currently harvesting and is full of energy, switch to building mode
    if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // If the creep is in building mode, find sites to build
    if (creep.memory.building) {
      const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (constructionSites.length > 0) {
        if (creep.build(constructionSites[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(constructionSites[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      } else {
        // Repair stuff here maybe.
        //Check if there are buildings to repair
        const repairSites = creep.room.find(FIND_STRUCTURES, {
          filter: (object) => object.hits < object.hitsMax,
        });
        if (repairSites.length) {
          creep.say("🚧 repair");
          if (creep.repair(repairSites[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(repairSites[0]);
          }
        }
      }
    }
    // If the creep is not in building mode, find energy sources and harvest them
    if (!creep.memory.building) {
      utils.getEnergy(creep);
    }
  },
};
