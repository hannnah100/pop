import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupSocketIO } from "./socket/events";
import { seedDailyContent } from "./lib/seedDaily";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
setupSocketIO(httpServer);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed daily archive content (Three Flops + Mini Crossword) into
  // whatever DB this server is talking to. Idempotent — it skips rows
  // that already exist. This is what populates the Archive page on the
  // published site.
  void seedDailyContent();
});
