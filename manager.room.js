const roleTower = require("role.tower");
const constructionManager = require("manager.construction");
const signConfig = require("config.sign");

const EXPANSION_BLOCK_TTL = 50000;
const EXPANSION_BLOCK_RECHECK_TICKS = 3000;
const EXPANSION_INTEL_MAX_AGE = 10000;
const EXPANSION_SCOUT_RETRY_TICKS = 3000;
const EXPANSION_LOG_INTERVAL = 500;
const MAX_EXPANSION_SCOUTS = 2;
const MAX_BOOTSTRAP_ROOMS = 2;
const MAX_PIONEERS_PER_BOOTSTRAP_ROOM = 4;
const DESIRED_FUNCTIONAL_PIONEERS_PER_BOOTSTRAP_ROOM = 2;
const SUPPORT_STORAGE_RESERVE = 200000;
const SUPPORT_TARGET_MAX_RCL = 4;
const MILITARY_INTEL_MAX_AGE = 1500;
const INCOME_LOG_INTERVAL = 100;
const ROOM_LOG_INTERVAL = 100;
const CONSTRUCTION_RUN_INTERVAL = 25;
const SPAWNLESS_CONSTRUCTION_RUN_INTERVAL = 5;
const LOW_BUCKET_CONSTRUCTION_LIMIT = 2000;
const LOW_BUCKET_VISUAL_LIMIT = 5000;
const LOW_BUCKET_SPAWN_LIMIT = 3000;
const CRITICAL_BUCKET_SPAWN_LIMIT = 1000;
const NORMAL_SPAWN_INTERVAL = 2;
const LOW_BUCKET_SPAWN_INTERVAL = 3;
const CRITICAL_BUCKET_SPAWN_INTERVAL = 5;
const STRATEGIC_SPAWN_INTERVAL = 25;
const EXPANSION_SPAWN_INTERVAL = 5;
const SPAWN_VISUAL_INTERVAL = 5;
const DEFENSE_SPAWN_INTERVAL = 5;
const MAINTENANCE_TARGET_CACHE_TICKS = 50;
const SOURCE_WORK_TARGET = 5;
const STORAGE_COMFORTABLE_ENERGY = 200000;
const logisticsStatsCache = {};
const expansionRouteCache = {};

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

function getRoomCreepCounts(room) {
  const counts = {
    harvester: 0,
    builder: 0,
    repairer: 0,
    upgrader: 0,
    tractor: 0,
    claimer: 0,
    scout: 0,
    supplier: 0,
    pioneer: 0,
    bootstrapEscort: 0,
    defender: 0,
    stim: 0,
    signer: 0,
  };

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    if (creep.memory.homeRoom !== room.name) {
      continue;
    }

    if (counts[creep.memory.role] === undefined) {
      counts[creep.memory.role] = 0;
    }

    counts[creep.memory.role]++;
  }

  return counts;
}

function getRoomMemory(room) {
  if (!Memory.rooms) {
    Memory.rooms = {};
  }

  if (!Memory.rooms[room.name]) {
    Memory.rooms[room.name] = {};
  }

  return Memory.rooms[room.name];
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

function getDroppedEnergyNearSource(source) {
  return source.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY,
  }).reduce((total, resource) => total + resource.amount, 0);
}

function getAssignedHarvesterWorkBySource(room) {
  const assignedWork = {};

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    if (
      creep.memory.role !== "harvester" ||
      creep.memory.homeRoom !== room.name ||
      !creep.memory.sourceId
    ) {
      continue;
    }

    assignedWork[creep.memory.sourceId] =
      (assignedWork[creep.memory.sourceId] || 0) +
      creep.getActiveBodyparts(WORK);
  }

  return assignedWork;
}

