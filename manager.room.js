const roleTower = require("role.tower");
const constructionManager = require("manager.construction");
const signConfig = require("config.sign");

const EXPANSION_BLOCK_TTL = 50000;
const EXPANSION_INTEL_MAX_AGE = 10000;
const EXPANSION_SCOUT_RETRY_TICKS = 3000;
const MAX_EXPANSION_SCOUTS = 2;
const MAX_BOOTSTRAP_ROOMS = 2;
const MAX_PIONEERS_PER_BOOTSTRAP_ROOM = 4;
const DESIRED_FUNCTIONAL_PIONEERS_PER_BOOTSTRAP_ROOM = 2;
const SUPPORT_STORAGE_RESERVE = 200000;
const SUPPORT_TARGET_MAX_RCL = 4;
const MILITARY_INTEL_MAX_AGE = 1500;

const ROLE_PRIORITY = [
  "harvester",
  "tractor",
  "builder",
  "repairer",
  "upgrader",
];

function bodyCost(body) {
  return body.reduce((total, part) => total + BODYPART_COST[part], 0);
}

function getAvailableSpawn(room) {
  const spawns = room.find(FIND_MY_SPAWNS);
  return spawns.find((spawn) => !spawn.spawning);
}

function getRoomCreeps(room, role) {
  return _.filter(Game.creeps, (creep) => {
    return creep.memory.role === role && creep.memory.homeRoom === room.name;
  });
}

function getPioneersForTarget(targetRoomName) {
  return _.filter(Game.creeps, (creep) => {
    return (
      creep.memory.role === "pioneer" &&
      creep.memory.targetRoom === targetRoomName
    );
  });
}

function isFunctionalPioneer(creep) {
  return (
    creep.getActiveBodyparts(WORK) > 0 &&
    creep.getActiveBodyparts(CARRY) > 0 &&
    creep.getActiveBodyparts(MOVE) > 0
  );
}

function getFunctionalPioneersForTarget(targetRoomName) {
  return getPioneersForTarget(targetRoomName).filter(isFunctionalPioneer);
}

function getClaimersForTarget(targetRoomName) {
  return _.filter(Game.creeps, (creep) => {
    return (
      creep.memory.role === "claimer" &&
      creep.memory.targetRoom === targetRoomName
    );
  });
}

function getScoutsForTarget(targetRoomName) {
  return _.filter(Game.creeps, (creep) => {
    return creep.memory.role === "scout" && creep.memory.targetRoom === targetRoomName;
  });
}

function getDefendersForTarget(targetRoomName) {
  return _.filter(Game.creeps, (creep) => {
    return (
      creep.memory.role === "defender" &&
      creep.memory.targetRoom === targetRoomName
    );
  });
}

function getBootstrapEscortsForTarget(targetRoomName) {
  return _.filter(Game.creeps, (creep) => {
    return (
      creep.memory.role === "bootstrapEscort" &&
      creep.memory.targetRoom === targetRoomName
    );
  });
}

function isFunctionalBootstrapEscort(creep) {
  return (
    creep.getActiveBodyparts(MOVE) > 0 &&
    (
      creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
      creep.getActiveBodyparts(ATTACK) > 0 ||
      creep.getActiveBodyparts(HEAL) > 0
    )
  );
}

function getFunctionalBootstrapEscortsForTarget(targetRoomName) {
  return getBootstrapEscortsForTarget(targetRoomName).filter(isFunctionalBootstrapEscort);
}

function getSignersForTarget(targetRoomName) {
  return _.filter(Game.creeps, (creep) => {
    return (
      creep.memory.role === "signer" &&
      creep.memory.targetRoom === targetRoomName
    );
  });
}

function getSuppliersForTarget(targetRoomName) {
  return _.filter(Game.creeps, (creep) => {
    return (
      creep.memory.role === "supplier" &&
      creep.memory.targetRoom === targetRoomName
    );
  });
}

function adoptLocalCreeps(room) {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    if (
      !creep.memory.homeRoom &&
      creep.room.name === room.name &&
      creep.room.controller &&
      creep.room.controller.my
    ) {
      creep.memory.homeRoom = room.name;
    }
  }
}

function getStoredEnergy(room) {
  let total = room.energyAvailable;

  if (room.storage) {
    total += room.storage.store[RESOURCE_ENERGY];
  }

  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
  });

  for (const container of containers) {
    total += container.store[RESOURCE_ENERGY];
  }

  return total;
}

function isSourceContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  const sources = container.pos.findInRange(FIND_SOURCES, 1);

  return sources.length > 0;
}

