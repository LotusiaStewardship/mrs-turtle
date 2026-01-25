/**
 * Copyright (c) 2024-2025 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */
import type { Address, PrivateKey, Script } from 'xpi-ts/lib/bitcore'
import type { ScriptType } from 'chronik-client'
import type { PlatformName } from '../lib/platforms/index.js'

export namespace Temporal {
  export type Command = {
    command: string
    data: string[]
  }
  /** Input received from Temporal Workflow, as a single message */
  export type SendMessageInput = {
    platform: PlatformName
    chatId: string
    message: string
  }
  /** Input received from Temporal Workflow, as a single output for a sendLotus activity */
  export type SendLotusInput = {
    scriptPayload: string
    sats: string
  }
}

export interface WalletParsedUtxo {
  txid: string
  outIdx: number
  value: string
  isCoinbase?: boolean
  blockHeight?: number
}

export interface WalletAccountUtxo extends WalletParsedUtxo {
  userId: string
}

export interface WalletDeposit extends WalletAccountUtxo {
  timestamp: Date
  confirmed?: boolean
}

export interface WalletWithdrawal {
  txid: string
  value: string
  timestamp: Date
  userId: string
}

export interface WalletGive {
  txid: string
  platform: string
  timestamp: Date
  fromId: string
  toId: string
  value: string
}

export interface WalletKey {
  signingKey: PrivateKey
  address: Address
  script: Script
  scriptHex: string
  scriptType: ScriptType
  utxos: WalletParsedUtxo[]
}

export interface WalletTxBroadcastResult {
  txid: string
  amount: string
}
