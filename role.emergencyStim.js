module.exports = {
    run: function (creep) {
        console.log("Enemies detected, man the towers!");

        try {

            if (creep.store[RESOURCE_ENERGY] === 0) {
                creep.memory.withdraw = true;
            }
            if (creep.store[RESOURCE_ENERGY] === 100) {
                creep.memory.withdraw = false;
            }

            // Get storage in current room
            // TODO: Make dynamic for all rooms, not just the first
            let storage = Game.rooms["E57S36"].find(FIND_MY_STRUCTURES, {
                filter: {structureType: STRUCTURE_STORAGE}
            });
            console.log("Storage: ", storage);

            let towers = Game.rooms["E57S36"].find(FIND_MY_STRUCTURES, {
                filter: {structureType: STRUCTURE_TOWER}
            });
            console.log("Towers: ", towers);

            if (towers.length > 0) {
                let lowestEnergyTower = towers.reduce((lowest, tower) =>
                    !lowest || tower.store[RESOURCE_ENERGY] < lowest.store[RESOURCE_ENERGY] ? tower : lowest, null);
                console.log("Lowest: ", lowestEnergyTower);
            }

            // Withdraw from storage
            if (creep.memory.withdraw) {
                if (creep.withdraw(storage[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage[0], {
                        visualizePathStyle: {stroke: "#ffffff"},
                    });
                }
            }

            // Deposit in tower
            if (!creep.memory.withdraw) {
                if (creep.transfer(lowestEnergyTower) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(lowestEnergyTower, {
                        visualizePathStyle: {stroke: "#ffffff"},
                    });
                }
            }
        }
        catch (e) {
            console.log(e);
        }
        // End function

    }
}