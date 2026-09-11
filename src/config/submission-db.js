const { AsyncLocalStorage } = require("node:async_hooks");
const prisma = require("./prisma");
const context = new AsyncLocalStorage();

// Submission operations share the transaction holding the attempt's lease lock.
const db = new Proxy(prisma, {
  get(target, key) {
    const client = context.getStore() || target;
    if (key === "$transaction" && context.getStore()) {
      return (operations) => typeof operations === "function" ? operations(client) : Promise.all(operations);
    }
    const value = client[key];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
module.exports = { db, withSubmissionTransaction: (tx, fn) => context.run(tx, fn) };
