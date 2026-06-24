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
  creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom), {
    visualizePathStyle: {
      stroke: "#ffffff",
    },
  });
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

function collectEnergy(creep, room) {
  const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY,
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
        structure.store[RESOURCE_ENERGY] > 0
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
    creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE) ||
    creep.pos.findClosestByPath(FIND_SOURCES);

  if (!source) {
    creep.say("no energy");
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

module.exports = {
  run: function (creep) {
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
      moveToTargetRoom(creep);
      return;
    }

    if (utils.moveOffRoomEdge(creep)) {
      return;
    }

    if (creep.memory.working) {
      work(creep, targetRoom);
      return;
    }

    collectEnergy(creep, targetRoom);
  },
};
