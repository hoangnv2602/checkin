import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { JobsController } from "./jobs.controller";

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB || 0),
      },
    }),
  ],
  controllers: [JobsController],
})
export class JobsModule {}