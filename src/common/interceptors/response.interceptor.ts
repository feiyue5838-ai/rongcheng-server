import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export interface Response<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
  timestamp: number;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const requestId = uuidv4();
    return next.handle().pipe(
      map(data => ({
        code: 0,
        message: 'success',
        data,
        requestId,
        timestamp: Date.now(),
      })),
    );
  }
}
