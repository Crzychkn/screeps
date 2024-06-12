module.exports = {
  run: function (creep) {
    let creepFull;

    //Check if creep is full of energy
    if (creep.store.getFreeCapacity == 0) {
      //Creep is full
      creepFull = true;
    } else {
      //Creep is empty
      creepFull = false;
    }

    //Check if there are buildings to construct
    var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
    if (targets.length > 0 && creepFull) {
      creep.memory.building = true;
      creep.memory.upgrading = false;
      creep.say("🚧 build");
    }

    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.building = false;
      creep.say("🔄 harvest");
    }
    // If the creep is currently harvesting and is full of energy, switch to building mode
    if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // If the creep is in building mode, find construction sites and build them
    if (creep.memory.building) {
      const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
      const repairSites = creep.room.find(FIND_STRUCTURES, {
        filter: (object) => object.hits < object.hitsMax,
      });
      if (constructionSites.length > 0) {
        if (creep.build(onstructionSites[0]) == ERR_NOT_IN_RANGE) {
          creep.moveTo(onstructionSites[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        } else if (repairSites.length > 0) {
          if (creep.repair(repairSites[0]) == ERR_NOT_IN_RANGE) {
            creep.moveTo(repairSites[0], {
              visualizePathStyle: { stroke: "#ffffff" },
            });
          }
        }
      } else {
        // If there are no construction sites, switch to upgrading mode
        creep.memory.building = false;
        creep.memory.upgrading = true;
        creep.say("🔄 upgrade");
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

    // If the creep is not building or harvesting, it must be in upgrading mode
    if (creep.memory.upgrading) {
      // Find a controller to upgrade
      var controller = creep.room.controller;
      if (creep.upgradeController(controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  },
};
