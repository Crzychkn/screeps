module.exports = {
  run: function (creep) {
    creep.say("Function running");
    creep.memory.building = false;
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
      creep.say("Building step 1");
      const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (constructionSites.length > 0) {
        console.log("Construction Site found.");
        if (creep.build(constructionSites[0]) == ERR_NOT_IN_RANGE) {
          creep.say("Moving");
          creep.moveTo(constructionSites[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      }
    }
    // If the creep is not in building mode, find energy sources and harvest them
    if (!creep.memory.building) {
      if (
        creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
      ) {
        creep.say("Too far, moving.");
        creep.moveTo(creep.room.storage, {
          visualizePathStyle: { stroke: "#ffaa00" },
        });
      }
    }
  },
};
