import { trace, type Span, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('task');

export interface LogAttributes {
  [key: string]: string | number | boolean;
}

class Logger {
  info(message: string, attrs?: LogAttributes): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(message, attrs);
    }
  }

  warn(message: string, attrs?: LogAttributes): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(`WARN: ${message}`, attrs);
    }
  }

  error(message: string, error?: unknown, attrs?: LogAttributes): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(`ERROR: ${message}`, attrs);
      if (error instanceof Error) {
        span.recordException(error);
      }
      span.setStatus({ code: SpanStatusCode.ERROR, message });
    }
  }

  startSpan<T>(name: string, fn: (span: Span) => T): T {
    return tracer.startActiveSpan(name, (span) => {
      try {
        const result = fn(span);
        span.end();
        return result;
      } catch (e) {
        if (e instanceof Error) {
          span.recordException(e);
        }
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw e;
      }
    });
  }
}

export const logger = new Logger();
