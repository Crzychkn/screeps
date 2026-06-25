const utils = require("utils");

function setStatus(creep, status) {
  creep.memory.lastStatus = status;
  creep.memory.lastStatusTick = Game.time;
}

function moveToTargetRoom(creep) {
  if (utils.moveOffRoomEdge(creep)) {
    setStatus(creep, "leaving_edge");
    return;
  }

  const result = utils.moveToRoom(creep, creep.memory.targetRoom, "#ffffff");

  if (result === ERR_NO_PATH) {
    setStatus(creep, "no_route");
    return;
  }

  setStatus(creep, "traveling");
}

module.exports = {
  run: function (creep) {
    if (!creep.memory.targetRoom) {
      creep.say("no target");
      setStatus(creep, "no_target");
      return;
    }

    if (creep.room.name !== creep.memory.targetRoom) {
      moveToTargetRoom(creep);
      return;
    }

    if (utils.moveOffRoomEdge(creep)) {
      setStatus(creep, "target_edge");
      return;
    }

    setStatus(creep, "scouting");
    creep.say("scout");
  },
};
