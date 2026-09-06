import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * One error shape for the whole API. Anything that is not an HttpException is
 * logged in full and reported as a bare 500 — stack traces and driver messages
 * never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Http");

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      response.status(status).json(
        typeof body === "string"
          ? { statusCode: status, message: body }
          : { statusCode: status, ...(body as Record<string, unknown>) },
      );
      return;
    }

    this.logger.error(
      `${request.method} ${request.originalUrl} failed`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Something went wrong on our side",
    });
  }
}
