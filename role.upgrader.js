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
  utils.moveToRoom(creep, homeRoom.name, "#ffffff");
}

function upgradeController(creep, room) {
  if (!room.controller || !room.controller.my) {
    return;
  }

  const result = creep.upgradeController(room.controller);

  if (result === ERR_NOT_IN_RANGE) {
    const target = getUpgradeTarget(creep, room);

    creep.moveTo(target, {
      range: 3,
      maxRooms: 1,
      reusePath: 10,
      ignoreCreeps: true,
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
  }
}

function getUpgradeTarget(creep, room) {
  if (
    creep.memory.upgradeTarget &&
    creep.memory.upgradeTarget.roomName === room.name
  ) {
    return new RoomPosition(
      creep.memory.upgradeTarget.x,
      creep.memory.upgradeTarget.y,
      room.name
    );
  }

  const target = room.controller.pos;

  creep.memory.upgradeTarget = {
    x: target.x,
    y: target.y,
    roomName: room.name,
  };

  return target;
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
