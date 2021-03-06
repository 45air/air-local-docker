const path = require('path')
const os = require('os')
const chalk = require('chalk')
const fs = require('fs-extra')
const config = require('./configure')
const execSync = require('child_process').execSync
const { rootPath } = require('./util/variables')

const error = chalk.bold.red
const warning = chalk.keyword('orange')
const info = chalk.keyword('cyan')
const success = chalk.keyword('green')
const logger = require('./util/logger')
const log = console.log

function help () {
  log(chalk.white('Usage: airlocal run <service> [command...]'))
  log()
  log(chalk.white('Options:'))
  log(chalk.white('  -h, --help         output usage information'))
  log()
  log(chalk.white('Commands:'))
  log(chalk.white('  composer [cmd...]  ') + info('Runs a composer command'))
  log(chalk.white('  npm [cmd...]       ') + info('Runs a npm command'))
  log(chalk.white('  gulp [cmd...]      ') + info('Runs a gulp command'))
}

const composer = async function (command) {
  const osType = os.type()

  await buildRunImg(osType)

  const userInfo = os.userInfo()
  const composerCache = await composerCacheDir()

  try {
    if (osType === 'Darwin') {
      execSync(
        `docker run --rm --interactive --tty --volume $PWD:/app --volume ${composerCache}:/home/docker/.composer/cache --entrypoint="" airlocal-run:phplatest-node10 composer ${command}`,
        { stdio: 'inherit' }
      )
    } else {
      execSync(
        `docker run --rm --interactive --tty --volume $PWD:/app --volume ${composerCache}:/home/docker/.composer/cache --entrypoint="" --user=${
          userInfo.uid
        }:${userInfo.gid} airlocal-run:phplatest-node10 composer ${command}`,
        { stdio: 'inherit' }
      )
    }
  } catch (err) {
    logger.log('error', err)
  }
}

const npm = async function (command) {
  const osType = os.type()

  await buildRunImg(osType)

  const userInfo = os.userInfo()

  try {
    if (osType === 'Darwin') {
      execSync(
        `docker run --rm --interactive --tty --volume $PWD:/app --entrypoint="" airlocal-run:phplatest-node10 npm ${command}`,
        { stdio: 'inherit' }
      )
    } else {
      execSync(
        `docker run --rm --interactive --tty --volume $PWD:/app --entrypoint="" --user=${
          userInfo.uid
        }:${userInfo.gid} airlocal-run:phplatest-node10 npm ${command}`,
        { stdio: 'inherit' }
      )
    }
  } catch (err) {
    logger.log('error', err)
  }
}

const gulp = async function (command) {
  const osType = os.type()

  await buildRunImg(osType)

  const userInfo = os.userInfo()

  try {
    if (osType === 'Darwin') {
      execSync(
        `docker run --rm --interactive --tty --volume $PWD:/app --entrypoint="" airlocal-run:phplatest-node10 npm run gulp`,
        { stdio: 'inherit' }
      )
    } else {
      execSync(
        `docker run --rm --interactive --tty --volume $PWD:/app --entrypoint="" --user=${
          userInfo.uid
        }:${userInfo.gid} airlocal-run:phplatest-node10 npm run gulp`,
        { stdio: 'inherit' }
      )
    }
  } catch (err) {
    logger.log('error', err)
  }
}

const composerCacheDir = async function () {
  const composerCache = path.join(
    config.getConfigDirectory(),
    'cache',
    'composer'
  )
  await fs.ensureDir(composerCache)
  return composerCache
}

const buildRunImg = async function (osType) {
  const buildDir = path.join(rootPath, 'build', 'run')
  const userInfo = os.userInfo()

  try {
    execSync(
      'cd ' +
        buildDir +
        ` && docker build --build-arg NODE_VERSION="10" --build-arg USER_ID=${
          userInfo.uid
        } --build-arg OS_TYPE=${osType} --build-arg GROUP_ID=${
          userInfo.gid
        } -t airlocal-run:phplatest-node10 .`,
      { stdio: 'inherit' }
    )
    log(success('Built airlocal-run:phplatest-node10'))
  } catch (err) {
    logger.log('error', err)
    log(error('Problem building airlocal-run:phplatest-node10'))
    process.exit(1)
  }
}

module.exports = { help, composer, npm, gulp, composerCacheDir }
