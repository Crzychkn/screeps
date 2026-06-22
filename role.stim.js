module.exports = {
    run: function (creep) {
        try {
            const homeRoomName = creep.memory.homeRoom || creep.room.name;
            const homeRoom = Game.rooms[homeRoomName];

            if (!homeRoom) {
                console.log(`${creep.name} cannot access home room ${homeRoomName}`);
                return;
            }

            if (creep.store[RESOURCE_ENERGY] === 0) {
                creep.memory.withdraw = true;
            }

            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.withdraw = false;
            }

            const storage = homeRoom.storage;

            const towers = homeRoom.find(FIND_MY_STRUCTURES, {
                filter: (structure) => {
                    return (
                        structure.structureType === STRUCTURE_TOWER &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    );
                },
            });

            if (!storage || storage.store[RESOURCE_ENERGY] === 0) {
                return;
            }

            if (towers.length === 0) {
                return;
            }

            const lowestEnergyTower = towers.reduce((lowest, tower) => {
                if (!lowest) {
                    return tower;
                }

                return tower.store[RESOURCE_ENERGY] < lowest.store[RESOURCE_ENERGY]
                    ? tower
                    : lowest;
            }, null);

            if (creep.memory.withdraw) {
                const result = creep.withdraw(storage, RESOURCE_ENERGY);

                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, {
                        visualizePathStyle: { stroke: "#ffffff" },
                    });
                }

                return;
            }

            const result = creep.transfer(lowestEnergyTower, RESOURCE_ENERGY);

            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(lowestEnergyTower, {
                    visualizePathStyle: { stroke: "#ffffff" },
                });
            }
        } catch (error) {
            console.log(`Error running emergency stim ${creep.name}:`, error);
        }
    },
};