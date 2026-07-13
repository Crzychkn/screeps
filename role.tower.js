const utils = require("utils");

const STIM_SPAWN_THRESHOLD = 400;
const STIM_BODY = [MOVE, MOVE, CARRY, CARRY];
const STIM_FALLBACK_BODY = [MOVE, CARRY];
const TOWER_REPAIR_MIN_ENERGY = 600;
const TOWER_REPAIR_INTERVAL = 10;
const LOW_BUCKET_REPAIR_LIMIT = 3000;

function bodyCost(body) {
    return body.reduce((total, part) => total + BODYPART_COST[part], 0);
}

function getAvailableSpawn(room) {
    const spawns = room.find(FIND_MY_SPAWNS);
    return spawns.find((spawn) => !spawn.spawning);
}

function getRoomStims(room) {
    return _.filter(Game.creeps, (creep) => {
        return (
            creep.memory.role === "stim" &&
            (creep.memory.homeRoom === room.name ||
                (!creep.memory.homeRoom && creep.room.name === room.name))
        );
    });
}

function spawnStimIfNeeded(room, towers) {
    const needsStim = towers.some((tower) => {
        return tower.store[RESOURCE_ENERGY] < STIM_SPAWN_THRESHOLD;
    });

    if (!needsStim || getRoomStims(room).length > 0) {
        return;
    }

    const spawn = getAvailableSpawn(room);

    if (!spawn) {
        return;
    }

    const body = bodyCost(STIM_BODY) <= room.energyAvailable
        ? STIM_BODY
        : STIM_FALLBACK_BODY;

    if (bodyCost(body) > room.energyAvailable) {
        return;
    }

    const newName = "Stim" + Game.time;
    const result = spawn.spawnCreep(body, newName, {
        memory: {
            role: "stim",
            homeRoom: room.name,
        },
    });

    if (result === OK) {
        console.log(`Spawning emergency stim in ${room.name}: ${newName}`);
    } else if (result !== ERR_NOT_ENOUGH_ENERGY && result !== ERR_BUSY) {
        console.log(`Failed to spawn emergency stim in ${room.name}: ${result}`);
    }
}

module.exports = {
    run: function (roomName) {
        const room = Game.rooms[roomName];

        if (!room) {
            return;
        }

        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: {structureType: STRUCTURE_TOWER}
        });

        if (towers.length === 0) {
            return;
        }

        spawnStimIfNeeded(room, towers);

        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            towers.forEach((tower) => {
                const hostile = tower.pos.findClosestByRange(hostiles);

                if (hostile) {
                    tower.attack(hostile);
                }
            });

            return;
        }

        const woundedFriendly = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.hits < creep.hitsMax,
        });

        if (woundedFriendly.length > 0) {
            towers.forEach((tower) => {
                const target = tower.pos.findClosestByRange(woundedFriendly);

                if (target) {
                    tower.heal(target);
                }
            });

            return;
        }

        if (
            Game.cpu.bucket < LOW_BUCKET_REPAIR_LIMIT ||
            Game.time % TOWER_REPAIR_INTERVAL !== 0
        ) {
            return;
        }

        const repairQueue = utils.getRepairQueue(room);
        const repairTarget = repairQueue[0];

        if (!repairTarget) {
            return;
        }

        towers.forEach((tower) => {
            if (tower.store[RESOURCE_ENERGY] > TOWER_REPAIR_MIN_ENERGY) {
                tower.repair(repairTarget);
            }
        });
    }
};
