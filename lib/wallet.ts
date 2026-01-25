/**
 * Copyright (c) 2024-2026 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */
import {
  Address,
  HDPrivateKey,
  Mnemonic,
  Networks,
  PrivateKey,
  Script,
  Transaction,
  Output,
  Input,
} from 'xpi-ts/lib/bitcore'
import {
  ChronikClient,
  OutPoint,
  ScriptType,
  SubscribeMsg,
  Tx as ChronikTx,
  Utxo,
  UtxoState,
  WsEndpoint,
} from 'chronik-client'
import config from '../config.js'
import { WALLET } from '../util/constants.js'
import { toAsyncIterable } from '../util/functions.js'
import type { WalletAccountUtxo, WalletParsedUtxo } from '../util/types.js'
/** A map of `WalletKey` instances, keyed by `userId` */
type WalletMap = Map<string, WalletKey>
type AccountMap = Map<string, Set<string>>
/**
 * Static methods for the `WalletKey` and `WalletManager` classes
 */
export class WalletTools {
  /**
   * Get the Bitcore `Script` for the provided `Address`
   * @param address - The `Address` to get the script for, in string or `Address` format
   * @returns The Bitcore `Script`
   */
  static getScriptFromAddress = (address: string | Address): Script => {
    try {
      return Script.fromAddress(
        typeof address === 'string' ? Address.fromString(address) : address,
      )
    } catch (e: any) {
      throw new Error(`getScriptFromAddress: ${e.message}`)
    }
  }
  /**
   * Get the Bitcore `PrivateKey` from the provided `HDPrivateKey`
   * @param hdPrivKey - The `HDPrivateKey` from which to derive the `PrivateKey`
   * @returns The Bitcore `PrivateKey`
   */
  static getDerivedSigningKey = (hdPrivKey: HDPrivateKey): PrivateKey => {
    try {
      return hdPrivKey
        .deriveChild(WALLET.PURPOSE, true)
        .deriveChild(WALLET.COINTYPE, true)
        .deriveChild(0, true)
        .deriveChild(0)
        .deriveChild(0).privateKey
    } catch (e: any) {
      throw new Error(`getDerivedPrivKey: ${e.message}`)
    }
  }
  /**
   * Get the Bitcore `Address` for the provided `PrivateKey`
   * @param signingKey - The `PrivateKey` to get the address for
   * @returns The Bitcore `Address`
   */
  static getAddressFromSigningKey = (signingKey: PrivateKey): Address => {
    try {
      return signingKey.toAddress()
    } catch (e: any) {
      throw new Error(`getAddressFromSigningKey: ${e.message}`)
    }
  }
  /**
   * Get the Chronik script type for the provided `Address`
   * @param address - The `Address` to get the script type for
   * @returns The Chronik script type
   */
  static getChronikScriptType = (address: string | Address): ScriptType => {
    // Convert string to Address if needed
    address =
      typeof address === 'string' ? Address.fromString(address) : address
    switch (true) {
      case address.isPayToPublicKeyHash():
        return 'p2pkh'
      case address.isPayToScriptHash():
        return 'p2sh'
      case address.isPayToTaproot():
        return 'p2tr-commitment'
      default:
        return 'other'
    }
  }
  /**
   * Convert a Chronik UTXO to a Bitcore-compatible `ParsedUtxo`
   * @param utxo - The Chronik UTXO to convert
   * @returns The Bitcore-compatible `ParsedUtxo`
   */
  static toParsedUtxo = (utxo: Utxo) => {
    const { txid, outIdx } = utxo.outpoint
    const { value } = utxo
    return { txid, outIdx, value }
  }
  /** Create Bitcore-compatible P2PKH `Transaction.Input` */
  static toP2PKHInput = (utxo: WalletParsedUtxo, script: Script) => {
    try {
      return new Input.PublicKeyHash({
        prevTxId: utxo.txid,
        outputIndex: utxo.outIdx,
        output: this.toOutput(Number(utxo.value), script),
        script,
      })
    } catch (e: any) {
      throw new Error(`_toPKHInput: ${e.message}`)
    }
  }
  /** Create a Bitcore-compatible `Transaction.Output` */
  static toOutput = (satoshis: number, script: Script) => {
    try {
      return new Output({ satoshis, script })
    } catch (e: any) {
      throw new Error(`_toOutput: ${e.message}`)
    }
  }
  /**
   * Validate that an address is valid using the Bitcore `Address` module
   * @param address - The address string to validate
   * @returns True if the address is valid, false otherwise
   */
  static isValidAddress = (address: string) => Address.isValid(address)
}
/**
 * A `WalletKey` is a single Bitcore `PrivateKey` with associated `Address`,
 * `Script`, and `ScriptType`. Each platform user has their own `WalletKey`.
 */
