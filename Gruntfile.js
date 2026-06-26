module.exports = function (grunt) {
  "use strict";

  const https = require("https");

  const moduleFiles = ["*.js", "!Gruntfile.js"];
  const servers = {
    persistent: {
      host: "screeps.com",
      path: "/api/user/code",
      name: "Persistent",
    },
    season: {
      host: "screeps.com",
      path: "/season/api/user/code",
      name: "Season",
    },
  };

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

  function getDeployFiles() {
    return grunt.file.expand({ cwd: "." }, moduleFiles);
  }

  function moduleName(filePath) {
    return filePath.replace(/\.js$/, "");
  }

  function getRequiredModules(filePath) {
    const source = grunt.file.read(filePath);
    const modules = [];
    const requirePattern = /require\(["']([^"']+)["']\)/g;
    let match;

    while ((match = requirePattern.exec(source))) {
      modules.push(match[1]);
    }

    return modules;
  }

  function validateDeployFiles() {
    const files = getDeployFiles();
    const deployedModules = new Set(files.map(moduleName));
    const missingModules = [];

    files.forEach(function (filePath) {
      getRequiredModules(filePath).forEach(function (requiredModule) {
        if (!deployedModules.has(requiredModule)) {
          missingModules.push(filePath + " requires missing module " + requiredModule);
        }
      });
    });

    if (missingModules.length > 0) {
      grunt.fail.fatal(
        "Deploy file list is incomplete:\n" + missingModules.join("\n")
      );
    }

    grunt.log.writeln(
      "Deploying " + files.length + " Screeps modules to " +
        config.server + "/" + config.branch + ":"
    );
    files.map(moduleName).sort().forEach(function (name) {
      grunt.log.writeln("- " + name);
    });
  }

  function buildModules() {
    const modules = {};

    getDeployFiles().forEach(function (filePath) {
      modules[moduleName(filePath)] = grunt.file.read(filePath, {
        encoding: "utf8",
      });
    });

    return modules;
  }

  function requestJson(method, path, payload, done) {
    const server = servers[config.server] || servers.season;
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
    };

    if (config.token) {
      headers["X-Token"] = config.token;
    }

    const requestOptions = {
      hostname: server.host,
      path: path,
      method: method,
      headers: headers,
    };

    if (!config.token) {
      requestOptions.auth = config.email + ":" + config.password;
    }

    const req = https.request(requestOptions, function (res) {
      let data = "";

      res.setEncoding("utf8");
      res.on("data", function (chunk) {
        data += chunk;
      });

      res.on("end", function () {
        let parsed;

        try {
          parsed = JSON.parse(data);
        } catch (error) {
          done(new Error("Invalid Screeps response: " + data));
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          done(
            new Error(
              "Screeps returned HTTP " + res.statusCode + ": " + data
            )
          );
          return;
        }

        done(null, parsed);
      });
    });

    req.on("error", done);

    if (payload) {
      req.write(JSON.stringify(payload));
    }

    req.end();
  }

  function deploySeason() {
    const done = this.async();
    const server = servers[config.server] || servers.season;
    const modules = buildModules();
    const moduleNames = Object.keys(modules).sort();

    requestJson(
      "POST",
      server.path,
      {
        branch: config.branch,
        modules: modules,
      },
      function (error, response) {
        if (error) {
          grunt.fail.fatal(error.message);
          done(false);
          return;
        }

        if (!response.ok) {
          grunt.fail.fatal(
            "Screeps rejected deploy: " + JSON.stringify(response)
          );
          done(false);
          return;
        }

        requestJson(
          "GET",
          server.path + "?branch=" + encodeURIComponent(config.branch),
          null,
          function (verifyError, verifyResponse) {
            if (verifyError) {
              grunt.fail.fatal(verifyError.message);
              done(false);
              return;
            }

            const uploadedModules = Object.keys(
              verifyResponse.modules || {}
            ).sort();
            const missingModules = moduleNames.filter(function (name) {
              return uploadedModules.indexOf(name) === -1;
            });

            if (missingModules.length > 0) {
              grunt.fail.fatal(
                "Deploy verification failed. Missing uploaded modules: " +
                  missingModules.join(", ")
              );
              done(false);
              return;
            }

            grunt.log.writeln(
              "Committed " + moduleNames.length + " modules to " +
                server.name + " branch \"" + config.branch + "\"."
            );
            done();
          }
        );
      }
    );
  }

  if (!config.token && !(config.email && config.password)) {
    grunt.fail.fatal(
      "Missing Screeps credentials. Add .screeps.json or set SCREEPS_TOKEN."
    );
  }

  grunt.registerTask("deploy-preflight", validateDeployFiles);
  grunt.registerTask("deploy-season", deploySeason);
  grunt.registerTask("season", ["deploy-preflight", "deploy-season"]);
  grunt.registerTask("default", ["season"]);
};
