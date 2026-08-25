const utils = require("utils");

const DANGEROUS_SCOUT_TTL = 50000;

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

function getExpansionMemory() {
  if (!Memory.expansion) {
    Memory.expansion = {};
  }

  if (!Memory.expansion.blockedRooms) {
    Memory.expansion.blockedRooms = {};
  }

  if (!Memory.expansion.scoutTargets) {
    Memory.expansion.scoutTargets = {};
  }

  return Memory.expansion;
}

function isSourceKeeper(creep) {
  return creep.owner && creep.owner.username === "Source Keeper";
}

function findDangerousHostiles(room) {
  return utils.findHostileUnits(room).filter((hostile) => {
    return !isSourceKeeper(hostile);
  });
}

function blockScoutTarget(creep, reason) {
  const expansion = getExpansionMemory();
  const targetRoom = creep.memory.targetRoom || creep.room.name;

  expansion.blockedRooms[targetRoom] = {
    reason: reason,
    time: Game.time,
    ttl: DANGEROUS_SCOUT_TTL,
  };

  if (expansion.scoutTargets[targetRoom]) {
    delete expansion.scoutTargets[targetRoom];
  }

  if (expansion.targetRoom === targetRoom) {
    delete expansion.targetRoom;
    delete expansion.sourceRoom;
  }
}

module.exports = {
  run: function (creep) {
    if (!creep.memory.targetRoom) {
      creep.say("no target");
      setStatus(creep, "no_target");
      return;
    }

    creep.notifyWhenAttacked(false);

    if (creep.room.name !== creep.memory.targetRoom) {
      moveToTargetRoom(creep);
      return;
    }

    if (utils.moveOffRoomEdge(creep)) {
      setStatus(creep, "target_edge");
      return;
    }

    const hostiles = findDangerousHostiles(creep.room);

    if (hostiles.length > 0) {
      blockScoutTarget(creep, "scout_attacked_or_hostile");
      setStatus(creep, "hostile_room");
      creep.say("danger");
      creep.suicide();
      return;
    }

    setStatus(creep, "scouting");
    creep.say("scout");
  },
};
