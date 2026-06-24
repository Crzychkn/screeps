const utils = require("utils");

function setWorkingState(creep) {
  if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
    creep.memory.upgrading = false;
  }

  if (!creep.memory.upgrading && creep.store[RESOURCE_ENERGY] > 0) {
    creep.memory.upgrading = true;
  }
}

function moveToHomeRoom(creep, homeRoom) {
  creep.moveTo(new RoomPosition(25, 25, homeRoom.name), {
    visualizePathStyle: {
      stroke: "#ffffff",
    },
  });
}

function upgradeController(creep, room) {
  if (!room.controller || !room.controller.my) {
    return;
  }

  const result = creep.upgradeController(room.controller);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(room.controller, {
      range: 3,
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
  }
}

module.exports = {
  run: function (creep) {
    const homeRoom = utils.getHomeRoom(creep);

    if (!creep.memory.homeRoom) {
      creep.memory.homeRoom = homeRoom.name;
    }

    setWorkingState(creep);

    if (creep.room.name !== homeRoom.name) {
      moveToHomeRoom(creep, homeRoom);
      return;
    }

    if (utils.moveOffRoomEdge(creep)) {
      return;
    }

    if (creep.memory.upgrading) {
      upgradeController(creep, homeRoom);
      return;
    }

    utils.getEnergy(creep);
  },
};
