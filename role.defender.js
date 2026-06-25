const utils = require("utils");

function moveToTargetRoom(creep) {
  utils.moveToRoom(creep, creep.memory.targetRoom, "#ff0000");
}

function getAttackTarget(creep) {
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length > 0) {
    return creep.pos.findClosestByPath(hostiles) || hostiles[0];
  }

  return null;
}

module.exports = {
  run: function (creep) {
    try {
      if (creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
        moveToTargetRoom(creep);
        return;
      }

      const target = getAttackTarget(creep);

      if (!target) {
        return;
      }

      if (creep.attack(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {
          visualizePathStyle: {
            stroke: "#ff0000",
          },
        });
      }
    } catch (error) {
      console.error(error);
    }
  },
};