function getLogisticsStats(room) {
  const sources = room.find(FIND_SOURCES);
  const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
  });

  const sourceContainers = containers.filter(isSourceContainer);
  const sourceContainerEnergy = sourceContainers.reduce((total, container) => {
    return total + container.store[RESOURCE_ENERGY];
  }, 0);
  const storedEnergy = getStoredEnergy(room);
  const lowEnergyThreshold = Math.max(800, room.energyCapacityAvailable * 2);
  const comfortableEnergyThreshold = Math.max(
    1600,
    room.energyCapacityAvailable * 3
  );

  return {
    constructionSiteCount: constructionSites.length,
    sourceCount: sources.length,
    sourceContainerCount: sourceContainers.length,
    sourceContainerEnergy: sourceContainerEnergy,
    storedEnergy: storedEnergy,
    hasSourceContainers: sourceContainers.length > 0,
    lowEnergy: storedEnergy < lowEnergyThreshold,
    comfortableEnergy: storedEnergy >= comfortableEnergyThreshold,
  };
}

function getMaintenanceTargets(room) {
  return room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      if (
        structure.structureType === STRUCTURE_WALL ||
        structure.structureType === STRUCTURE_RAMPART
      ) {
        return false;
      }

      if (
        structure.structureType === STRUCTURE_ROAD ||
        structure.structureType === STRUCTURE_CONTAINER
      ) {
        return structure.hits < structure.hitsMax * 0.9;
      }

      return structure.hits < structure.hitsMax * 0.75;
    },
  });
}

function getDesiredCounts(room) {
  const rcl = room.controller.level;
  const logistics = getLogisticsStats(room);

  const desired = {
    harvester: 3,
    builder: logistics.constructionSiteCount > 0 ? 1 : 0,
    repairer: 0,
    upgrader: 2,
    tractor: 0,
  };

  if (rcl >= 2) {
    desired.harvester = 4;
    desired.builder = logistics.constructionSiteCount > 0 ? 2 : 0;
    desired.upgrader = 3;
  }

  if (rcl >= 3) {
    desired.harvester = 4;
    desired.builder = logistics.constructionSiteCount > 0 ? 2 : 0;
    desired.upgrader = 4;

    if (logistics.hasSourceContainers && logistics.sourceContainerEnergy > 100) {
      desired.tractor = 1;
    }
  }

  if (rcl >= 4) {
    desired.harvester = 4;
    desired.builder = logistics.constructionSiteCount > 0 ? 2 : 0;
    desired.upgrader = 4;
    desired.tractor =
      logistics.hasSourceContainers &&
      (logistics.sourceContainerEnergy > 100 || logistics.storedEnergy > 1200)
        ? 1
        : 0;
  }

  if (rcl >= 5) {
    desired.harvester = 5;
    desired.builder = logistics.constructionSiteCount > 0 ? 2 : 0;
    desired.upgrader = 5;
    desired.tractor =
      logistics.hasSourceContainers &&
      (logistics.sourceContainerEnergy > 100 || logistics.storedEnergy > 1200)
        ? 1
        : 0;
  }

  if (
    logistics.sourceContainerCount >= 2 &&
    (logistics.sourceContainerEnergy > 800 || logistics.comfortableEnergy)
  ) {
    desired.tractor = Math.max(desired.tractor, 2);
  }

  if (rcl >= 4 && logistics.sourceContainerCount >= logistics.sourceCount) {
    desired.harvester = Math.max(logistics.sourceCount, 2);
  }

  if (rcl === 7 && logistics.storedEnergy > 900000) {
    desired.upgrader = 7;
  }

  if (rcl >= 8) {
    desired.upgrader = logistics.comfortableEnergy ? 2 : 1;
  }

  if (logistics.lowEnergy) {
    desired.upgrader = Math.min(desired.upgrader, 1);
    desired.builder = Math.min(desired.builder, 1);

    if (logistics.sourceContainerEnergy > 100) {
      desired.tractor = Math.max(desired.tractor, 1);
    }
  }

  const maintenanceTargets = getMaintenanceTargets(room);

  if (rcl >= 2 && maintenanceTargets.length > 0) {
    desired.repairer = 1;
  }

  if (rcl >= 5 && maintenanceTargets.length > 20) {
    desired.repairer = 2;
  }

  return desired;
}

