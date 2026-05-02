import dotenv from "dotenv";
import path from "node:path";
import { app } from "./app";
import { closeDatabase, initializeDatabase } from "./db/database";

// Always resolve .env from project root, even when running via npm workspace scripts.
dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

const port = Number(process.env.PORT ?? 4000);

const start = async () => {
  await initializeDatabase();

  const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Please stop the old process or set a new PORT in .env.`
      );
      process.exit(1);
    }

    console.error("Server failed to listen:", error);
    process.exit(1);
  });
};

void start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

const shutdown = async () => {
  await closeDatabase();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
