module.exports = {
    apps : [{
      name: "socket",
      script: "./socket/init.js",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      }
    }]
}