function getBodiesForRole(role, rcl) {
  if (role === "scout") {
    return [
      [MOVE],
    ];
  }

  if (role === "signer") {
    return [
      [MOVE],
    ];
  }

  if (role === "claimer") {
    return [
      [CLAIM, MOVE],
    ];
  }

  if (role === "pioneer") {
    if (rcl >= 4) {
      return [
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    return [
      [WORK, CARRY, MOVE],
    ];
  }

  if (role === "defender") {
    if (rcl >= 6) {
      return [
        [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK],
        [MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK],
        [MOVE, ATTACK],
      ];
    }

    if (rcl >= 3) {
      return [
        [MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK],
        [MOVE, ATTACK],
      ];
    }

    return [
      [MOVE, ATTACK],
    ];
  }

  if (role === "bootstrapEscort") {
    if (rcl >= 6) {
      return [
        [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL],
        [MOVE, MOVE, RANGED_ATTACK, HEAL],
        [MOVE, RANGED_ATTACK],
      ];
    }

    if (rcl >= 4) {
      return [
        [MOVE, MOVE, RANGED_ATTACK, HEAL],
        [MOVE, RANGED_ATTACK],
      ];
    }

    return [
      [MOVE, RANGED_ATTACK],
    ];
  }

  if (role === "harvester") {
    if (rcl >= 7) {
      return [
        [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    if (rcl >= 2) {
      return [
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    return [
      [WORK, CARRY, MOVE],
    ];
  }

  if (role === "builder") {
    if (rcl >= 3) {
      return [
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    return [
      [WORK, CARRY, MOVE],
    ];
  }

  if (role === "repairer") {
    if (rcl >= 4) {
      return [
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    return [
      [WORK, CARRY, MOVE],
    ];
  }

  if (role === "upgrader") {
    if (rcl >= 6) {
      return [
        [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    if (rcl >= 3) {
      return [
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    return [
      [WORK, CARRY, MOVE],
    ];
  }

  if (role === "tractor") {
    if (rcl >= 7) {
      return [
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
        [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
        [CARRY, CARRY, MOVE],
      ];
    }

    if (rcl >= 4) {
      return [
        [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
        [CARRY, CARRY, MOVE],
      ];
    }

    return [
      [CARRY, CARRY, MOVE],
    ];
  }

  if (role === "supplier") {
    if (rcl >= 7) {
      return [
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
        [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        [CARRY, CARRY, MOVE, MOVE],
      ];
    }

    return [
      [CARRY, CARRY, MOVE, MOVE],
    ];
  }

  return [
    [WORK, CARRY, MOVE],
  ];
}

function chooseBody(room, role) {
  const bodies = getBodiesForRole(role, room.controller.level);

  for (const body of bodies) {
    if (bodyCost(body) <= room.energyAvailable) {
      return body;
    }
  }

  return null;
}

function spawnRole(room, role, body) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return ERR_BUSY;
  }

  if (!body || bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = role.charAt(0).toUpperCase() + role.slice(1) + Game.time;

  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: role,
      homeRoom: room.name,
    },
  });

  if (result === OK) {
    console.log(`Spawning ${role} in ${room.name}: ${name}`);
  } else {
    console.log(`Failed to spawn ${role} in ${room.name}: ${result}`);
  }

  return result;
}

function spawnTargetedDefender(room, body, targetRoomName) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return ERR_BUSY;
  }

  if (!body || bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = "Defender" + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: "defender",
      homeRoom: room.name,
      targetRoom: targetRoomName,
    },
  });

  if (result === OK) {
    console.log(`Spawning defender from ${room.name} to ${targetRoomName}: ${name}`);
  } else {
    console.log(`Failed to spawn defender from ${room.name} to ${targetRoomName}: ${result}`);
  }

  return result;
}

function spawnBootstrapEscort(room, body, targetRoomName) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return ERR_BUSY;
  }

  if (!body || bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = "BootstrapEscort" + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: "bootstrapEscort",
      homeRoom: room.name,
      targetRoom: targetRoomName,
    },
  });

  if (result === OK) {
    console.log(`Spawning bootstrapEscort from ${room.name} to ${targetRoomName}: ${name}`);
  } else {
    console.log(`Failed to spawn bootstrapEscort from ${room.name} to ${targetRoomName}: ${result}`);
  }

  return result;
}

function spawnPioneer(room, body, targetRoomName) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return ERR_BUSY;
  }

  if (!body || bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = "Pioneer" + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: "pioneer",
      homeRoom: room.name,
      targetRoom: targetRoomName,
    },
  });

  if (result === OK) {
    console.log(`Spawning pioneer from ${room.name} to ${targetRoomName}: ${name}`);
  } else {
    console.log(`Failed to spawn pioneer from ${room.name} to ${targetRoomName}: ${result}`);
  }

  return result;
}

function spawnClaimer(room, body, targetRoomName) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return ERR_BUSY;
  }

  if (!body || bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = "Claimer" + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: "claimer",
      homeRoom: room.name,
      targetRoom: targetRoomName,
    },
  });

  if (result === OK) {
    console.log(`Spawning claimer from ${room.name} to ${targetRoomName}: ${name}`);
  } else {
    console.log(`Failed to spawn claimer from ${room.name} to ${targetRoomName}: ${result}`);
  }

  return result;
}

