var roleHarvester = {
  /** @param {Creep} creep **/
  run: function (creep) {
    //If creep has space, find energy and harvest
    if (creep.store.getFreeCapacity() > 0) {
      var sources = creep.room.find(FIND_SOURCES);
      let random = Math.round(Math.random());
      if (creep.harvest(sources[random]) == ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[random], {
          visualizePathStyle: { stroke: "#ffaa00" },
        });
      }
    } else {
      var targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            (structure.structureType == STRUCTURE_TOWER ||
              structure.structureType == STRUCTURE_SPAWN ||
              structure.structureType == STRUCTURE_STORAGE ||
              structure.structureType == STRUCTURE_CONTAINER ||
              structure.structureType == STRUCTURE_EXTENSION) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        },
      });
      //If spawn, extension, or tower need energy, supply them
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], {
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      } else {
        creep.moveTo(Game.spawns.Spawn1.pos.x, Game.spawns.Spawn1.pos.y);
      }
    }
  },
};

module.exports = roleHarvester;
