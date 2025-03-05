module.exports = {
    run: function (creep) {
        try {
            // Find hostiles in room
            let hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
            let hostilesAmount = hostiles.length;

            // Attack if in range
            if (hostilesAmount > 0) {
                if (creep.attack(hostiles[0]) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(hostiles[0], {
                        visualizePathStyle: {stroke: "#ffffff"}
                    });
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
}