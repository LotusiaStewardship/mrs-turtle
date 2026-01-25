#!/bin/bash

## Make sure updated dependencies are installed
npm install

## Make sure prisma is generated
npx prisma generate
npx prisma db push

## Start backend service
npm run build:dev && npm run start