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

function setStatus(creep, status) {
  creep.memory.lastStatus = status;
  creep.memory.lastStatusTick = Game.time;
}

function moveToRoom(creep, roomName, stroke) {
  if (utils.moveOffRoomEdge(creep)) {
    setStatus(creep, "leaving_edge");
    return;
  }

  const result = utils.moveToRoom(creep, roomName, stroke);

  if (result === ERR_NO_PATH) {
    setStatus(creep, "no_route");
    return;
  }

  setStatus(creep, "traveling");
}

function returnCarriedEnergy(creep, storage) {
  if (creep.store[RESOURCE_ENERGY] === 0) {
    return false;
  }

  const result = creep.transfer(storage, RESOURCE_ENERGY);

  if (result === OK) {
    setStatus(creep, "returned_energy");
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    setStatus(creep, "returning_energy");
    creep.moveTo(storage, {
      maxRooms: 1,
      reusePath: 5,
      visualizePathStyle: {
        stroke: "#ffaa00",
      },
    });
    return true;
  }

  return false;
}

function withdrawEnergy(creep) {
  const homeRoom = getHomeRoom(creep);
  const targetRoom = getTargetRoom(creep);

  if (!homeRoom || !homeRoom.storage) {
    creep.say("no source");
    setStatus(creep, "no_source");
    return;
  }

  if (creep.room.name !== homeRoom.name) {
    moveToRoom(creep, homeRoom.name, "#ffaa00");
    return;
  }

  if (utils.moveOffRoomEdge(creep)) {
    setStatus(creep, "home_edge");
    return;
  }

  if (targetRoom && !findDeliveryTarget(targetRoom)) {
    if (returnCarriedEnergy(creep, homeRoom.storage)) {
      return;
    }

    creep.say("wait");
    setStatus(creep, "target_full");
    return;
  }

  if (homeRoom.storage.store[RESOURCE_ENERGY] <= SOURCE_RESERVE) {
    creep.say("reserve");
    setStatus(creep, "reserve");
    return;
  }

  const result = creep.withdraw(homeRoom.storage, RESOURCE_ENERGY);

  if (result === OK) {
    setStatus(creep, "withdrawing");
  }

  if (result === ERR_NOT_IN_RANGE) {
    setStatus(creep, "moving_to_storage");
    creep.moveTo(homeRoom.storage, {
      maxRooms: 1,
      reusePath: 5,
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
    moveToRoom(creep, creep.memory.targetRoom, "#ffffff");
    return;
  }

  if (utils.moveOffRoomEdge(creep)) {
    setStatus(creep, "target_edge");
    return;
  }

  const target = findDeliveryTarget(targetRoom);

  if (!target) {
    creep.say("return");
    creep.memory.delivering = false;
    setStatus(creep, "target_full_returning");
    return;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);

  if (result === OK) {
    setStatus(creep, "delivering");
  }

  if (result === ERR_NOT_IN_RANGE) {
    setStatus(creep, "moving_to_target");
    creep.moveTo(target, {
      maxRooms: 1,
      reusePath: 5,
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
      setStatus(creep, "missing_route");
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
