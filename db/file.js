var EmbeddedDocument = require('camo').EmbeddedDocument

class File extends EmbeddedDocument {
  constructor() {
    super()

    this.path = String
    this.name = String
    this.lastUpdated = Date
    this.size = Number
    this.attributes = Object
  }
}

module.exports = File
