'use strict'
const merge = require('webpack-merge')
const prodEnv = require('./prod.env')
const apiConf = require('./api_config.json')

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  API_PATH: JSON.stringify(apiConf.path)
})
