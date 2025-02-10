module.exports = {
  run: function (creep) {
    // Check GCL level and owned rooms to see if we can claim one
    console.log(Game.gcl.level);
    const currentGcl = Game.gcl.level;

    // Check that we have GCL above 1.
    if ( currentGcl > 2 ) {
      // If we do, grab the first room from our rooms

      const firstRoom = Game.rooms[0].name;

      // Check the exits to that room and see if adjacent rooms are claimed
      console.log(firstRoom)
    }

    // Check list of adjacent rooms to current room

    // Pick one if available

    // Go to room

    // Claim room
  }
};