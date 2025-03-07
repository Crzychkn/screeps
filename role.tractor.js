module.exports = {
    /** @param {Creep} creep **/
    run: function (creep) {
        try {
            //If creep has space, find energy and harvest
            if (creep.store[RESOURCE_ENERGY] === 0) {
                creep.memory.withdraw = true;
            }
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.withdraw = false;
            }

            creep.say("🌾 harvest.");
            if (creep.memory.withdraw) {
                var sources = creep.room.find(FIND_SOURCES);
                if (creep.harvest(sources[1]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[1], {visualizePathStyle: {stroke: "#ffaa00"}});
                }
            }

            if (!creep.memory.withdraw) {
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (
                            (structure.structureType === STRUCTURE_TOWER ||
                                structure.structureType === STRUCTURE_SPAWN ||
                                structure.structureType === STRUCTURE_STORAGE ||
                                structure.structureType === STRUCTURE_CONTAINER ||
                                structure.structureType === STRUCTURE_EXTENSION) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                        );
                    },
                });
                //If spawn, extension, or tower need energy, supply them
                if (targets.length > 0) {
                    if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0], {
                            visualizePathStyle: {stroke: "#ffffff"},
                        });
                    }
                } else {
                    creep.moveTo(Game.spawns.Spawn1.pos.x, Game.spawns.Spawn1.pos.y);
                    creep.say("🚫 storage");
                }
            }
        } catch (error) {
            console.log(error);
        }
    },
};

