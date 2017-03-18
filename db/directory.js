var Document = require('camo').Document
var File = require('./file.js')

class Directory extends Document {
  constructor () {
    super()

    this.path = String
    this.hash = String
    this.lastUpdated = Date
    this.attributes = Object
    this.files = [File]
  }

  /**
   * Get name of all files.
   * @return Array[string]
   */
  fileNames () {
    return this.files.map((file) => {
      return file.name
    })
  }
}

module.exports = {
  Directory: Directory,
  File: File
}
