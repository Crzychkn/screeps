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

const roomManager = require("manager.room");
const intelManager = require("manager.intel");
const militaryManager = require("manager.military");
const warManager = require("manager.war");

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
};

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
  console.log("CPU Bucket:", Game.cpu.bucket);
  console.log("CPU Tick Limit:", Game.cpu.tickLimit);
  console.log("CPU Unlocked Status:", Game.cpu.unlocked);
}

function runCreeps() {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const roleName = creep.memory.role;
    const role = roles[roleName];

    if (!role) {
      console.log(`${creep.name} has unknown role: ${roleName}`);
      continue;
    }

    try {
      role.run(creep);
    } catch (error) {
      console.log(`Error running ${roleName} for ${creep.name}:`, error);
    }
  }
}

module.exports.loop = function () {
  console.log("*********************");

  cleanDeadCreepMemory();
  rememberCreepState();
  logCpuStats();

  const ownedRooms = getOwnedRooms();

  console.log(`${ownedRooms.length} owned room(s).`);
  console.log(`GCL: ${Game.gcl.level}`);

  try {
    intelManager.run();
  } catch (error) {
    console.log("Intel manager error:", error);
  }

  try {
    militaryManager.run();
  } catch (error) {
    console.log("Military manager error:", error);
  }

  try {
    warManager.run();
  } catch (error) {
    console.log("War manager error:", error);
  }

  for (const room of ownedRooms) {
    try {
      roomManager.run(room);
    } catch (error) {
      console.log(`Error managing room ${room.name}:`, error);
    }
  }

  runCreeps();

  console.log("*********************");
  console.log("\n");
};
