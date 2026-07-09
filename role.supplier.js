const utils = require("utils");

const SOURCE_RESERVE = 200000;
const PARKING_MIN_RANGE = 4;
const PARKING_MAX_RANGE = 7;
const PARKING_RECHECK_INTERVAL = 50;

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
  const result = utils.moveToRoom(creep, roomName, stroke);

  if (result === ERR_NO_PATH) {
    setStatus(creep, "no_route");
    const homeRoom = getHomeRoom(creep);

    if (homeRoom && creep.room.name === homeRoom.name) {
      setTrip(creep, "waiting");
      park(creep, homeRoom);
    }

    return;
  }

  setStatus(creep, "traveling_to_" + roomName);
}

function setTrip(creep, trip) {
  if (creep.memory.supplierTrip !== trip) {
    delete creep.memory.routeDestination;
    delete creep.memory.routeFromRoom;
    delete creep.memory.routeNextRoom;
  }

  creep.memory.supplierTrip = trip;
}

function getParkingAnchor(room) {
  if (room.storage) {
    return room.storage.pos;
  }

  const spawn = room.find(FIND_MY_SPAWNS)[0];

  if (spawn) {
    return spawn.pos;
  }

  return room.controller ? room.controller.pos : null;
}

function isParkingPosition(room, x, y) {
  if (x <= 1 || x >= 48 || y <= 1 || y >= 48) {
    return false;
  }

  const terrain = room.getTerrain();

  if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
    return false;
  }

  const look = room.lookAt(x, y);

  for (const item of look) {
    if (item.type === LOOK_CREEPS) {
      return false;
    }

    if (item.type === LOOK_CONSTRUCTION_SITES) {
      return false;
    }

    if (item.type === LOOK_STRUCTURES) {
      return false;
    }
  }

  return true;
}

function findParkingPosition(room) {
  const anchor = getParkingAnchor(room);

  if (!anchor) {
    return null;
  }

  for (let range = PARKING_MIN_RANGE; range <= PARKING_MAX_RANGE; range++) {
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== range) {
          continue;
        }

        const x = anchor.x + dx;
        const y = anchor.y + dy;

        if (isParkingPosition(room, x, y)) {
          return new RoomPosition(x, y, room.name);
        }
      }
    }
  }

  return null;
}

function getCachedParkingPosition(creep, room) {
  if (
    !creep.memory.parkingPosition ||
    creep.memory.parkingRoom !== room.name ||
    !creep.memory.parkingTick ||
    Game.time - creep.memory.parkingTick > PARKING_RECHECK_INTERVAL
  ) {
    return null;
  }

  return new RoomPosition(
    creep.memory.parkingPosition.x,
    creep.memory.parkingPosition.y,
    room.name
  );
}

function rememberParkingPosition(creep, position) {
  creep.memory.parkingRoom = position.roomName;
  creep.memory.parkingPosition = {
    x: position.x,
    y: position.y,
  };
  creep.memory.parkingTick = Game.time;
}

function park(creep, room) {
  if (!room || creep.room.name !== room.name) {
    return false;
  }

  const parkingPosition =
    getCachedParkingPosition(creep, room) || findParkingPosition(room);

  if (!parkingPosition) {
    return false;
  }

  rememberParkingPosition(creep, parkingPosition);

  if (creep.pos.isEqualTo(parkingPosition)) {
    setStatus(creep, "parked");
    return true;
  }

  creep.moveTo(parkingPosition, {
    maxRooms: 1,
    reusePath: 10,
    visualizePathStyle: {
      stroke: "#777777",
    },
  });
  setStatus(creep, "parking");
  return true;
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
    park(creep, creep.room);
    return;
  }

  if (creep.room.name !== homeRoom.name) {
    setTrip(creep, "to_home");
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

    setTrip(creep, "waiting");
    creep.say("wait");
    setStatus(creep, "target_full");
    park(creep, homeRoom);
    return;
  }

  if (creep.store[RESOURCE_ENERGY] > 0) {
    setTrip(creep, "to_target");
    moveToRoom(creep, creep.memory.targetRoom, "#ffffff");
    return;
  }

  if (homeRoom.storage.store[RESOURCE_ENERGY] <= SOURCE_RESERVE) {
    creep.say("reserve");
    setStatus(creep, "reserve");
    park(creep, homeRoom);
    return;
  }

  const result = creep.withdraw(homeRoom.storage, RESOURCE_ENERGY);

  if (result === OK) {
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      setTrip(creep, "to_target");
    }

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
    setTrip(creep, "to_target");
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
    setTrip(creep, "to_home");
    setStatus(creep, "target_full_returning");
    return;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);

  if (result === OK) {
    if (creep.store[RESOURCE_ENERGY] === 0) {
      setTrip(creep, "to_home");
    }

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
      park(creep, creep.room);
      return;
    }

    if (!creep.memory.supplierTrip) {
      creep.memory.supplierTrip =
        creep.store[RESOURCE_ENERGY] > 0 ? "to_target" : "to_home";
    }

    if (
      creep.memory.supplierTrip === "to_target" &&
      creep.store[RESOURCE_ENERGY] === 0
    ) {
      setTrip(creep, "to_home");
    }

    if (
      creep.memory.supplierTrip === "to_home" &&
      creep.room.name === creep.memory.homeRoom &&
      creep.store[RESOURCE_ENERGY] === 0
    ) {
      setTrip(creep, "waiting");
    }

    if (creep.memory.supplierTrip === "to_target") {
      deliverEnergy(creep);
      return;
    }

    withdrawEnergy(creep);
  },
};
