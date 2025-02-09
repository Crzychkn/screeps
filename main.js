let roleHarvester = require("role.harvester");
let roleUpgrader = require("role.upgrader");
let roleBuilder = require("role.builder");
let roleRepairer = require("role.repairer");
let roleTractor = require("role.tractor");

let name;

module.exports.loop = function () {

  // Start Script
  console.log('*********************');
  const controllerSign = "A new player learning and having fun.";

  // console.log(Room.controller.sign);

  // Declare variables
  let newName;

  //Clear memory of dead creeps
  for (name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      console.log("Clearing non-existing creep memory:", name);
    }
  }

  const bucket = Game.cpu.bucket;
  const tickLimit = Game.cpu.tickLimit;
  const cpuUnlocked = Game.cpu.unlocked;

  console.log('CPU Bucket: ' + bucket);
  console.log('CPU Tick Limit: ' + tickLimit);
  console.log('CPU Unlocked Status: ' + cpuUnlocked)

  //Harvesters auto spawn
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

  //Upgraders auto spawn
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

  //Builders auto spawn
  let builders = _.filter(
    Game.creeps,
    (creep) => creep.memory.role === "builder"
  );
  console.log("Builder: " + builders.length);

  if (harvesters.length > 3 && builders.length < 2) {
    newName = "Builder" + Game.time;
    console.log("Spawning new builder: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "builder" },
    });
  }

  //Repairers auto spawn
  let repairers = _.filter(
    Game.creeps,
    (creep) => creep.memory.role === "repairer"
  );
  console.log("Repairer: " + builders.length);

  if (harvesters.length > 3 && repairers.length < 1) {
    newName = "Repairer" + Game.time;
    console.log("Spawning new repairer: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "repairer" },
    });
  }

  if (Game.spawns["Spawn1"].spawning) {
    let spawningCreep = Game.creeps[Game.spawns["Spawn1"].spawning.name];
    Game.spawns["Spawn1"].room.visual.text(
      "🛠️" + spawningCreep.memory.role,
      Game.spawns["Spawn1"].pos.x + 1,
      Game.spawns["Spawn1"].pos.y,
      { align: "left", opacity: 0.8 }
    );
  }

  //Tower Code
  let tower = Game.getObjectById("TOWER_ID");
  if (tower) {
    var closestDamagedStructure = tower.pos.findClosestByRange(
      FIND_STRUCTURES,
      {
        filter: (structure) => structure.hits < structure.hitsMax,
      }
    );
    if (closestDamagedStructure) {
      tower.repair(closestDamagedStructure);
    }

    var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile) {
      tower.attack(closestHostile);
    }
  }

  //Run screeps logic
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
  }

  // End Script
  console.log('*********************');
  console.log('\n')
};
