let roleHarvester = require("role.harvester");
let roleUpgrader = require("role.upgrader");
let roleBuilder = require("role.builder");
let roleRepairer = require("role.repairer");
let roleTractor = require("role.tractor");
let roleScout = require("role.scout");
let roleTower = require("role.tower");
const roleStim = require("role.emergencyStim");
const roleDefender = require("role.defender");
const utils = require("./utils");



let name;

module.exports.loop = function () {

    // Start Script
    console.log('*********************');

    // Declare variables
    let newName;

    // Clear memory of dead creeps
    for (name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log("Clearing non-existing creep memory:", name);
        }
    }

    // Variables for stats
    const bucket = Game.cpu.bucket;
    const tickLimit = Game.cpu.tickLimit;
    const cpuUnlocked = Game.cpu.unlocked;

    // Stats to monitor
    console.log('CPU Bucket: ' + bucket);
    console.log('CPU Tick Limit: ' + tickLimit);
    console.log('CPU Unlocked Status: ' + cpuUnlocked)

    Game.notify(`Bucket Amount: ${bucket}`, 720);
    Game.notify(`CPU Tick Limit: ${tickLimit}`, 720);
    try {
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            const repairQueue = utils.getRepairQueue(room);
            console.log(repairQueue.length, 'structures to repair.')
            if (repairQueue.length > 0) {
                console.log(`Lowest structure is ${repairQueue[0].hits} out of ${repairQueue[0].hitsMax} hits.`);
            }
        }
    } catch (error) {
        console.log(error);
    }

    // Defense creeps
    let hostiles
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        hostiles = Game.rooms[roomName].find(FIND_HOSTILE_CREEPS);
    }
    let hostilesAmount = hostiles.length;
    if (hostiles.length > 0) {
        Game.notify(`${hostilesAmount} hostile(s) found in a room!`, 0);
        let defenders = _.filter(Game.creeps, (creep) => {
            creep.memory.role === "defender"
        })
        if (defenders.length < hostilesAmount) {
            let newName = "Defender" + Game.time;
            Game.spawns["Spawn1"].spawnCreep([MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK],
                newName, {
                    memory: {role: "defender"},
                });
        }
    }

    // // Check closest creep to death
    // const myCreeps = Object.values(Game.creeps);
    // try {
    //   let closestToDeath = myCreeps.reduce((lowest, creep) => !lowest || creep.ticksToLive < lowest.ticksToLive ? creep : lowest, null
    //   );
    //   console.log(`Creep ${closestToDeath} dies in ${closestToDeath.ticksToLive}.`);
    // } catch (error) {
    //   console.log(error);
    // }

    // Check Extensions
    let myExtensions;
    try {
        myExtensions = Game.rooms['E57S36'].find(FIND_STRUCTURES, {
            filter: {structureType: STRUCTURE_EXTENSION},
        });

        console.log('Current Extensions:', myExtensions.length);
        if (myExtensions.length > 0) {
            var containerStore = 0;
            for (let container of myExtensions) {
                containerStore += container.store[RESOURCE_ENERGY];
            }
            console.log('Current Extensions Total Energy:', containerStore);
        }
    } catch (error) {
        console.log(error);
    }

    // Harvesters auto spawn
    let harvesters = _.filter(
        Game.creeps,
        (creep) => creep.memory.role === "harvester"
    );
    console.log("Harvesters: " + harvesters.length);

    if (harvesters.length < 5) {
        newName = "Harvester" + Game.time;
        console.log("Spawning new harvester: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
            memory: {role: "harvester"},
        });
    }

    let tractors = _.filter(
        Game.creeps,
        (creep) => creep.memory.role === "tractor"
    );
    console.log("Tractors: ", tractors.length);

    // TODO: Maybe check to ensure enough energy before creating this
    // Get all containers / storage and ensure energy levels exceed 900 in total.
    if (tractors.length < 1 && Game.gcl.level >= 3) {
        console.log("Tractor can be made.");
        newName = "Tractor" + Game.time;
        Game.spawns["Spawn1"].spawnCreep(
            [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
            newName,
            {
                memory: {role: "tractor"},
            }
        );
    }

    if (tractors.length < 2 && Game.gcl.level >= 4) {
        newName = "Tractor" + Game.time;
        Game.spawns["Spawn1"].spawnCreep(
            [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
            newName, {
                memory: {role: "tractor"},
            }
        )
    }

    // Builders auto spawn
    let builders = _.filter(
        Game.creeps,
        (creep) => creep.memory.role === "builder"
    );
    console.log("Builder: " + builders.length);

    if (harvesters.length > 3 && builders.length < 4) {
        newName = "Builder" + Game.time;
        console.log("Spawning new builder: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
            memory: {role: "builder"},
        });
    }

    // Upgraders auto spawn
    let upgraders = _.filter(
        Game.creeps,
        (creep) => creep.memory.role === "upgrader"
    );
    console.log("Upgrader: " + upgraders.length);

    // TODO: This needs re-worked to make more. If upgraders.length !< 3, it won't ever run to make more in the second loop
    if (harvesters.length > 3 && builders.length > 2 && upgraders.length <= 4) {
        // TODO: Create function to create a creep?
        newName = "Upgrader" + Game.time;
        console.log("Spawning new upgrader: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
            memory: {role: "upgrader"},
        });
        try {
            let room = Game.rooms['E57S36'];
            console.log('Room variable:', room);
            if (room.controller.level > 3 && upgraders.length < 5) {
                Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
                    memory: {role: "upgrader"},
                });
            }
        } catch (e) {
            console.log(e);
        }
    }

    // Repairers auto spawn
    let repairers = _.filter(
        Game.creeps,
        (creep) => creep.memory.role === "repairer"
    );
    console.log("Repairer: " + repairers.length);

    if (harvesters.length > 3 && repairers.length < 2) {
        newName = "Repairer" + Game.time;
        console.log("Spawning new repairer: " + newName);
        Game.spawns["Spawn1"].spawnCreep([WORK, CARRY, MOVE], newName, {
            memory: {role: "repairer"},
        });
    }

    // Scout auto spawn
    let scout = _.filter(
        Game.creeps,
        (creep) => creep.memory.role === "scout"
    );
    console.log("Scout: " + scout.length);

    // If no scouts
    // and gcl level > 1

    // if (scout.length < 1 && Game.gcl.level > Object.keys(Game.rooms).length && tractors.length > 0 && upgraders.length > 3 && containerStore > 1200) {
    //     newName = "Scout" + Game.time;
    //     console.log("Spawning new scout: ", newName);
    //     const result = Game.spawns["Spawn1"].spawnCreep([MOVE, MOVE, CLAIM], newName, {
    //         memory: {role: "scout"},
    //     });
    //     console.log(result);
    // }

    // Tower code
    for (let roomName in Game.rooms) {
        roleTower.run(roomName);
    }

    if (Game.spawns["Spawn1"].spawning) {
        let spawningCreep = Game.creeps[Game.spawns["Spawn1"].spawning.name];
        Game.spawns["Spawn1"].room.visual.text(
            "🛠️" + spawningCreep.memory.role,
            Game.spawns["Spawn1"].pos.x + 1,
            Game.spawns["Spawn1"].pos.y,
            {align: "left", opacity: 0.8}
        );
    }

    // Run screeps logic
    for (name in Game.creeps) {
        var creep = Game.creeps[name];
        if (creep.memory.role === "harvester") {
            roleHarvester.run(creep);
        }
        if (creep.memory.role === "upgrader") {
            roleUpgrader.run(creep);
        }
        if (creep.memory.role === "builder") {
            roleBuilder.run(creep);
        }
        if (creep.memory.role === "repairer") {
            roleRepairer.run(creep);
        }
        if (creep.memory.role === "tractor") {
            roleTractor.run(creep);
        }
        if (creep.memory.role === "scout") {
            roleScout.run(creep);
        }
        if (creep.memory.role === "stim") {
            roleStim.run(creep);
        }
        if (creep.memory.role === "defender") {
            roleDefender.run(creep);
        }
    }

    // End Script
    console.log('*********************');
    console.log('\n')
};
