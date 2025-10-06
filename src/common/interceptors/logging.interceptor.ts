import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;
    const ip = req.ip;
    const userAgent = req.get('user-agent') || '';
    const userId = req.user?.id || 'anonymous'; // Assumes authentication middleware sets req.user
    const now = Date.now();

    // Log incoming request with relevant details (avoiding sensitive info like full bodies)
    const queryLog =
      Object.keys(req.query).length > 0
        ? `query params: ${JSON.stringify(req.query)}`
        : 'no query params';
    const bodyLog = req.body ? `body size: ${JSON.stringify(req.body).length} bytes` : 'no body';
    this.logger.log(
      `Incoming Request: ${method} ${url} from IP: ${ip} UA: ${userAgent} User: ${userId} | ${queryLog} | ${bodyLog}`,
    );

    return next.handle().pipe(
      tap({
        next: data => {
          const res = context.switchToHttp().getResponse();
          const status = res.statusCode;
          const responseTime = Date.now() - now;
          // Log outgoing response (avoid logging full body to prevent sensitive data exposure)
          const responseBodyLog = data
            ? `body size: ${JSON.stringify(data).length} bytes`
            : 'no body';
          this.logger.log(
            `Outgoing Response: ${method} ${url} Status: ${status} Time: ${responseTime}ms User: ${userId} | ${responseBodyLog}`,
          );
        },
        error: err => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `Error Response: ${method} ${url} Time: ${responseTime}ms User: ${userId} | Error: ${err.message}`,
          );
        },
      }),
    );
  }
}
