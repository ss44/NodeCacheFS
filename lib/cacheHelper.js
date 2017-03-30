const winston = require('winston')
const fs = require('fs')
const path = require('path')
const Q = require('Q')
const async = require('async')
const mkdirp = require('mkdirp')

/**
 * Cache helper
 */
class CacheHelper {
  constructor (args, cacheDb) {
    this.args = args
    this.cacheDb = cacheDb
    this.filesBeingCached = {}
    this.cachedFd = {}
    this.cacheBuffer = {}
  }

  /**
   * Retruns the expected block path.
   */
  blockPath (id, block) {
    return path.join(this.fileCachePath(id), parseInt(block).toString(16))
  }

  fileCachePath (id) {
    return path.join(this.args.cacheDir, id)
  }

  cacheDir (path) {
    let $q = Q.defer()

    fs.readdir(path, (err, files) => {
      winston.info('%s :: listing files', 'cache.cacheDir', files)

      // If there was an error reading the files return cb with that.
      if (err) {
        $q.reject(err.errorno)
      } else {
        winston.debug('%s :: attempting caching dir', 'cache.cacheDir')

        // Otherwise return files with no error.
        this.cacheDb.cacheDir(path, files)
          .then((dir) => {
            $q.resolve(dir)
          })
          .catch((err) => {
            $q.reject(err)
          })
      }
    })

    return $q.promise
  }

  static statFile (path) {}

  /**
   * Checks if a cache block exists in the cache and returns true or false.
   * @param id the file._id paramater for the block.
   * @param block int the block we're looking for.
   */
  cacheBlockExists (id, block) {
    let path = this.blockPath(id, block)

    // If a file descriptor exists no need to do an fsCheck
    if (this.cacheBuffer[path]) {
      return true
    }

    winston.debug('%s :: checking if cache block exists', 'cacheHelper.cacheBlockExists')
    // generate id/block_path
    return fs.existsSync(path)
  }

  makeCacheDirSync (id) {
    let path = this.fileCachePath(id)

    if (!fs.exists(path)) {
      mkdirp(path)
    }
  }

  cacheBlock (file, block) {
    let $q = Q.defer()
    let blockPath = this.blockPath(file._id, block)

    if (this.filesBeingCached[blockPath] !== undefined) {
      winston.error('%s :: File is already queued to be cached - here is a promise to that.', 'CacheHelper.cacheBlock', blockPath)
      return this.filesBeingCached[blockPath]
    }

    this.filesBeingCached[blockPath] = $q

    winston.debug('%s :: Attempting to cache block Source: (%s), Dest (%s) ', 'CacheHelper.cacheBlock', file.path, blockPath)

    // Open the file in the source apth
    this.makeCacheDirSync(file._id)

    // Determine the position and length of our blocks
    let length = this.args.cacheBlockSize
    let positionX = block * this.args.cacheBlockSize

    winston.debug('%s :: Reading from source file start: (%d) end: (%d)', 'CacheHelper.cacheBlock', positionX, length)

    let fileReadStream = fs.createReadStream(file.path, {start: positionX, end: length + positionX})
    let fileWriteStream = fs.createWriteStream(blockPath)
    fileReadStream.pipe(fileWriteStream)

    fileWriteStream.on('close', (err) => {
      winston.debug('%s :: Stream closed for writing...(%d)', 'CacheHelper.cacheBlock', fileWriteStream.bytesRead)

      // All done streaming.
      if (err) {
        winston.error('%s :: Error reading write to cache file: ', 'CacheHelper.cacheBlock', err.toString())
        $q.reject(err)
        return
      }

      // Remove from cache
      delete this.filesBeingCached[blockPath]
      $q.resolve()
    })

    return $q.promise
  }

  readCachedBuffer (file, block, opts) {
    let $q = Q.defer()
    let blockPath = this.blockPath(file._id, block)

    async.waterfall([
      (next) => {
        // If cache block doesn't exist create it.
        if (!this.cacheBlockExists(file._id, block)) {
          winston.debug('%s :: no cache block exists so attempting to cache.', 'cacheHelper.readCachedBuffer')
          return this.cacheBlock(file, block).then(() => { next() })
        }

        // Otherwise move to next step.
        next()
      },

      (next) => {
        winston.debug('%s :: file successfully cached time to read.', 'cacheHelper.readCachedBuffer')

        // Cache file into buffer and store in memory to save some i/o
        if (this.cacheBuffer[blockPath] === undefined) {
          winston.debug('%s :: Buffering block file [%s]', 'cachehelper.readCachedBuffer', blockPath)
          fs.readFile(blockPath, (err, data) => {
            winston.debug('%s :: File buffered lets do this.', 'cacheHelper.readCachedBuffer')
            if (err) {
              next(err)
              return
            }

            this.cacheBuffer[blockPath] = data
            next()
          })
        } else {
          next()
        }
      },

      (next) => {
        // Load cached block
        let length = opts.end - opts.start
        let buffer = this.cacheBuffer[blockPath].slice(opts.start, opts.start + length)

        winston.debug('%s :: Reading from buffer Start (%s) -- Length (%s).',
          'cacheHelper.readCachedBuffer', opts.start, length)

        $q.resolve({buffer: buffer, bytesRead: buffer.length})
      }
    ], (err) => {
      winston.error('%s :: error occurred reading cache buffer - ', 'cacheHelper.readCachedBuffer', err)
      $q.reject(err)
    })

    return $q.promise
  }

  /**
   * @returns ReadStream
   */
  getCacheBlockStream (file, block, opts) {
    // let blockPath = this.blockPath(file._id, block)

    // Open the file in the source apth
    this.makeCacheDirSync(file._id)
    return fs.createReadStream(file.path, opts)
    // // If cache file exists use it
    // if (this.cacheBlockExists(file._id, block)) {
    //   return fs.createReadStream(blockPath, opts)
    // }

    // // No cache so let's read from the source
    // let sourceStream = fs.createReadStream(file.path, opts)
    // let destStream = fs.createWriteStream(blockPath)

    // sourceStream.pause().pipe(destStream)
    // return sourceStream
  }
}

module.exports = CacheHelper
