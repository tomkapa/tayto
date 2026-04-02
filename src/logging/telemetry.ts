import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Config } from '../config/index.js';

let sdk: NodeSDK | undefined;

export function initTelemetry(config: Config): void {
  const spanProcessor = config.otelEndpoint
    ? new BatchSpanProcessor(new OTLPTraceExporter({ url: config.otelEndpoint }))
    : config.logLevel === 'debug'
      ? new BatchSpanProcessor(new ConsoleSpanExporter())
      : undefined;

  sdk = new NodeSDK({
    serviceName: 'task',
    spanProcessors: spanProcessor ? [spanProcessor] : [],
  });

  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}
