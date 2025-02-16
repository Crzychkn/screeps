const utils = require("utils");

module.exports = {
  run: function (creep) {
    let creepFull;

    //Check if creep is full of energy
    creepFull = creep.store.getFreeCapacity === 0;

    //Check if there are buildings to repair
    const repairQueue = utils.getRepairQueue(creep.room);

    if (repairQueue.length > 0 && creepFull) {
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
        if (creep.repair(repairQueue[0]) === ERR_NOT_IN_RANGE) {
          creep.say("Repair");
          creep.moveTo(repairQueue[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
    } else {
      // If the creep is not in building mode, find energy sources and harvest them
      utils.getEnergy(creep);
    }
  },
};
