var Document = require('camo').Document
var winston = require('winston')
var Q = require('Q')

class Directory extends Document {
  constructor () {
    super()

    this._File = require('./file.js').File
    this._Attrs = require('./attrs.js').Attrs

    this.path = {
      type: String,
      unique: true
    }

    this.hash = String
    this.lastUpdated = Date
    this.attributes = this._Attrs
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

    this._File.find({'directory': this._id})
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

module.exports = {
  Directory: Directory
}
