var towerSpawn = {

	var spawnPos = Game.spawns['Spawn1'].pos;

	Game.spawns['Spawn1'].room.createConstructionSite( spawnPos + 5, spawnPos - 5, STRUCTURE_TOWER );

}
module.exports = towerSpawn;
