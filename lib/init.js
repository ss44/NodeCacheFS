'use strict'

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

  // @todo deal with parsing db options here.

  return {
    source: args[0],
    target: args[1],
    dbPath: './.fcachefs/data/'
  }
}

module.exports = {
  checkInit: checkInit,
  showUsage: showUsage
}
