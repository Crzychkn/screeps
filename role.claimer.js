function moveToTargetRoom(creep) {
  creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom), {
    visualizePathStyle: {
      stroke: "#ffffff",
    },
  });
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

module.exports = {
  run: function (creep) {
    if (!creep.memory.targetRoom) {
      creep.say("no target");
      return;
    }

    if (!isActiveExpansionTarget(creep)) {
      creep.say("stand down");
      creep.suicide();
      return;
    }

    if (creep.room.name !== creep.memory.targetRoom) {
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
      creep.say("claimed");
      return;
    }

    if (controller.owner && controller.owner.username !== creep.owner.username) {
      creep.say("owned");
      blockExpansionTarget(creep, `owned_by_${controller.owner.username}`);
      return;
    }

    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

    if (hostiles.length > 0) {
      creep.say("hostile");
      blockExpansionTarget(creep, "hostiles");
      return;
    }

    const result = creep.claimController(controller);

    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, {
        visualizePathStyle: {
          stroke: "#ffffff",
        },
      });
    }
  },
};
