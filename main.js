var roleHarvester = require("role.harvester");
var roleUpgrader = require("role.upgrader");
var roleBuilder = require("role.builder");
var roleRepairer = require("role.repairer");

module.exports.loop = function () {
  //Clear memory of dead creeps
  for (var name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      console.log("Clearing non-existing creep memory:", name);
    }
  }

  //Harvesters auto spawn
  var harvesters = _.filter(
    Game.creeps,
    (creep) => creep.memory.role == "harvester"
  );
  console.log("Harvesters: " + harvesters.length);

  if (harvesters.length < 3) {
    var newName = "Harvester" + Game.time;
    console.log("Spawning new harvester: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "harvester" },
    });
  }

  //Upgraders auto spawn
  var upgraders = _.filter(
    Game.creeps,
    (creep) => creep.memory.role == "upgrader"
  );
  console.log("Upgrader: " + upgraders.length);

  if (upgraders.length < 3) {
    var newName = "Upgrader" + Game.time;
    console.log("Spawning new upgrader: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "upgrader" },
    });
  }

  //Builders auto spawn
  var builders = _.filter(
    Game.creeps,
    (creep) => creep.memory.role == "builder"
  );
  console.log("Builder: " + builders.length);

  if (builders.length < 3) {
    var newName = "Builder" + Game.time;
    console.log("Spawning new builder: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "builder" },
    });
  }

  //Repairers auto spawn
  var repairers = _.filter(
    Game.creeps,
    (creep) => creep.memory.role == "repairer"
  );
  console.log("Repairer: " + builders.length);

  if (repairers.length < 3) {
    var newName = "Repairer" + Game.time;
    console.log("Spawning new repairer: " + newName);
    Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
      memory: { role: "repairer" },
    });
  }

  if (Game.spawns["Spawn1"].spawning) {
    var spawningCreep = Game.creeps[Game.spawns["Spawn1"].spawning.name];
    Game.spawns["Spawn1"].room.visual.text(
      "🛠️" + spawningCreep.memory.role,
      Game.spawns["Spawn1"].pos.x + 1,
      Game.spawns["Spawn1"].pos.y,
      { align: "left", opacity: 0.8 }
    );
  }

  //Tower Code
  var tower = Game.getObjectById("TOWER_ID");
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
  for (var name in Game.creeps) {
    var creep = Game.creeps[name];
    if (creep.memory.role == "harvester") {
      roleHarvester.run(creep);
    }
    if (creep.memory.role == "upgrader") {
      roleUpgrader.run(creep);
    }
    if (creep.memory.role == "builder") {
      roleBuilder.run(creep);
    }
    if (creep.memory.role == "repairer") {
      roleRepairer.run(creep);
    }
  }
};
