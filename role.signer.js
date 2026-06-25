const signConfig = require("config.sign");
const utils = require("utils");

function getSignText() {
  return (Memory.sign && Memory.sign.text) || signConfig.text;
}

function moveToTargetRoom(creep) {
  utils.moveToRoom(creep, creep.memory.targetRoom, "#ffffff");
}

module.exports = {
  run: function (creep) {
    const signText = getSignText();

    if (!signText) {
      creep.say("no sign");
      creep.suicide();
      return;
    }

    if (!creep.memory.targetRoom) {
      creep.memory.targetRoom = creep.memory.homeRoom;
    }

    if (creep.room.name !== creep.memory.targetRoom) {
      moveToTargetRoom(creep);
      return;
    }

    const controller = creep.room.controller;

    if (!controller || !controller.my) {
      creep.say("no ctrl");
      creep.suicide();
      return;
    }

    if (
      controller.sign &&
      controller.sign.username === creep.owner.username &&
      controller.sign.text === signText
    ) {
      creep.say("signed");
      creep.suicide();
      return;
    }

    const result = creep.signController(controller, signText);

    if (result === OK) {
      creep.say("signed");
      creep.suicide();
      return;
    }

    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, {
        range: 1,
        visualizePathStyle: {
          stroke: "#ffffff",
        },
      });
    }
  },
};
