var fuse = require('fuse-bindings')
var init = require('./lib/init')
var winston = require('winston')
var args

winston.level = 'debug'

try {
  args = init.checkInit()
  var fuseCache = require('./lib/fuseCache')(args)

  winston.info('Attempting to mount Cache with args:', args)

  fuse.mount(args['target'], fuseCache)

} catch (error) {
  winston.error('Error - ' + error.toString() + '\n')
  init.showUsage()
}

process.on('SIGINT', function () {
  winston.info('Exiting time to clean up.')

  fuse.unmount(args['target'], function (err) {
    if (err) {
      winston.debug('filesystem at ' + args['target'] + ' not unmounted', err.toString())
    } else {
      winston.debug('filesystem at ' + args['target'] + ' unmounted')
    }
  })
})
