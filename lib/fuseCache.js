'use strict'

const winston = require('winston')
const fs = require('fs')
const path = require('path')
// const Q = require('Q')

const nyi = (str) => {
  winston.info('!! Not Yet Implemented !! - ', str)
}

module.exports = (args) => {
  winston.debug('init - fusecache')

  const basepath = (p) => path.join(args.source, p)
  const cacheDb = require('./cacheDb.js')(args.dbPath, args.dbOptions)

  return {
    /**
     * Reading a directory has occurred.
     * Read from local cache first. If nothing is found,
     * then pass through and save to DB.
     */
    readdir: (path, cb) => {
      winston.debug('readdir (%s)', path)
      path = basepath(path)

      // Fetch results from cache if they exist otherwise, attempt to cache.
      cacheDb.fetchDir(path)
        .then((dir) => {
          var files = dir.fileNames()
          winston.debug('found files in readdir', files)
          cb(0, files)
        })
        .catch(() => {
          winston.debug('no cache - refreshing for first time.')

          fs.readdir(path, (err, files) => {
            winston.info('listing files -- ', files)

            // If there was an error reading the files return cb with that.
            if (err) {
              cb(err.errorno, [])
            } else { // Otherwise return files with no error.
              cacheDb.cacheDir(path, files).then(() => {
                cb(0, files)
              })
            }
          })
        })
    },

    /**
     * Return file attributes. The "stat" structure is described in detail in the stat(2)
     * manual page. For the given pathname, this should fill in the elements of the "stat" structure.
     * If a field is meaningless or semi-meaningless (e.g., st_ino) then it should be set to 0 or given a
     * "reasonable" value. This call is pretty much required for a usable filesystem.
     */
    getattr: (path, cb) => {
      path = basepath(path)
      winston.debug('getattr(%s)', path)

      // Get file details for file from cache.
      cacheDb.fetchFile(path)
        .then((file) => {
          winston.debug('found attributes for file (%s)', file.path)
          cb(0, file.attributes)
        })
        .catch(() => {
          winston.debug('no cached attributes for file (%s)', path)

          fs.stat(path, (err, st) => {
            if (err) {
              winston.error('error getting stat for file (%s) Error (%s)', path, err.toString())
              cb(err.errno)
            } else {
              cb(0, st)
            }
          })
        })
    },

    /**
     * As getattr, but called when fgetattr(2) is invoked by the user program.
     */
    fgetattr: (path, cb) => {
      nyi('fgetattr (%s)', path)
    }
  }
}
