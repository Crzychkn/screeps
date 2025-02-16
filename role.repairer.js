const utils = require("utils");

module.exports = {
  run: function (creep) {
    let creepFull;

    const repairPriorities = {
      [STRUCTURE_TOWER]: 1,
      [STRUCTURE_RAMPART]: 2,
      [STRUCTURE_ROAD]: 3
    };

    //Check if creep is full of energy
    creepFull = creep.store.getFreeCapacity === 0;

    //Check if there are buildings to repair
    const repairSites = creep.room.find(FIND_STRUCTURES, {
      filter: (object) => object.hits < object.hitsMax,
    });
    if (repairSites.length > 0 && creepFull) {
      creep.memory.repairing = true;
      creep.say("🚧 repair");
    }

    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.repairing && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.repairing = false;
      creep.say("🔄 harvest");
    }
    // If the creep is currently harvesting and is full of energy, switch to repairing mode
    if (!creep.memory.repairing && creep.store.getFreeCapacity() === 0) {
      creep.memory.repairing = true;
      creep.say("🚧 repair");
    }

    // If the creep is in repair mode, find sites to repair
    if (creep.memory.repairing) {
      const repairSites = creep.room.find(FIND_STRUCTURES, {
        filter: (object) => object.hits < object.hitsMax,
      });
      if (repairSites.length > 0) {

        const repairQueue = repairSites.sort((a, b) => {
          const priorityA = repairPriorities[a.structureType] || 99;
          const priorityB = repairPriorities[b.structureType] || 99;

          if (priorityA !== priorityB) return priorityA - priorityB;
          return (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
        })

        if (creep.repair(repairQueue[0]) === ERR_NOT_IN_RANGE) {
          creep.say("Repair");
          creep.moveTo(repairQueue[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      }
    } else {
      // If the creep is not in building mode, find energy sources and harvest them
      utils.getEnergy(creep);
    }
  },
};