class WalletKey {
  /** The unique identifier for this wallet account */
  public accountId: string
  /** The unique identifier for the user associated with this wallet */
  public userId: string
  /** This Chronik client instance is only for managing UTXOs in this `WalletKey` */
  public chronik: ChronikClient
  /** This Chronik WS endpoint is only for managing UTXOs in this `WalletKey` */
  public chronikWs: WsEndpoint
  /** The private key used for signing transactions */
  public signingKey: PrivateKey
  /** The public address derived from the signing key */
  public address: Address
  /** The locking script that controls spending from this address */
  public script: Script
  /** The type of script (e.g. p2pkh) as used by Chronik */
  public scriptType: ScriptType
  /** The full P2PKH script as a hex string */
  public scriptHex: string
  /** The hex-encoded public key hash used in the script */
  public scriptPayload: string
  /** The UTXO cache for this `WalletKey` */
  public utxos: WalletParsedUtxo[] = []
  /**
   * Creates a new `WalletKey` instance
   * @param accountId - The unique identifier for this wallet account
   * @param hdPrivKey - The `HDPrivateKey` used to derive the signing key
   */
  constructor(
    accountId: string,
    userId: string,
    hdPrivKey: HDPrivateKey,
    chronik: ChronikClient,
    chronikWs: WsEndpoint,
  ) {
    this.accountId = accountId
    this.userId = userId
    this.signingKey = WalletTools.getDerivedSigningKey(hdPrivKey)
    this.address = WalletTools.getAddressFromSigningKey(this.signingKey)
    this.script = WalletTools.getScriptFromAddress(this.address)
    this.scriptType = WalletTools.getChronikScriptType(this.address)
    this.scriptHex = this.script.toHex()
    this.scriptPayload = this.script.getData().toString('hex')
    this.chronik = chronik
    this.chronikWs = chronikWs
  }
  /** Initialize the Chronik client and WS endpoint */
  async init() {
    const utxos = await this.fetchUtxos()
    this.utxos = utxos.map(utxo => WalletTools.toParsedUtxo(utxo))
  }
  /** Get the balance of the `WalletKey` by adding the value of all cached, in-memory UTXOs */
  async getBalance() {
    return this.utxos.reduce((balance, utxo) => balance + Number(utxo.value), 0)
  }
  /**
   * Fetch UTXOs from Chronik API for `WalletKey` script data
   * @returns The UTXOs from Chronik
   */
  async fetchUtxos(): Promise<Utxo[]> {
    try {
      const scriptEndpoint = this.chronik.script(
        this.scriptType,
        this.scriptPayload,
      )
      const [result] = await scriptEndpoint.utxos()
      return result?.utxos || []
    } catch (e: any) {
      throw new Error(`fetchUtxos: ${e.message}`)
    }
  }
  /**
   * Validate UTXOs against Chronik API
   * @param utxos - The UTXOs to validate
   * @returns The validated UTXOs
   */
  async validateUtxos(utxos: WalletParsedUtxo[]) {
    let result: UtxoState[]
    try {
      result = await this.chronik.validateUtxos(utxos)
    } catch (e: any) {
      throw new Error(`reconcileUtxos: ${e.message}`)
    }
    const validatedUtxos: WalletParsedUtxo[] = []
    let i = 0
    for await (const utxo of toAsyncIterable(utxos)) {
      switch (result[i].state) {
        case 'UNSPENT':
          validatedUtxos.push(utxo)
      }
      i++
    }
    return validatedUtxos
  }
}
/**
 * The `WalletManager` is responsible for managing all `WalletKey` instances
 * and their associated UTXOs. It is also responsible for handling Chronik WS
 * messages and updating the in-memory UTXO set.
 *
 * The `WalletManager` is responsible for:
 * - Initializing Chronik WS
 * - Loading user accounts (keys, UTXOs, WS subscription)
 */
