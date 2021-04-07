const chalk = require('chalk')
const path = require('path')
const fs = require('fs-extra')
const yaml = require('node-yaml')
const inquirer = require('inquirer')
const database = require('./database')
const gateway = require('./gateway')
const environment = require('./environment')
const snapshots = require('./snapshots')
const wordpress = require('./wordpress')
const auth = require('./auth')
const config = require('./configure')
const execSync = require('child_process').execSync
const helpers = require('./util/helpers')
const utils = require('./util/utilities')
const pkg = require('../package.json')
const axios = require('axios')
const { srcPath, globalPath, rootPath } = require('./util/variables')

const log = console.log
const logger = require('./util/logger')
const error = chalk.bold.red
const warning = chalk.keyword('orange')
const info = chalk.keyword('cyan')
const success = chalk.keyword('green')

const createEnv = async function () {
  log(rootPath)
  const authConfig = await auth.checkIfAuthConfigured()

  var baseConfig = {
    version: '3',
    services: {
      redis: {
        image: 'redis:latest'
      }
    }
  }

  var networkConfig = {
    networks: {
      airlocaldocker: {
        external: {
          name: 'airlocaldocker'
        }
      }
    }
  }

  var volumeConfig = {
    volumes: {}
  }

  const questions = [
    {
      name: 'hostname',
      type: 'input',
      message:
        'What is the primary hostname for your site? (Must be a .test domain Ex: docker.test)',
      validate: helpers.validateNotEmpty,
      filter: helpers.parseHostname
    },
    {
      name: 'addMoreHosts',
      type: 'confirm',
      message: 'Are there additional domains the site should respond to?',
      default: false
    },
    {
      name: 'extraHosts',
      type: 'input',
      message:
        'Enter additional hostnames separated by spaces (Ex: docker1.test docker2.test)',
      filter: async function (value) {
        const answers = value
          .split(' ')
          .map(function (value) {
            return value.trim()
          })
          .filter(function (value) {
            return value.length > 0
          })
          .map(helpers.parseHostname)

        return answers
      },
      when: function (answers) {
        return answers.addMoreHosts === true
      }
    },
    {
      name: 'mediaProxy',
      type: 'confirm',
      message:
        'Do you want to set a proxy for media assets? (i.e. Serving /wp-content/uploads/ directory assets from a production or development site)',
      default: false
    },
    {
      name: 'proxy',
      type: 'input',
      message: 'Proxy URL',
      default: function (answers) {
        return utils.createDefaultProxy(answers.hostname)
      },
      validate: helpers.validateNotEmpty,
      filter: helpers.parseProxyUrl,
      when: function (answers) {
        return answers.mediaProxy === true
      }
    },
    {
      name: 'phpVersion',
      type: 'list',
      message: 'What version of PHP would you like to use?',
      choices: ['8.0', '7.4', '7.3', '7.2', '7.1', '7.0'],
      default: '7.3'
    },
    {
      name: 'wordpress',
      type: 'confirm',
      message: 'Do you want to install WordPress?'
    },
    {
      name: 'wordpressType',
      type: 'list',
      message: 'Select a WordPress installation type:',
      choices: [
        { name: 'Single Site', value: 'single' },
        { name: 'Subdirectory Multisite', value: 'subdirectory' },
        { name: 'Subdomain Multisite', value: 'subdomain' }
      ],
      default: 'single',
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'emptyContent',
      type: 'confirm',
      message: 'Do you want to remove the default content?',
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'title',
      type: 'input',
      message: 'Site Name',
      default: function (answers) {
        return answers.hostname
      },
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'username',
      type: 'input',
      message: 'Admin Username',
      default: 'admin',
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'password',
      type: 'input',
      message: 'Admin Password',
      default: 'password',
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'email',
      type: 'input',
      message: 'Admin Email',
      default: 'admin@example.com',
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    }
  ]

  const questionsAuth = [
    {
      name: 'aircloud',
      type: 'confirm',
      message: 'Is this a devops.45air.co Gitlab project?',
      default: true
    },
    {
      name: 'id',
      type: 'number',
      message:
        'What is the devops.45air.co Gitlab project ID? (Project Overview > Details - Right under the repo title)',
      validate: helpers.validateNumber,
      when: function (answers) {
        return answers.aircloud === true
      }
    },
    {
      name: 'environment',
      type: 'list',
      message: 'Which environment would you like setup?',
      choices: ['stage', 'develop'],
      default: 'stage',
      when: function (answers) {
        return answers.aircloud === true
      }
    },
    {
      name: 'hostname',
      type: 'input',
      message:
        'What is the primary hostname for your site? (Must be a .test domain Ex: docker.test)',
      validate: helpers.validateNotEmpty,
      filter: helpers.parseHostname
    },
    {
      name: 'addMoreHosts',
      type: 'confirm',
      message: 'Are there additional domains the site should respond to?',
      default: false
    },
    {
      name: 'extraHosts',
      type: 'input',
      message:
        'Enter additional hostnames separated by spaces (Ex: docker1.test docker2.test)',
      filter: async function (value) {
        const answers = value
          .split(' ')
          .map(function (value) {
            return value.trim()
          })
          .filter(function (value) {
            return value.length > 0
          })
          .map(helpers.parseHostname)

        return answers
      },
      when: function (answers) {
        return answers.addMoreHosts === true
      }
    },
    {
      name: 'mediaProxy',
      type: 'confirm',
      message:
        'Do you want to set a proxy for media assets? (i.e. Serving /wp-content/uploads/ directory assets from a production or development site)',
      default: false
    },
    {
      name: 'proxy',
      type: 'input',
      message: 'Proxy URL',
      default: function (answers) {
        return utils.createDefaultProxy(answers.hostname)
      },
      validate: helpers.validateNotEmpty,
      filter: helpers.parseProxyUrl,
      when: function (answers) {
        return answers.mediaProxy === true
      }
    },
    {
      name: 'phpVersion',
      type: 'list',
      message: 'What version of PHP would you like to use?',
      choices: ['8.0', '7.4', '7.3', '7.2', '7.1', '7.0'],
      default: '7.3'
    },
    {
      name: 'wordpress',
      type: 'confirm',
      message: 'Do you want to install WordPress?',
      when: function (answers) {
        return answers.aircloud === false
      }
    },
    {
      name: 'wordpressType',
      type: 'list',
      message: 'Select a WordPress installation type:',
      choices: [
        { name: 'Single Site', value: 'single' },
        { name: 'Subdirectory Multisite', value: 'subdirectory' },
        { name: 'Subdomain Multisite', value: 'subdomain' }
      ],
      default: 'single',
      when: function (answers) {
        return answers.aircloud === false && answers.wordpress === true
      }
    },
    {
      name: 'emptyContent',
      type: 'confirm',
      message: 'Do you want to remove the default content?',
      when: function (answers) {
        return answers.wordpress === true && answers.aircloud === false
      }
    },
    {
      name: 'title',
      type: 'input',
      message: 'Site Name',
      default: function (answers) {
        return answers.hostname
      },
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true && answers.aircloud === false
      }
    },
    {
      name: 'username',
      type: 'input',
      message: 'Admin Username',
      default: 'admin',
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true && answers.aircloud === false
      }
    },
    {
      name: 'password',
      type: 'input',
      message: 'Admin Password',
      default: 'password',
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true && answers.aircloud === false
      }
    },
    {
      name: 'email',
      type: 'input',
      message: 'Admin Email',
      default: 'admin@example.com',
      validate: helpers.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true && answers.aircloud === false
      }
    }
  ]

  let answers

  // Ask questions depending on if the user is authed in or not.
  if (authConfig) {
    answers = await inquirer.prompt(questionsAuth)
  } else {
    answers = await inquirer.prompt(questions)
  }

  // Folder name inside of /air-local-docker-sites/ for this site
  const envHost = answers.hostname
  const envSlug = utils.envSlug(envHost)
  const envPath = await utils.envPath(envHost)

  if ((await fs.exists(envPath)) === true) {
    log(
      error('Error: ') +
        error(envHost) +
        error(
          ' environment already exists. To recreate the environment, please delete it first by running '
        ) +
        info('airlocal delete ') +
        info(envHost)
    )
    process.exit(1)
  }

  await fs.copySync(path.join(globalPath, '.env'), path.join(envPath, '.env'))

  await gateway.startGlobal()

  let allHosts = [answers.hostname]
  const starHosts = []

  if (answers.addMoreHosts === true) {
    answers.extraHosts.forEach(function (host) {
      allHosts.push(host)
    })
  }

  // Remove duplicates
  allHosts = allHosts.filter(function (item, pos, self) {
    return self.indexOf(item) === pos
  })

  allHosts.forEach(function (host) {
    starHosts.push(`*.${host}`)
  })

  // Create webroot/config
  log(info('Copying required files'))

  await fs.copy(path.join(srcPath, 'config'), path.join(envPath, 'config'))

  // Write AirLocal site configuration file
  log(info('Writing AirLocal site configuration file'))
  const envConfig = {
    envHosts: allHosts,
    version: pkg.version,
    aircloud: answers.aircloud
  }
  await fs.writeJson(path.join(envPath, '.config.json'), envConfig)
  log(success('Site configuration file .config.json created'))

  // Media proxy is selected
  if (answers.mediaProxy === true) {
    // Write the proxy to the config files
    log(info('Writing proxy configuration'))

    await new Promise(resolve => {
      fs.readFile(
        path.join(envPath, 'config', 'nginx', 'global', 'media-proxy.conf'),
        'utf8',
        function (err, curConfig) {
          if (err) {
            logger.log('error', err)
            log(
              error(
                'Failed to read nginx configuration file. Your media proxy has not been set.'
              )
            )
            resolve()
            return
          }

          fs.writeFile(
            path.join(envPath, 'config', 'nginx', 'global', 'media-proxy.conf'),
            createProxyConfig(answers.proxy, curConfig),
            'utf8',
            function (err) {
              if (err) {
                logger.log('error', err)
                log(
                  error(
                    'Failed to write configuration file. Your media proxy has not been set.'
                  )
                )
                resolve()
              }
            }
          )

          log(success('Proxy configured'))
          resolve()
        }
      )
    })
  }

  // Write to hosts file if user has configured it
  if ((await config.get('manageHosts')) === true) {
    log(info('Adding entry to hosts file'))
    const sudoOptions = {
      name: 'AirLocal'
    }
    const hostsstring = allHosts.join(' ')
    const hostsCmd = path.join(rootPath, 'airlocal-hosts')
    try {
      await utils.writeHosts(hostsCmd, hostsstring, sudoOptions)
    } catch (err) {}
  }

  // Create DB
  log(info('Creating database'))
  try {
    await database.create(envSlug)
    await database.assignPrivs(envSlug)
  } catch (err) {
    logger.log('error', err)
    log(error('Error creating DB'))
    process.exit(1)
  }
  log(success('Successfully created DB ' + envSlug))

  const wpCliCache = path.join(config.getConfigDirectory(), 'cache', 'wp-cli')
  await fs.ensureDir(wpCliCache)

  // Run this if authentication is configured
  // and user is setting up an AirCloud site
  if (authConfig && answers.aircloud) {
    // Validate project ID with Gitlab and get repo information
    let response
    const token = await auth.get('token')
    try {
      const options = {
        headers: { 'Private-Token': token }
      }
      response = await axios.get(
        'https://devops.45air.co/api/v4/projects/' + answers.id,
        options
      )
    } catch (err) {
      if (err.response) {
        log(error(err.response.data.message))
        log(error('Invalid project ID'))
        process.exit(1)
      } else if (err.request) {
        log(
          error(
            'No response from the server. Logging the error request and exiting'
          )
        )
        process.exit(1)
      }
      log(error(err.message))
      process.exit(1)
    }
    log(
      success(
        'Project ID is valid for repo ' +
          info(response.data.path_with_namespace)
      )
    )

    // Clone git repo and checkout branch
    const repoPath = response.data.path_with_namespace
    const repoSlug = response.data.path
    const userName = await auth.get('user')
    const userPat = await auth.get('token')
    let branch = answers.environment
    if (branch === 'stage') {
      branch = 'master'
    }
    try {
      execSync(
        `git clone https://${userName}:${userPat}@devops.45air.co/${repoPath}.git`,
        { stdio: 'inherit', cwd: envPath }
      )
      execSync(`git checkout -b ${branch}`, {
        stdio: 'inherit',
        cwd: envPath + '/' + repoSlug
      })
    } catch (err) {
      logger.log('error', err)
      log(error('Error cloning repo from Gitlab'))
      process.exit(1)
    }
    log(success('Cloned site repo ' + repoPath))
    log(success('Checked out ' + branch + ' branch of ' + repoSlug))

    // Generate auth.json file for composer authentication
    log(info('Generating auth.json for composer authentication'))
    try {
      const authJson = {
        'http-basic': {
          'devops.45air.co': {
            username: userName,
            password: userPat
          }
        }
      }
      const file = path.join(envPath, repoSlug, 'auth.json')
      await fs.outputJsonSync(file, authJson)
    } catch (err) {
      logger.log('error', err)
      log(error('Error creating auth.json file for composer'))
      process.exit(1)
    }
    log(success('Successfully generated auth.json'))

    // Run composer install on site repo
    log(info('Running composer install on the site repo'))
    try {
      execSync('airlocal run composer install', {
        stdio: 'inherit',
        cwd: envPath + '/' + repoSlug
      })
    } catch (err) {
      logger.log('error', err)
      log(error('Error running composer install on the cloned repo'))
      process.exit(1)
    }
    log(success('Composer dependencies installed successfully'))

    // Generate docker-compose.yml
    log(info('Generating docker-compose.yml file'))
    const ssDir = await snapshots.getSnapshotsDir()
    baseConfig.services.phpfpm = {
      build: {
        context: './config/build',
        dockerfile: `Dockerfile-${answers.phpVersion}`,
        args: [
          'PHP_EXTENSIONS=xdebug',
          'WORDPRESS_VERSION=5.3',
          'NODE_VERSION=10',
          'WP_ENV=local',
          'TEMPLATE_PHP_INI=development'
        ]
      },
      volumes: [
        './config/php/conf.d/local.ini:/usr/local/etc/php/conf.d/local.ini',
        './config/nginx/fastcgi.d/read_timeout:/etc/nginx/fastcgi.d/read_timeout',
        './config/nginx/global/logs-off.conf:/etc/nginx/global/logs-off.conf',
        './config/nginx/global/media-proxy.conf:/etc/nginx/global/media-proxy.conf',
        `${wpCliCache}:/var/www/.wp-cli/cache`,
        './config/wp-cli.local.yml:/var/www/wp-cli.yml',
        '~/.ssh:/home/docker/.ssh',
        `${ssDir}:/var/www/.snapshots`,
        `./${repoSlug}/web/wp-config.php:/var/www/web/wp-config.php`,
        `./${repoSlug}/web/wp-content/mu-plugins:/var/www/web/wp-content/mu-plugins`,
        `./${repoSlug}/web/wp-content/plugins/:/var/www/web/wp-content/plugins/`,
        `./${repoSlug}/web/wp-content/themes/:/var/www/web/wp-content/themes/`,
        `./${repoSlug}/config:/var/www/config`,
        `./${repoSlug}/vendor:/var/www/vendor`
      ],
      depends_on: ['redis'],
      networks: ['default', 'airlocaldocker'],
      dns: ['10.0.0.2'],
      environment: {
        VIRTUAL_PORT: 80,
        WP_CLI_CACHE_DIR: '/var/www/.wp-cli/cache',
        DB_HOST: 'mysql',
        DB_USER: 'root',
        DB_PASSWORD: 'password',
        DB_NAME: `${envSlug}`
      }
    }
    baseConfig.services.phpfpm.environment.VIRTUAL_HOST = allHosts
      .concat(starHosts)
      .join(',')

    const dockerCompose = Object.assign(baseConfig, networkConfig, volumeConfig)
    try {
      yaml.writeSync(path.join(envPath, 'docker-compose.yml'), dockerCompose)
    } catch (err) {
      logger.log('error', err)
      log(error('Error creating docker-compose.yml'))
      process.exit(1)
    }
    log(success('Successfully generated docker-compose.yml'))

    // Start environment
    log(info('Fire up the ' + envSlug + ' environment'))
    await environment.start(envSlug)
  } // END authenticated and AirCloud site section

  // Run this section if user is setting up WP with AirLocal
  // not using AirCloud site
  if (answers.wordpress) {
    await environment.start(envSlug)

    const ssDir = await snapshots.getSnapshotsDir()

    baseConfig.services.phpfpm = {
      build: {
        context: './config/build',
        dockerfile: `Dockerfile-${answers.phpVersion}`,
        args: [
          'PHP_EXTENSIONS=xdebug',
          'WORDPRESS_VERSION=5.3',
          'NODE_VERSION=10',
          'WP_ENV=local',
          'TEMPLATE_PHP_INI=development'
        ]
      },
      volumes: [
        './config/php/conf.d/local.ini:/usr/local/etc/php/conf.d/local.ini',
        './config/nginx/fastcgi.d/read_timeout:/etc/nginx/fastcgi.d/read_timeout',
        './config/nginx/global/logs-off.conf:/etc/nginx/global/logs-off.conf',
        './config/nginx/global/media-proxy.conf:/etc/nginx/global/media-proxy.conf',
        `${wpCliCache}:/var/www/.wp-cli/cache`,
        './config/wp-cli.local.yml:/var/www/wp-cli.yml',
        '~/.ssh:/home/docker/.ssh',
        `${ssDir}:/var/www/.snapshots`
      ],
      depends_on: ['redis'],
      networks: ['default', 'airlocaldocker'],
      dns: ['10.0.0.2'],
      environment: {
        VIRTUAL_PORT: 80,
        WP_CLI_CACHE_DIR: '/var/www/.wp-cli/cache',
        DB_HOST: 'mysql',
        DB_USER: 'root',
        DB_PASSWORD: 'password',
        DB_NAME: `${envSlug}`
      }
    }

    await wordpress.configure(envSlug)

    await wordpress.install(envSlug, envHost, answers)

    await wordpress.setRewrites(envSlug)

    if (answers.emptyContent) {
      await wordpress.emptyContent(envSlug)
    }
  }

  log(success('Successfully Created Site!'))

  log(info('Visit your new site @ http://' + answers.hostname))

  log(
    warning(
      'NOTE: It could take up to 60 seconds for the site to come completely up'
    )
  )

  if (answers.wordpressType === 'subdomain') {
    log(
      info(
        'NOTE: Subdomain multisites require any additional subdomains to be added manually to your hosts file'
      )
    )
  }
}

/**
 * Create the NGINX directive to set a media URL proxy
 *
 * @param {string} proxy The URL to set the proxy to
 * @param {string} curConfig Complete content of the existing config file
 * @return {string} New content for the config file
 */
const createProxyConfig = (proxy, curConfig) => {
  const proxyMarkup =
    'location @production {' +
    '\r\n' +
    '        resolver 8.8.8.8;' +
    '\r\n' +
    '        proxy_pass ' +
    proxy +
    '/$uri;' +
    '\r\n' +
    '    }'

  const proxyMapObj = {
    '#{TRY_PROXY}': 'try_files $uri @production;',
    '#{PROXY_URL}': proxyMarkup
  }

  const re = new RegExp(Object.keys(proxyMapObj).join('|'), 'gi')

  const newConfig = curConfig.replace(re, function (matched) {
    return proxyMapObj[matched]
  })

  return curConfig.replace(curConfig, newConfig)
}

const command = async function () {
  await createEnv()
}

module.exports = { command }
