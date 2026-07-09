const roleHarvester = require("role.harvester");
const roleUpgrader = require("role.upgrader");
const roleBuilder = require("role.builder");
const roleRepairer = require("role.repairer");
const roleTractor = require("role.tractor");
const roleScout = require("role.scout");
const roleStim = require("role.stim");
const roleDefender = require("role.defender");
const rolePioneer = require("role.pioneer");
const roleClaimer = require("role.claimer");
const roleSigner = require("role.signer");
const roleBootstrapEscort = require("role.bootstrapEscort");
const roleSupplier = require("role.supplier");

const roomManager = require("manager.room");
const intelManager = require("manager.intel");
const militaryManager = require("manager.military");
const warManager = require("manager.war");

const CPU_LOG_INTERVAL = 100;
const ROLE_CPU_PROFILE_INTERVAL = 100;
const CREEP_STATE_INTERVAL = 25;
const DEAD_MEMORY_CLEANUP_INTERVAL = 25;
const MAIN_LOG_INTERVAL = 100;
const LOW_BUCKET_LIMIT = 3000;
const CRITICAL_BUCKET_LIMIT = 1000;
const INTEL_MANAGER_INTERVAL = 5;
const PLANNING_MANAGER_INTERVAL = 10;
const OPTIONAL_CREEP_CPU_LIMIT = 18;
const OPTIONAL_CREEP_CPU_BUCKET_LIMIT = 5000;
const HARD_CPU_STOP = 19;
const SLOW_CREEP_CPU = 2;
const SLOW_CREEP_LOG_INTERVAL = 100;

const CRITICAL_CREEP_ROLES = {
  harvester: true,
  tractor: true,
  defender: true,
  bootstrapEscort: true,
  stim: true,
  claimer: true,
  pioneer: true,
};

const LOW_BUCKET_ROLE_INTERVALS = {
  upgrader: 2,
  builder: 2,
  repairer: 3,
  supplier: 2,
  scout: 5,
  signer: 10,
};

const CRITICAL_BUCKET_ROLE_INTERVALS = {
  upgrader: 5,
  builder: 5,
  repairer: 10,
  supplier: 4,
  scout: 10,
  signer: 20,
  pioneer: 2,
};

const roles = {
  harvester: roleHarvester,
  upgrader: roleUpgrader,
  builder: roleBuilder,
  repairer: roleRepairer,
  tractor: roleTractor,
  scout: roleScout,
  stim: roleStim,
  defender: roleDefender,
  pioneer: rolePioneer,
  claimer: roleClaimer,
  signer: roleSigner,
  bootstrapEscort: roleBootstrapEscort,
  supplier: roleSupplier,
};

function getCpuProfileMemory() {
  if (!Memory.cpuProfile) {
    Memory.cpuProfile = {
      started: Game.time,
      roles: {},
    };
  }

  if (!Memory.cpuProfile.roles) {
    Memory.cpuProfile.roles = {};
  }

  return Memory.cpuProfile;
}

function recordRoleCpu(roleName, usedCpu) {
  const profile = getCpuProfileMemory();

  if (!profile.roles[roleName]) {
    profile.roles[roleName] = {
      cpu: 0,
      runs: 0,
    };
  }

  profile.roles[roleName].cpu += usedCpu;
  profile.roles[roleName].runs++;
}

function logRoleCpuProfile() {
  const profile = getCpuProfileMemory();

  if (Game.time - profile.started < ROLE_CPU_PROFILE_INTERVAL) {
    return;
  }

  const ticks = Math.max(Game.time - profile.started, 1);
  const entries = Object.keys(profile.roles).map((roleName) => {
    const roleProfile = profile.roles[roleName];

    return {
      roleName: roleName,
      cpu: roleProfile.cpu,
      runs: roleProfile.runs,
      average: roleProfile.runs > 0 ? roleProfile.cpu / roleProfile.runs : 0,
      perTick: roleProfile.cpu / ticks,
    };
  });

  entries.sort((a, b) => b.cpu - a.cpu);

  const summary = entries.slice(0, 8).map((entry) => {
    return (
      entry.roleName +
      " total:" + entry.cpu.toFixed(2) +
      " avg:" + entry.average.toFixed(3) +
      " run:" + entry.runs +
      " tick:" + entry.perTick.toFixed(3)
    );
  });

  console.log(
    `Role CPU over ${ticks} ticks - ${summary.join(" | ")}`
  );

  Memory.cpuProfile = {
    started: Game.time,
    roles: {},
  };
}

function cleanDeadCreepMemory() {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      const memory = Memory.creeps[name];
      const details = [
        `role=${memory.role || "unknown"}`,
        `home=${memory.homeRoom || "unknown"}`,
        `target=${memory.targetRoom || "none"}`,
        `lastRoom=${memory.lastRoom || "unknown"}`,
        `lastStatus=${memory.lastStatus || "unknown"}`,
        `ttl=${memory.lastTicksToLive || "unknown"}`,
      ];

      if (memory.lastActiveParts) {
        details.push(`parts=${JSON.stringify(memory.lastActiveParts)}`);
      }

      delete Memory.creeps[name];
      console.log(`Clearing non-existing creep memory: ${name} (${details.join(", ")})`);
    }
  }
}

function countActiveParts(creep) {
  const parts = {};

  for (const bodyPart of creep.body) {
    if (bodyPart.hits <= 0) {
      continue;
    }

    parts[bodyPart.type] = (parts[bodyPart.type] || 0) + 1;
  }

  return parts;
}

