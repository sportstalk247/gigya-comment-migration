// TODO: Take command line arguments to select environments based on different .env files.
dotenv = require('dotenv').config();

var config = {};

config.environments = [{
    label: "sandbox",
    token: process.env.SPORTSTALK_TOKEN,
    appid: process.env.SPORTSTALK_APP_ID,
    streamFileName: "./data/commentstreams_file.json",
    commentFileName: "./data/comments_file.json",
    description: "Environment for testing Migration Script"
}]

config.getEnv = function(environment) {
    for (let loop = 0; loop < this.environments.length; loop++) {
        if (this.environments[loop].label === environment) {
            return this.environments[loop];
        }
    }

    throw new Error("The specified environment '" + environment + "' is not defined");
}

module.exports = config;