import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  success: boolean;
  statusCode: number;
  timestamp: string;
  path: string;
  message?: string;
  [key: string]: any;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Determine log level based on status code severity
    let logLevel: 'log' | 'warn' | 'error' = 'error';
    if (status < 400) {
      logLevel = 'log';
    } else if (status < 500) {
      logLevel = 'warn';
    }

    // Log the error with appropriate level, including request details and stack
    this.logger[logLevel](
      `HTTP ${status} - ${request.method} ${request.url}: ${exception.message}`,
      exception.stack,
    );

    // Prepare consistent error response
    const errorDetails =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : exceptionResponse || { message: exception.message };

    let responseBody: ErrorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...errorDetails,
    };

    // In production, mask internal details for 5xx errors to avoid exposing sensitive information
    if (process.env.NODE_ENV === 'production' && status >= 500) {
      responseBody = {
        success: false,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: 'Internal server error',
      };
    }

    response.status(status).json(responseBody);
  }
}
