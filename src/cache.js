const chalk = require('chalk')
const gateway = require('./gateway')
const execSync = require('child_process').execSync

const info = chalk.keyword('cyan')
const success = chalk.keyword('green')
const log = console.log

function help () {
  log(chalk.white('Usage: airlocal cache [command]'))
  log()
  log(chalk.white('Options:'))
  log(chalk.white('  -h, --help       output usage information'))
  log()
  log(chalk.white('Commands:'))
  log(
    chalk.white('  clear            ') +
      info('Clears WP-CLI, NPM, and AIRSnapshots caches')
  )
}

const clear = async function () {
  await gateway.removeCacheVolume()
  await gateway.ensureCacheExists()

  log(success('Cache Cleared'))
}

const printInfo = async function () {
  log(chalk.white('Cache Volume Information'))
  const networks = execSync(
    'docker volume ls --filter name=^airlocalCache$'
  ).toString()
  log(networks)
}

module.exports = { help, clear, printInfo }
