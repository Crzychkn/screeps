const MIN_DROPPED_ENERGY = 25;

function moveToTarget(creep, target, stroke) {
    creep.moveTo(target, {
        maxRooms: 1,
        reusePath: 5,
        visualizePathStyle: { stroke: stroke },
    });
}

function hasEnergy(structure) {
    return structure.store && structure.store[RESOURCE_ENERGY] > 0;
}

function findLowestEnergyTower(room) {
    const towers = room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
            return (
                structure.structureType === STRUCTURE_TOWER &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            );
        },
    });

    if (towers.length === 0) {
        return null;
    }

    return towers.reduce((lowest, tower) => {
        if (!lowest) {
            return tower;
        }

        return tower.store[RESOURCE_ENERGY] < lowest.store[RESOURCE_ENERGY]
            ? tower
            : lowest;
    }, null);
}

function withdrawFromStructure(creep, structure) {
    const result = creep.withdraw(structure, RESOURCE_ENERGY);

    if (result === ERR_NOT_IN_RANGE) {
        moveToTarget(creep, structure, "#ffaa00");
    }

    return result === OK || result === ERR_NOT_IN_RANGE;
}

function pickupDroppedEnergy(creep) {
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource) => {
            return (
                resource.resourceType === RESOURCE_ENERGY &&
                resource.amount >= MIN_DROPPED_ENERGY
            );
        },
    });

    if (droppedEnergy.length === 0) {
        return false;
    }

    const target = creep.pos.findClosestByRange(droppedEnergy);
    const result = creep.pickup(target);

    if (result === ERR_NOT_IN_RANGE) {
        moveToTarget(creep, target, "#ffaa00");
    }

    return result === OK || result === ERR_NOT_IN_RANGE;
}

function withdrawFromContainer(creep) {
    const containers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return (
                structure.structureType === STRUCTURE_CONTAINER &&
                hasEnergy(structure)
            );
        },
    });

    if (containers.length === 0) {
        return false;
    }

    const target = creep.pos.findClosestByRange(containers);
    return withdrawFromStructure(creep, target);
}

function harvestFallback(creep) {
    const source =
        creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE) ||
        creep.pos.findClosestByRange(FIND_SOURCES);

    if (!source) {
        return false;
    }

    const result = creep.harvest(source);

    if (result === ERR_NOT_IN_RANGE) {
        moveToTarget(creep, source, "#ffaa00");
    }

    return result === OK || result === ERR_NOT_IN_RANGE;
}

function collectEnergy(creep, homeRoom) {
    if (homeRoom.storage && hasEnergy(homeRoom.storage)) {
        return withdrawFromStructure(creep, homeRoom.storage);
    }

    if (withdrawFromContainer(creep)) {
        return true;
    }

    if (pickupDroppedEnergy(creep)) {
        return true;
    }

    return harvestFallback(creep);
}

module.exports = {
    run: function (creep) {
        try {
            const homeRoomName = creep.memory.homeRoom || creep.room.name;
            const homeRoom = Game.rooms[homeRoomName];

            if (!homeRoom) {
                console.log(`${creep.name} cannot access home room ${homeRoomName}`);
                return;
            }

            if (creep.room.name !== homeRoom.name) {
                creep.moveTo(new RoomPosition(25, 25, homeRoom.name), {
                    reusePath: 10,
                    visualizePathStyle: { stroke: "#ffaa00" },
                });
                return;
            }

            const tower = findLowestEnergyTower(homeRoom);

            if (!tower) {
                return;
            }

            if (creep.store[RESOURCE_ENERGY] === 0) {
                creep.memory.withdraw = true;
            }

            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.withdraw = false;
            }

            if (creep.memory.withdraw) {
                collectEnergy(creep, homeRoom);
                return;
            }

            const result = creep.transfer(tower, RESOURCE_ENERGY);

            if (result === ERR_NOT_IN_RANGE) {
                moveToTarget(creep, tower, "#ffffff");
            }
        } catch (error) {
            console.log(`Error running emergency stim ${creep.name}:`, error);
        }
    },
};