function spawnScout(room, targetRoomName, purpose) {
  const spawn = getAvailableSpawn(room);
  const body = [MOVE];

  if (!spawn) {
    return ERR_BUSY;
  }

  if (bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = "Scout" + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: "scout",
      homeRoom: room.name,
      targetRoom: targetRoomName,
      purpose: purpose || "scout",
    },
  });

  if (result === OK) {
    console.log(`Spawning scout from ${room.name} to ${targetRoomName}: ${name}`);
  } else {
    console.log(`Failed to spawn scout from ${room.name} to ${targetRoomName}: ${result}`);
  }

  return result;
}

function spawnSigner(room, targetRoomName) {
  const spawn = getAvailableSpawn(room);
  const body = [MOVE];

  if (!spawn) {
    return ERR_BUSY;
  }

  if (bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = "Signer" + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: "signer",
      homeRoom: room.name,
      targetRoom: targetRoomName,
    },
  });

  if (result === OK) {
    console.log(`Spawning signer from ${room.name} to ${targetRoomName}: ${name}`);
  } else {
    console.log(`Failed to spawn signer from ${room.name} to ${targetRoomName}: ${result}`);
  }

  return result;
}

function spawnSupplier(room, body, targetRoomName) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return ERR_BUSY;
  }

  if (!body || bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = "Supplier" + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: {
      role: "supplier",
      homeRoom: room.name,
      targetRoom: targetRoomName,
    },
  });

  if (result === OK) {
    console.log(`Spawning supplier from ${room.name} to ${targetRoomName}: ${name}`);
  } else {
    console.log(`Failed to spawn supplier from ${room.name} to ${targetRoomName}: ${result}`);
  }

  return result;
}

function getSignText() {
  return (Memory.sign && Memory.sign.text) || signConfig.text;
}

function getSignRoomSettings() {
  if (Memory.sign && Memory.sign.rooms) {
    return Memory.sign.rooms;
  }

  return signConfig.rooms;
}

function shouldSignRoom(room) {
  const signText = getSignText();
  const signRooms = getSignRoomSettings();

  if (!signText || !room.controller || !room.controller.my) {
    return false;
  }

  if (signRooms && signRooms[room.name] === false) {
    return false;
  }

  if (
    signRooms &&
    Object.keys(signRooms).length > 0 &&
    signRooms[room.name] !== true
  ) {
    return false;
  }

  if (
    room.controller.sign &&
    room.controller.sign.username === room.controller.owner.username &&
    room.controller.sign.text === signText
  ) {
    return false;
  }

  return true;
}

function manageSigningSupport(room, counts, desired) {
  if (!getSignText()) {
    return false;
  }

  if (counts.harvester < desired.harvester) {
    return false;
  }

  const target = Object.values(Game.rooms).find((visibleRoom) => {
    return shouldSignRoom(visibleRoom);
  });

  if (!target) {
    return false;
  }

  if (getSignersForTarget(target.name).length > 0) {
    return false;
  }

  spawnSigner(room, target.name);
  return true;
}

function getMilitaryMemory() {
  if (!Memory.military) {
    Memory.military = {};
  }

  return Memory.military;
}

function getRoomIntel(roomName) {
  if (!Memory.rooms || !Memory.rooms[roomName]) {
    return null;
  }

  return Memory.rooms[roomName].intel || null;
}

function needsMilitaryScout(targetRoomName) {
  const intel = getRoomIntel(targetRoomName);

  if (!intel) {
    return true;
  }

  return Game.time - intel.lastScouted > MILITARY_INTEL_MAX_AGE;
}

function manageMilitaryScouting(room, counts, desired) {
  const military = getMilitaryMemory();

  if (!military.attackTarget) {
    return false;
  }

  if (counts.harvester < desired.harvester) {
    return false;
  }

  if (!needsMilitaryScout(military.attackTarget)) {
    return false;
  }

  const scouts = getScoutsForTarget(military.attackTarget);

  if (scouts.length > 0) {
    return false;
  }

  spawnScout(room, military.attackTarget);
  return true;
}

