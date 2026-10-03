-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "digestFrequency" TEXT NOT NULL DEFAULT 'DAILY',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDigestAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lastScrapedAt" DATETIME
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'ANY',
    "tier" TEXT,
    "nickname" TEXT,
    CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCard_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBank" (
    "userId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "bankId"),
    CONSTRAINT "UserBank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBank_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCategory" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    PRIMARY KEY ("userId", "category"),
    CONSTRAINT "UserCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "merchant" TEXT,
    "description" TEXT,
    "category" TEXT,
    "discountText" TEXT,
    "discountPct" REAL,
    "url" TEXT,
    "imageUrl" TEXT,
    "terms" TEXT,
    "cardTypes" TEXT NOT NULL DEFAULT '[]',
    "networks" TEXT NOT NULL DEFAULT '[]',
    "tiers" TEXT NOT NULL DEFAULT '[]',
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "recurrence" TEXT,
    "rawValidity" TEXT,
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Offer_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "offersFound" INTEGER NOT NULL DEFAULT 0,
    "newOffers" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    CONSTRAINT "ScrapeRun_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationLog_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_contentHash_key" ON "Offer"("contentHash");

-- CreateIndex
CREATE INDEX "Offer_bankId_isActive_idx" ON "Offer"("bankId", "isActive");

-- CreateIndex
CREATE INDEX "Offer_validTo_idx" ON "Offer"("validTo");

-- CreateIndex
CREATE INDEX "ScrapeRun_bankId_startedAt_idx" ON "ScrapeRun"("bankId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_offerId_key" ON "NotificationLog"("userId", "offerId");
