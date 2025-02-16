var roleHarvester = {
  /** @param {Creep} creep **/
  run: function (creep) {
    //If creep has space, find energy and harvest
    if (creep.store.getFreeCapacity() > 0) {

      // TODO: Pull energy from tombstones if any exist first
      // Find tombstones
      const tombstones = room.find(FIND_TOMBSTONES)

      // If there are any
      // Harvest energy from them instead
      if (tombstones.length > 0) {
        console.log('Tombstones found!')
      }

      let sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    } else {
      let targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            (structure.structureType === STRUCTURE_TOWER ||
              structure.structureType === STRUCTURE_SPAWN ||
              structure.structureType === STRUCTURE_STORAGE ||
              structure.structureType === STRUCTURE_EXTENSION ||
              structure.structureType === STRUCTURE_CONTAINER) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        },
      });
      //If spawn, extension, or tower need energy, supply them
      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
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
