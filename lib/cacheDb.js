const winston = require('winston')
const _ = require('underscore')
const connect = require('camo').connect
const Q = require('Q')
const docs = require('../db/directory.js')

class CacheDb {
  /**
   * DbWrapper to use for fetching, and storing files in the cache.
   * @param {string} path string Path to store the database file.
   * @param {object} options object Options that can be passed into db wrapper.
   * @param {int} [options.dirKeepAlive = 300] Seconds to keep and directory attributes as fresh before forcing refreshing.
   * @param {int} [options.fileKeepAlive = 0]  Seconds to keep file info before forcing refresh. 0: Never refresh.
   */
  constructor (dbPath, options) {
    // Get dB ready and going.
    this.defaults = {
      dirKeepAlive: 300,
      fileKeepAlive: 0
    }

    this.options = _.extend(this.defaults, options)

    winston.debug('Initializing DB -- (%s)', dbPath)

    var uri = 'nedb://' + dbPath
    this.db = null

    connect(uri).then(function (db) {
      winston.debug('db successfully connected.', db)
      this.db = db
    }).catch((err) => {
      winston.error('error initializing db.', err)
    })
  }

  /**
   * Attempts to fetch cached dir. If directory is not currently cached will return undefined.
   * @return {object | undefined} Returns a directory object or undefined if nothing found.
   */

  fetchDir (path) {
    var $q = Q.defer()

    // attempt to fetch from directory.
    winston.debug('fetching directory (%s) from cache.. ', path)

    docs.Directory.findOne({path: path}).then((dir) => {
      if (dir === null) {
        $q.reject(dir)
      } else {
        // Compare time of cached directory to now
        winston.debug('directory keep alive is set to -- ', this.options.dirKeepAlive)

        // Calculates the difference in seconds based on the unix timestamp.
        var timeDiff = ((new Date().getTime() - dir.lastUpdated.getTime()) / 1000).toFixed(0)
        winston.debug('diff', timeDiff)

        // Test to see if the directory path is still fresh enough to serve.
        if (timeDiff > this.options.dirKeepAlive) {
          winston.debug('cached dir is expired: (diff: %d)', timeDiff)

          // Delete existing cache and reject.
          dir.delete().then(() => {
            $q.reject(dir)
          })
        } else {
          $q.resolve(dir)
        }
      }
    })

    return $q.promise
  }

  /**
   * handle adding a new directory to our cache.
   */
  cacheDir (path, files) {
    winston.info('Attempting to cache directory: (%s)', path)
    var $q = Q.defer()

    var dir = docs.Directory.create()

    dir.path = path
    dir.lastUpdated = new Date()

    files.forEach((fileInDir) => {
      var file = docs.File.create()
      file.name = fileInDir
      file.lastUpdated = null
      file.path = path + fileInDir

      dir.files.push(file)
    })

    winston.debug('trying to save dir', dir)

    dir.save()
      .then(() => {
        winston.debug('Directory and files saved.')
        $q.resolve()
      })
      .catch((err) => {
        winston.error('Error saving directory and files.', err.toString())
        $q.reject()
      })

    return $q.promise
  }
}

module.exports = (path) => {
  winston.debug('getting db with path (%s)', path)
  return new CacheDb(path)
}