function manageMilitaryAttackers(room, counts, desired) {
  const military = getMilitaryMemory();
  const operation = military.operation;

  if (!operation || operation.status !== "ready") {
    return false;
  }

  if (operation.type !== "invader_clear") {
    return false;
  }

  if (counts.harvester < desired.harvester) {
    return false;
  }

  if (room.controller.level < 3) {
    return false;
  }

  if (getLogisticsStats(room).lowEnergy) {
    return false;
  }

  const neededAttackers = operation.requiredRoles.attacker || 0;

  if (neededAttackers <= 0) {
    return false;
  }

  const defenders = getDefendersForTarget(operation.targetRoom);

  if (defenders.length >= neededAttackers) {
    return false;
  }

  const body = chooseBody(room, "defender");

  if (!body) {
    return false;
  }

  spawnTargetedDefender(room, body, operation.targetRoom);
  return true;
}

function getExpansionMemory() {
  if (!Memory.expansion) {
    Memory.expansion = {};
  }

  if (!Memory.expansion.blockedRooms) {
    Memory.expansion.blockedRooms = {};
  }

  if (!Memory.expansion.scoutTargets) {
    Memory.expansion.scoutTargets = {};
  }

  return Memory.expansion;
}

function clearExpansionTarget(expansion) {
  delete expansion.targetRoom;
  delete expansion.sourceRoom;
}

function pruneBlockedExpansionRooms() {
  const expansion = getExpansionMemory();

  if (!expansion.blockedRooms) {
    expansion.blockedRooms = {};
    return;
  }

  for (const roomName in expansion.blockedRooms) {
    const block = expansion.blockedRooms[roomName];

    if (!block.time || Game.time - block.time > EXPANSION_BLOCK_TTL) {
      delete expansion.blockedRooms[roomName];
    }
  }
}

function isExpansionBlocked(roomName) {
  const expansion = getExpansionMemory();

  if (!expansion.blockedRooms) {
    return false;
  }

  return !!expansion.blockedRooms[roomName];
}

function getOwnedRoomCount() {
  return Object.values(Game.rooms).filter((room) => {
    return room.controller && room.controller.my;
  }).length;
}

function hasExpansionCapacity() {
  return Game.gcl.level > getOwnedRoomCount();
}

function getActiveBootstrapRoomCount() {
  return Object.values(Game.rooms).filter((room) => {
    if (!room.controller || !room.controller.my) {
      return false;
    }

    return room.find(FIND_MY_SPAWNS).length === 0;
  }).length;
}

function hasBootstrapCapacity() {
  return getActiveBootstrapRoomCount() < MAX_BOOTSTRAP_ROOMS;
}

function getAdjacentRoomNames(roomName) {
  const exits = Game.map.describeExits(roomName);

  if (!exits) {
    return [];
  }

  return Object.values(exits);
}

function getExpansionIntel(roomName) {
  if (!Memory.rooms || !Memory.rooms[roomName]) {
    return null;
  }

  return Memory.rooms[roomName].intel || null;
}

function isFreshExpansionIntel(intel) {
  return !!intel && Game.time - intel.lastScouted <= EXPANSION_INTEL_MAX_AGE;
}

function isNormalRoom(roomName) {
  const status = Game.map.getRoomStatus(roomName);

  return status.status === "normal";
}

function hasExpansionScoutForTarget(roomName) {
  return _.some(Game.creeps, (creep) => {
    return (
      creep.memory.role === "scout" &&
      creep.memory.purpose === "expansion" &&
      creep.memory.targetRoom === roomName
    );
  });
}

function getExpansionScoutCount() {
  return _.filter(Game.creeps, (creep) => {
    return creep.memory.role === "scout" && creep.memory.purpose === "expansion";
  }).length;
}

function hasDangerousExpansionStructures(intel) {
  return (
    intel.military.towerCount > 0 ||
    intel.military.spawnCount > 0 ||
    intel.military.rampartCount > 0 ||
    intel.military.wallCount > 0
  );
}

function getBlockingHostileCount(intel) {
  if (intel.military.blockingHostileCount !== undefined) {
    return intel.military.blockingHostileCount;
  }

  return intel.military.hostileCount - (intel.military.sourceKeeperCount || 0);
}

function isClaimableExpansionIntel(roomName) {
  if (isExpansionBlocked(roomName) || !isNormalRoom(roomName)) {
    return false;
  }

  const intel = getExpansionIntel(roomName);

  if (!isFreshExpansionIntel(intel)) {
    return false;
  }

  if (hasDangerousExpansionStructures(intel)) {
    return false;
  }

  return !!intel.claimableNow;
}

