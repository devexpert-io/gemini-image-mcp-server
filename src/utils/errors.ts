import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripMcpPrefix(error: McpError): string {
  const prefix = `MCP error ${error.code}: `;
  return error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message;
}

function safeSerialize(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  if (value === null || value === undefined) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch (serializationError) {
    const description = serializationError instanceof Error ? serializationError.message : 'Unknown serialization error';
    return `[unserializable:${description}]`;
  }
}

function mergeData(
  existing: unknown,
  extra?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!extra || Object.keys(extra).length === 0) {
    return isRecord(existing) ? existing : undefined;
  }

  const base = isRecord(existing)
    ? existing
    : existing === undefined
    ? {}
    : { previous: existing };

  return {
    ...base,
    ...extra,
  };
}

export function ensureMcpError(
  error: unknown,
  fallbackCode: ErrorCode,
  fallbackMessage: string,
  extraData?: Record<string, unknown>
): McpError {
  if (error instanceof McpError) {
    const mergedData = mergeData(error.data, extraData);
    if (!mergedData) {
      return error;
    }

    const next = new McpError(error.code, stripMcpPrefix(error), mergedData);
    next.stack = error.stack;
    return next;
  }

  const data: Record<string, unknown> = {
    ...(extraData ?? {}),
  };

  if (error instanceof Error) {
    data.cause = error.message;
    if (error.name && error.name !== 'Error') {
      data.causeName = error.name;
    }
  } else if (typeof error === 'object' && error !== null) {
    data.cause = safeSerialize(error);
  } else {
    data.cause = String(error);
  }

  return new McpError(fallbackCode, fallbackMessage, data);
}

export function invalidParams(message: string, data?: Record<string, unknown>): McpError {
  return new McpError(ErrorCode.InvalidParams, message, data);
}

export function internalError(message: string, data?: Record<string, unknown>): McpError {
  return new McpError(ErrorCode.InternalError, message, data);
}
