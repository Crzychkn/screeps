const utils = require("utils");

function moveToTargetRoom(creep) {
  creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom), {
    visualizePathStyle: {
      stroke: "#ff0000",
    },
  });
}

function getClosestHostile(creep) {
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

  if (hostiles.length === 0) {
    return null;
  }

  return creep.pos.findClosestByRange(hostiles) || hostiles[0];
}

function heal(creep) {
  if (creep.getActiveBodyparts(HEAL) === 0) {
    return false;
  }

  if (creep.hits < creep.hitsMax) {
    creep.heal(creep);
    return true;
  }

  const wounded = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: (target) => {
      return target.hits < target.hitsMax && target.room.name === creep.room.name;
    },
  });

  if (!wounded) {
    return false;
  }

  if (creep.heal(wounded) === ERR_NOT_IN_RANGE) {
    creep.rangedHeal(wounded);
  }

  return true;
}

function fight(creep, hostile) {
  if (!hostile) {
    return false;
  }

  const range = creep.pos.getRangeTo(hostile);

  if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
    if (range <= 3) {
      creep.rangedAttack(hostile);
    }

    if (range <= 2) {
      const fleePath = PathFinder.search(creep.pos, {
        pos: hostile.pos,
        range: 4,
      }, {
        flee: true,
        maxRooms: 1,
      });

      if (fleePath.path.length > 0) {
        creep.move(creep.pos.getDirectionTo(fleePath.path[0]));
      }

      return true;
    }

    creep.moveTo(hostile, {
      range: 3,
      visualizePathStyle: {
        stroke: "#ff0000",
      },
    });
    return true;
  }

  if (creep.getActiveBodyparts(ATTACK) > 0) {
    if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
      creep.moveTo(hostile, {
        visualizePathStyle: {
          stroke: "#ff0000",
        },
      });
    }

    return true;
  }

  return false;
}

function holdNearController(creep) {
  const controller = creep.room.controller;

  if (!controller) {
    return;
  }

  if (creep.pos.getRangeTo(controller) > 4) {
    creep.moveTo(controller, {
      range: 3,
      visualizePathStyle: {
        stroke: "#ff0000",
      },
    });
  }
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

    if (utils.moveOffRoomEdge(creep)) {
      return;
    }

    heal(creep);

    const hostile = getClosestHostile(creep);

    if (fight(creep, hostile)) {
      return;
    }

    holdNearController(creep);
  },
};
