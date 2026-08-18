const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: [{ emit: "event", level: "query" }, "warn", "error"],
});

const slowQueryMs = Math.max(Number.parseInt(process.env.SLOW_QUERY_MS || "200", 10), 0);
prisma.$on("query", (event) => {
  if (event.duration >= slowQueryMs) {
    // Parameters are intentionally omitted because they may contain private data.
    console.warn(`Slow database query (${event.duration}ms): ${event.query}`);
  }
});

module.exports = prisma;
