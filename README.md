# Fuse.CacheFS
A simple cachefs written in node using the [fuse-bindings](https://github.com/mafintosh/fuse-bindings) Libray.

You specify a source directory and then all content in the cached directory will attempt to mirror and cache from the source.

Main goal is make mounting of cloud drives via [rclone](http://rclone.org/) or [acd_cli](https://github.com/yadayada/acd_cli) a little bit faster by being able to cache contents on local drives for faster access and scans.

This project is still in its infancy and pretty alpha. It is  **not** recommended for production use. Currently only supports a tiny subset of fuse commands and has yet to go any thorough testing.

Early local benchmark's show it does what it's designed to do so that's always promising.

# Installation

## Pre-requisites
Requires fuse to be installed.

### OSX
Brew:
```
brew install osxfuse
```

Manually: Download [Fuse for OSX](https://osxfuse.github.io/)

### Linux
#### Ubuntu
```
sudo apt-get install libfuse-dev
```

#### CentOS
```
sudo yum install fuse fuse-devel
```

## Install from NPM
```
npm i install fuse.cachefs -g
```

# Usage
```
fuse.cachefs <source> <target>
```

# Roadmap
Features that are currently be worked on and really required for production use:
* Ability to specify cache size.
* Expire and automatically delete blocks.
* Pre-Fetch blocks to cache during large read operations to improve streaming.

# Credits
Thanks to the work by:
* [Mathias Buus](https://github.com/mafintosh) with [fuse-bindings](https://github.com/mafintosh/fuse-bindings) to really get this project going without which it wouldn't exist.
* [John Kozak](https://github.com/jkozak) for his [example](https://github.com/jkozak/node-fuse-bindings-xmp-example) for helping me get started.

# Liscense
ISC
