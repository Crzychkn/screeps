var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
        
        var priority = 0;

        if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.say('harvesting');
        }
        if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
            creep.memory.building = true;
            creep.say('building');
        }

        if(creep.memory.building) {
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            
            if (targets[priority] == StructureExtension)
            {
                console.log(priority);
            }
            else
            {
                priority += 1;
                console.log(priority);
            }
            
            if(targets.length) {
                if(creep.build(targets[priority]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[priority]);
                }
            }
        }
        else {
            var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0]);
            }
        }
    }
};

module.exports = roleBuilder;