export class WalletManager {
  /** The Chronik client instance */
  private chronik: ChronikClient
  /** The Chronik WS endpoint */
  private chronikWs: WsEndpoint
  /** A map of `WalletKey` instances, keyed by `userId` */
  private wallets: WalletMap = new Map()
  /** A map of `accountId`s to `userId`s */
  private accounts: AccountMap = new Map()
  /** The callback to execute when a deposit is received */
  public walletDepositReceived: (utxo: WalletAccountUtxo) => Promise<void>
  /**
   * @property chronik - The Chronik client instance
   * @property chronikWs - The Chronik WS endpoint, hooked to the `chronikHandleWsMessage` method that is used by all `WalletKey` instances
   */
  constructor() {
    this.chronik = new ChronikClient(config.wallet.chronikUrl)
    this.chronikWs = this.chronik.ws({
      onMessage: this.chronikHandleWsMessage,
      onError: async e => await this.chronikWs.waitForOpen(),
      onEnd: async e => await this.chronikWs.waitForOpen(),
    })
  }
  /**
   * - Initialize Chronik WS
   * - load user accounts (keys, UTXOs, WS subscription)
   */
  init = async (
    users: Array<{
      accountId: string
      userId: string
      hdPrivKey: HDPrivateKey
    }>,
  ) => {
    try {
      await this.chronikWs.waitForOpen()
      for (const user of users) {
        await this.loadKey(user)
      }
    } catch (e: any) {
      throw new Error(`WalletManager: init: ${e.message}`)
    }
  }
  /** Unsubscribe from and close Chronik WS */
  closeWsEndpoint = () => {
    for (const [_userId, walletKey] of this.wallets) {
      this.chronikWs.unsubscribe(walletKey.scriptType, walletKey.scriptPayload)
    }
    this.chronikWs.close()
  }
  /** Get the UTXOs for every `WalletKey` */
  getUtxos = (): WalletAccountUtxo[] => {
    const utxos: WalletAccountUtxo[] = []
    for (const [userId, walletKey] of this.wallets) {
      utxos.push(
        ...walletKey.utxos.map(utxo => {
          return { ...utxo, userId }
        }),
      )
    }
    return utxos
  }
  /** Get the `WalletKey` for the provided `userId` */
  getWalletKey = (userId: string) => this.wallets.get(userId)
  /** Get the UTXOs for the provided `userId` */
  getUtxosByUserId = (userId: string) => this.wallets.get(userId)?.utxos
  /** Get the UTXO balance for the provided `accountId` */
  getAccountBalance = async (accountId: string) => {
    let balance = 0
    const userIds = this.accounts.get(accountId)!
    for (const userId of userIds) {
      const walletKey = this.wallets.get(userId)
      balance += await walletKey.getBalance()
    }
    return balance
  }
  /** Return the XAddress of the `WalletKey` of `userId` */
  getXAddress = (userId: string) =>
    this.wallets.get(userId)?.address?.toXAddress()
  getScriptPayload = (userId: string) => this.wallets.get(userId)?.scriptPayload
  getSigningKey = (userId: string) => this.wallets.get(userId)?.signingKey
  getXAddresses = (accountId: string) => {
    const addresses: string[] = []
    for (const userId of this.accounts.get(accountId)) {
      addresses.push(this.wallets.get(userId)!.address.toXAddress())
    }
    return addresses
  }
  /**
   * - load wallet signingKey, script, address
   * - download UTXOs from Chronik and store `ParsedUtxo`s
   * - subscribe to Chronik WS
   */
  loadKey = async ({
    accountId,
    userId,
    hdPrivKey,
  }: {
    accountId: string
    userId: string
    hdPrivKey: HDPrivateKey
  }) => {
    try {
      // add the userId into the account set
      const accountUserIds = this.accounts.get(accountId) || new Set()
      accountUserIds.add(userId)
      this.accounts.set(accountId, accountUserIds)
      // Set up new wallet and subscribe to Chronik WS
      const walletKey = new WalletKey(
        accountId,
        userId,
        hdPrivKey,
        this.chronik,
        this.chronikWs,
      )
      await walletKey.init()
      this.wallets.set(userId, walletKey)
      // set the Chronik WS message handler for this wallet
      this.chronikWs.subscribe(walletKey.scriptType, walletKey.scriptPayload)
    } catch (e: any) {
      throw new Error(`loadKey: ${userId}: ${e.message}`)
    }
  }
  /**
   * Reconcile UTXO set for the `WalletKey` of `userId`
   * @param userId - The `userId` of the `WalletKey` to reconcile
   */
  validateUtxos = async (userId: string) => {
    const walletKey = this.wallets.get(userId)
    walletKey.utxos = await walletKey.validateUtxos(walletKey.utxos)
  }
  /** Update the WalletKey of `userId` with provided `accountId` */
  updateKey = (userId: string, oldAccountId: string, newAccountId: string) => {
    const oldAccountUsers = this.accounts.get(oldAccountId)!
    const newAccountUsers = this.accounts.get(newAccountId)!
    oldAccountUsers.delete(userId)
    newAccountUsers.add(userId)
    // don't need to set the userId sets back into the accounts map
    // since Set values are referenced directly from the map
    //this.accounts.set(oldAccountId, oldAccountUsers)
    //this.accounts.set(newAccountId, newAccountUsers)
  }
  /** Process Give/Withdraw tx for the provided `fromUserId` */
  genTx = async (
    type: 'give' | 'withdraw',
    {
      fromAccountId,
      toUserId,
      outAddress,
      outSats,
    }: {
      fromAccountId: string
      toUserId?: string
      outAddress?: string
      outSats: number
    },
  ): Promise<[Transaction, WalletParsedUtxo[]]> => {
    const tx = new Transaction()
    const signingKeys: PrivateKey[] = []
    const spentUtxos: WalletParsedUtxo[] = []
    // wallets used to fund the transaction
    const userIds = this.accounts.get(fromAccountId)!
    try {
      for (const userId of userIds) {
        const wallet = this.wallets.get(userId)
        signingKeys.push(wallet.signingKey)
        for (const utxo of wallet.utxos) {
          tx.addInput(WalletTools.toP2PKHInput(utxo, wallet.script))
          spentUtxos.push(utxo)
          if (tx.inputAmount > outSats) {
            break
          }
        }
        // May need to continue adding utxos from other keys
        if (tx.inputAmount < outSats) {
          continue
        }
        tx.feePerByte(config.wallet.tx.feeRate)
        // Set current key's address as change address
        tx.change(wallet.address)
        // Set up output script
        let outScript: Script
        switch (type) {
          case 'give':
            outScript = this.wallets.get(toUserId)?.script
            break
          case 'withdraw':
            outScript = WalletTools.getScriptFromAddress(outAddress)
            break
        }
        // add appropriate output with tx fee subtracted if required
        const txFee = tx.getFee()
        tx.addOutput(
          WalletTools.toOutput(
            // subtract fee from output amount if required
            outSats + txFee > tx.inputAmount ? outSats - txFee : outSats,
            outScript,
          ),
        )
        // sign and verify tx
        tx.sign(signingKeys)
        const verified = tx.verify()
        switch (typeof verified) {
          case 'boolean':
            return [tx, spentUtxos]
          case 'string':
            throw new Error(verified)
        }
      }
    } catch (e: any) {
      throw new Error(`genTx: ${e.message}`)
    }
  }
  /** Remove the provided UTXOs from the `WalletKey` of `userId` */
  removeUtxos = async (accountId: string, spentUtxos: WalletParsedUtxo[]) => {
    const userIds = this.accounts.get(accountId)!
    for (const userId of userIds) {
      const walletKey = this.wallets.get(userId)
      walletKey.utxos = walletKey.utxos.filter(
        utxo =>
          !spentUtxos.some(
            spentUtxo =>
              spentUtxo.txid === utxo.txid && spentUtxo.outIdx === utxo.outIdx,
          ),
      )
    }
  }
  /** Broadcast the provided tx for the provided userId */
  broadcastTx = async (tx: Transaction) => {
    try {
      const txBuf = tx.toBuffer()
      const broadcasted = await this.chronik.broadcastTx(txBuf)
      return broadcasted.txid
    } catch (e: any) {
      throw new Error(`broadcastTx: ${e.message}`)
    }
  }
  /**
   * Ensure Chronik `AddedToMempool` doesn't corrupt the in-memory UTXO set
   */
  private isExistingUtxo = (userId: string, utxo: WalletParsedUtxo) => {
    const utxos = this.wallets.get(userId)?.utxos
    return utxos.length > 0
      ? utxos.some(
          existing =>
            existing.txid == utxo.txid && existing.outIdx == utxo.outIdx,
        )
      : false
  }
  /** Detect and process Chronik WS messages */
  chronikHandleWsMessage = async (msg: SubscribeMsg) => {
    let tx: ChronikTx
    try {
      // get the coinbsae tx from connected block
      // supports mining directly to lotus-bot wallet 🥰
      if (msg.type == 'BlockConnected') {
        const block = await this.chronik.block(msg.blockHash)
        tx = block.txs[0]
      }
      if (msg.type == 'AddedToMempool') {
        tx = await this.chronik.tx(msg.txid)
      }
    } catch (e: any) {
      throw new Error(`_chronikHandleWsMessage: ${e.message}`)
    }
    // don't proceed without tx data
    if (!tx) {
      return
    }
    // process each tx output
    let i = -1
    for await (const output of toAsyncIterable(tx.outputs)) {
      // increment output index
      // if first output, this will value start at 0
      i++
      // find userId/key matching output scriptHex
      for await (const [_accountId, userIds] of toAsyncIterable(
        this.accounts,
      )) {
        for (const userId of userIds) {
          if (this.wallets.get(userId)?.scriptHex !== output.outputScript) {
            continue
          }
          // found our userId/key; save utxo
          const parsedUtxo = {
            txid: tx.txid,
            outIdx: i,
            value: output.value,
          } as WalletParsedUtxo
          // add metadata for coinbase tx if needed
          if (tx.isCoinbase) {
            parsedUtxo.isCoinbase = true
            parsedUtxo.blockHeight = tx.block?.height
          }
          /**
           * Give transactions generate duplicate Chronik WS messages.
           * This conditional ensures we do not save duplicate UTXOs
           */
          if (this.isExistingUtxo(userId, parsedUtxo)) {
            break
          }
          // push the utxo to the wallet's utxo set
          this.wallets.get(userId)!.utxos.push(parsedUtxo)
          // if this is last output, assume it is change output and skip deposit notification
          if (i + 1 === tx.outputs.length) {
            return
          }

          try {
            await this.walletDepositReceived({
              ...parsedUtxo,
              userId,
            } as WalletAccountUtxo)
          } catch (e: any) {
            throw new Error(`_chronikHandleWsMessage: ${e.message}`)
          }

          // TODO: check to make sure we are always processing all applicable
          // outputs in any given tx
        }
      }
    }
  }
  /** Generates a new 12-word mnemonic phrase */
  static newMnemonic = () => new Mnemonic()
  /** Gets `HDPrivateKey` from mnemonic seed buffer */
  static newHDPrivateKey = (mnemonic: Mnemonic) =>
    HDPrivateKey.fromSeed(mnemonic.toSeed())
  /** Instantiate Prisma HDPrivateKey buffer as `HDPrivateKey` */
  static hdPrivKeyFromBuffer = (hdPrivKeyBuf: Buffer) =>
    new HDPrivateKey(hdPrivKeyBuf)
  static hdPrivKeyFromString = (hdPrivKeyStr: string) =>
    HDPrivateKey.fromSeed(hdPrivKeyStr, Networks.mainnet)
  static toOutpoint = (utxo: WalletParsedUtxo): OutPoint => {
    return {
      txid: utxo.txid,
      outIdx: utxo.outIdx,
    }
  }
  /**
   * Convert Chronik-compatible 20-byte P2PKH to Lotus XAddress format
   * @param scriptPayload
   * @returns
   */
  static toXAddressFromScriptPayload = (scriptPayload: string) =>
    Address.fromPublicKeyHash(
      Buffer.from(scriptPayload, 'hex'),
      Networks.livenet,
    ).toXAddress()
  /**
   * Static method to generate Lotus send transaction. Primarily useful for
   * Temporal Activity Execution
   * @param param0
   * @returns {Transaction}
   */
  static craftSendLotusTransaction = async ({
    outputs,
    totalOutputValue,
    changeAddress,
    utxos,
    inAddress,
    signingKey,
  }: {
    outputs: AsyncIterable<{
      scriptPayload: string
      sats: string
    }>
    totalOutputValue: string
    changeAddress: string
    utxos: WalletParsedUtxo[]
    inAddress: string
    signingKey: PrivateKey
  }): Promise<[Transaction, WalletParsedUtxo[]]> => {
    // set up transaction with base parameters
    const tx = new Transaction()
    tx.feePerByte(config.wallet.tx.feeRate)
    tx.change(changeAddress)
    // input address to script
    const inScript = Script.fromAddress(inAddress)
    const spentUtxos: WalletParsedUtxo[] = []
    // add utxos to inputs until sufficient input amount gathered
    for (const utxo of utxos) {
      tx.addInput(
        new Input.PublicKeyHash({
          prevTxId: utxo.txid,
          outputIndex: utxo.outIdx,
          output: new Output({
            satoshis: Number(utxo.value),
            script: inScript,
          }),
          script: inScript,
        }),
      )
      spentUtxos.push(utxo)
      // if input amount is greater than total output value, break
      if (tx.inputAmount > Number(totalOutputValue)) {
        break
      }
    }
    // add tx outputs
    for await (const output of outputs) {
      tx.addOutput(
        new Output({
          satoshis: Number(output.sats),
          script: Script.fromAddress(
            Address.fromPublicKeyHash(
              Buffer.from(output.scriptPayload, 'hex'),
              Networks.livenet,
            ),
          ),
        }),
      )
    }
    // TODO: add check for tx size (max is 100KB)
    // sign and return tx
    tx.sign(signingKey)
    return [tx, spentUtxos]
  }
  /**
   * Assumes that the last output is the change output. Used in Chronik WS message handling.
   * @param outIdx - the index of the output to check
   * @param outputs - the outputs of the transaction, in Chronik format
   * @returns true if the output is the change output, false otherwise.
   */
  static isChangeOutput = (outIdx: number, outputs: ChronikTx['outputs']) =>
    outIdx == outputs.length - 1
  static WITHDRAW_CHANGE_OUTIDX = 1
  static GIVE_CHANGE_OUTIDX = 1
}
