let roleHarvester = require("role.harvester");
let roleUpgrader = require("role.upgrader");
let roleBuilder = require("role.builder");
let roleRepairer = require("role.repairer");
let roleTractor = require("role.tractor");
let roleScout = require("role.scout");
let roleTower = require("role.tower");

let name;

module.exports.loop = function () {

  // Start Script
  console.log('*********************');

  // Declare variables
  let newName;

  // Clear memory of dead creeps
  for (name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      console.log("Clearing non-existing creep memory:", name);
    }
  }

  // Variables for stats
  // const bucket = Game.cpu.bucket;
  // const tickLimit = Game.cpu.tickLimit;
  // const cpuUnlocked = Game.cpu.unlocked;

  // Stats to monitor
  // console.log('CPU Bucket: ' + bucket);
  // console.log('CPU Tick Limit: ' + tickLimit);
  // console.log('CPU Unlocked Status: ' + cpuUnlocked)

  // Harvesters auto spawn
  let harvesters = _.filter(
    Game.creeps,
    (creep) => creep.memory.role === "harvester"
  );
  console.log("Harvesters: " + harvesters.length);

  if (harvesters.length < 4) {
    newName = "Harvester" + Game.time;
    console.log("Spawning new harvester: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "harvester" },
    });
  }

  let tractors = _.filter(
    Game.creeps,
    (creep) => creep.memory.role === "tractor"
  );
  console.log("Tractors: ", tractors.length);

  if (tractors.length < 1 && Game.gcl.level >= 3) {
    console.log("Tractor can be made.");
    newName = "Tractor" + Game.time;
    Game.spawns["Spawn1"].spawnCreep(
      [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
      newName,
      {
        memory: { role: "tractor" },
      }
    );
  }

  // Upgraders auto spawn
  let upgraders = _.filter(
    Game.creeps,
    (creep) => creep.memory.role === "upgrader"
  );
  console.log("Upgrader: " + upgraders.length);

  if (harvesters.length > 3 && upgraders.length < 2) {
    newName = "Upgrader" + Game.time;
    console.log("Spawning new upgrader: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "upgrader" },
    });
  }

  // Builders auto spawn
  let builders = _.filter(
    Game.creeps,
    (creep) => creep.memory.role === "builder"
  );
  console.log("Builder: " + builders.length);

  if (harvesters.length > 3 && builders.length < 3) {
    newName = "Builder" + Game.time;
    console.log("Spawning new builder: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "builder" },
    });
  }

  // Repairers auto spawn
  let repairers = _.filter(
    Game.creeps,
    (creep) => creep.memory.role === "repairer"
  );
  console.log("Repairer: " + builders.length);

  if (harvesters.length > 3 && repairers.length < 3) {
    newName = "Repairer" + Game.time;
    console.log("Spawning new repairer: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "repairer" },
    });
  }

  // Scout auto spawn
  // let scout = _.filter(
  //     Game.creeps,
  //     (creep) => creep.memory.role === "scout"
  // );
  // console.log("Scout: " + scout.length);
  //
  // if (scout.length < 1 && Game.gcl.level > 1) {
  //   newName = "Scout" + Game.time;
  //   console.log("Spawning new scout: ", newName);
  //   const result = Game.spawns["Spawn1"].spawnCreep([MOVE, MOVE, CLAIM], newName, {
  //     memory: { role: "scout" },
  //   });
  //   console.log(result);
  // }

  if (Game.spawns["Spawn1"].spawning) {
    let spawningCreep = Game.creeps[Game.spawns["Spawn1"].spawning.name];
    Game.spawns["Spawn1"].room.visual.text(
      "🛠️" + spawningCreep.memory.role,
      Game.spawns["Spawn1"].pos.x + 1,
      Game.spawns["Spawn1"].pos.y,
      { align: "left", opacity: 0.8 }
    );
  }

  // Run screeps logic
  for (name in Game.creeps) {
    var creep = Game.creeps[name];
    if (creep.memory.role === "harvester") {
      roleHarvester.run(creep);
    }
    if (creep.memory.role === "upgrader") {
      roleUpgrader.run(creep);
    }
    if (creep.memory.role === "builder") {
      roleBuilder.run(creep);
    }
    if (creep.memory.role === "repairer") {
      roleRepairer.run(creep);
    }
    if (creep.memory.role === "tractor") {
      roleTractor.run(creep);
    }
    if (creep.memory.role === "scout") {
      roleScout.run(creep);
    }
    if (creep.memory.role === "tower") {
      for (let roomName in Game.rooms) {
        roleTower.run(roomName);
      }
    }
  }

  // End Script
  console.log('*********************');
  console.log('\n')
};
