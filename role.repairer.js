module.exports = {
  run: function (creep) {
    let creepFull;

    //Check if creep is full of energy
    if (creep.store.getFreeCapacity == 0) {
      //Creep is full
      creepFull = true;
    } else {
      //Creep as space free
      creepFull = false;
    }

    //Check if there are buildings to repair
    const repairSites = creep.room.find(FIND_STRUCTURES, {
      filter: (object) => object.hits < object.hitsMax,
    });
    if (repairSites.length > 0 && creepFull) {
      creep.memory.repairing = true;
      creep.say("🚧 repair");
    }

    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.repairing && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.repairing = false;
      creep.say("🔄 harvest");
    }
    // If the creep is currently harvesting and is full of energy, switch to repairing mode
    if (!creep.memory.repairing && creep.store.getFreeCapacity() == 0) {
      creep.memory.repairing = true;
      creep.say("🚧 repair");
    }

    // If the creep is in repair mode, find sites to repair
    if (creep.memory.repairing) {
      const repairSites = creep.room.find(FIND_STRUCTURES, {
        filter: (object) => object.hits < object.hitsMax,
      });
      if (repairSites.length > 0) {
        if (creep.repair(repairSites[0]) == ERR_NOT_IN_RANGE) {
          creep.say("Repair");
          creep.moveTo(repairSites[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      }
    } else {
      // If the creep is not in building mode, find energy sources and harvest them
      if (!creepFull) {
        var sources = creep.room.find(FIND_SOURCES);
        if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(sources[0], {
            visualizePathStyle: { stroke: "#ffaa00" },
          });
        }
      }
    }
  },
};
