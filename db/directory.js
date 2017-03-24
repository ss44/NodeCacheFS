var Document = require('camo').Document
var EmbeddedDocument = require('camo').EmbeddedDocument

// var File = require('./file.js')
var winston = require('winston')
var Q = require('Q')

class Attrs extends EmbeddedDocument {
  constructor () {
    super()
    this.mtime = Date
    this.atime = Date
    this.ctime = Date
    this.size = Number
    this.mode = Number
    this.uid = Number
    this.gid = Number
  }

  static fstatToAttr (attrObj) {
    let attr = new Attrs()
    attr.mtime = attrObj.mtime
    attr.atime = attrObj.atime
    attr.ctime = attrObj.ctime
    attr.size = attrObj.size
    attr.mode = attrObj.mode
    attr.uid = attrObj.uid
    attr.gid = attrObj.gid

    return attr
  }
}

class Directory extends Document {
  constructor () {
    super()

    this.path = {
      type: String,
      unique: true
    }

    this.hash = String
    this.lastUpdated = Date
    this.attributes = Attrs
  }

  static collectionName () {
    return 'directories'
  }

  /**
   * Get name of all files.
   * @return Array[string]
   */
  fileNames () {
    var $q = Q.defer()
    winston.debug('attempting to get filenames ', this._id)

    File.find({'directory': this._id})
      .then((files) => {
        winston.debug('Found (%d) files.', files.length)

        var fileNames = files.map((file) => {
          return file.name
        })

        $q.resolve(fileNames)
      })
      .catch((err) => {
        winston.error('error trying to get files')
        $q.reject(err)
      })

    return $q.promise
  }

  isCacheExpired (dirKeepAlive) {
    winston.debug('%s :: directory keep alive is set to -- %d', 'readdir', dirKeepAlive)

    // Calculates the difference in seconds based on the unix timestamp.
    var timeDiff = ((new Date().getTime() - this.lastUpdated.getTime()) / 1000).toFixed(0)
    winston.debug('diff', timeDiff)

    // Test to see if the directory path is still fresh enough to serve.
    return timeDiff > dirKeepAlive
  }
}

class File extends Document {
  constructor () {
    super()

    this.directory = {
      type: Directory,
      required: true
    }

    this.path = {
      type: String,
      unique: true,
      required: true
    }

    this.name = String
    this.lastUpdated = {
      type: Date,
      default: new Date()
    }

    this.attributes = Attrs
  }

  preSave () {
    // Update the date of a file on save.
    this.lastUpdated = new Date()
  }

  static collectionName () {
    return 'files'
  }

  /**
   * Given the block size, start and end position, determines which blocks are required to complete
   * a requested data requested.
   * @param blockSize <int> how big blocks are expected to be.
   * @param positionStart <int> starting position relative to the file.
   * @param length <int> how many bytes are being requested.
   * @returns Array<int> Returns id of blocks to fetch.

   */
  getRequiredBlocks (blockSize, positionStart, length) {
    winston.debug('%s :: Fetching blocks - Block Size (%d), Position (%d), Length (%d)',
      'File.getRequiredBlocks', blockSize, positionStart, length)

    // @todo - return a fuse error code instead? PositionStart < FileSize return 0
    if (positionStart > this.attributes.size) {
      return [0]
    }

    // PositionStart + length > FileSize?
    if ((positionStart + length > this.attributes.size)) {
      // Truncate length to being the max end of file size.
      length = this.attributes.size - positionStart
    }

    // 1st Block == Floor[positionStart / blockSize]
    let startingBlock = Math.floor(positionStart / blockSize)
    let endingBlock = Math.floor((positionStart + length) / blockSize)

    // Blocks required [1stBlock, x, LastBlock]
    let blocks = []
    for (let x = startingBlock; x <= endingBlock; x++) {
      blocks.push(x)
    }

    return blocks
  }
}

module.exports = {
  Directory: Directory,
  File: File,
  Attrs: Attrs
}
