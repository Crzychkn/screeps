const MIN_DROPPED_ENERGY = 25;
const REPAIR_QUEUE_CACHE_TICKS = 10;
const ROOM_ROUTE_CACHE_TICKS = 1000;
const RAMPART_REPAIR_TARGET = 10000;
const RAMPART_CRITICAL_REPAIR_TARGET = 1000;
const avoidConfig = require("config.avoid");
const repairQueueCache = {};

function getHomeRoom(creep) {
  const homeRoomName = creep.memory.homeRoom || creep.room.name;
  return Game.rooms[homeRoomName] || creep.room;
}

function moveToTarget(creep, target) {
  creep.moveTo(target, {
    maxRooms: 1,
    reusePath: 5,
    ignoreCreeps: true,
    visualizePathStyle: {
      stroke: "#ffffff",
    },
  });
}

function moveOffRoomEdge(creep) {
  const x = creep.pos.x;
  const y = creep.pos.y;

  if (x > 0 && x < 49 && y > 0 && y < 49) {
    return false;
  }

  creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
    reusePath: 0,
    maxRooms: 1,
    visualizePathStyle: {
      stroke: "#ffaa00",
    },
  });

  return true;
}

function getRoomIntel(roomName) {
  if (!Memory.rooms || !Memory.rooms[roomName]) {
    return null;
  }

  return Memory.rooms[roomName].intel || null;
}

function findHostileUnits(room) {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  if (typeof FIND_HOSTILE_POWER_CREEPS === "undefined") {
    return hostiles;
  }

  return hostiles.concat(room.find(FIND_HOSTILE_POWER_CREEPS));
}

function hasHostileUnits(room) {
  return findHostileUnits(room).length > 0;
}

function isDangerousTransitRoom(roomName, destinationRoomName) {
  if (avoidConfig.isRoomAvoided(roomName)) {
    return true;
  }

  if (roomName === destinationRoomName) {
    return false;
  }

  const intel = getRoomIntel(roomName);

  if (!intel || !intel.military) {
    return false;
  }

  return (
    intel.military.sourceKeeperCount > 0 ||
    intel.military.invaderCount > 0 ||
    (intel.military.blockingHostileCount || 0) > 0 ||
    intel.military.towerCount > 0
  );
}

function getSafeRoomRouteOptions(destinationRoomName) {
  return {
    routeCallback: function (roomName) {
      if (isDangerousTransitRoom(roomName, destinationRoomName)) {
        return Infinity;
      }

      return 1;
    },
  };
}

function getRoomRouteCache() {
  if (!Memory.roomRouteCache) {
    Memory.roomRouteCache = {};
  }

  return Memory.roomRouteCache;
}

function getCachedRoomRoute(fromRoomName, destinationRoomName) {
  const cache = getRoomRouteCache();
  const cacheKey = fromRoomName + ">" + destinationRoomName;
  const cached = cache[cacheKey];

  if (cached && Game.time - cached.time <= ROOM_ROUTE_CACHE_TICKS) {
    return cached.route;
  }

  const route = Game.map.findRoute(
    fromRoomName,
    destinationRoomName,
    getSafeRoomRouteOptions(destinationRoomName)
  );

  cache[cacheKey] = {
    time: Game.time,
    route: route === ERR_NO_PATH ? null : route,
  };

  return cache[cacheKey].route;
}

function moveToRoom(creep, roomName, stroke) {
  let destination = new RoomPosition(25, 25, roomName);

  if (creep.room.name !== roomName) {
    if (
      creep.memory.routeDestination !== roomName ||
      creep.memory.routeFromRoom !== creep.room.name ||
      !creep.memory.routeNextRoom
    ) {
      const route = getCachedRoomRoute(creep.room.name, roomName);

      if (!route) {
        delete creep.memory.routeDestination;
        delete creep.memory.routeFromRoom;
        delete creep.memory.routeNextRoom;
        creep.say("no route");
        return ERR_NO_PATH;
      }

      creep.memory.routeDestination = roomName;
      creep.memory.routeFromRoom = creep.room.name;
      creep.memory.routeNextRoom = route.length > 0 ? route[0].room : roomName;
    }

    destination = new RoomPosition(25, 25, creep.memory.routeNextRoom);
  } else {
    delete creep.memory.routeDestination;
    delete creep.memory.routeFromRoom;
    delete creep.memory.routeNextRoom;
  }

  return creep.moveTo(destination, {
    reusePath: 10,
    maxRooms: 2,
    ignoreCreeps: true,
    visualizePathStyle: {
      stroke: stroke || "#ffffff",
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

function isControllerContainer(container, room) {
  if (container.structureType !== STRUCTURE_CONTAINER || !room.controller) {
    return false;
  }

  return container.pos.getRangeTo(room.controller) <= 3;
}

function isSourceContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  const sources = container.pos.findInRange(FIND_SOURCES, 1);

  return sources.length > 0;
}

function withdrawFromControllerContainer(creep, room) {
  const controllerContainers = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        isControllerContainer(structure, room) &&
        structure.store[RESOURCE_ENERGY] > 0
      );
    },
  });

  if (controllerContainers.length === 0) {
    return false;
  }

  const target = creep.pos.findClosestByRange(controllerContainers);

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

  const target = creep.pos.findClosestByRange(containers);

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
    filter: (resource) => {
      return (
        resource.resourceType === RESOURCE_ENERGY &&
        resource.amount >= MIN_DROPPED_ENERGY
      );
    },
  });

  if (droppedEnergy.length === 0) {
    return false;
  }

  const target = creep.pos.findClosestByRange(droppedEnergy);

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
  const sources = room.find(FIND_SOURCES_ACTIVE);

  if (sources.length === 0) {
    return false;
  }

  const source = creep.pos.findClosestByRange(sources);

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

