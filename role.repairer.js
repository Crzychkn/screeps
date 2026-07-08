const utils = require("utils");

function moveToHomeRoom(creep, homeRoom) {
  utils.moveToRoom(creep, homeRoom.name, "#ffffff");
}

module.exports = {
  run: function (creep) {
    const homeRoom = utils.getHomeRoom(creep);

    if (!creep.memory.homeRoom) {
      creep.memory.homeRoom = homeRoom.name;
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

    if (creep.memory.repairing && creep.room.name !== homeRoom.name) {
      moveToHomeRoom(creep, homeRoom);
      return;
    }

    if (creep.room.name === homeRoom.name && utils.moveOffRoomEdge(creep)) {
      return;
    }

    // If the creep is in repair mode, find sites to repair
    if (creep.memory.repairing) {
      const repairQueue = utils.getRepairQueue(homeRoom);
      const repairTarget = repairQueue[0];

      if (!repairTarget) {
        return;
      }

      if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
        creep.say("🚧 repair");
        creep.moveTo(repairTarget, {
          maxRooms: 1,
          reusePath: 5,
          visualizePathStyle: { stroke: "#ffffff" },
        });
      }

      return;
    }

    // If the creep is not in repair mode, find energy sources and harvest them
    utils.getEnergy(creep);
  },
};
