import LotusBot from './lib/lotusbot.js'

const lotusbot = new LotusBot()
lotusbot.init().catch((e: Error) => console.log(e))
