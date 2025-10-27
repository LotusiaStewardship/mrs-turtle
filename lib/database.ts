import { PrismaClient, Deposit } from '../prisma/prisma-client-js/client.js'
import type { PlatformName } from './platforms/index.js'
import type { Wallet } from '../util/types.js'

enum PlatformUserTable {
  telegram = 'userTelegram',
  discord = 'userDiscord',
  twitter = 'userTwitter',
}

export const prisma = new PrismaClient()

export async function connect() {
  await prisma.$connect()
}

export async function disconnect() {
  await prisma.$disconnect()
}

export const check = {
  /**
   * Checks if a transaction is a "give" transaction.
   * @param {string} txid The transaction ID to look up.
   * @returns True if it is a "give" transaction, false otherwise.
   */
  isGiveTx: async (txid: string): Promise<boolean> => {
    const result = await prisma.give.findFirst({
      where: { txid },
      select: { txid: true },
    })
    return result?.txid ? true : false
  },

  /**
   * Checks if a transaction is a "withdraw" transaction.
   * @param {string} txid The transaction ID to look up.
   * @returns True if it is a "withdraw" transaction, false otherwise.
   */
  isWithdrawTx: async (txid: string): Promise<boolean> => {
    const result = await prisma.withdrawal.findFirst({
      where: { txid },
      select: { txid: true },
    })
    return result?.txid ? true : false
  },

  /**
   * Checks if a user is valid on the given platform.
   * @param {PlatformName} platform The name of the platform.
   * @param {string} platformId The user's ID on the platform.
   * @returns True if the user is valid, false otherwise.
   */
  isValidUser: async (
    platform: PlatformName,
    platformId: string,
  ): Promise<boolean> => {
    //@ts-ignore
    const result = await prisma[PlatformUserTable[platform]].findFirst({
      where: { id: platformId },
    })
    return result?.userId ? true : false
  },
}

export const read = {
  /**
   * Gets the user wallet keys for all users.
   * @returns The user wallet keys for all users.
   */
  getUserWalletKeys: async () => {
    const result = await prisma.user.findMany({
      select: {
        id: true,
        accountId: true,
        key: {
          select: { hdPrivKey: true },
        },
      },
    })
    return result.map(user => {
      return {
        accountId: user.accountId,
        userId: user.id,
        hdPrivKey: user?.key?.hdPrivKey,
      }
    })
  },
  /**
   * Gets the user ID and account ID for the given platform and platform ID.
   * @param {PlatformName} platform The name of the platform.
   * @param {string} platformId The user's ID on the platform.
   * @returns The user ID and account ID for the given platform and platform ID.
   */
  getIds: async (
    platform: PlatformName,
    platformId: string,
  ): Promise<{ userId: string; accountId: string } | null> => {
    //@ts-ignore
    const result = await prisma[PlatformUserTable[platform]].findFirst({
      where: { id: platformId },
      select: { user: { select: { id: true, accountId: true } } },
    })
    return result?.user
      ? { userId: result.user.id, accountId: result.user.accountId }
      : null
  },
  /**
   * Gets the user IDs for the given account ID.
   * @param {string} accountId The account ID.
   * @returns The user IDs for the given account ID.
   */
  getUserIdsForAccount: async (accountId: string) => {
    const result = await prisma.account.findFirst({
      where: { id: accountId },
      select: { users: { select: { id: true } } },
    })
    return result?.users?.map(user => user.id) || []
  },
  /**
   * Gets the account ID for the given secret.
   * @param {string} secret The secret.
   * @returns The account ID for the given secret.
   */
  getAccountIdFromSecret: async (secret: string) => {
    const result = await prisma.user.findFirst({
      where: { secret },
      select: { accountId: true },
    })
    return result?.accountId
  },
  /**
   * Gets the user secret for the given platform and platform ID.
   * @param {PlatformName} platform The name of the platform.
   * @param {string} platformId The user's ID on the platform.
   * @returns The user secret for the given platform and platform ID.
   */
  getUserSecret: async (platform: PlatformName, platformId: string) => {
    //@ts-ignore
    const result = await prisma[PlatformUserTable[platform]].findFirst({
      where: { id: platformId },
      select: { user: { select: { secret: true } } },
    })
    return result?.user?.secret
  },
  /**
   * Gets the user mnemonic for the given user ID.
   * @param {string} userId The user ID.
   * @returns The user mnemonic for the given user ID.
   */
  getUserMnemonic: async (userId: string) => {
    const result = await prisma.user.findFirst({
      where: { id: userId },
      select: { key: { select: { mnemonic: true } } },
    })
    return result?.key?.mnemonic
  },
}

