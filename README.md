# mrs-turtle (formerly `lotus-bot`) v3.2.0

Multi-platform social media bot for giving and receiving Lotus (XPI) cryptocurrency. Supports Telegram, Discord, and Twitter with on-chain transaction processing.

## Current Build Tests

_Continuous Testing & Integration not implemented yet_

## Requirements

- Docker & Docker Compose Plugin
- NodeJS 24+ (if running without Docker)
- PostgreSQL 18+ (if running without Docker)
- Access to Chronik API endpoint (default: https://chronik.lotusia.org)

## Installation

1. `git clone https://github.com/LotusiaStewardship/mrs-turtle`
2. `cd mrs-turtle`
3. `cp .env.example .env`
4. Update .env with Platform API Keys, Database Credentials, and Configuration:

```env
# Platform API Keys (comment out to disable platform)
APIKEY_TELEGRAM='your_telegram_bot_token'
APIKEY_TWITTER='your_twitter_bearer_token'
APIKEY_DISCORD='your_discord_bot_token'

# Discord Configuration
CLIENTID_DISCORD='your_discord_client_id'
GUILDID_DISCORD='comma_separated_guild_ids'

# Wallet Configuration
WALLET_CHRONIK_URL='https://chronik.lotusia.org'
WALLET_EXPLORER_URL='https://explorer.lotusia.org'
WALLET_ADMIN_TELEGRAM='your_telegram_user_id'

# Transaction Configuration
TX_FEE_RATE=2

# Database Configuration
POSTGRES_USER=lotusbot
POSTGRES_PASSWORD=generateALongSuperSecretPasswordHere
POSTGRES_DB=lotusbot

# Temporal.io Configuration (optional - leave empty to disable)
TEMPORAL_HOST='127.0.0.1'
TEMPORAL_NAMESPACE='default'
TEMPORAL_TASKQUEUE='lotus-bot:ipc'
TEMPORAL_NOTIFICATION_CHAT_IDS_TELEGRAM=''
TEMPORAL_NOTIFICATION_CHAT_IDS_DISCORD=''
TEMPORAL_COMMAND_DELIM=''
TEMPORAL_COMMAND_ADMINS=''
TEMPORAL_COMMAND_ENABLED=''
TEMPORAL_COMMAND_WORKFLOW_TYPE=''
TEMPORAL_COMMAND_WORKFLOW_ID=''
TEMPORAL_COMMAND_WORKFLOW_SIGNAL=''

# Solana Configuration (optional)
SOL_WXPI_CA=''
SOL_WXPI_DEXSCREENER_URL=''
```

5. Run database migrations:

```bash
npx prisma migrate deploy
```

6. Start the bot:

```bash
docker compose up -d
```

You can use `docker compose logs -f app` to check the status of the bot. Start times may vary depending on database generation, upgrades, and node module updates.

## Docker Configuration

The bot uses the following Docker images:

- **Application**: node:24
- **Database**: postgres:18

Database data is persisted in `./psql_data` directory.

## Runtime Notes

### Default Platform Commands

These commands are for the user-space; they are not administrative in nature.

```
balance .......... Check your Lotus balance
deposit .......... Get your deposit address and QR code
withdraw ......... Withdraw Lotus to an external wallet address
link ............ Connect platform accounts to share a wallet balance
give ............ Give Lotus to another user (on-chain transaction)
backup .......... Get your wallet seed phrase for backup
ca .............. Get Solana contract address for WXPI (if configured)
```

### Platform-Specific Notes

- **Telegram**: All commands supported. Direct message commands: balance, deposit, withdraw, link, backup. Group commands: give, ca.
- **Discord**: All commands supported via slash commands (/balance, /deposit, etc.).
- **Twitter**: Limited implementation (interface only, commands not fully functional).

### On-Chain Giving

Starting with v2.1.0, the "give" interaction of Mrs. Turtle is now done on-chain. The Give database table is now simply used for tracking gives rather than for calculating user balances. User balances are now calculated solely by the UTXOs of the user's WalletKey.

## Architecture

### Core Components

- **LotusBot**: Main orchestrator, initializes all submodules and manages lifecycle
- **Handler**: Processes user commands and coordinates between wallet and database
- **WalletManager**: Manages HD wallets, UTXO tracking, and transaction creation via Chronik API
- **Database**: PostgreSQL with Prisma ORM for user accounts, deposits, withdrawals, and gives
- **Platform Modules**: Telegram (Telegraf), Discord (discord.js), Twitter (twitter-api-v2)

### Optional Features

- **Temporal.io Integration**: Workflow orchestration for advanced automation
- **Solana/WXPI**: Integration with wrapped XPI on Solana

### Database Schema

The bot maintains the following data models:

- **Account**: Shared wallet accounts across platforms
- **User**: Platform-specific user records linked to accounts
- **WalletKey**: HD wallet keys (mnemonic, hdPrivKey, hdPubKey)
- **Deposit**: Incoming transaction tracking
- **Withdrawal**: Outgoing withdrawal tracking
- **Give**: On-chain give transaction tracking

## Development

### Build Commands

```bash
# Development build
npm run build:dev

# Production build
npm run build:prod

# Start built application
npm start
```

### Database Migrations

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Support / Questions

Telegram: `@maff1989`  
Discord: `maff1989#2504`
