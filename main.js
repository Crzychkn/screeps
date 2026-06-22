const roleHarvester = require("role.harvester");
const roleUpgrader = require("role.upgrader");
const roleBuilder = require("role.builder");
const roleRepairer = require("role.repairer");
const roleTractor = require("role.tractor");
const roleScout = require("role.scout");
const roleStim = require("role.emergencyStim");
const roleDefender = require("role.defender");

const roomManager = require("manager.room");

const roles = {
  harvester: roleHarvester,
  upgrader: roleUpgrader,
  builder: roleBuilder,
  repairer: roleRepairer,
  tractor: roleTractor,
  scout: roleScout,
  stim: roleStim,
  defender: roleDefender,
};

function cleanDeadCreepMemory() {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      console.log("Clearing non-existing creep memory:", name);
    }
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
  logCpuStats();

  const ownedRooms = getOwnedRooms();

  console.log(`${ownedRooms.length} owned room(s).`);
  console.log(`GCL: ${Game.gcl.level}`);

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