function isExpansionScoutCandidate(roomName) {
  const expansion = getExpansionMemory();

  if (isExpansionBlocked(roomName) || !isNormalRoom(roomName)) {
    return false;
  }

  if (expansion.targetRoom === roomName) {
    return false;
  }

  if (hasExpansionScoutForTarget(roomName)) {
    return false;
  }

  const scoutTarget = expansion.scoutTargets[roomName];

  if (
    scoutTarget &&
    scoutTarget.lastAssigned &&
    Game.time - scoutTarget.lastAssigned < EXPANSION_SCOUT_RETRY_TICKS
  ) {
    return false;
  }

  const visibleRoom = Game.rooms[roomName];

  if (visibleRoom && visibleRoom.controller && visibleRoom.controller.my) {
    return false;
  }

  const intel = getExpansionIntel(roomName);

  if (!intel) {
    return true;
  }

  if (!isFreshExpansionIntel(intel)) {
    return true;
  }

  if (!intel.controller.exists || intel.controller.my || intel.controller.owner) {
    return false;
  }

  return getBlockingHostileCount(intel) === 0 && !intel.claimableNow;
}

function getExpansionCandidateScore(sourceRoom, roomName) {
  const intel = getExpansionIntel(roomName);
  const sourceCount = intel ? intel.sourceCount : 1;
  const sourceScore = Math.max(0, 3 - sourceCount) * 20;
  const range = Game.map.getRoomLinearDistance(sourceRoom.name, roomName);

  return sourceScore + range;
}

function chooseExpansionTarget(sourceRoom) {
  const candidates = Object.keys(Memory.rooms || {}).filter(isClaimableExpansionIntel);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    return getExpansionCandidateScore(sourceRoom, a) - getExpansionCandidateScore(sourceRoom, b);
  });

  return candidates[0];
}

function getExpansionTarget(room) {
  pruneBlockedExpansionRooms();

  const expansion = getExpansionMemory();

  if (!hasExpansionCapacity()) {
    clearExpansionTarget(expansion);
    return null;
  }

  if (!hasBootstrapCapacity()) {
    clearExpansionTarget(expansion);
    return null;
  }

  if (
    expansion.targetRoom &&
    expansion.sourceRoom &&
    isClaimableExpansionIntel(expansion.targetRoom)
  ) {
    return expansion;
  }

  const targetRoom = chooseExpansionTarget(room);

  if (!targetRoom) {
    clearExpansionTarget(expansion);
    return null;
  }

  expansion.sourceRoom = room.name;
  expansion.targetRoom = targetRoom;

  console.log(`Selected expansion target ${targetRoom} from ${room.name}`);

  return expansion;
}

function manageClaimingSupport(room, counts, desired) {
  if (counts.harvester < desired.harvester) {
    return false;
  }

  const expansion = getExpansionTarget(room);

  if (!expansion || expansion.sourceRoom !== room.name) {
    return false;
  }

  const claimers = getClaimersForTarget(expansion.targetRoom);

  if (claimers.length > 0) {
    return false;
  }

  const body = chooseBody(room, "claimer");

  if (!body) {
    return false;
  }

  spawnClaimer(room, body, expansion.targetRoom);
  return true;
}

function chooseExpansionScoutTarget(room) {
  const candidates = getAdjacentRoomNames(room.name).filter((roomName) => {
    return isExpansionScoutCandidate(roomName);
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    return getExpansionCandidateScore(room, a) - getExpansionCandidateScore(room, b);
  });

  return candidates[0];
}

function manageExpansionScouting(room, counts, desired) {
  pruneBlockedExpansionRooms();

  if (!hasExpansionCapacity()) {
    return false;
  }

  if (counts.harvester < desired.harvester) {
    return false;
  }

  if (getLogisticsStats(room).lowEnergy) {
    return false;
  }

  if (getExpansionScoutCount() >= MAX_EXPANSION_SCOUTS) {
    return false;
  }

  const targetRoom = chooseExpansionScoutTarget(room);

  if (!targetRoom) {
    return false;
  }

  const expansion = getExpansionMemory();
  expansion.scoutTargets[targetRoom] = {
    sourceRoom: room.name,
    lastAssigned: Game.time,
  };

  spawnScout(room, targetRoom, "expansion");
  return true;
}

