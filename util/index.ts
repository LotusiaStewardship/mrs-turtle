/**
 * Copyright (c) 2024-2026 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */
import * as Constants from './constants.js'
import { randomUUID } from 'node:crypto'

export const toSats = (xpi: number | string) =>
  Math.round(Number(xpi) * Constants.XPI_DIVISOR)

export const toXPI = (sats: number | string) =>
  (Number(sats) / Constants.XPI_DIVISOR).toString()

export const newUUID = () => randomUUID()
export const split = (text: string) => text.split(/\s+|\r?\n/)
