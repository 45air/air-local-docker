const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const chalk = require('chalk')
const log = console.log
const execSync = require('child_process').execSync
const slugify = require('@sindresorhus/slugify')
const isPortReachable = require('is-port-reachable')
const async = require('asyncro')
const configure = require('../configure')

// Tracks current config
let config = null

/**
 * Resolve the path to users home directory
 *
 * @param {string} input
 * @returns {string}
 */
function resolveHome (input) {
  return input.replace('~', os.homedir())
}

/**
 * Path to the configuration directory
 *
 * @returns {string}
 */
function getConfigDirectory () {
  return path.join(os.homedir(), '.airlocal')
}

/**
 * Path to the main configuration file
 *
 * @returns {string}
 */
function getConfigFilePath () {
  return path.join(getConfigDirectory(), 'config.json')
}

/**
 * Check if the main configuration file exists
 *
 * @returns {string}
 */
function configFileExists () {
  return path.join(getConfigDirectory(), 'config.json')
}

async function write () {
  // Make sure we have our config directory present
  await fs.ensureDir(getConfigDirectory())
  await fs.writeJson(getConfigFilePath(), config)
}

async function read () {
  let readConfig = {}

  if (await fs.exists(getConfigFilePath())) {
    readConfig = await fs.readJson(getConfigFilePath())
  }

  config = Object.assign({}, readConfig)
}

async function get (key) {
  const defaults = configure.getDefaults()

  if (config === null) {
    await read()
  }

  return typeof config[key] === 'undefined' ? defaults[key] : config[key]
}

async function set (key, value) {
  if (config === null) {
    await read()
  }

  config[key] = value

  await write()
}

async function sitesPath () {
  const path = await get('sitesPath')
  return path
}

function envSlug (env) {
  return slugify(env)
}

async function envPath (env) {
  const envPath = path.join(await sitesPath(), envSlug(env))

  return envPath
}

function checkIfDockerRunning () {
  var output

  try {
    output = execSync('docker system info')
  } catch (er) {
    return false
  }

  if (
    output
      .toString()
      .toLowerCase()
      .indexOf('version') === -1
  ) {
    return false
  }

  return true
}

async function shareErrors () {
  const sharing = await configure.get('shareErrors')
  return sharing
}

async function portsInUse () {
  const dbPort = await isPortReachable(3306)
  const mailhogPort = await isPortReachable(1025)
  const mailhogPortExtra = await isPortReachable(1080)

  if (dbPort || mailhogPort || mailhogPortExtra) {
    log(
      chalk.bold.yellow('Warning: ') +
        chalk.yellow(
          'You have ports in use already that will conflict with AIRLocal'
        )
    )
    return true
  }
  return false
}

module.exports = {
  checkIfDockerRunning,
  envPath,
  sitesPath,
  envSlug,
  get,
  set,
  read,
  write,
  configFileExists,
  getConfigFilePath,
  getConfigDirectory,
  resolveHome,
  async,
  shareErrors,
  portsInUse
}
