const roleTower = require("role.tower");
const constructionManager = require("manager.construction");

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

  if (rcl >= 7 && logistics.storedEnergy > 900000) {
    desired.upgrader = 7;
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

function manageDefense(room) {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length === 0) {
    return;
  }

  console.log(`${hostiles.length} hostile(s) found in ${room.name}`);

  if (hostiles.length > 3) {
    Game.notify(`${hostiles.length} hostile(s) found in ${room.name}`, 0);
  }

  const defenders = getRoomCreeps(room, "defender");

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
  };

  console.log(
    `${room.name} creeps - Harvesters: ${counts.harvester}/${desired.harvester}, ` +
    `Builders: ${counts.builder}/${desired.builder}, ` +
    `Repairers: ${counts.repairer}/${desired.repairer}, ` +
    `Upgraders: ${counts.upgrader}/${desired.upgrader}, ` +
    `Tractors: ${counts.tractor}/${desired.tractor}`
  );

  // Emergency recovery: if the room has no harvesters, prioritize the cheapest viable worker.
  if (counts.harvester === 0) {
    const emergencyBody = [WORK, CARRY, MOVE];

    if (bodyCost(emergencyBody) <= room.energyAvailable) {
      spawnRole(room, "harvester", emergencyBody);
    }

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
