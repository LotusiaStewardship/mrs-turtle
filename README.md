# lotus-bot v3.1.1

Bot for Multiple Social Networking Platforms for Giving/Receiving Lotus to/from other Users.

## Current Build Tests

_Continuous Testing & Integration not implemented yet_

## Requirements

- Docker & Docker Compose Plugin
- NodeJS 24+

## Installation

1. `git clone https://github.com/LotusiaStewardship/mrs-turtle`
2. `cd mrs-turtle`
3. `cp .env.example .env`
4. Update .env with Platform API Keys, and Database Credentials:
```env
APIKEY_TELEGRAM='abc123'
APIKEY_TWITTER='abc123'
APIKEY_DISCORD='abc123'
CLIENTID_DISCORD='abc123'
# Comma Separated List of Guild IDs (Server IDs)
GUILDID_DISCORD='123456789'
...
POSTGRES_USER=lotusbot
POSTGRES_PASSWORD=generateALongSuperSecretPasswordHere
POSTGRES_DB=lotusbot
```
5. Once you have API Keys, Bot Tokens, and the PostgreSQL information setup: `docker compose up -d`

You can use `docker compose logs` to check the status of the bot. Start times may vary depending on database generation, upgrades, and node module updates.

## Runtime Notes

### Default Platform Commands

These commands are for the user-space; they are not administrative in nature.

```
balance .......... Check your Lotus balance
deposit .......... Deposit Lotus to your account
withdraw ......... Withdraw Lotus to your wallet address
link    .......... Connect platform accounts to share a wallet balance
give    .......... Give Lotus to another user
```

### On-Chain Giving

Starting with v2.1.0, the "give" interaction of lotus-bot is now done on-chain. The Give database table is now simply used for tracking gives rather than for calculating user balances. User balances are now calculated solely by the UTXOs of the user's `WalletKey`.

### Support / Questions

Telegram: `@maff1989`  
Discord: `maff1989#2504`
