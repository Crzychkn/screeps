module.exports = {
  run: function (creep) {
    // Check GCL level and owned rooms to see if we can claim one
    const gclLevel = Game.gcl.level;
    console.log('gclLevel: ', gclLevel);

    const currentGcl = Game.gcl.level;

    // Check that we have GCL above 1.
    if ( currentGcl > 1 ) {
      // If we do, grab the first room from our rooms

      const firstRoom = Object.keys(Game.rooms)[0];

      // Check the exits to that room and see if adjacent rooms are claimed
      console.log('firstRoom: ', firstRoom);
      console.log(Game.map.getRoomStatus(firstRoom));
      console.log(Game.map.describeExits(firstRoom))
    }

    // Check list of adjacent rooms to current room

    // Pick one if available

    // Go to room

    // Claim room
  }
};