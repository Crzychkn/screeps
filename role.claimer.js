function moveToTargetRoom(creep) {
  creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom), {
    visualizePathStyle: {
      stroke: "#ffffff",
    },
  });
}

module.exports = {
  run: function (creep) {
    if (!creep.memory.targetRoom) {
      creep.say("no target");
      return;
    }

    if (creep.room.name !== creep.memory.targetRoom) {
      moveToTargetRoom(creep);
      return;
    }

    const controller = creep.room.controller;

    if (!controller) {
      creep.say("no ctrl");
      return;
    }

    if (controller.my) {
      creep.say("claimed");
      return;
    }

    if (controller.owner && controller.owner.username !== creep.owner.username) {
      creep.say("owned");
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