function getLogisticsStats(room) {
  const cached = logisticsStatsCache[room.name];

  if (cached && cached.tick === Game.time) {
    return cached.stats;
  }

  const sources = room.find(FIND_SOURCES);
  const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
  });

  const sourceContainers = containers.filter(isSourceContainer);
  const sourceContainerEnergy = sourceContainers.reduce((total, container) => {
    return total + container.store[RESOURCE_ENERGY];
  }, 0);
  const fullSourceContainerCount = sourceContainers.filter((container) => {
    return container.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
  }).length;
  const droppedSourceEnergy = sources.reduce((total, source) => {
    return total + getDroppedEnergyNearSource(source);
  }, 0);
  const assignedHarvesterWork = getAssignedHarvesterWorkBySource(room);
  const weakHarvestingSourceCount = sources.filter((source) => {
    return (assignedHarvesterWork[source.id] || 0) < SOURCE_WORK_TARGET;
  }).length;
  const storedEnergy = getStoredEnergy(room);
  const lowEnergyThreshold = Math.max(800, room.energyCapacityAvailable * 2);
  const comfortableEnergyThreshold = room.storage
    ? Math.max(STORAGE_COMFORTABLE_ENERGY, room.energyCapacityAvailable * 10)
    : Math.max(1600, room.energyCapacityAvailable * 3);

  const stats = {
    constructionSiteCount: constructionSites.length,
    sourceCount: sources.length,
    sourceContainerCount: sourceContainers.length,
    sourceContainerEnergy: sourceContainerEnergy,
    fullSourceContainerCount: fullSourceContainerCount,
    droppedSourceEnergy: droppedSourceEnergy,
    weakHarvestingSourceCount: weakHarvestingSourceCount,
    storedEnergy: storedEnergy,
    hasSourceContainers: sourceContainers.length > 0,
    lowEnergy: storedEnergy < lowEnergyThreshold,
    comfortableEnergy: storedEnergy >= comfortableEnergyThreshold,
  };

  logisticsStatsCache[room.name] = {
    tick: Game.time,
    stats: stats,
  };

  return stats;
}

function getSourceContainerForSource(source) {
  return source.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
  })[0];
}

function getAssignedHarvesterWork(room, source) {
  return _.filter(Game.creeps, (creep) => {
    return (
      creep.memory.role === "harvester" &&
      creep.memory.homeRoom === room.name &&
      creep.memory.sourceId === source.id
    );
  }).reduce((total, creep) => {
    return total + creep.getActiveBodyparts(WORK);
  }, 0);
}

function formatEnergyDelta(delta) {
  if (delta > 0) {
    return "+" + delta;
  }

  return String(delta);
}

function logIncomeEfficiency(room) {
  const roomMemory = getRoomMemory(room);
  const previous = roomMemory.incomeSample;

  if (
    previous &&
    previous.tick &&
    Game.time - previous.tick < INCOME_LOG_INTERVAL
  ) {
    return;
  }

  const storedEnergy = getStoredEnergy(room);
  const delta =
    previous && previous.storedEnergy !== undefined
      ? storedEnergy - previous.storedEnergy
      : 0;
  const ticks =
    previous && previous.tick
      ? Game.time - previous.tick
      : INCOME_LOG_INTERVAL;
  const deltaPerTick = ticks > 0 ? (delta / ticks).toFixed(1) : "0.0";
  const sources = room.find(FIND_SOURCES);
  const sourceDetails = sources.map((source, index) => {
    const container = getSourceContainerForSource(source);
    const containerEnergy = container ? container.store[RESOURCE_ENERGY] : 0;
    const containerCapacity = container
      ? container.store.getCapacity(RESOURCE_ENERGY)
      : 0;
    const droppedEnergy = getDroppedEnergyNearSource(source);
    const assignedWork = getAssignedHarvesterWork(room, source);

    return (
      "S" + (index + 1) +
      " e:" + source.energy + "/" + source.energyCapacity +
      " regen:" + source.ticksToRegeneration +
      " cont:" + containerEnergy + "/" + containerCapacity +
      " drop:" + droppedEnergy +
      " work:" + assignedWork + "/5"
    );
  });

  console.log(
    `${room.name} income - stored: ${storedEnergy} ` +
    `delta/${ticks}: ${formatEnergyDelta(delta)} (${deltaPerTick}/tick), ` +
    `sources: ${sourceDetails.join(" | ")}`
  );

  roomMemory.incomeSample = {
    tick: Game.time,
    storedEnergy: storedEnergy,
  };
}

