module.exports = {
  run: function (creep) {
    // Check GCL level and owned rooms to see if we can claim one
    const gclLevel = Game.gcl.level;
    console.log('gclLevel: ', gclLevel);

    const currentGcl = Game.gcl.level;

    // Check if owned rooms (Game.rooms.length) is less (<) than GCL (Game.gcl.level or gclLevel)
    // Probably do this in main instead

    // Find rooms nearby
    // Check room statuses
    // Pick best room

    // Move to chosen room

    // If in chosen room, run claim function

    // Check that we have GCL above 1.
    if ( currentGcl > 1 ) {
      // If we do, grab the first room from our rooms

      const firstRoom = Object.keys(Game.rooms)[0];

      // Check the exits to that room and see if adjacent rooms are claimed
      console.log('firstRoom: ', firstRoom);
      const status = Game.map.getRoomStatus(firstRoom);
      console.log('status: ', status.status);
      try{
        const exits = Game.map.describeExits(firstRoom)
        for ( exit in exits ) {
          console.log('Exits', exits[exit]);
          console.log('Top Exit', exits["1"]);
          console.log('Right Exit', exits["3"]);
          console.log('Bottom Exit', exits["5"]);
          console.log('Left Exit', exits["7"]);
        }
      } catch (error) {
        console.log(error)
      }



    }

    // Check list of adjacent rooms to current room

    // Pick one if available

    // Go to room

    // Claim room
  }
};