function getBootstrapTargets(sourceRoom) {
  return Object.values(Game.rooms).filter((room) => {
    if (room.name === sourceRoom.name) {
      return false;
    }

    if (!room.controller || !room.controller.my) {
      return false;
    }

    const spawns = room.find(FIND_MY_SPAWNS);

    return spawns.length === 0;
  });
}

function getBootstrapIntel(roomName) {
  return getExpansionIntel(roomName);
}

function getBootstrapThreat(roomName) {
  const intel = getBootstrapIntel(roomName);

  if (!intel || !intel.military) {
    return {
      dangerous: false,
      requiredEscorts: 0,
    };
  }

  if (intel.military.sourceKeeperCount > 0) {
    return {
      dangerous: true,
      requiredEscorts: 2,
    };
  }

  if (getBlockingHostileCount(intel) > 0) {
    return {
      dangerous: true,
      requiredEscorts: 1,
    };
  }

  return {
    dangerous: false,
    requiredEscorts: 0,
  };
}

function manageBootstrapEscorts(room, counts, desired) {
  if (counts.harvester < desired.harvester) {
    return false;
  }

  if (getLogisticsStats(room).lowEnergy) {
    return false;
  }

  const targets = getBootstrapTargets(room);

  for (const target of targets) {
    const threat = getBootstrapThreat(target.name);

    if (!threat.dangerous) {
      continue;
    }

    const escorts = getFunctionalBootstrapEscortsForTarget(target.name);

    if (escorts.length >= threat.requiredEscorts) {
      continue;
    }

    const body = chooseBody(room, "bootstrapEscort");

    if (!body) {
      continue;
    }

    spawnBootstrapEscort(room, body, target.name);
    return true;
  }

  return false;
}

function isSupplierSourceRoom(room, counts, desired) {
  return (
    room.controller.level >= 8 &&
    room.storage &&
    room.storage.store[RESOURCE_ENERGY] > SUPPORT_STORAGE_RESERVE &&
    counts.harvester >= desired.harvester &&
    !getLogisticsStats(room).lowEnergy
  );
}

function getSupportTargetRooms(sourceRoom) {
  return Object.values(Game.rooms).filter((room) => {
    if (room.name === sourceRoom.name) {
      return false;
    }

    if (!room.controller || !room.controller.my) {
      return false;
    }

    if (room.controller.level > SUPPORT_TARGET_MAX_RCL) {
      return false;
    }

    const spawns = room.find(FIND_MY_SPAWNS);

    if (spawns.length === 0) {
      return false;
    }

    if (room.energyAvailable < room.energyCapacityAvailable) {
      return true;
    }

    if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      return true;
    }

    return room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (
          structure.structureType === STRUCTURE_CONTAINER &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    }).length > 0;
  });
}

function getSupportTargetScore(room) {
  return room.controller.level * 100 + room.energyAvailable;
}

function manageEnergySupport(room, counts, desired) {
  if (!isSupplierSourceRoom(room, counts, desired)) {
    return false;
  }

  const targets = getSupportTargetRooms(room);

  if (targets.length === 0) {
    return false;
  }

  targets.sort((a, b) => {
    return getSupportTargetScore(a) - getSupportTargetScore(b);
  });

  for (const target of targets) {
    if (getSuppliersForTarget(target.name).length > 0) {
      continue;
    }

    const body = chooseBody(room, "supplier");

    if (!body) {
      continue;
    }

    spawnSupplier(room, body, target.name);
    return true;
  }

  return false;
}

function manageExpansionSupport(room, counts, desired) {
  if (counts.harvester < desired.harvester) {
    return false;
  }

  const targets = getBootstrapTargets(room);

  for (const target of targets) {
    const threat = getBootstrapThreat(target.name);
    const escorts = getFunctionalBootstrapEscortsForTarget(target.name);

    if (threat.dangerous && escorts.length < threat.requiredEscorts) {
      continue;
    }

    const totalPioneers = getPioneersForTarget(target.name);

    if (totalPioneers.length >= MAX_PIONEERS_PER_BOOTSTRAP_ROOM) {
      continue;
    }

    const pioneers = getFunctionalPioneersForTarget(target.name);

    if (pioneers.length >= DESIRED_FUNCTIONAL_PIONEERS_PER_BOOTSTRAP_ROOM) {
      continue;
    }

    const body = chooseBody(room, "pioneer");

    if (!body) {
      continue;
    }

    spawnPioneer(room, body, target.name);
    return true;
  }

  return false;
}

