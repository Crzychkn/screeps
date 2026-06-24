const INTEL_MAX_AGE = 1500;

function getMilitaryMemory() {
  if (!Memory.military) {
    Memory.military = {};
  }

  return Memory.military;
}

function getRoomIntel(roomName) {
  if (!Memory.rooms || !Memory.rooms[roomName]) {
    return null;
  }

  return Memory.rooms[roomName].intel || null;
}

function makeOperation(targetRoom, type, status, requiredRoles, notes) {
  return {
    targetRoom: targetRoom,
    type: type,
    status: status,
    requiredRoles: requiredRoles,
    notes: notes,
    updated: Game.time,
  };
}

function hasHostileStructures(military) {
  return (
    military.towerCount > 0 ||
    military.spawnCount > 0 ||
    military.rampartCount > 0 ||
    military.wallCount > 0
  );
}

function classifyOperation(targetRoom, intel) {
  if (!intel) {
    return makeOperation(
      targetRoom,
      "unknown",
      "needs_intel",
      {},
      ["No intel recorded for target room."]
    );
  }

  if (Game.time - intel.lastScouted > INTEL_MAX_AGE) {
    return makeOperation(
      targetRoom,
      "unknown",
      "needs_intel",
      {},
      ["Intel is stale."]
    );
  }

  if (!intel.controller.exists) {
    return makeOperation(
      targetRoom,
      "invalid",
      "unsafe",
      {},
      ["Target room has no controller."]
    );
  }

  if (intel.controller.my) {
    return makeOperation(
      targetRoom,
      "owned",
      "complete",
      {},
      ["Target room is already owned."]
    );
  }

  const military = intel.military;

  if (hasHostileStructures(military) || intel.controller.owner) {
    return makeOperation(
      targetRoom,
      "owned_assault",
      "planning",
      {
        attacker: 0,
        rangedAttacker: 0,
        healer: 0,
        dismantler: 0,
      },
      ["Fortified or player-owned room. Needs a dedicated assault plan."]
    );
  }

  if (military.sourceKeeperCount > 0) {
    return makeOperation(
      targetRoom,
      "source_keeper_clear",
      "planning",
      {
        attacker: 0,
        rangedAttacker: Math.max(2, military.sourceKeeperCount),
        healer: Math.max(1, Math.ceil(military.sourceKeeperCount / 2)),
        dismantler: 0,
      },
      ["Source keeper room. Prefer ranged attackers with healing support."]
    );
  }

  if (military.hostileCount > 0 || military.invaderCount > 0) {
    return makeOperation(
      targetRoom,
      "invader_clear",
      "ready",
      {
        attacker: Math.max(1, military.hostileCount),
        rangedAttacker: 0,
        healer: 0,
        dismantler: 0,
      },
      ["Creep-only hostile room. Basic attackers should be enough."]
    );
  }

  if (intel.claimableNow) {
    return makeOperation(
      targetRoom,
      "claim",
      "ready",
      {
        claimer: 1,
      },
      ["Room appears claimable now."]
    );
  }

  return makeOperation(
    targetRoom,
    "unknown",
    "planning",
    {},
    ["Intel does not match a known operation type."]
  );
}

module.exports = {
  run: function () {
    const military = getMilitaryMemory();

    if (!military.attackTarget) {
      delete military.operation;
      return;
    }

    military.operation = classifyOperation(
      military.attackTarget,
      getRoomIntel(military.attackTarget)
    );
  },
};
