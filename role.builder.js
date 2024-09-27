module.exports = {
  run: function (creep) {
    let creepEmpty;

    //Check if creep is full of energy
    if (creep.store[RESOURCE_ENERGY] == 0) {
      // Creep is empty
      creepEmpty = true;
      console.log("Builder is empty");
    } else {
      // Creep has energy
      creepEmpty = false;
      console.log("Builder is full");
    }

    //Check if there are buildings to construct
    var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (targets.length > 0 && !creepEmpty) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.building && creepEmpty) {
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
      if (creepEmpty) {
        console.log(creep.room.storage.pos);
        console.log(creep.room.storage.isActive());
        if (creep.withdraw(creep.room.storage) === ERR_NOT_IN_RANGE) {
          creep.say("Too far, moving.");
          creep.moveTo(creep.room.storage.pos, {
            visualizePathStyle: { stroke: "#ffaa00" },
          });
        }
      }
    }
  },
};
