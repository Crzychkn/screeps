const INTEL_MAX_AGE = 1500;
const MIN_STABLE_ROOMS = 2;
const MIN_WAR_RCL = 6;
const MIN_STORAGE_ENERGY = 100000;
const LOG_INTERVAL = 100;

function getWarMemory() {
  if (!Memory.war) {
    Memory.war = {};
  }

  return Memory.war;
}

function getRoomIntel(roomName) {
  if (!Memory.rooms || !Memory.rooms[roomName]) {
    return null;
  }

  return Memory.rooms[roomName].intel || null;
}

function hasHostileStructures(military) {
  return (
    military.towerCount > 0 ||
    military.spawnCount > 0 ||
    military.rampartCount > 0 ||
    military.wallCount > 0
  );
}

function getOwnedRooms() {
  return Object.values(Game.rooms).filter((room) => {
    return room.controller && room.controller.my;
  });
}

function getSpawnCount(room) {
  return room.find(FIND_MY_SPAWNS).length;
}

function getStorageEnergy(room) {
  if (!room.storage) {
    return 0;
  }

  return room.storage.store[RESOURCE_ENERGY];
}

function isStableWarRoom(room) {
  return (
    room.controller &&
    room.controller.my &&
    room.controller.level >= MIN_WAR_RCL &&
    getSpawnCount(room) > 0 &&
    getStorageEnergy(room) >= MIN_STORAGE_ENERGY
  );
}

function getStableWarRooms() {
  return getOwnedRooms().filter(isStableWarRoom);
}

function hasActiveBootstrapRoom() {
  return getOwnedRooms().some((room) => {
    return getSpawnCount(room) === 0;
  });
}

function makeOperation(targetRoom, mode, status, sourceRooms, requiredRoles, reason, targetType) {
  return {
    targetRoom: targetRoom,
    mode: mode,
    status: status,
    sourceRooms: sourceRooms,
    requiredRoles: requiredRoles,
    reason: reason,
    targetType: targetType,
    updated: Game.time,
  };
}

function getOperationSignature(operation) {
  if (!operation) {
    return "none";
  }

  return [
    operation.targetRoom,
    operation.mode,
    operation.status,
    operation.targetType,
    operation.reason,
    operation.sourceRooms.join(","),
    JSON.stringify(operation.requiredRoles),
  ].join("|");
}

function logOperation(war) {
  const operation = war.operation;

  if (!operation) {
    return;
  }

  const signature = getOperationSignature(operation);
  const changed = war.lastLogSignature !== signature;
  const staleLog =
    !war.lastLogTime || Game.time - war.lastLogTime >= LOG_INTERVAL;

  if (!changed && !staleLog) {
    return;
  }

  console.log(
    `War plan ${operation.targetRoom || "none"}: ${operation.status} ` +
    `(${operation.targetType}, ${operation.mode}) - ${operation.reason}`
  );

  war.lastLogSignature = signature;
  war.lastLogTime = Game.time;
}

function emptyRoles() {
  return {
    ranger: 0,
    healer: 0,
    dismantler: 0,
    claimer: 0,
  };
}

function classifyTarget(intel, mode) {
  if (!intel.controller.exists) {
    return {
      targetType: "invalid",
      requiredRoles: emptyRoles(),
      reason: "Target room has no controller.",
    };
  }

  if (intel.controller.my) {
    return {
      targetType: "owned",
      requiredRoles: emptyRoles(),
      reason: "Target room is already owned.",
    };
  }

  if (hasHostileStructures(intel.military) || intel.controller.owner) {
    return {
      targetType: "fortified",
      requiredRoles: {
        ranger: 2,
        healer: 2,
        dismantler: 2,
        claimer: mode === "claim" ? 1 : 0,
      },
      reason: "Target has hostile ownership or fortified structures.",
    };
  }

  if (intel.military.sourceKeeperCount > 0) {
    return {
      targetType: "source_keeper",
      requiredRoles: {
        ranger: Math.max(2, intel.military.sourceKeeperCount),
        healer: Math.max(1, Math.ceil(intel.military.sourceKeeperCount / 2)),
        dismantler: 0,
        claimer: 0,
      },
      reason: "Target has Source Keepers. Treat as SK clear/remote setup, not a simple claim.",
    };
  }

  if (intel.military.hostileCount > 0 || intel.military.invaderCount > 0) {
    return {
      targetType: "creep_hostile",
      requiredRoles: {
        ranger: Math.max(1, intel.military.hostileCount),
        healer: 0,
        dismantler: 0,
        claimer: mode === "claim" ? 1 : 0,
      },
      reason: "Target has hostile creeps but no fortified structures.",
    };
  }

  if (intel.claimableNow) {
    return {
      targetType: "claimable",
      requiredRoles: {
        ranger: 0,
        healer: 0,
        dismantler: 0,
        claimer: mode === "claim" ? 1 : 0,
      },
      reason: "Target appears claimable now.",
    };
  }

  return {
    targetType: "unknown",
    requiredRoles: emptyRoles(),
    reason: "Target intel does not match a supported war plan.",
  };
}

function getReadinessBlock(stableRooms) {
  if (stableRooms.length < MIN_STABLE_ROOMS) {
    return `Need at least ${MIN_STABLE_ROOMS} stable RCL ${MIN_WAR_RCL}+ rooms with ${MIN_STORAGE_ENERGY} energy in storage.`;
  }

  if (hasActiveBootstrapRoom()) {
    return "A claimed room is still bootstrapping without a spawn.";
  }

  return null;
}

module.exports = {
  run: function () {
    const war = getWarMemory();

    if (!war.enabled) {
      delete war.operation;
      return;
    }

    if (!war.targetRoom) {
      war.operation = makeOperation(
        null,
        war.mode || "clear",
        "blocked",
        [],
        emptyRoles(),
        "No Memory.war.targetRoom configured.",
        "none"
      );
      logOperation(war);
      return;
    }

    const mode = war.mode || "clear";
    const stableRooms = getStableWarRooms();
    const sourceRooms = stableRooms.map((room) => room.name);
    const readinessBlock = getReadinessBlock(stableRooms);

    if (readinessBlock) {
      war.operation = makeOperation(
        war.targetRoom,
        mode,
        "blocked",
        sourceRooms,
        emptyRoles(),
        readinessBlock,
        "unknown"
      );
      logOperation(war);
      return;
    }

    const intel = getRoomIntel(war.targetRoom);

    if (!intel) {
      war.operation = makeOperation(
        war.targetRoom,
        mode,
        "needs_intel",
        sourceRooms,
        emptyRoles(),
        "No intel recorded for target room.",
        "unknown"
      );
      logOperation(war);
      return;
    }

    if (Game.time - intel.lastScouted > INTEL_MAX_AGE) {
      war.operation = makeOperation(
        war.targetRoom,
        mode,
        "needs_intel",
        sourceRooms,
        emptyRoles(),
        "Target intel is stale.",
        "unknown"
      );
      logOperation(war);
      return;
    }

    const target = classifyTarget(intel, mode);
    const readyTypes = {
      claimable: true,
      creep_hostile: true,
      source_keeper: true,
    };

    war.operation = makeOperation(
      war.targetRoom,
      mode,
      readyTypes[target.targetType] ? "ready" : "planning",
      sourceRooms,
      target.requiredRoles,
      target.reason,
      target.targetType
    );
    logOperation(war);
  },
};
