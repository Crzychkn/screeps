module.exports = {
  run: function (creep) {
    // Check GCL level and owned rooms to see if we can claim one
    const gclLevel = Game.gcl.level;
    console.log('gclLevel: ', gclLevel);

    const currentGcl = Game.gcl.level;

    // Check that we have GCL above 1.
    if ( currentGcl > 2 ) {
      // If we do, grab the first room from our rooms

      for (const i in Game.rooms) {
        firstRoom = Game.rooms[i];
      }

      // Check the exits to that room and see if adjacent rooms are claimed
      console.log('firstRoom: ', firstRoom);

    }

    // Check list of adjacent rooms to current room

    // Pick one if available

    // Go to room

    // Claim room
  }
};