export const write = {
  /**
   * Given the provided `utxos`, filter the UTXOs that exist in the database
   * and write the new ones
   * @param {Wallet.AccountUtxo[]} utxos The UTXO set.
   * @returns The new deposits.
   */
  reconcileDeposits: async (
    utxos: Wallet.AccountUtxo[],
  ): Promise<Deposit[]> => {
    return await prisma.$transaction(async tx => {
      const newDeposits: Deposit[] = []
      for (const utxo of utxos) {
        const deposit = await tx.deposit.findFirst({
          where: { txid: utxo.txid, outIdx: utxo.outIdx },
        })
        if (!deposit) {
          newDeposits.push({
            ...utxo,
            timestamp: new Date(),
            blockHeight: utxo.blockHeight || 0,
            isCoinbase: utxo.isCoinbase || false,
          })
        }
      }
      // return the new deposits to notify the users of their deposits
      return newDeposits
    })
  },
  /**
   * Saves a new account to the database.
   * @returns The new account.
   */
  saveAccount: async ({
    accountId,
    userId,
    secret,
    platform,
    platformId,
    mnemonic,
    hdPrivKey,
    hdPubKey,
  }: {
    accountId: string
    userId: string
    secret: string
    platform?: string
    platformId?: string
    mnemonic: string
    hdPrivKey: string
    hdPubKey: string
  }) => {
    const privKeyBytes = Buffer.from(hdPrivKey)
    const pubKeyBytes = Buffer.from(hdPubKey)
    const account = {
      id: accountId,
      users: {
        create: {
          id: userId,
          secret,
          key: {
            create: {
              mnemonic,
              hdPrivKey: privKeyBytes,
              hdPubKey: pubKeyBytes,
            },
          },
        },
      },
    }
    if (platform && platformId) {
      account.users.create[platform.toLowerCase()] = {
        create: {
          id: platformId,
        },
      }
    }
    return await prisma.account.create({ data: account })
  },
  /**
   * Updates the account ID for the given user ID.
   * @param {string} userId The user ID.
   * @param {string} accountId The account ID.
   * @returns The updated user.
   */
  updateUserAccountId: async (userId: string, accountId: string) => {
    const result = await prisma.user.update({
      where: { id: userId },
      data: { accountId },
    })
    return result
  },
  /**
   * Saves a new deposit to the database.
   * @param {Wallet.Deposit} data The deposit data.
   * @returns The new deposit.
   */
  saveDeposit: async (data: Wallet.Deposit) => {
    const result = await prisma.deposit.create({
      data,
      select: {
        user: {
          select: {
            accountId: true,
            telegram: true,
            twitter: true,
            discord: true,
          },
        },
      },
    })
    return result
  },
  /**
   * Deletes a give from the database.
   * @param {string} txid The transaction ID.
   */
  deleteGive: async (txid: string): Promise<void> => {
    await prisma.give.delete({ where: { txid } })
  },
  /**
   * Deletes a withdrawal from the database.
   * @param {string} txid The transaction ID.
   */
  deleteWithdrawal: async (txid: string): Promise<void> => {
    await prisma.withdrawal.delete({ where: { txid } })
  },
  /**
   * Saves a new "give" transaction to the database.
   * @param data The give object
   */
  saveGive: async (data: Wallet.Give): Promise<void> => {
    await prisma.give.create({ data })
  },
  /**
   * Saves a new withdrawal to the database.
   * @param {Wallet.Withdrawal} data The withdrawal data.
   */
  saveWithdrawal: async (data: Wallet.Withdrawal): Promise<void> => {
    await prisma.withdrawal.create({ data })
  },
  /**
   * Executes a transaction.
   * @param {any[]} inserts The inserts to execute.
   * @returns The result of the transaction.
   */
  _execTransaction: async (inserts: any[]) => {
    return await prisma.$transaction(inserts)
  },
}