function hasFreeEnergyCapacity(structure) {
  return (
    structure.store &&
    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  );
}

function findRecoveryEnergyTarget(creep, room) {
  const criticalTower = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_TOWER &&
        structure.store[RESOURCE_ENERGY] < 500 &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });

  if (criticalTower) {
    return criticalTower;
  }

  const spawnOrExtension = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return (
        (
          structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION
        ) &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });

  if (spawnOrExtension) {
    return spawnOrExtension;
  }

  if (room.storage && hasFreeEnergyCapacity(room.storage)) {
    return room.storage;
  }

  return creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        !isSourceContainer(structure) &&
        !isControllerContainer(structure, room) &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });
}

function findFallbackRecoveryEnergyTarget(creep, room) {
  return creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        hasFreeEnergyCapacity(structure)
      );
    },
  });
}

function returnEnergyForRecovery(creep, room) {
  if (creep.store[RESOURCE_ENERGY] === 0) {
    return false;
  }

  const target = findRecoveryEnergyTarget(creep, room);

  if (!target) {
    const fallback = findFallbackRecoveryEnergyTarget(creep, room);

    if (!fallback) {
      return false;
    }

    const fallbackResult = creep.transfer(fallback, RESOURCE_ENERGY);

    if (fallbackResult === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, fallback);
      return true;
    }

    return fallbackResult === OK;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, target);
    return true;
  }

  return result === OK;
}

function getEnergy(creep) {
  const homeRoom = getHomeRoom(creep);

  if (!creep.memory.homeRoom) {
    creep.memory.homeRoom = homeRoom.name;
  }

  if (creep.room.name !== homeRoom.name) {
    moveToRoom(creep, homeRoom.name, "#ffffff");
    return;
  }

  if (moveOffRoomEdge(creep)) {
    return;
  }

  if (pickupDroppedEnergy(creep, homeRoom)) {
    return;
  }

  if (
    creep.memory.role === "upgrader" &&
    withdrawFromControllerContainer(creep, homeRoom)
  ) {
    return;
  }

  if (withdrawFromContainer(creep, homeRoom)) {
    return;
  }

  if (withdrawFromStorage(creep, homeRoom)) {
    return;
  }

  harvestSource(creep, homeRoom);
}

function getRepairQueue(room) {
  const cached = repairQueueCache[room.name];

  if (cached && Game.time - cached.tick < REPAIR_QUEUE_CACHE_TICKS) {
    return cached.ids.map((id) => Game.getObjectById(id)).filter(Boolean);
  }

  const repairSites = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      if (
        structure.structureType === STRUCTURE_WALL
      ) {
        return false;
      }

      if (structure.structureType === STRUCTURE_RAMPART) {
        return structure.hits < RAMPART_REPAIR_TARGET;
      }

      if (structure.structureType === STRUCTURE_ROAD) {
        return structure.hits < structure.hitsMax * 0.9;
      }

      if (structure.structureType === STRUCTURE_CONTAINER) {
        return structure.hits < structure.hitsMax * 0.85;
      }

      return structure.hits < structure.hitsMax * 0.75;
    },
  });

  const repairPriorities = {
    [STRUCTURE_ROAD]: 1,
    [STRUCTURE_CONTAINER]: 2,
    [STRUCTURE_RAMPART]: 3,
    [STRUCTURE_TOWER]: 3,
    [STRUCTURE_SPAWN]: 4,
    [STRUCTURE_EXTENSION]: 5,
    [STRUCTURE_STORAGE]: 6,
  };

  function getRepairRatio(structure) {
    if (structure.structureType === STRUCTURE_RAMPART) {
      return structure.hits / RAMPART_REPAIR_TARGET;
    }

    return structure.hits / structure.hitsMax;
  }

  function isCriticalRepair(structure) {
    if (structure.structureType === STRUCTURE_RAMPART) {
      return structure.hits < RAMPART_CRITICAL_REPAIR_TARGET;
    }

    return structure.hits < structure.hitsMax * 0.25;
  }

  const queue = repairSites.sort((a, b) => {
    const healthA = getRepairRatio(a);
    const healthB = getRepairRatio(b);
    const criticalA = isCriticalRepair(a);
    const criticalB = isCriticalRepair(b);

    if (criticalA || criticalB) {
      return healthA - healthB;
    }

    const priorityA = repairPriorities[a.structureType] || 99;
    const priorityB = repairPriorities[b.structureType] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return healthA - healthB;
  });

  repairQueueCache[room.name] = {
    tick: Game.time,
    ids: queue.map((structure) => structure.id),
  };

  return queue;
}

module.exports = {
  getEnergy,
  getHomeRoom,
  moveToRoom,
  moveOffRoomEdge,
  getRepairQueue,
  findHostileUnits,
  hasHostileUnits,
  returnEnergyForRecovery,
};
