const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const execSync = require('child_process').execSync
const sudo = require('sudo-prompt')
const slugify = require('@sindresorhus/slugify')
const async = require('asyncro')
const inquirer = require('inquirer')
const chalk = require('chalk')
const helper = require('./helpers')
const error = chalk.bold.red
const warning = chalk.keyword('orange')
const info = chalk.keyword('cyan')
const success = chalk.keyword('green')
const logger = require('./logger')
const log = console.log

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
async function getConfigFilePath () {
  return path.join(getConfigDirectory(), 'config.json')
}

/**
 * Check if the main configuration file exists
 *
 * @returns {string}
 */
async function configFileExists () {
  return path.join(getConfigDirectory(), 'config.json')
}

async function write () {
  const config = await read()
  // Make sure we have our config directory present
  await fs.ensureDir(getConfigDirectory())
  await fs.writeJson(getConfigFilePath(), config)
}

async function read () {
  let readConfig = {}

  const confPath = await getConfigFilePath()
  if (await fs.exists(confPath)) {
    readConfig = await fs.readJson(confPath)
  }

  const config = Object.assign({}, readConfig)

  return config
}

async function get (key) {
  const config = await read()

  return typeof config[key] === 'undefined' ? '' : config[key]
}

async function set (key, value) {
  const config = await read()

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
  } catch (err) {
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

/**
 * Run tasks required when updating airlocal versions
 *
 * @param {string} existing Last configured version.
 * @param {string} current  Current version.
 * @returns {boolean}
 */
async function runUpdateTasks (existing, current) {
  execSync('airlocal image update all', { stdio: 'inherit' })
  execSync('airlocal cache clear', { stdio: 'inherit' })
  execSync('airlocal stop all', { stdio: 'inherit' })
}

const parseEnvFromCWD = async function () {
  // Compare both of these as all lowercase to account for any misconfigurations
  let cwd = process.cwd().toLowerCase()
  let sitesPathValue = await sitesPath()
  sitesPathValue = sitesPathValue.toLowerCase()

  if (cwd.indexOf(sitesPathValue) === -1) {
    return false
  }

  if (cwd === sitesPathValue) {
    return false
  }

  // Strip the base sitepath from the path
  cwd = cwd.replace(sitesPathValue, '').replace(/^\//i, '')

  // First segment is now the envSlug, get rid of the rest
  cwd = cwd.split('/')[0]

  // Make sure that a .config.json file exists here
  const configFile = path.join(sitesPathValue, cwd, '.config.json')
  if (!(await fs.exists(configFile))) {
    return false
  }

  return cwd
}

const getAllEnvironments = async function () {
  const sitePath = await get('sitesPath')
  let dirContent = await fs.readdir(sitePath)

  // Make into full path
  dirContent = await async.map(dirContent, async item => {
    return path.join(sitePath, item)
  })

  // Filter any that aren't directories
  dirContent = await async.filter(dirContent, async item => {
    const stat = await fs.stat(item)
    return stat.isDirectory()
  })

  // Filter any that don't have the .config.json file (which indicates its probably not a AIRLocal Environment)
  dirContent = await async.filter(dirContent, async item => {
    const configFile = path.join(item, '.config.json')

    const config = await fs.exists(configFile)
    return config
  })

  // Back to just the basename
  dirContent = await async.map(dirContent, async item => {
    return path.basename(item)
  })

  return dirContent
}

const promptEnv = async function () {
  const environments = await getAllEnvironments()

  const questions = [
    {
      name: 'envSlug',
      type: 'list',
      message: 'What environment would you like to use?',
      choices: environments
    }
  ]

  log(
    chalk.bold.white('Unable to determine environment from current directory')
  )
  const answers = await inquirer.prompt(questions)

  return answers.envSlug
}

const parseOrPromptEnv = async function () {
  let envSlug = await parseEnvFromCWD()

  if (envSlug === false) {
    envSlug = await promptEnv()
  }

  return envSlug
}

const getEnvHosts = async function (envPath) {
  try {
    const envConfig = await fs.readJson(path.join(envPath, '.config.json'))

    return typeof envConfig === 'object' && undefined !== envConfig.envHosts
      ? envConfig.envHosts
      : []
  } catch (ex) {
    return []
  }
}

const getPathOrError = async function (env) {
  if (env === false || undefined === env || env.trim().length === 0) {
    env = await promptEnv()
  }

  log(chalk.bold.white(`Locating project files for ${env}`))

  const _envPath = await envPath(env)
  if (!(await fs.pathExists(_envPath))) {
    log(error(`ERROR: Cannot find ${env} environment!`))
    process.exit(1)
  }

  return _envPath
}

/**
 * Format the default Proxy URL based on entered hostname
 *
 * @param  {string} value The user entered hostname
 * @return {string} The formatted default proxy URL
 */
const createDefaultProxy = function (value) {
  let proxyUrl = 'http://' + helper.removeEndSlashes(value)
  const proxyUrlTLD = proxyUrl.lastIndexOf('.')

  if (proxyUrlTLD === -1) {
    proxyUrl = proxyUrl + '.com'
  } else {
    proxyUrl = proxyUrl.substring(0, proxyUrlTLD + 1) + 'com'
  }

  return proxyUrl
}

const writeHosts = function (cmd, hosts, options) {
  return new Promise(resolve => {
    sudo.exec(cmd + ' add ' + hosts, options, function (error, stdout, stderr) {
      if (error) {
        //logger.log('error', error)
        console.log(chalk.bold.red('Error failed to write to hosts file'))
        log(
          warning('Add "127.0.0.1 ' + hosts + '" to your hosts file manually')
        )
        resolve()
      }
      if (stderr) {
        //logger.log('error', stderr)
         console.log(chalk.bold.red('Error failed to write to hosts file'))
        log(
          warning('Add "127.0.0.1 ' + hosts + '" to your hosts file manually')
        )
        resolve()
      }
      log(success('Added ' + hosts + ' to hosts file'))
      resolve()
    })
  })
}

const removeHosts = function (cmd, hosts, options) {
  return new Promise(resolve => {
    sudo.exec(cmd + ' remove ' + hosts, options, function (
      error,
      stdout,
      stderr
    ) {
      if (error) {
        //logger.log('error', error)
        console.log(chalk.bold.red('Error failed to write to hosts file'))
        log(
          warning(
            'Remove "127.0.0.1 ' + hosts + '" to your hosts file manually'
          )
        )
        resolve()
      }
      if (stderr) {
        //logger.log('error', stderr)
        console.log(chalk.bold.red('Error failed to write to hosts file'))
        log(
          warning(
            'Remove "127.0.0.1 ' + hosts + '" to your hosts file manually'
          )
        )
        resolve()
      }
      log(success('Removed ' + hosts + ' from hosts file'))
      resolve()
    })
  })
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
  runUpdateTasks,
  parseEnvFromCWD,
  getAllEnvironments,
  promptEnv,
  parseOrPromptEnv,
  getEnvHosts,
  getPathOrError,
  createDefaultProxy,
  writeHosts,
  removeHosts
}
