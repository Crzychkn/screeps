const signConfig = require("config.sign");
const utils = require("utils");

const CLAIMER_EVENT_LOG_INTERVAL = 100;

function setStatus(creep, status) {
  creep.memory.lastStatus = status;
  creep.memory.lastStatusTick = Game.time;
}

function logClaimerEvent(creep, message) {
  if (
    creep.memory.lastClaimerEventLog &&
    Game.time - creep.memory.lastClaimerEventLog < CLAIMER_EVENT_LOG_INTERVAL
  ) {
    return;
  }

  creep.memory.lastClaimerEventLog = Game.time;
  console.log(
    `${creep.name} ${message} ` +
    `(room=${creep.room.name}, target=${creep.memory.targetRoom || "none"})`
  );
}

function moveToTargetRoom(creep) {
  if (utils.moveOffRoomEdge(creep)) {
    setStatus(creep, "leaving_edge");
    return;
  }

  const result = utils.moveToRoom(creep, creep.memory.targetRoom, "#ffffff");

  if (result === ERR_NO_PATH) {
    setStatus(creep, "no_route");
    logClaimerEvent(creep, "has no safe route");
    return;
  }

  setStatus(creep, "traveling");
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

  logClaimerEvent(creep, `blocked expansion target: ${reason}`);

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
    setStatus(creep, "moving_to_sign");
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
    setStatus(creep, "moving_to_clear_reservation");
    creep.moveTo(controller, {
      visualizePathStyle: {
        stroke: "#ffffff",
      },
    });
    return true;
  }

  if (result === OK) {
    creep.say("clear");
    setStatus(creep, "clearing_reservation");
    logClaimerEvent(creep, "cleared foreign reservation");
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
      setStatus(creep, "no_target");
      return;
    }

    if (creep.room.name !== creep.memory.targetRoom) {
      if (!isActiveExpansionTarget(creep)) {
        creep.say("stand down");
        setStatus(creep, "stand_down_in_transit");
        logClaimerEvent(creep, "standing down in transit");
        creep.suicide();
        return;
      }

      moveToTargetRoom(creep);
      return;
    }

    const controller = creep.room.controller;

    if (!controller) {
      creep.say("no ctrl");
      setStatus(creep, "no_controller");
      blockExpansionTarget(creep, "no_controller");
      return;
    }

    if (controller.my) {
      if (signControllerIfNeeded(creep, controller)) {
        creep.say("sign");
        return;
      }

      creep.say("claimed");
      setStatus(creep, "claimed");
      logClaimerEvent(creep, "confirmed owned controller");
      return;
    }

    if (!isActiveExpansionTarget(creep)) {
      creep.say("stand down");
      setStatus(creep, "stand_down_at_target");
      logClaimerEvent(creep, "standing down at target");
      creep.suicide();
      return;
    }

    if (controller.owner && controller.owner.username !== creep.owner.username) {
      creep.say("owned");
      setStatus(creep, "owned_by_other");
      blockExpansionTarget(creep, `owned_by_${controller.owner.username}`);
      return;
    }

    const hostiles = findBlockingHostiles(creep.room);

    if (hostiles.length > 0) {
      creep.say("hostile");
      setStatus(creep, "hostiles_at_target");
      blockExpansionTarget(creep, "hostiles");
      return;
    }

    if (clearForeignReservation(creep, controller)) {
      return;
    }

    const result = creep.claimController(controller);

    if (result === ERR_NOT_IN_RANGE) {
      setStatus(creep, "moving_to_controller");
      creep.moveTo(controller, {
        visualizePathStyle: {
          stroke: "#ffffff",
        },
      });
      return;
    }

    if (result !== OK) {
      creep.say("claim " + result);
      setStatus(creep, "claim_failed_" + result);
      console.log(
        `${creep.name} failed to claim ${creep.room.name}: ${result}`
      );
      return;
    }

    creep.say("claim");
    setStatus(creep, "claim_success");
    logClaimerEvent(creep, "claimed controller");
  },
};
