const utils = require("utils");

const CONTROLLER_DANGER_TICKS = 3000;
const CONTROLLER_SAFE_TICKS = 5000;

function moveToTarget(creep, target, stroke) {
  creep.moveTo(target, {
    visualizePathStyle: {
      stroke: stroke,
    },
  });
}

function getTargetRoom(creep) {
  if (!creep.memory.targetRoom) {
    return null;
  }

  return Game.rooms[creep.memory.targetRoom];
}

function moveToTargetRoom(creep) {
  utils.moveToRoom(creep, creep.memory.targetRoom, "#ffffff");
}

function withdrawFromStructure(creep, structure) {
  const result = creep.withdraw(structure, RESOURCE_ENERGY);

  if (result === OK) {
    return true;
  }

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, structure, "#ffaa00");
    return true;
  }

  return false;
}

function isNearHostile(position, range) {
  const hostiles = position.findInRange(FIND_HOSTILE_CREEPS, range);

  return hostiles.length > 0;
}

function collectEnergy(creep, room) {
  const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
    filter: (resource) => {
      return (
        resource.resourceType === RESOURCE_ENERGY &&
        !isNearHostile(resource.pos, 5)
      );
    },
  });

  if (droppedEnergy) {
    const result = creep.pickup(droppedEnergy);

    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, droppedEnergy, "#ffaa00");
    }

    return;
  }

  const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store[RESOURCE_ENERGY] > 0 &&
        !isNearHostile(structure.pos, 5)
      );
    },
  });

  if (container && withdrawFromStructure(creep, container)) {
    return;
  }

  if (room.storage && room.storage.store[RESOURCE_ENERGY] > 0) {
    if (withdrawFromStructure(creep, room.storage)) {
      return;
    }
  }

  const source =
    creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE, {
      filter: (target) => !isNearHostile(target.pos, 5),
    }) ||
    creep.pos.findClosestByPath(FIND_SOURCES, {
      filter: (target) => !isNearHostile(target.pos, 5),
    });

  if (!source) {
    creep.say("unsafe energy");
    return;
  }

  const result = creep.harvest(source);

  if (result === ERR_NOT_IN_RANGE) {
    moveToTarget(creep, source, "#ffaa00");
  }
}

function findBuildTarget(room) {
  const spawnSite = room.find(FIND_MY_CONSTRUCTION_SITES, {
    filter: (site) => site.structureType === STRUCTURE_SPAWN,
  })[0];

  if (spawnSite) {
    return spawnSite;
  }

  const sites = room.find(FIND_MY_CONSTRUCTION_SITES);

  return sites[0];
}

function upgradeController(creep, room) {
  if (!room.controller || !room.controller.my) {
    return false;
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

  return true;
}

function updateControllerSafetyMode(creep, room) {
  if (!room.controller || !room.controller.my) {
    return;
  }

  if (room.controller.ticksToDowngrade < CONTROLLER_DANGER_TICKS) {
    creep.memory.savingController = true;
  }

  if (room.controller.ticksToDowngrade > CONTROLLER_SAFE_TICKS) {
    creep.memory.savingController = false;
  }
}

function work(creep, room) {
  updateControllerSafetyMode(creep, room);

  if (creep.memory.savingController) {
    creep.say("save ctrl");
    upgradeController(creep, room);
    return;
  }

  const buildTarget = findBuildTarget(room);

  if (buildTarget) {
    const result = creep.build(buildTarget);

    if (result === ERR_NOT_IN_RANGE) {
      moveToTarget(creep, buildTarget, "#ffffff");
    }

    return;
  }

  upgradeController(creep, room);
}

function isMoveOnly(creep) {
  return (
    creep.getActiveBodyparts(MOVE) > 0 &&
    creep.getActiveBodyparts(WORK) === 0 &&
    creep.getActiveBodyparts(CARRY) === 0
  );
}

function rememberPioneerStatus(creep, status) {
  creep.memory.lastStatus = status;
  creep.memory.lastStatusTick = Game.time;
}

module.exports = {
  run: function (creep) {
    if (isMoveOnly(creep)) {
      rememberPioneerStatus(creep, "retiring_move_only");
      console.log(
        `${creep.name} retiring as move-only pioneer in ${creep.room.name} ` +
        `target=${creep.memory.targetRoom || "none"} ttl=${creep.ticksToLive}`
      );
      creep.say("retire");
      creep.suicide();
      return;
    }

    if (!creep.memory.targetRoom) {
      creep.say("no target");
      return;
    }

    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (
      !creep.memory.working &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      creep.memory.working = true;
    }

    const targetRoom = getTargetRoom(creep);

    if (!targetRoom || creep.room.name !== creep.memory.targetRoom) {
      rememberPioneerStatus(creep, "traveling");
      moveToTargetRoom(creep);
      return;
    }

    if (utils.moveOffRoomEdge(creep)) {
      rememberPioneerStatus(creep, "moving_off_edge");
      return;
    }

    if (creep.memory.working) {
      rememberPioneerStatus(creep, "working");
      work(creep, targetRoom);
      return;
    }

    rememberPioneerStatus(creep, "collecting_energy");
    collectEnergy(creep, targetRoom);
  },
};
