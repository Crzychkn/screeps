const utils = require("utils");

const STARVED_ENERGY_THRESHOLD = 25000;
const RECOVERY_DOWNGRADE_BUFFER = 10000;

function getStoredEnergy(room) {
  let total = room.energyAvailable;

  if (room.storage) {
    total += room.storage.store[RESOURCE_ENERGY];
  }

  const containers = room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
  });

  for (const container of containers) {
    total += container.store[RESOURCE_ENERGY];
  }

  return total;
}

function isStarved(room) {
  return (
    getStoredEnergy(room) <
    Math.max(STARVED_ENERGY_THRESHOLD, room.energyCapacityAvailable * 5)
  );
}

function isCriticalConstructionSite(site) {
  return (
    site.structureType === STRUCTURE_SPAWN ||
    site.structureType === STRUCTURE_CONTAINER ||
    site.structureType === STRUCTURE_TOWER
  );
}

function findConstructionSites(room) {
  const sites = room.find(FIND_CONSTRUCTION_SITES);

  if (!isStarved(room)) {
    return sites;
  }

  return sites.filter(isCriticalConstructionSite);
}

function moveToHomeRoom(creep, homeRoom) {
  utils.moveToRoom(creep, homeRoom.name, "#ffffff");
}

module.exports = {
  run: function (creep) {
    const homeRoom = utils.getHomeRoom(creep);

    if (!creep.memory.homeRoom) {
      creep.memory.homeRoom = homeRoom.name;
    }

    // If the creep is currently building and is out of energy, switch to harvesting mode
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.building = false;
      creep.say("🔄 empty");
    }
    // If the creep is currently harvesting and is full of energy, switch to building mode
    if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
      creep.memory.building = true;
      creep.say("🚧 build");
    }

    // If the creep is in building mode, find sites to build
    if (creep.memory.building) {
      if (creep.room.name !== homeRoom.name) {
        moveToHomeRoom(creep, homeRoom);
        return;
      }

      if (utils.moveOffRoomEdge(creep)) {
        return;
      }

      const constructionSites = findConstructionSites(homeRoom);
      if (constructionSites.length > 0) {
        if (creep.build(constructionSites[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(constructionSites[0], {
            maxRooms: 1,
            reusePath: 5,
            visualizePathStyle: { stroke: "#ffffff" },
          });
        }
      } else {
          creep.say("🚧 repair");

          const repairQueue = utils.getRepairQueue(homeRoom);

          if (repairQueue.length > 0 && creep.repair(repairQueue[0]) === ERR_NOT_IN_RANGE) {
            creep.moveTo(repairQueue[0], {
              maxRooms: 1,
              reusePath: 5,
            });
          } else if (
            repairQueue.length === 0 &&
            homeRoom.controller &&
            (
              !isStarved(homeRoom) ||
              homeRoom.controller.ticksToDowngrade <= RECOVERY_DOWNGRADE_BUFFER
            )
          ) {
            const result = creep.upgradeController(homeRoom.controller);

            if (result === ERR_NOT_IN_RANGE) {
              creep.moveTo(homeRoom.controller, {
                range: 3,
                maxRooms: 1,
                reusePath: 5,
                visualizePathStyle: { stroke: "#ffffff" },
              });
            }
          } else if (isStarved(homeRoom)) {
            utils.returnEnergyForRecovery(creep, homeRoom);
          }
      }
    }
    // If the creep is not in building mode, find energy sources and harvest them
    if (!creep.memory.building) {
      utils.getEnergy(creep);
    }
  },
};
