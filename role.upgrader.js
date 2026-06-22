const utils = require("utils");

function getHomeRoom(creep) {
  const homeRoomName = creep.memory.homeRoom || creep.room.name;
  return Game.rooms[homeRoomName] || creep.room;
}

function setWorkingState(creep) {
  if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
    creep.memory.upgrading = false;
  }

  if (!creep.memory.upgrading && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
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

function withdrawFromStorage(creep, room) {
  if (!room.storage || room.storage.store[RESOURCE_ENERGY] === 0) {
    return false;
  }

  const result = creep.withdraw(room.storage, RESOURCE_ENERGY);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, room.storage);
    return true;
  }

  return false;
}

function withdrawFromContainer(creep, room) {
  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store[RESOURCE_ENERGY] > 0
      );
    },
  });

  if (containers.length === 0) {
    return false;
  }

  const target = creep.pos.findClosestByPath(containers);

  if (!target) {
    return false;
  }

  const result = creep.withdraw(target, RESOURCE_ENERGY);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target);
    return true;
  }

  return false;
}

function pickupDroppedEnergy(creep, room) {
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY,
  });

  if (droppedEnergy.length === 0) {
    return false;
  }

  const target = creep.pos.findClosestByPath(droppedEnergy);

  if (!target) {
    return false;
  }

  const result = creep.pickup(target);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target);
    return true;
  }

  return false;
}

function harvestSource(creep, room) {
  const sources = room.find(FIND_SOURCES);

  if (sources.length === 0) {
    return false;
  }

  const source = creep.pos.findClosestByPath(sources);

  if (!source) {
    return false;
  }

  const result = creep.harvest(source);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source);
    return true;
  }

  return false;
}

function collectEnergy(creep, room) {
  if (withdrawFromStorage(creep, room)) {
    return;
  }

  if (withdrawFromContainer(creep, room)) {
    return;
  }

  if (pickupDroppedEnergy(creep, room)) {
    return;
  }

  harvestSource(creep, room);
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

    if (creep.memory.upgrading) {
      upgradeController(creep, homeRoom);
      return;
    }

    utils.getEnergy(creep);
  },
};