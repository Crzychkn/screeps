var roleHarvester = {
  /** @param {Creep} creep **/
  run: function (creep) {
    //If creep has space, find energy and harvest
    if (creep.store.getFreeCapacity() > 0) {

      // TODO: Pull energy from tombstones if any exist first
      // Find tombstones
      const tombstones = creep.room.find(FIND_TOMBSTONES)
      let sources = creep.room.find(FIND_SOURCES);

      try {
        // If there are any, harvest energy from them instead
        if (tombstones.length > 0 && tombstones[0].store[RESOURCE_ENERGY] > 0) {
          // Harvest tombstones here.
          console.log(tombstones, ' found! Eat it!');
          if (creep.withdraw(tombstones[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tombstones[0], {
              visualizePathStyle: {
                stroke: "#ffaa00"
              }
            })
          }
        }
        else if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      } catch (error) {
        console.error(error);
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
