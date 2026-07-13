const utils = require("utils");

function moveToTargetRoom(creep) {
  utils.moveToRoom(creep, creep.memory.targetRoom, "#ff0000");
}

function getAttackTarget(creep) {
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length > 0) {
    return creep.pos.findClosestByRange(hostiles) || hostiles[0];
  }

  return null;
}

function healSelf(creep) {
  if (creep.getActiveBodyparts(HEAL) > 0 && creep.hits < creep.hitsMax) {
    creep.heal(creep);
  }
}

function fightAtRange(creep, target) {
  const range = creep.pos.getRangeTo(target);

  if (range <= 3) {
    creep.rangedAttack(target);
  }

  if (range < 3) {
    const path = PathFinder.search(creep.pos, {
      pos: target.pos,
      range: 3,
    }, {
      flee: true,
      maxRooms: 1,
    }).path;

    if (path.length > 0) {
      creep.move(creep.pos.getDirectionTo(path[0]));
    }

    return;
  }

  if (range > 3) {
    creep.moveTo(target, {
      range: 3,
      maxRooms: 1,
      reusePath: 3,
      visualizePathStyle: {
        stroke: "#ff0000",
      },
    });
  }
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

      healSelf(creep);

      if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
        fightAtRange(creep, target);
        return;
      }

      if (creep.attack(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {
          maxRooms: 1,
          reusePath: 3,
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
