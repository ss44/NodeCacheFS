const winston = require('winston')
const _ = require('underscore')
const connect = require('camo').connect
const Q = require('Q')
const docs = require('../db/index.js')
const async = require('async')

class CacheDb {
  /**
   * DbWrapper to use for fetching, and storing files in the cache.
   * @param {string} path string Path to store the database file.
   * @param {object} options object Options that can be passed into db wrapper.
   * @param {int} [options.dirKeepAlive = 300] Seconds to keep and directory attributes as fresh before forcing refreshing.
   * @param {int} [options.fileKeepAlive = 0]  Seconds to keep file info before forcing refresh. 0: Never refresh.
   */
  constructor (dbPath, options) {
    var $q = Q.defer()

    // Get dB ready and going.
    this.defaults = {
      dirKeepAlive: 300,
      fileKeepAlive: 0
    }

    this.docs = docs
    this.options = _.extend(this.defaults, options)

    winston.debug('Initializing DB -- (%s)', dbPath)

    var uri = 'nedb://' + dbPath
    this.db = null

    connect(uri)
      .then((db) => {
        winston.debug('db successfully connected.')
        this.db = db
        $q.resolve(this)
      }).catch((err) => {
        winston.error('error initializing db.', err)
        $q.reject('Error initializing cacheDB')
      })

    return $q.promise
  }

  /**
   * Attempts to fetch cached dir.
   * @async
   * @returns {object} Returns a directory object or null if nothing found.
   * @throws Error
   */

  fetchDir (path) {
    var $q = Q.defer()

    // attempt to fetch from directory.
    winston.debug('%s :: directory (%s) from cache.. ', 'fetchDir', path)

    docs.Directory.findOne({path: path})
      .then((dir) => {
        $q.resolve(dir)
      })
      .catch((err) => {
        $q.reject(err)
      })

    return $q.promise
  }

  /**
   * handle adding a new directory to our cache.
   */
  cacheDir (path, files) {
    var $q = Q.defer()
    var _dir = null

    winston.info('%s :: Attempting to cache directory: (%s)', 'cacheDb.cacheDir', path)

    // Find an existing directory or create.
    docs.Directory.findOne({path: path})
      .then((dir) => {
        _dir = dir

        if (dir === null) {
          _dir = docs.Directory.create()
          _dir.path = path
        }

        _dir.lastUpdated = new Date()

        winston.debug('%s :: trying to save dir', 'cacheDb.cacheDir')
        return _dir.save()
      })
      .then(() => {
        winston.debug('%s :: Directory saved. Attempting to save files.', 'cacheDb.cacheDir')

        // Loop over each file in parallel and update the file details if needed.
        async.each(files, (fileInDir, cb) => {
          var filePath = path + fileInDir

          docs.File.findOne({path: filePath})
            .catch((err) => {
              winston.error('%s :: Unable to find file.', 'cacheDb.cacheDir', err)
            })
            .then((file) => {
              if (file === null) {
                winston.debug('%s :: no existing cache file.', 'cacheDb.cacheDir')

                file = docs.File.create()
                file.name = fileInDir
                file.path = filePath
                file.directory = _dir._id
                return file.save()
              } else {
                return Q.promise((resolve) => resolve())
              }
            })
            .then(() => {
              cb(0)
            })
            .catch((err) => {
              winston.error('%s :: error saving / fetching cached file - (%s)', 'cacheDb.cacheDir', err)
              cb(err)
            })
        }, (err) => {
          if (err) {
            winston.error('%s :: error trying to save directory files. (%s)', 'cacheDb.cacheDir', err)
            $q.reject(err)
            return
          }

          winston.debug('%s :: Done saving and caching files.', 'cacheDb.cacheDir')
          $q.resolve(_dir)
        })
      })
      .catch((err) => {
        winston.error('%s :: Error saving directory and files.', 'cacheDb.cacheDir', err.toString())
        $q.reject()
      })

    return $q.promise
  }

  fetchFile (path) {
    var $q = Q.defer()

    winston.debug('%s :: Attempting to fetch file (%s)', 'cacheDb.fetchFile', path)

    docs.File.findOne({'path': path}, {populate: true})
      .then((file) => {
        winston.debug('%s :: Found a cached file (%s)', 'cacheDb.fetchFile', file.path)
        $q.resolve(file)
      }).catch(() => {
        // Handle dealing with errors here.
        winston.debug('%s :: Didn\'t find cached file at (%s)', 'cacheDb.fetchFile', path)
        $q.reject()
      })

    return $q.promise
  }

  cacheFile (file) {
    let $q = Q.defer()

    winston.debug('Attempting to cache file (%s)', file.path)

    docs.File.findOneAndUpdate({path: file.path}, file, {upsert: true})
      .then((savedFile) => {
        winston.debug('Successfully saved cache file for (%s)', savedFile.path)
        $q.resolve(file)
      })
      .catch((err) => {
        winston.error('Error trying to cache file (%s): (%s)', file.path, err.toString())
        $q.reject(err)
      })

    return $q.promise
  }
}

module.exports = {CacheDb, docs}
