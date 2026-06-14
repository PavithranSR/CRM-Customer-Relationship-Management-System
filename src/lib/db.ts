import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

type LegacyChatMessageDelegate = {
  findMany: (...args: unknown[]) => Promise<unknown[]>;
  findFirst: (...args: unknown[]) => Promise<unknown | null>;
  findUnique: (...args: unknown[]) => Promise<unknown | null>;
  count: (...args: unknown[]) => Promise<number>;
  create: (...args: unknown[]) => Promise<unknown>;
  createMany: (...args: unknown[]) => Promise<{ count: number }>;
  updateMany: (...args: unknown[]) => Promise<{ count: number }>;
  deleteMany: (...args: unknown[]) => Promise<{ count: number }>;
};

const resolvedDatabaseUrl =
  process.env.DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL;

export const isDatabaseConfigured = Boolean(resolvedDatabaseUrl);

const createMissingDatabaseProxy = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Missing database URL. Set DATABASE_URL, DATABASE_URL_UNPOOLED, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL."
        );
      },
    }
  ) as PrismaClient;

export const db =
  globalForPrisma.prisma ??
  (isDatabaseConfigured
    ? new PrismaClient({
        datasources: {
          db: { url: resolvedDatabaseUrl },
        },
        log:
          process.env.NODE_ENV === "development"
            ? ["error", "warn"]
            : ["error"],
      })
    : createMissingDatabaseProxy());

const createLegacyChatMessageDelegate = (): LegacyChatMessageDelegate => ({
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  count: async () => 0,
  create: async () => {
    throw new Error(
      "chatMessage is not part of the current schema. Use activityLog-based notifications instead."
    );
  },
  createMany: async () => ({ count: 0 }),
  updateMany: async () => ({ count: 0 }),
  deleteMany: async () => ({ count: 0 }),
});

if (!("chatMessage" in db)) {
  Object.defineProperty(db, "chatMessage", {
    value: createLegacyChatMessageDelegate(),
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

if (!Object.getOwnPropertyDescriptor(PrismaClient.prototype, "chatMessage")) {
  Object.defineProperty(PrismaClient.prototype, "chatMessage", {
    get() {
      return createLegacyChatMessageDelegate();
    },
    configurable: true,
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