function getMaintenanceTargets(room) {
  const roomMemory = getRoomMemory(room);
  const cached = roomMemory.maintenanceTargets;

  if (
    cached &&
    cached.tick &&
    Game.time - cached.tick < MAINTENANCE_TARGET_CACHE_TICKS
  ) {
    return cached.ids.map((id) => Game.getObjectById(id)).filter(Boolean);
  }

  const targets = room.find(FIND_STRUCTURES, {
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

  roomMemory.maintenanceTargets = {
    tick: Game.time,
    ids: targets.map((target) => target.id),
  };

  return targets;
}

function getCriticalMaintenanceTargets(maintenanceTargets) {
  return maintenanceTargets.filter((structure) => {
    return structure.hits < structure.hitsMax * 0.35;
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
    desired.upgrader = logistics.comfortableEnergy ? 2 : 1;

    if (logistics.hasSourceContainers && logistics.sourceContainerEnergy > 100) {
      desired.tractor = 1;
    }
  }

  if (rcl >= 4) {
    desired.harvester = 4;
    desired.builder = logistics.constructionSiteCount > 0 ? 2 : 0;
    desired.upgrader = logistics.comfortableEnergy ? 2 : 1;
    desired.tractor = logistics.hasSourceContainers ? 1 : 0;
  }

  if (rcl >= 5) {
    desired.harvester = 5;
    desired.builder = logistics.constructionSiteCount > 0 ? 2 : 0;
    desired.upgrader = logistics.comfortableEnergy ? 3 : 1;
    desired.tractor = logistics.hasSourceContainers ? 1 : 0;
  }

  if (
    logistics.sourceContainerCount >= 2 &&
    (logistics.sourceContainerEnergy > 800 || logistics.comfortableEnergy)
  ) {
    desired.tractor = Math.max(desired.tractor, 2);
  }

  if (
    logistics.hasSourceContainers &&
    (logistics.fullSourceContainerCount > 0 || logistics.droppedSourceEnergy > 500)
  ) {
    desired.tractor = Math.max(desired.tractor, 2);
  }

  if (
    logistics.sourceContainerCount >= 2 &&
    (logistics.fullSourceContainerCount > 0 || logistics.droppedSourceEnergy > 1500)
  ) {
    desired.tractor = Math.max(desired.tractor, 3);
  }

  if (rcl >= 4 && logistics.sourceContainerCount >= logistics.sourceCount) {
    desired.harvester = logistics.sourceCount;
  }

  if (rcl >= 4 && logistics.weakHarvestingSourceCount > 0) {
    desired.harvester = Math.max(
      desired.harvester,
      logistics.sourceCount + logistics.weakHarvestingSourceCount
    );
  }

  if (
    rcl === 3 &&
    logistics.sourceCount === 1 &&
    logistics.hasSourceContainers
  ) {
    desired.harvester = Math.min(desired.harvester, 3);
  }

  if (
    rcl >= 3 &&
    logistics.sourceCount === 1 &&
    logistics.sourceContainerCount < logistics.sourceCount
  ) {
    desired.harvester = Math.min(desired.harvester, 2);
  }

  if (rcl === 7 && logistics.storedEnergy > 900000) {
    desired.upgrader = 4;
  }

  if (rcl >= 8) {
    desired.upgrader = logistics.comfortableEnergy ? 2 : 1;
  }

  if (
    rcl < 8 &&
    (
      logistics.fullSourceContainerCount > 0 ||
      logistics.droppedSourceEnergy > 1000
    )
  ) {
    desired.upgrader = Math.max(desired.upgrader, rcl >= 5 ? 3 : 2);
  }

  if (logistics.lowEnergy) {
    desired.upgrader = Math.min(desired.upgrader, 1);
    desired.builder = Math.min(desired.builder, 1);
    desired.harvester = Math.max(desired.harvester, logistics.sourceCount);

    if (logistics.sourceContainerEnergy > 100) {
      desired.tractor = Math.max(desired.tractor, 1);
    }
  }

  const maintenanceTargets = getMaintenanceTargets(room);
  const criticalMaintenanceTargets = getCriticalMaintenanceTargets(maintenanceTargets);

  if (
    rcl >= 2 &&
    (criticalMaintenanceTargets.length > 0 || maintenanceTargets.length >= 5)
  ) {
    desired.repairer = 1;
  }

  if (
    rcl >= 5 &&
    (criticalMaintenanceTargets.length >= 3 || maintenanceTargets.length > 20)
  ) {
    desired.repairer = 2;
  }

  return desired;
}

function getBodiesForRole(role, rcl, room) {
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
    const logistics = room ? getLogisticsStats(room) : null;
    const hasContainerMining =
      logistics &&
      rcl >= 4 &&
      logistics.sourceContainerCount >= logistics.sourceCount;

    if (hasContainerMining && rcl >= 7) {
      return [
        [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, WORK, WORK, CARRY, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    if (hasContainerMining) {
      return [
        [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, WORK, WORK, CARRY, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

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
        [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
        [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        [WORK, CARRY, MOVE],
      ];
    }

    if (rcl >= 3) {
      return [
        [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
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
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
        [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
        [CARRY, CARRY, MOVE],
      ];
    }

    if (rcl >= 4) {
      return [
        [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
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
  const bodies = getBodiesForRole(role, room.controller.level, room);

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

function spawnRoleWithMemory(room, role, body, memory) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return ERR_BUSY;
  }

  if (!body || bodyCost(body) > room.energyAvailable) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  const name = role.charAt(0).toUpperCase() + role.slice(1) + Game.time;
  const result = spawn.spawnCreep(body, name, {
    memory: Object.assign({
      role: role,
      homeRoom: room.name,
    }, memory || {}),
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

  return !( room.controller.sign &&
    room.controller.sign.username === room.controller.owner.username &&
    room.controller.sign.text === signText );


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
      continue;
    }

    const intel = getExpansionIntel(roomName);

    if (
      intel &&
      isFreshExpansionIntel(intel) &&
      intel.claimableNow &&
      !hasDangerousExpansionStructures(intel)
    ) {
      delete expansion.blockedRooms[roomName];
    }
  }
}

function isExpansionBlocked(roomName) {
  const expansion = getExpansionMemory();

  if (!expansion.blockedRooms) {
    return false;
  }

  const block = expansion.blockedRooms[roomName];

  if (!block) {
    return false;
  }

  const intel = getExpansionIntel(roomName);

  if (
    intel &&
    isFreshExpansionIntel(intel) &&
    intel.claimableNow &&
    !hasDangerousExpansionStructures(intel)
  ) {
    delete expansion.blockedRooms[roomName];
    return false;
  }

  return !( Game.time - block.time > EXPANSION_BLOCK_RECHECK_TICKS &&
    ( !intel || !isFreshExpansionIntel(intel) ) );


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

  return !!status && status.status === "normal";
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

function logExpansionDecision(expansion, message) {
  if (
    expansion.lastDecisionLog &&
    Game.time - expansion.lastDecisionLog < EXPANSION_LOG_INTERVAL
  ) {
    return;
  }

  expansion.lastDecisionLog = Game.time;
  console.log(`Expansion: ${message}`);
}

function logExpansionStatus(expansion, message) {
  logExpansionDecision(expansion, message);
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

function isEstablishedSupportRoom(room) {
  return (
    room.controller &&
    room.controller.my &&
    room.controller.level >= 4 &&
    room.find(FIND_MY_SPAWNS).length > 0
  );
}

function getAdjacentEstablishedRoomCount(roomName) {
  return getAdjacentRoomNames(roomName).filter((adjacentRoomName) => {
    const room = Game.rooms[adjacentRoomName];
    return room && isEstablishedSupportRoom(room);
  }).length;
}

function isSafeExpansionRoute(sourceRoomName, targetRoomName) {
  const cacheKey = sourceRoomName + ">" + targetRoomName;
  const cached = expansionRouteCache[cacheKey];

  if (cached && cached.tick === Game.time) {
    return cached.safe;
  }

  const route = Game.map.findRoute(sourceRoomName, targetRoomName, {
    routeCallback: function (roomName) {
      if (isDangerousSupplierTransitRoom(roomName, targetRoomName)) {
        return Infinity;
      }

      return 1;
    },
  });

  expansionRouteCache[cacheKey] = {
    tick: Game.time,
    safe: route !== ERR_NO_PATH,
  };

  return expansionRouteCache[cacheKey].safe;
}

function getPreferredExpansionTarget(expansion) {
  if (!expansion.preferredTarget || typeof expansion.preferredTarget !== "string") {
    return null;
  }

  const preferredTarget = expansion.preferredTarget.trim().toUpperCase();

  if (!/^[WE][0-9]+[NS][0-9]+$/.test(preferredTarget)) {
    logExpansionDecision(
      expansion,
      `invalid preferred target ${expansion.preferredTarget}`
    );
    return null;
  }

  return preferredTarget;
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
  const sourceScore = sourceCount >= 2 ? 0 : 50;
  const range = Game.map.getRoomLinearDistance(sourceRoom.name, roomName);
  const rangeScore = range * 5;
  const adjacentEstablishedScore =
    getAdjacentEstablishedRoomCount(roomName) * -25;
  const sourceRoomScore = isEstablishedSupportRoom(sourceRoom) ? 0 : 50;
  const hostileScore =
    intel && intel.military && getBlockingHostileCount(intel) > 0 ? 100 : 0;
  const keeperScore =
    intel && intel.military && intel.military.sourceKeeperCount > 0 ? 100 : 0;
  const routeScore = isSafeExpansionRoute(sourceRoom.name, roomName) ? 0 : 200;

  return (
    sourceScore +
    rangeScore +
    adjacentEstablishedScore +
    sourceRoomScore +
    hostileScore +
    keeperScore +
    routeScore
  );
}

function describeExpansionCandidate(sourceRoom, roomName) {
  const intel = getExpansionIntel(roomName);
  const sourceCount = intel ? intel.sourceCount : 0;
  const range = Game.map.getRoomLinearDistance(sourceRoom.name, roomName);
  const adjacentEstablished = getAdjacentEstablishedRoomCount(roomName);
  const safeRoute = isSafeExpansionRoute(sourceRoom.name, roomName);

  return (
    roomName +
    " score=" + getExpansionCandidateScore(sourceRoom, roomName) +
    " sources=" + sourceCount +
    " range=" + range +
    " adjacentEstablished=" + adjacentEstablished +
    " safeRoute=" + safeRoute
  );
}

function chooseExpansionTarget(sourceRoom, expansion) {
  const preferredTarget = getPreferredExpansionTarget(expansion);

  if (preferredTarget) {
    if (
      isClaimableExpansionIntel(preferredTarget) &&
      isSafeExpansionRoute(sourceRoom.name, preferredTarget)
    ) {
      logExpansionDecision(
        expansion,
        `preferred target viable: ${describeExpansionCandidate(sourceRoom, preferredTarget)}`
      );
      return preferredTarget;
    }

    logExpansionDecision(
      expansion,
      `preferred target ${preferredTarget} not claimable or no safe route yet`
    );
  }

  const candidates = Object.keys(Memory.rooms || {}).filter((roomName) => {
    return (
      isClaimableExpansionIntel(roomName) &&
      isSafeExpansionRoute(sourceRoom.name, roomName)
    );
  });

  if (candidates.length === 0) {
    logExpansionDecision(expansion, "no fresh claimable candidates with safe routes");
    return null;
  }

  candidates.sort((a, b) => {
    return getExpansionCandidateScore(sourceRoom, a) - getExpansionCandidateScore(sourceRoom, b);
  });

  logExpansionDecision(
    expansion,
    "best candidates from " + sourceRoom.name + ": " +
      candidates.slice(0, 3).map((roomName) => {
        return describeExpansionCandidate(sourceRoom, roomName);
      }).join(" | ")
  );

  return candidates[0];
}

function getExpansionTarget(room) {
  pruneBlockedExpansionRooms();

  const expansion = getExpansionMemory();

  if (!hasExpansionCapacity()) {
    logExpansionStatus(
      expansion,
      `at capacity owned=${getOwnedRoomCount()} gcl=${Game.gcl.level}`
    );
    clearExpansionTarget(expansion);
    return null;
  }

  if (!hasBootstrapCapacity()) {
    logExpansionStatus(
      expansion,
      `bootstrap full active=${getActiveBootstrapRoomCount()}/${MAX_BOOTSTRAP_ROOMS}`
    );
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

  const targetRoom = chooseExpansionTarget(room, expansion);

  if (!targetRoom) {
    clearExpansionTarget(expansion);
    return null;
  }

  expansion.sourceRoom = room.name;
  expansion.targetRoom = targetRoom;

  console.log(
    `Selected expansion target from ${room.name}: ` +
    describeExpansionCandidate(room, targetRoom)
  );

  return expansion;
}

function manageClaimingSupport(room, counts, desired) {
  if (counts.harvester < desired.harvester) {
    logExpansionDecision(
      getExpansionMemory(),
      `claim skipped in ${room.name}: harvesters ${counts.harvester}/${desired.harvester}`
    );
    return false;
  }

  const expansion = getExpansionTarget(room);

  if (!expansion || expansion.sourceRoom !== room.name) {
    return false;
  }

  const claimers = getClaimersForTarget(expansion.targetRoom);

  if (claimers.length > 0) {
    logExpansionDecision(
      expansion,
      `claimer already active for ${expansion.targetRoom}`
    );
    return false;
  }

  const body = chooseBody(room, "claimer");

  if (!body) {
    logExpansionDecision(
      expansion,
      `claim skipped in ${room.name}: cannot afford claimer`
    );
    return false;
  }

  spawnClaimer(room, body, expansion.targetRoom);
  return true;
}

function chooseExpansionScoutTarget(room) {
  const expansion = getExpansionMemory();
  const preferredTarget = getPreferredExpansionTarget(expansion);

  if (
    preferredTarget &&
    getAdjacentRoomNames(room.name).indexOf(preferredTarget) >= 0 &&
    isExpansionScoutCandidate(preferredTarget)
  ) {
    return preferredTarget;
  }

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
    logExpansionDecision(
      getExpansionMemory(),
      `scout skipped in ${room.name}: harvesters ${counts.harvester}/${desired.harvester}`
    );
    return false;
  }

  if (getLogisticsStats(room).lowEnergy) {
    logExpansionDecision(
      getExpansionMemory(),
      `scout skipped in ${room.name}: low energy`
    );
    return false;
  }

  if (getExpansionScoutCount() >= MAX_EXPANSION_SCOUTS) {
    logExpansionDecision(
      getExpansionMemory(),
      `scout skipped: active scouts ${getExpansionScoutCount()}/${MAX_EXPANSION_SCOUTS}`
    );
    return false;
  }

  const targetRoom = chooseExpansionScoutTarget(room);

  if (!targetRoom) {
    logExpansionDecision(
      getExpansionMemory(),
      `no adjacent scout target from ${room.name}`
    );
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

function isDangerousSupplierTransitRoom(roomName, destinationRoomName) {
  if (roomName === destinationRoomName) {
    return false;
  }

  const intel = getExpansionIntel(roomName);

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

function hasSafeSupplierRoute(sourceRoomName, targetRoomName) {
  const route = Game.map.findRoute(sourceRoomName, targetRoomName, {
    routeCallback: function (roomName) {
      if (isDangerousSupplierTransitRoom(roomName, targetRoomName)) {
        return Infinity;
      }

      return 1;
    },
  });

  return route !== ERR_NO_PATH;
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

    if (!hasSafeSupplierRoute(room.name, target.name)) {
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

function getEmergencyDefenderBody(room) {
  const bodies = [
    [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL],
    [MOVE, MOVE, RANGED_ATTACK, HEAL],
    [MOVE, RANGED_ATTACK],
    [MOVE, ATTACK],
  ];

  for (const body of bodies) {
    if (bodyCost(body) <= room.energyAvailable) {
      return body;
    }
  }

  return null;
}

function needsTowerEnergy(room) {
  const tower = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_TOWER &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      );
    },
  })[0];

  return !!tower;
}

function manageHostileEmergencySpawning(room, counts) {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length === 0) {
    return false;
  }

  if (needsTowerEnergy(room) && counts.stim === 0) {
    const body = bodyCost([MOVE, MOVE, CARRY, CARRY]) <= room.energyAvailable
      ? [MOVE, MOVE, CARRY, CARRY]
      : [MOVE, CARRY];

    if (bodyCost(body) <= room.energyAvailable) {
      spawnRole(room, "stim", body);
      return true;
    }
  }

  const localDefenders = getRoomCreeps(room, "defender").filter((creep) => {
    return !creep.memory.targetRoom;
  });
  const functionalDefenders = localDefenders.filter((creep) => {
    return (
      creep.getActiveBodyparts(ATTACK) > 0 ||
      creep.getActiveBodyparts(RANGED_ATTACK) > 0
    );
  });

  if (functionalDefenders.length >= Math.max(hostiles.length, 1)) {
    return true;
  }

  const body = getEmergencyDefenderBody(room);

  if (!body) {
    return true;
  }

  spawnRoleWithMemory(room, "defender", body, {
    emergency: true,
  });
  return true;
}

function canRunSupportSpawning(room, counts, desired) {
  if (counts.harvester < desired.harvester) {
    return false;
  }

  if (getLogisticsStats(room).lowEnergy) {
    return false;
  }

  return room.controller.level >= 6 || isSupplierSourceRoom(room, counts, desired);
}

function manageSpawning(room) {
  const spawn = getAvailableSpawn(room);

  if (!spawn) {
    return;
  }

  const desired = getDesiredCounts(room);
  const counts = getRoomCreepCounts(room);

  if (Game.time % ROOM_LOG_INTERVAL === 0) {
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
  }

  if (manageHostileEmergencySpawning(room, counts)) {
    return;
  }

  // Emergency recovery: if the room has no harvesters, prioritize the cheapest viable worker.
  if (counts.harvester === 0) {
    const emergencyBody = [WORK, CARRY, MOVE];

    if (bodyCost(emergencyBody) <= room.energyAvailable) {
      spawnRole(room, "harvester", emergencyBody);
    }

    return;
  }

  if (shouldRunExpansionSpawning(room)) {
    if (manageClaimingSupport(room, counts, desired)) {
      return;
    }

    if (manageExpansionScouting(room, counts, desired)) {
      return;
    }
  }

  if (shouldRunStrategicSpawning(room)) {
    if (manageBootstrapEscorts(room, counts, desired)) {
      return;
    }

    if (canRunSupportSpawning(room, counts, desired)) {
      if (manageEnergySupport(room, counts, desired)) {
        return;
      }

      if (manageExpansionSupport(room, counts, desired)) {
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
    }
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

function shouldRunConstruction(room) {
  if (Game.cpu.bucket < LOW_BUCKET_CONSTRUCTION_LIMIT) {
    return false;
  }

  const roomMemory = getRoomMemory(room);
  const hasSpawn = room.find(FIND_MY_SPAWNS).length > 0;
  const interval = hasSpawn
    ? CONSTRUCTION_RUN_INTERVAL
    : SPAWNLESS_CONSTRUCTION_RUN_INTERVAL;

  if (
    roomMemory.lastConstructionRun &&
    Game.time - roomMemory.lastConstructionRun < interval
  ) {
    return false;
  }

  roomMemory.lastConstructionRun = Game.time;
  return true;
}

function getRoomCpuOffset(room) {
  const roomMemory = getRoomMemory(room);

  if (roomMemory.cpuOffset === undefined) {
    roomMemory.cpuOffset = Game.time % 20;
  }

  return roomMemory.cpuOffset;
}

function shouldRunSpawning(room) {
  if (Game.cpu.bucket >= LOW_BUCKET_SPAWN_LIMIT) {
    return (Game.time + getRoomCpuOffset(room)) % NORMAL_SPAWN_INTERVAL === 0;
  }

  const interval = Game.cpu.bucket < CRITICAL_BUCKET_SPAWN_LIMIT
    ? CRITICAL_BUCKET_SPAWN_INTERVAL
    : LOW_BUCKET_SPAWN_INTERVAL;

  return (Game.time + getRoomCpuOffset(room)) % interval === 0;
}

function shouldRunStrategicSpawning(room) {
  return (Game.time + getRoomCpuOffset(room)) % STRATEGIC_SPAWN_INTERVAL === 0;
}

function shouldRunExpansionSpawning(room) {
  return (Game.time + getRoomCpuOffset(room)) % EXPANSION_SPAWN_INTERVAL === 0;
}

function shouldShowSpawnVisual(room) {
  if (Game.cpu.bucket < LOW_BUCKET_VISUAL_LIMIT) {
    return false;
  }

  return (Game.time + getRoomCpuOffset(room)) % SPAWN_VISUAL_INTERVAL === 0;
}

function shouldRunDefenseSpawn(room) {
  return (Game.time + getRoomCpuOffset(room)) % DEFENSE_SPAWN_INTERVAL === 0;
}

function runMeasuredRoomPhase(room, phase, callback) {
  const before = Game.cpu.getUsed();

  callback();

  const usedCpu = Game.cpu.getUsed() - before;

  if (usedCpu >= 1) {
    console.log(
      `Slow room phase ${room.name}:${phase} cpu=${usedCpu.toFixed(2)}`
    );
  }
}

module.exports = {
  run: function (room) {
    if (!room.controller || !room.controller.my) {
      return;
    }

    adoptLocalCreeps(room);

    if (Game.time % ROOM_LOG_INTERVAL === 0) {
      console.log(`Managing room ${room.name}, RCL ${room.controller.level}`);
      console.log(`Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`);
    }

    runMeasuredRoomPhase(room, "income", function () {
      logIncomeEfficiency(room);
    });

    try {
      runMeasuredRoomPhase(room, "tower", function () {
        roleTower.run(room.name);
      });
    } catch (error) {
      console.log(`Tower error in ${room.name}:`, error);
    }

    if (shouldRunConstruction(room)) {
      try {
        runMeasuredRoomPhase(room, "construction", function () {
          constructionManager.run(room);
        });
      } catch (error) {
        console.log(`Construction manager error in ${room.name}:`, error);
      }
    }

    if (shouldRunDefenseSpawn(room)) {
      runMeasuredRoomPhase(room, "defense", function () {
        manageDefense(room);
      });
    }

    if (shouldRunSpawning(room)) {
      runMeasuredRoomPhase(room, "spawn", function () {
        manageSpawning(room);
      });
    }

    if (shouldShowSpawnVisual(room)) {
      runMeasuredRoomPhase(room, "visual", function () {
        showSpawnVisual(room);
      });
    }
  },
};
