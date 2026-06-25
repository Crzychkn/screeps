const utils = require("utils");

const SOURCE_RESERVE = 200000;

function getTargetRoom(creep) {
  if (!creep.memory.targetRoom) {
    return null;
  }

  return Game.rooms[creep.memory.targetRoom];
}

function getHomeRoom(creep) {
  if (!creep.memory.homeRoom) {
    return null;
  }

  return Game.rooms[creep.memory.homeRoom];
}

function hasFreeEnergyCapacity(structure) {
  return (
    structure.store &&
    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  );
}

function withdrawEnergy(creep) {
  const homeRoom = getHomeRoom(creep);

  if (!homeRoom || !homeRoom.storage) {
    creep.say("no source");
    return;
  }

  if (creep.room.name !== homeRoom.name) {
    utils.moveToRoom(creep, homeRoom.name, "#ffaa00");
    return;
  }

  if (homeRoom.storage.store[RESOURCE_ENERGY] <= SOURCE_RESERVE) {
    creep.say("reserve");
    return;
  }

  const result = creep.withdraw(homeRoom.storage, RESOURCE_ENERGY);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(homeRoom.storage, {
      visualizePathStyle: {
        stroke: "#ffaa00",
      },
    });
  }
}

function findDeliveryTarget(room) {
  const spawnOrExtension = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return (
        (
          structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION
        ) &&
        hasFreeEnergyCapacity(structure)
      );
    },
  })[0];

  if (spawnOrExtension) {
    return spawnOrExtension;
  }

  const tower = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return structure.structureType === STRUCTURE_TOWER && hasFreeEnergyCapacity(structure);
    },
  })[0];

  if (tower) {
    return tower;
  }

  if (room.storage && hasFreeEnergyCapacity(room.storage)) {
    return room.storage;
  }

  return room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        hasFreeEnergyCapacity(structure)
      );
    },
  })[0];
}

function deliverEnergy(creep) {
  const targetRoom = getTargetRoom(creep);

  if (!targetRoom || creep.room.name !== creep.memory.targetRoom) {
    utils.moveToRoom(creep, creep.memory.targetRoom, "#ffffff");
    return;
  }

  if (utils.moveOffRoomEdge(creep)) {
    return;
  }

  const target = findDeliveryTarget(targetRoom);

  if (!target) {
    creep.say("no target");
    return;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, {
      maxRooms: 1,
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
  }
}

module.exports = {
  run: function (creep) {
    if (!creep.memory.targetRoom || !creep.memory.homeRoom) {
      creep.say("no route");
      return;
    }

    if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.delivering = false;
    }

    if (
      !creep.memory.delivering &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      creep.memory.delivering = true;
    }

    if (creep.memory.delivering) {
      deliverEnergy(creep);
      return;
    }

    withdrawEnergy(creep);
  },
};
