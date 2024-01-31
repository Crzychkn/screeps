var roleUpgrader = {
  /** @param {Creep} creep **/
  run: function (creep) {
    var harvesters = _.filter(
      Game.creeps,
      (creep) => creep.memory.role == "upgrader",
    );
    console.log("Upgrader: " + upgrader.length);

    if (upgrader.length < 2) {
      var newName = "Upgrader" + Game.time;
      console.log("Spawning new upgrader: " + newName);
      Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
        memory: { role: "upgrader" },
      });
    }

    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.upgrading = false;
      creep.say("🔄 harvest");
    }
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
      creep.memory.upgrading = true;
      creep.say("⚡ upgrade");
    }

    if (creep.memory.upgrading) {
      if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {
          visualizePathStyle: { stroke: "#ffffff" },
        });
      }
    } else {
      var sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  },
};

module.exports = roleUpgrader;
