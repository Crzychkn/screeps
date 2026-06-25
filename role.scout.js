const utils = require("utils");

function moveToTargetRoom(creep) {
  utils.moveToRoom(creep, creep.memory.targetRoom, "#ffffff");
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

    creep.say("scout");
  },
};
