const DEFAULT_AVOID_ROOMS = {
  E58S38: true,
};

function addAvoidedRooms(target, rooms) {
  if (!rooms) {
    return;
  }

  if (Array.isArray(rooms)) {
    for (const roomName of rooms) {
      if (typeof roomName === "string") {
        target[roomName.trim().toUpperCase()] = true;
      }
    }

    return;
  }

  for (const roomName in rooms) {
    if (rooms[roomName]) {
      target[roomName.trim().toUpperCase()] = true;
    }
  }
}

function getAvoidedRooms() {
  const avoided = {};

  addAvoidedRooms(avoided, DEFAULT_AVOID_ROOMS);

  if (typeof Memory !== "undefined") {
    addAvoidedRooms(avoided, Memory.avoidRooms);

    if (Memory.expansion) {
      addAvoidedRooms(avoided, Memory.expansion.avoidRooms);
    }
  }

  return avoided;
}

function isRoomAvoided(roomName) {
  return !!(roomName && getAvoidedRooms()[roomName.trim().toUpperCase()]);
}

module.exports = {
  rooms: DEFAULT_AVOID_ROOMS,
  getAvoidedRooms,
  isRoomAvoided,
};
