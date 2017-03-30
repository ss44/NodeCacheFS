'use strict'

const winston = require('winston')
const fs = require('fs')
const path = require('path')
const Q = require('Q')
const async = require('async')
const fuse = require('fuse-bindings')
const {CacheDb, docs} = require('./cacheDb.js')
const CacheHelper = require('./cacheHelper.js')
const toArray = require('stream-to-array')
const util = require('util')
const cachedFilesHandles = {}

var cacheDb = null

module.exports = (args) => {
  winston.debug('init - fusecache')

  const basepath = (p) => path.join(args.source, p)
  const cacheHelper = new CacheHelper(args, cacheDb)

  return {
    init: (cb) => {
      new CacheDb(args.dbPath, args.dbOptions)
        .then((cdb) => {
          winston.info('Init successfull')
          cacheDb = cdb
          cacheHelper.cacheDb = cdb
          cb(0)
        })
        .catch((err) => {
          winston.error('Error Connecting - ', err)
          // Error initializing the cache.
          cb(fuse.ENOTCONN)
        })
    },

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
          // If dir is empty -- fetch files.
          if (dir === null) {
            winston.debug('%s :: no directory', 'readdir')
            return cacheHelper.cacheDir(path)
          }

          // If dir is not empty but is expired - re-fetch files and update cache time.
          // Compare time of cached directory to now
          if (dir.isCacheExpired(args.dirKeepAlive)) {
            return cacheHelper.cacheDir(path)
          }

          return Q.promise((resolve) => { resolve(dir) })
        })
        .then((dir) => {
          return dir.fileNames()
        })
        .then((files) => {
          winston.debug('following cached files:', files)
          cb(0, files)
        })
        .catch((err) => {
          winston.error('%s :: error fetching cache - %s', 'readdir', err)
          cb(0)
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

      // If path is directory
      try {
        if (fs.lstatSync(path).isDirectory()) {
          winston.debug('attr requested path is a directory.')
          cb(0, fs.lstatSync(path))
          return
        }
      } catch (err) {
        cb(err.errorno)
        return
      }

      // Get file details for file from cache.
      cacheDb.fetchFile(path)
        .then((file) => {
          winston.debug('attr checking attributes for file (%s)', file.path)

          // If missing size attribute (Easiest way to tell that attributes need to be updated.)
          if (!file.attributes || file.attributes.size === undefined) {
            winston.debug('%s :: missing attributes for cached file. trying to set.', 'fuseCache::attr')
            fs.stat(path, (err, st) => {
              if (err) {
                winston.error('%s :: error getting stat for file (%s) Error (%s)', 'fuseCache::attr', path, err.toString())
                cb(fuse.ENOENT)
              } else {
                winston.debug('%s :: File attributes:', 'fuseCache::attr', st)
                file.attributes = docs.Attrs.fstatToAttr(st)

                file.save()
                  .then(() => {
                    winston.debug('%s :: file attributes updated.', 'fuseCache::attr')
                    return docs.File.findOne({_id: file._id})
                  })
                  .then((file) => {
                    cb(0, file.attributes)
                  })
                  .catch((err) => {
                    winston.error('%s :: error updating file attribute:', 'fuseCache::attr', err)
                    cb(fuse.ENOENT)
                  })
              }
            })
          } else {
            winston.debug('%s :: returning saved attributes --', 'fuseCache::attr', file.attributes)
            cb(0, file.attributes)
          }
        })
        .catch((err) => {
          winston.error('%s :: error -- ', 'fuseCache::attr', err)
          winston.error('%s :: no cached instance of file found. Files only updated and created during readdir.', 'fuseCache::attr')

          // Return ENOENT
          cb(fuse.ENOENT)
        })
    },

    open: (path, flags, cb) => {
      path = basepath(path)
      winston.info('%s :: Opening file %s', 'fuseCache.open', path)

      cacheDb.fetchFile(path)
        .catch((err) => {
          winston.error('%s :: Error opening file from cache %s', 'fuseCache.open', err)
          cb(-1)
        })
        .then((file) => {
          // Cache the file
          cachedFilesHandles[path] = file
          cb(0)
        })
    },

    read: (path, fd, buffer, length, position, cb) => {
      path = basepath(path)
      winston.debug('%s :: Attempting to read file %s', 'fuseCache::read', path)
      winston.debug('%s :: Position: (%s), Length: (%d)', 'fuseCache::read', position, length)
      // @todo handle deleting blocks to clear memory to make space.

      // Load file details from db.
      let file = cachedFilesHandles[path]

      winston.debug('%s :: Successfully loaded cached file.', 'fuseCache.read')
      winston.debug('%s :: args: ', 'fuseCache.read', args)

      // Based on position and length - determine which blocks we require to read from a file.
      var requiredBlocks = file.getRequiredBlocks(args.cacheBlockSize, position, length)
      winston.debug('%s :: Required blocks for read', 'fuseCache::read', requiredBlocks)

      let totalBytesRead = 0

      // Start reading from position of the first block.
      // and loop reading data to buffer in chunks until we
      // get to position in the last block.
      async.waterfall([
        (next) => {
          let buffersArray = []
          winston.debug('%s :: looping over (%d) blocks', 'fuseCache.read', requiredBlocks.length)

          async.eachOfSeries(requiredBlocks, (block, blockIdx, next) => {
            // Determine starting position for block reading.
            // We can assume we're starting from the begining of the block for all blocks but the first one.
            let xPos = 0
            if (blockIdx === 0) {
              xPos = position % args.cacheBlockSize
            }

            // Determine end position when reading from blocks.
            // We can assume we're reading to the end of the block for all blocks but the last block.
            let yPos = args.cacheBlockSize
            if (blockIdx === requiredBlocks.length) {
              yPos = (position + length) % args.cacheBlockSize
            }

            // totalLength += yPos - xPos

            winston.debug('%s :: looking up blocks at index [%d] -- %d', 'fuseCache.read',
              blockIdx, block)

            cacheHelper.readCachedBuffer(file, block, {start: xPos, end: yPos})
              .then((r) => {
                winston.debug('%s :: read [%d] from cached block', 'fuseCache.read', r.bytesRead)
                buffersArray.push(r.buffer)
                totalBytesRead += r.bytesRead
                next()
              })
          }, (err) => {
            if (err) {
              next(err)
            } else {
              next(0, buffersArray)
            }
          })
        },

        (buffersArray, next) => {
          // Copy all our buffers to our single read buffer.
          Buffer.concat(buffersArray).copy(buffer)
          winston.debug('%s :: done loading blocks total length (%d)', 'fuseCache.read', totalBytesRead)

          // Total length written
          cb(buffer.length)
        }
      ])
    }
  }
}
