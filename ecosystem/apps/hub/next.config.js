const { createNextConfig } = require("../../next.config.base");

const config = createNextConfig(__dirname);
config.experimental.serverComponentsExternalPackages = ["nodemailer"];
module.exports = config;
