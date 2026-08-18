const requestTiming = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const logger = durationMs >= 1000 ? console.warn : console.info;
    logger(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
  });

  next();
};

module.exports = requestTiming;
