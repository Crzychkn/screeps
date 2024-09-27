module.exports = {
  run: function (creep) {
    let creepFull;

    //Check if creep is full of energy
    if (creep.store[RESOURCE_ENERGY] == 0) {
      // Creep has energy still.
      creepFull = true;
    } else {
      // Creep is empty
      creepFull = false;
    }

    //Check if there are buildings to construct
    var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (targets.length > 0 && creepFull) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
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
          creep.say("Construct");
          creep.moveTo(constructionSites[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      }
    } else {
      // If the creep is not in building mode, find energy sources and harvest them
      if (!creepFull) {
        if (creep.withdraw(Room.storage) == ERR_NOT_IN_RANGE) {
          creep.moveTo(Room.storage, {
            visualizePathStyle: { stroke: "#ffaa00" },
          });
        }
      }
    }
  },
};