function rememberCreepState() {
  if (Game.time % CREEP_STATE_INTERVAL !== 0) {
    return;
  }

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    creep.memory.lastRoom = creep.room.name;
    creep.memory.lastTicksToLive = creep.ticksToLive;
    creep.memory.lastActiveParts = countActiveParts(creep);
  }
}

function getOwnedRooms() {
  return Object.values(Game.rooms).filter((room) => {
    return room.controller && room.controller.my;
  });
}

function logCpuStats() {
  if (Game.time % CPU_LOG_INTERVAL !== 0) {
    return;
  }

  console.log("CPU Bucket:", Game.cpu.bucket);
  console.log("CPU Tick Limit:", Game.cpu.tickLimit);
  console.log("CPU Unlocked Status:", Game.cpu.unlocked);
}

function getCreepCpuOffset(creep) {
  if (creep.memory.cpuOffset === undefined) {
    creep.memory.cpuOffset = Game.time % 20;
  }

  return creep.memory.cpuOffset;
}

function shouldRunStaggered(creep, interval) {
  return (Game.time + getCreepCpuOffset(creep)) % interval === 0;
}

function shouldRunCreep(creep) {
  const roleName = creep.memory.role;

  if (Game.cpu.bucket < CRITICAL_BUCKET_LIMIT) {
    const interval = CRITICAL_BUCKET_ROLE_INTERVALS[roleName];
    return !interval || shouldRunStaggered(creep, interval);
  }

  if (Game.cpu.bucket < LOW_BUCKET_LIMIT) {
    const interval = LOW_BUCKET_ROLE_INTERVALS[roleName];
    return !interval || shouldRunStaggered(creep, interval);
  }

  return true;
}

function shouldStopForCpu() {
  return Game.cpu.getUsed() > HARD_CPU_STOP;
}

function runCreep(creep) {
  const roleName = creep.memory.role;
  const role = roles[roleName];

  if (!role) {
    console.log(`${creep.name} has unknown role: ${roleName}`);
    return;
  }

  if (!shouldRunCreep(creep)) {
    return;
  }

  try {
    const before = Game.cpu.getUsed();

    role.run(creep);
    const usedCpu = Game.cpu.getUsed() - before;

    recordRoleCpu(roleName, usedCpu);

    if (
      usedCpu >= SLOW_CREEP_CPU &&
      (!creep.memory.lastSlowCpuLog ||
        Game.time - creep.memory.lastSlowCpuLog >= SLOW_CREEP_LOG_INTERVAL)
    ) {
      creep.memory.lastSlowCpuLog = Game.time;
      console.log(
        `Slow creep ${creep.name} role=${roleName} cpu=${usedCpu.toFixed(2)} ` +
        `room=${creep.room.name} home=${creep.memory.homeRoom || "unknown"} ` +
        `target=${creep.memory.targetRoom || "none"} status=${creep.memory.lastStatus || "unknown"}`
      );
    }
  } catch (error) {
    console.log(`Error running ${roleName} for ${creep.name}:`, error);
  }
}

function runCreeps() {
  const optionalCreeps = [];

  for (const name in Game.creeps) {
    if (shouldStopForCpu()) {
      return;
    }

    const creep = Game.creeps[name];

    if (CRITICAL_CREEP_ROLES[creep.memory.role]) {
      runCreep(creep);
      continue;
    }

    optionalCreeps.push(creep);
  }

  for (const creep of optionalCreeps) {
    if (
      shouldStopForCpu() ||
      (
        Game.cpu.bucket < OPTIONAL_CREEP_CPU_BUCKET_LIMIT &&
        Game.cpu.getUsed() > OPTIONAL_CREEP_CPU_LIMIT
      )
    ) {
      return;
    }

    runCreep(creep);
  }
}

module.exports.loop = function () {
  const shouldLogMain = Game.time % MAIN_LOG_INTERVAL === 0;

  if (Game.time % DEAD_MEMORY_CLEANUP_INTERVAL === 0) {
    cleanDeadCreepMemory();
  }

  rememberCreepState();
  logCpuStats();

  const ownedRooms = getOwnedRooms();

  if (shouldLogMain) {
    console.log(`${ownedRooms.length} owned room(s).`);
    console.log(`GCL: ${Game.gcl.level}`);
  }

  runCreeps();

  if (Game.time % INTEL_MANAGER_INTERVAL === 0) {
    try {
      if (!shouldStopForCpu()) {
        intelManager.run();
      }
    } catch (error) {
      console.log("Intel manager error:", error);
    }
  }

  if (Game.time % PLANNING_MANAGER_INTERVAL === 0) {
    try {
      if (!shouldStopForCpu()) {
        militaryManager.run();
      }
    } catch (error) {
      console.log("Military manager error:", error);
    }
  }

  if (Game.time % PLANNING_MANAGER_INTERVAL === 0) {
    try {
      if (!shouldStopForCpu()) {
        warManager.run();
      }
    } catch (error) {
      console.log("War manager error:", error);
    }
  }

  for (const room of ownedRooms) {
    if (shouldStopForCpu()) {
      break;
    }

    try {
      roomManager.run(room);
    } catch (error) {
      console.log(`Error managing room ${room.name}:`, error);
    }
  }

  if (!shouldStopForCpu()) {
    logRoleCpuProfile();
  }
};
