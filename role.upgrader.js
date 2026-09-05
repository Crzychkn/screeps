const utils = require("utils");

const STARVED_ENERGY_THRESHOLD = 25000;
const RECOVERY_DOWNGRADE_BUFFER = 3000;
const RCL8_RECOVERY_DOWNGRADE_BUFFER = 15000;

function isSourceContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  return container.pos.findInRange(FIND_SOURCES, 1).length > 0;
}

function isControllerContainer(container) {
  if (container.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  if (!container.room.controller) {
    return false;
  }

  return container.pos.getRangeTo(container.room.controller) <= 3;
}

function getCentralStoredEnergy(room) {
  let total = room.energyAvailable;

  if (room.storage) {
    total += room.storage.store[RESOURCE_ENERGY];
  }

  if (room.terminal) {
    total += room.terminal.store[RESOURCE_ENERGY];
  }

  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        !isSourceContainer(structure) &&
        !isControllerContainer(structure)
      );
    },
  });

  for (const container of containers) {
    total += container.store[RESOURCE_ENERGY];
  }

  return total;
}

function shouldPauseUpgrading(room) {
  if (!room.controller || !room.controller.my) {
    return false;
  }

  const threshold = Math.max(
    STARVED_ENERGY_THRESHOLD,
    room.energyCapacityAvailable * 5
  );
  const downgradeBuffer = room.controller.level >= 8
    ? RCL8_RECOVERY_DOWNGRADE_BUFFER
    : RECOVERY_DOWNGRADE_BUFFER;

  return (
    getCentralStoredEnergy(room) < threshold &&
    room.controller.ticksToDowngrade > downgradeBuffer
  );
}

function setWorkingState(creep) {
  if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
    creep.memory.upgrading = false;
  }

  if (!creep.memory.upgrading && creep.store[RESOURCE_ENERGY] > 0) {
    creep.memory.upgrading = true;
  }
}

function moveToHomeRoom(creep, homeRoom) {
  utils.moveToRoom(creep, homeRoom.name, "#ffffff");
}

function upgradeController(creep, room) {
  if (!room.controller || !room.controller.my) {
    return;
  }

  const result = creep.upgradeController(room.controller);

  if (result === OK) {
    creep.memory.lastStatus = "upgrading";
    return;
  }

  if (result === ERR_NOT_IN_RANGE) {
    const target = getUpgradeTarget(creep, room);

    creep.moveTo(target, {
      range: 3,
      maxRooms: 1,
      reusePath: 10,
      ignoreCreeps: true,
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
    creep.memory.lastStatus = "moving_to_controller";
    return;
  }

  if (result === ERR_FULL) {
    creep.memory.lastStatus = "controller_upgrade_capped";
    return;
  }

  if (result !== ERR_BUSY) {
    creep.memory.lastStatus = "upgrade_error_" + result;
    console.log(`${creep.name} failed to upgrade in ${room.name}: ${result}`);
  }
}

function getUpgradeTarget(creep, room) {
  if (
    creep.memory.upgradeTarget &&
    creep.memory.upgradeTarget.roomName === room.name
  ) {
    return new RoomPosition(
      creep.memory.upgradeTarget.x,
      creep.memory.upgradeTarget.y,
      room.name
    );
  }

  const target = room.controller.pos;

  creep.memory.upgradeTarget = {
    x: target.x,
    y: target.y,
    roomName: room.name,
  };

  return target;
}

module.exports = {
  run: function (creep) {
    const homeRoom = utils.getHomeRoom(creep);

    if (!creep.memory.homeRoom) {
      creep.memory.homeRoom = homeRoom.name;
    }

    setWorkingState(creep);

    if (creep.room.name !== homeRoom.name) {
      moveToHomeRoom(creep, homeRoom);
      return;
    }

    if (utils.moveOffRoomEdge(creep)) {
      return;
    }

    if (shouldPauseUpgrading(homeRoom)) {
      creep.memory.upgrading = false;
      creep.memory.lastStatus = "paused_energy_recovery";
      utils.returnEnergyForRecovery(creep, homeRoom);
      return;
    }

    if (creep.memory.upgrading) {
      upgradeController(creep, homeRoom);
      return;
    }

    utils.getEnergy(creep);
  },
};
