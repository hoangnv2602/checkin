/**
 * apps/api-gateway/src/modules/grpc-server/grpc-server.module.ts
 *
 * I-801: NestJS module wiring the gRPC server (port 50052) for mobile clients.
 * Boot via app.connectMicroservice() in main.ts.
 */
import { Module } from "@nestjs/common";
import { CheckInGrpcController } from "./checkin-grpc.controller";

@Module({
  controllers: [CheckInGrpcController],
})
export class GrpcServerModule {}
