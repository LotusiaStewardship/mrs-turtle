/**
 * Copyright (c) 2024-2026 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */
import LotusBot from './lib/lotusbot.js'

const lotusbot = new LotusBot()
lotusbot.init().catch((e: Error) => console.log(e))
