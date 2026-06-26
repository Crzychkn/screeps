module.exports = function (grunt) {
  "use strict";

  function readLocalConfig() {
    if (!grunt.file.exists(".screeps.json")) {
      return {};
    }

    return grunt.file.readJSON(".screeps.json");
  }

  function envConfig() {
    return {
      email: process.env.SCREEPS_EMAIL,
      password: process.env.SCREEPS_PASSWORD,
      token: process.env.SCREEPS_TOKEN,
      server: process.env.SCREEPS_SERVER,
      branch: process.env.SCREEPS_BRANCH,
    };
  }

  function mergeConfig() {
    const fileConfig = readLocalConfig();
    const selectedFileConfig = fileConfig.season || fileConfig;
    const env = envConfig();

    return {
      email: env.email || selectedFileConfig.email,
      password: env.password || selectedFileConfig.password,
      token: env.token || selectedFileConfig.token,
      server: env.server || selectedFileConfig.server || "season",
      branch: env.branch || selectedFileConfig.branch || "default",
    };
  }

  const config = mergeConfig();

  if (!config.token && !(config.email && config.password)) {
    grunt.fail.fatal(
      "Missing Screeps credentials. Add .screeps.json or set SCREEPS_TOKEN."
    );
  }

  grunt.loadNpmTasks("grunt-screeps");

  grunt.initConfig({
    screeps: {
      season: {
        options: config,
        files: [
          {
            expand: true,
            cwd: ".",
            src: ["*.js", "!Gruntfile.js"],
            flatten: true,
          },
        ],
      },
    },
  });

  grunt.registerTask("season", ["screeps:season"]);
  grunt.registerTask("default", ["season"]);
};
