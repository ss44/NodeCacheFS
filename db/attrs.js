const EmbeddedDocument = require('camo').EmbeddedDocument

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

module.exports = {
  Attrs: Attrs
}
