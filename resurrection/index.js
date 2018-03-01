var webtorrent = require('webtorrent')
var idb = require('indexeddb-chunk-store')
var idbkv = require('idb-kv-store')
var parsetorrent = require('parse-torrent')

var client = new webtorrent()
var torrents = new idbkv('torrents')

function addInputFiles(){
  var torrentFiles = document.getElementById('fileSubmit')
  if(torrentFiles.files.length <= 0){
    alert("Please select a file to add!")
    return
  }
  //Splits the FileList into an array of files.
  var input = Array.prototype.slice.call(torrentFiles.files)
  addTorrent(input)
}

function addTorrent(files) {
  //Adds files to WebTorrent client, storing them in the indexedDB store.
  var torrent = client.seed(files, {"store": idb})
  torrent.on('metadata', ()=>{
    //Once generated, stores the metadata for later use when re-adding the torrent!
    torrents.add(parsetorrent(torrent.torrentFile))
    console.log(`[${torrent.infoHash}] Seeding torrent`)
  })
  torrent.on('done', ()=>{
    console.log(`[${torrent.infoHash}] Import into indexedDB done`)
    //Checks to make sure that ImmediateChunkStore has finished writing to store before destroying the torrent!
    var isMemStoreEmpty = setInterval(()=>{
      //Since client.seed is sequential, this is okay here.
      var empty = !!!torrent.store.mem[torrent.store.mem.length-1]
      if(empty){
        console.log(`[${torrent.infoHash}] Destroying torrent`)
        //Destroys the torrent, removing it from the client!
        torrent.destroy()
        clearInterval(isMemStoreEmpty)
      }
    },500)
  })
}

function resurrectAllTorrents(){
  //Itterates through all metadata from metadata store and attempts to resurrect them!
  torrents.iterator((err, cursor)=>{
    if(err) throw err
    if(cursor){
      if(typeof cursor.value === 'object'){
        resurrectTorrent(cursor.value)
      }
      cursor.continue()
    }
  })
}

function resurrectTorrent(metadata){
  if(typeof metadata === 'object' && metadata != null){
    if(client.get(metadata.infoHash)) return
    var torrent = client.add(metadata, {"store": idb})
    torrent.on('metadata', ()=>{
      console.log(`[${metadata.infoHash}] Resurrecting torrent`)
    })
    torrent.on('done', ()=>{
      console.log(`[${metadata.infoHash}] Loaded torrent from indexedDB store`)
    })
  }
}

window.client = client
window.torrents = torrents
window.addTorrent = addTorrent
window.addInputFiles = addInputFiles
window.resurrectAll = resurrectAllTorrents
window.resurrectTorrent = resurrectTorrent
