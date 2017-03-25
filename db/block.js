var Document = require('camo').Document

class Block extends Document {
  constructor () {
    super()
    this._File = require('./file.js').File
    this.time_modified = Date
    this.file = this._File
    this.block_id = Number
  }
}

module.exports = {
  Block: Block
}