const utils = require("utils");

var roleUpgrader = {
  /** @param {Creep} creep **/
  run: function (creep) {
    //If creep is set to upgrade, but has no energy, change memory to harvest energy.
    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.upgrading = false;
      creep.say("🔄 harvest");
    }

    //If creep is not set to upgrade, but has full energy, set to upgrade.
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
      creep.memory.upgrading = true;
      creep.say("⚡ upgrade");
    }

    //If creep is set to upgrade, find controller and move to it.
    if (creep.memory.upgrading) {
      if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {
          visualizePathStyle: { stroke: "#ffffff" },
        });
      }
    } else {
      //Find sources to harvest and move to them
      utils.getEnergy(creep);
    }
  },
};

module.exports = roleUpgrader;