function manageDefense(room) {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length === 0) {
    return;
  }

  console.log(`${hostiles.length} hostile(s) found in ${room.name}`);

  if (hostiles.length > 3) {
    Game.notify(`${hostiles.length} hostile(s) found in ${room.name}`, 0);
  }

  const defenders = getRoomCreeps(room, "defender").filter((creep) => {
    return !creep.memory.targetRoom;
  });

  if (defenders.length >= hostiles.length) {
    return;
  }

  const body = [MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK];

  if (bodyCost(body) <= room.energyAvailable) {
    spawnRole(room, "defender", body);
  }
}

function manageSpawning(room) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return;
  }

  const desired = getDesiredCounts(room);

  const counts = {
    harvester: getRoomCreeps(room, "harvester").length,
    builder: getRoomCreeps(room, "builder").length,
    repairer: getRoomCreeps(room, "repairer").length,
    upgrader: getRoomCreeps(room, "upgrader").length,
    tractor: getRoomCreeps(room, "tractor").length,
    claimer: getRoomCreeps(room, "claimer").length,
    scout: getRoomCreeps(room, "scout").length,
    supplier: getRoomCreeps(room, "supplier").length,
    pioneer: getRoomCreeps(room, "pioneer").length,
    bootstrapEscort: getRoomCreeps(room, "bootstrapEscort").length,
    defender: getRoomCreeps(room, "defender").length,
    stim: getRoomCreeps(room, "stim").length,
    signer: getRoomCreeps(room, "signer").length,
  };

  console.log(
    `${room.name} creeps - Harvesters: ${counts.harvester}/${desired.harvester}, ` +
    `Builders: ${counts.builder}/${desired.builder}, ` +
    `Repairers: ${counts.repairer}/${desired.repairer}, ` +
    `Upgraders: ${counts.upgrader}/${desired.upgrader}, ` +
    `Tractors: ${counts.tractor}/${desired.tractor}, ` +
    `Claimers: ${counts.claimer}, ` +
    `Scouts: ${counts.scout}, ` +
    `Suppliers: ${counts.supplier}, ` +
    `Pioneers: ${counts.pioneer}, ` +
    `Escorts: ${counts.bootstrapEscort}, ` +
    `Defenders: ${counts.defender}, ` +
    `Stims: ${counts.stim}, ` +
    `Signers: ${counts.signer}`
  );

  // Emergency recovery: if the room has no harvesters, prioritize the cheapest viable worker.
  if (counts.harvester === 0) {
    const emergencyBody = [WORK, CARRY, MOVE];

    if (bodyCost(emergencyBody) <= room.energyAvailable) {
      spawnRole(room, "harvester", emergencyBody);
    }

    return;
  }

  if (manageBootstrapEscorts(room, counts, desired)) {
    return;
  }

  if (manageEnergySupport(room, counts, desired)) {
    return;
  }

  if (manageExpansionSupport(room, counts, desired)) {
    return;
  }

  if (manageClaimingSupport(room, counts, desired)) {
    return;
  }

  if (manageExpansionScouting(room, counts, desired)) {
    return;
  }

  if (manageSigningSupport(room, counts, desired)) {
    return;
  }

  if (manageMilitaryScouting(room, counts, desired)) {
    return;
  }

  if (manageMilitaryAttackers(room, counts, desired)) {
    return;
  }

  for (const role of ROLE_PRIORITY) {
    if (counts[role] >= desired[role]) {
      continue;
    }

    const body = chooseBody(room, role);

    if (!body) {
      continue;
    }

    spawnRole(room, role, body);
    return;
  }
}

function showSpawnVisual(room) {
  const spawns = room.find(FIND_MY_SPAWNS);

  for (const spawn of spawns) {
    if (!spawn.spawning) {
      continue;
    }

    const spawningCreep = Game.creeps[spawn.spawning.name];

    if (!spawningCreep) {
      continue;
    }

    room.visual.text(
      "🛠️" + spawningCreep.memory.role,
      spawn.pos.x + 1,
      spawn.pos.y,
      {
        align: "left",
        opacity: 0.8,
      }
    );
  }
}

module.exports = {
  run: function (room) {
    if (!room.controller || !room.controller.my) {
      return;
    }

    adoptLocalCreeps(room);

    console.log(`Managing room ${room.name}, RCL ${room.controller.level}`);
    console.log(`Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`);

    try {
      roleTower.run(room.name);
    } catch (error) {
      console.log(`Tower error in ${room.name}:`, error);
    }

    try {
      constructionManager.run(room);
    } catch (error) {
      console.log(`Construction manager error in ${room.name}:`, error);
    }

    manageDefense(room);
    manageSpawning(room);
    showSpawnVisual(room);
  },
};
