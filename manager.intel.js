const INTEL_RECORD_INTERVAL = 10;

function countBodyParts(creep) {
  const counts = {};

  for (const part of creep.body) {
    counts[part.type] = (counts[part.type] || 0) + 1;
  }

  return counts;
}

function summarizeHostiles(room) {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  return hostiles.map((creep) => {
    return {
      owner: creep.owner ? creep.owner.username : "unknown",
      body: countBodyParts(creep),
      x: creep.pos.x,
      y: creep.pos.y,
    };
  });
}

function countStructures(room, structureType) {
  return room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === structureType,
  }).length;
}

function getControllerIntel(room) {
  if (!room.controller) {
    return {
      exists: false,
    };
  }

  return {
    exists: true,
    my: room.controller.my,
    owner: room.controller.owner ? room.controller.owner.username : null,
    reservation: room.controller.reservation
      ? {
          username: room.controller.reservation.username,
          ticksToEnd: room.controller.reservation.ticksToEnd,
        }
      : null,
    level: room.controller.level,
    ticksToDowngrade: room.controller.ticksToDowngrade,
  };
}

function getMilitaryIntel(room) {
  const hostiles = summarizeHostiles(room);
  const hostileOwners = {};

  for (const hostile of hostiles) {
    hostileOwners[hostile.owner] = (hostileOwners[hostile.owner] || 0) + 1;
  }

  return {
    hostiles: hostiles,
    hostileOwners: hostileOwners,
    hostileCount: hostiles.length,
    invaderCount: hostileOwners.Invader || 0,
    sourceKeeperCount: hostileOwners["Source Keeper"] || 0,
    blockingHostileCount:
      hostiles.length - (hostileOwners["Source Keeper"] || 0),
    towerCount: countStructures(room, STRUCTURE_TOWER),
    spawnCount: countStructures(room, STRUCTURE_SPAWN),
    rampartCount: countStructures(room, STRUCTURE_RAMPART),
    wallCount: countStructures(room, STRUCTURE_WALL),
  };
}

function isClaimable(controllerIntel, militaryIntel) {
  if (!controllerIntel.exists || controllerIntel.my || controllerIntel.owner) {
    return false;
  }

  if (militaryIntel.blockingHostileCount > 0) {
    return false;
  }

  return true;
}

function ensureRoomMemory(roomName) {
  if (!Memory.rooms) {
    Memory.rooms = {};
  }

  if (!Memory.rooms[roomName]) {
    Memory.rooms[roomName] = {};
  }

  return Memory.rooms[roomName];
}

function recordRoom(room) {
  const roomMemory = ensureRoomMemory(room.name);

  if (
    roomMemory.intel &&
    Game.time - roomMemory.intel.lastScouted < INTEL_RECORD_INTERVAL
  ) {
    return;
  }

  const controller = getControllerIntel(room);
  const military = getMilitaryIntel(room);

  roomMemory.intel = {
    lastScouted: Game.time,
    roomName: room.name,
    status: Game.map.getRoomStatus(room.name).status,
    controller: controller,
    military: military,
    sourceCount: room.find(FIND_SOURCES).length,
    mineralCount: room.find(FIND_MINERALS).length,
    claimableNow: isClaimable(controller, military),
  };
}

module.exports = {
  run: function () {
    for (const roomName in Game.rooms) {
      recordRoom(Game.rooms[roomName]);
    }
  },
};
