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
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.building = false;
      creep.say("🔄 empty");
    }
    // If the creep is currently harvesting and is full of energy, switch to building mode
    if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // If the creep is in building mode, find sites to build
    if (creep.memory.building) {
      if (creep.room.name !== homeRoom.name) {
        moveToHomeRoom(creep, homeRoom);
        return;
      }

      if (utils.moveOffRoomEdge(creep)) {
        return;
      }

      const constructionSites = homeRoom.find(FIND_CONSTRUCTION_SITES);
      if (constructionSites.length > 0) {
        if (creep.build(constructionSites[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(constructionSites[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      } else {
          creep.say("🚧 repair");

          const repairQueue = utils.getRepairQueue(homeRoom);

          if (repairQueue.length > 0 && creep.repair(repairQueue[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(repairQueue[0]);
          }
      }
    }
    // If the creep is not in building mode, find energy sources and harvest them
    if (!creep.memory.building) {
      utils.getEnergy(creep);
    }
  },
};
