var roleHarvester = {
  /** @param {Creep} creep **/
  run: function (creep) {
    //If creep has space, find energy and harvest
    if (creep.store.getFreeCapacity() > 0) {
      let sources = creep.room.find(FIND_SOURCES);

      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], {visualizePathStyle: {stroke: "#ffaa00"}});
      }

    } else {
      // let targets = creep.room.find(FIND_STRUCTURES, {
      //   filter: (structure) => {
      //     return (
      //       (structure.structureType === STRUCTURE_SPAWN ||
      //         structure.structureType === STRUCTURE_EXTENSION ||
      //         structure.structureType === STRUCTURE_STORAGE ||
      //         structure.structureType === STRUCTURE_CONTAINER ||
      //           structure.structureType === STRUCTURE_TOWER) &&
      //       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      //     );
      //   },
      // });

      // Filter for spawns
      let spawns = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.structureType === STRUCTURE_SPAWN &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      })

      // Filter for extensions
      let extensions = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.structureType === STRUCTURE_EXTENSION &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      })

      // Filter for storage
      let storage = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.structureType === STRUCTURE_STORAGE &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      })

      // Filter for containers
      let containers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.structureType === STRUCTURE_CONTAINER &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      })

      // Filter for towers
      let towers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.structureType === STRUCTURE_TOWER &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      })

      //If spawn, extension, or tower need energy, supply them
      if (spawns.length > 0) {
        if (creep.transfer(spawns[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawns[0], {
            visualizePathStyle: {stroke: "#ffffff"},
          });
        }
      } else if (extensions.length > 0) {
        if (creep.transfer(extensions[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(extensions[0], {
            visualizePathStyle: {stroke: "#ffffff"},
          });
        }
      } else if (storage.length > 0) {
        if (creep.transfer(storage[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storage[0], {
            visualizePathStyle: {stroke: "#ffffff"},
          });
        }
      } else if (containers.length > 0) {
        if (creep.transfer(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(containers[0], {
            visualizePathStyle: {stroke: "#ffffff"},
          });
        }
      } else if (towers.length > 0) {
        if (creep.transfer(towers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(towers[0], {
            visualizePathStyle: {stroke: "#ffffff"},
          });
        }
      } else {
        creep.moveTo(Game.spawns.Spawn1.pos.x, Game.spawns.Spawn1.pos.y);
        creep.say('🚫 storage');
      }
    }
  },
};

module.exports = roleHarvester;
