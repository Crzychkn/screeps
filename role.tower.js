const utils = require("utils");

module.exports = {
    run: function (roomName) {
        // Get all towers in the room
        let towers = Game.rooms[roomName].find(FIND_MY_STRUCTURES, {
            filter: {structureType: STRUCTURE_TOWER}
        });

        let stims = _.filter(
            Game.creeps,
            (creep) => creep.memory.role === "stim"
        );
        console.log("Stims: ", stims.length);

        towers.forEach(tower => {
            // TODO: Add check here to ensure storage has energy to transfer
            // storage && storage.store[RESOURCE_ENERGY] > 0
            if (tower.store[RESOURCE_ENERGY] < 400 && stims.length < 1) {
                let newName = "Stim" + Game.time;
                Game.spawns["Spawn1"].spawnCreep(
                    [MOVE, MOVE, CARRY, CARRY],
                    newName,
                    {
                        memory: {role: "stim"},
                    }
                );
            }
        })

        if (!towers) {
            console.log("No towers available!");
        }

        // Find enemy creeps in the room
        let hostiles = Game.rooms[roomName].find(FIND_HOSTILE_CREEPS);

        // If enemies exist, make towers attack
        if (hostiles.length > 0) {
            towers.forEach(tower => tower.attack(hostiles[0])); // Attack first enemy found
        } else {
            // Nothing to attack, so repair something instead.
            towers.forEach(tower => {
                console.log(tower.store[RESOURCE_ENERGY]);
                tower.repair(utils.getRepairQueue(Game.rooms[roomName])[0])
            });
        }
    }
};
