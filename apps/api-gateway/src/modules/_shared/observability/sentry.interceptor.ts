/**
 * apps/api-gateway/src/modules/_shared/observability/sentry.interceptor.ts
 *
 * I-603 — Global exception filter that captures errors to Sentry. Only
 * captures 5xx; 4xx is expected (validation, auth) and not interesting.
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";
import type { Request, Response } from "express";

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("SentryExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      Sentry.captureException(exception, {
        tags: {
          method: req.method,
          path: req.path,
          status: String(status),
        },
        user: {
          ip_address: req.ip,
        },
      });
      this.logger.error(
        `${req.method} ${req.path} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res.status(status).json(typeof body === "string" ? { message: body } : body);
      return;
    }
    res.status(status).json({
      statusCode: status,
      message: "Internal server error",
    });
  }
}
