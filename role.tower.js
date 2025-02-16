const utils = require('utils');

module.exports = {
    run: function(roomName) {
        // Get all towers in the room
        let towers = Game.rooms[roomName].find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        // Find enemy creeps in the room
        let hostiles = Game.rooms[roomName].find(FIND_HOSTILE_CREEPS);

        // If enemies exist, make towers attack
        if (hostiles.length > 0) {
            towers.forEach(tower => tower.attack(hostiles[0])); // Attack first enemy found
        }
    }
};
