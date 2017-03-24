'use strict'
const _ = require('underscore')
const bytes = require('bytes')

/**
 * Show basic usage.
 */
function showUsage () {
  process.stdout.write('Usage: jsCacheFS <source dir> <cached target dir> \n')
}

/**
 * @throws Error Throws an error if missing usage.
 * @returns Array the parsed arguments.
 */
function checkInit () {
  var args = process.argv.slice(2)

  if (args.length < 2) {
    throw new Error('Invalid arguments passed.')
  }

  let defaults = {
    dirKeepAlive: 300, // Seconds before refreshing contents of a directory.
    fileKeepAlive: 0, // Seconds to keep a file cached - before re-caching.
    cacheThreads: 5, // Track how many cache blocks are read at once.
    cacheDir: './.fcachefs/data/', // Path where cache blocks are stored.
    cacheBlockSize: '20mb', // Default cache block size
    dbPath: './.fcachefs/db/' // path where db with meta-data is stored.
  }

  // Attempt to parse and set arguments.
  let options = {
    source: args[0],
    target: args[1]
  }

  // Merge in defaults.
  options = _.extend(defaults, options)

  // Normlaize any of the fields that we need to.
  options.cacheBlockSize = bytes(options.cacheBlockSize)

  // @todo deal with parsing db options here.
  return options
}

module.exports = {
  checkInit: checkInit,
  showUsage: showUsage
}
