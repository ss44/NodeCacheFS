const Document = require('camo').Document
const winston = require('winston')

class File extends Document {
  constructor () {
    super()

    this._Directory = require('./directory.js').Directory
    this._Attrs = require('./attrs.js').Attrs

    this.directory = {
      type: this._Directory,
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

    this.attributes = this._Attrs
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
  File: File
}
