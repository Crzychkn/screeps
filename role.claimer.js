const signConfig = require("config.sign");
const utils = require("utils");

function moveToTargetRoom(creep) {
  utils.moveToRoom(creep, creep.memory.targetRoom, "#ffffff");
}

function blockExpansionTarget(creep, reason) {
  if (!Memory.expansion) {
    Memory.expansion = {};
  }

  if (!Memory.expansion.blockedRooms) {
    Memory.expansion.blockedRooms = {};
  }

  Memory.expansion.blockedRooms[creep.memory.targetRoom] = {
    reason: reason,
    time: Game.time,
  };

  if (Memory.expansion.targetRoom === creep.memory.targetRoom) {
    delete Memory.expansion.targetRoom;
    delete Memory.expansion.sourceRoom;
  }
}

function isActiveExpansionTarget(creep) {
  return (
    Memory.expansion &&
    Memory.expansion.targetRoom === creep.memory.targetRoom
  );
}

function getSignText() {
  if (
    (Memory.sign && Memory.sign.signNewRooms === false) ||
    (!Memory.sign && signConfig.signNewRooms === false)
  ) {
    return null;
  }

  return (Memory.sign && Memory.sign.text) || signConfig.text;
}

function signControllerIfNeeded(creep, controller) {
  const signText = getSignText();

  if (!signText) {
    return false;
  }

  if (
    controller.sign &&
    controller.sign.username === creep.owner.username &&
    controller.sign.text === signText
  ) {
    return false;
  }

  const result = creep.signController(controller, signText);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, {
      range: 1,
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
    return true;
  }

  return result === OK;
}

function isSourceKeeper(creep) {
  return creep.owner && creep.owner.username === "Source Keeper";
}

function findBlockingHostiles(room) {
  return room.find(FIND_HOSTILE_CREEPS, {
    filter: (creep) => !isSourceKeeper(creep),
  });
}

function clearForeignReservation(creep, controller) {
  if (
    !controller.reservation ||
    controller.reservation.username === creep.owner.username
  ) {
    return false;
  }

  const result = creep.attackController(controller);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, {
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
    return true;
  }

  if (result === OK) {
    creep.say("clear");
    return true;
  }

  console.log(
    `${creep.name} failed to clear reservation in ${creep.room.name}: ${result}`
  );
  return false;
}

module.exports = {
  run: function (creep) {
    if (!creep.memory.targetRoom) {
      creep.say("no target");
      return;
    }

    if (creep.room.name !== creep.memory.targetRoom) {
      if (!isActiveExpansionTarget(creep)) {
        creep.say("stand down");
        creep.suicide();
        return;
      }

      moveToTargetRoom(creep);
      return;
    }

    const controller = creep.room.controller;

    if (!controller) {
      creep.say("no ctrl");
      blockExpansionTarget(creep, "no_controller");
      return;
    }

    if (controller.my) {
      if (signControllerIfNeeded(creep, controller)) {
        creep.say("sign");
        return;
      }

      creep.say("claimed");
      return;
    }

    if (!isActiveExpansionTarget(creep)) {
      creep.say("stand down");
      creep.suicide();
      return;
    }

    if (controller.owner && controller.owner.username !== creep.owner.username) {
      creep.say("owned");
      blockExpansionTarget(creep, `owned_by_${controller.owner.username}`);
      return;
    }

    const hostiles = findBlockingHostiles(creep.room);

    if (hostiles.length > 0) {
      creep.say("hostile");
      blockExpansionTarget(creep, "hostiles");
      return;
    }

    if (clearForeignReservation(creep, controller)) {
      return;
    }

    const result = creep.claimController(controller);

    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, {
        visualizePathStyle: {
          stroke: "#ffffff",
        },
      });
      return;
    }

    if (result !== OK) {
      creep.say("claim " + result);
      console.log(
        `${creep.name} failed to claim ${creep.room.name}: ${result}`
      );
    }
  },
};
