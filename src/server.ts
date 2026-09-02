import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { transporter } from "./app/middleware/nodemailer";
import { redisClient } from "./app/middleware/redis";

const PORT = config.port;

// ANSI Color Codes for terminal styling
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

const main = async () => {
  try {
    console.log(`${colors.cyan}🚀 Starting GridPulse / PowerGridBD Backend Server...${colors.reset}`);
    const startTime = Date.now();

    // 1. Database Connection
    await prisma.$connect();
    console.log(`${colors.green}✔ Database Connected Successfully${colors.reset} ${colors.magenta}(PostgreSQL / Prisma)${colors.reset}`);

    // 2. Redis Connection
    await redisClient.connect();
    console.log(`${colors.green}✔ Redis Client Connected Successfully${colors.reset} ${colors.magenta}(Caching & OTP Store)${colors.reset}`);

    // 3. Nodemailer Verification
    await transporter.verify();
    console.log(`${colors.green}✔ Mail Transporter Verified Successfully${colors.reset} ${colors.magenta}(SMTP Service)${colors.reset}`);

    // 4. Start Express Server
    app.listen(PORT, () => {
      const duration = Date.now() - startTime;
      console.log(`\n--------------------------------------------------`);
      console.log(`${colors.bright}${colors.green}  Server is up and running smoothly! 🌟${colors.reset}`);
      console.log(`--------------------------------------------------`);
      console.log(`➜  Local URL:   ${colors.cyan}http://localhost:${PORT}${colors.reset}`);
      console.log(`➜  Environment: ${colors.yellow}${config.node_env || "development"}${colors.reset}`);
      console.log(`➜  Startup Time: ${colors.magenta}${duration}ms${colors.reset}`);
      console.log(`--------------------------------------------------\n`);
    });
  } catch (error) {
    console.error(`\n${colors.red}✖ Error starting the server:${colors.reset}`, error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

main();