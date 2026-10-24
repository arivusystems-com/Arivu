/**
 * ============================================================================
 * PLATFORM CONTRACT ERRORS: Developer-Facing Error Types
 * ============================================================================
 * 
 * Standard error shapes for platform builders and validation.
 * 
 * Rules:
 * - Thrown only in builders/validation
 * - Never rendered directly to users
 * - Logged or surfaced in dev tools
 * - Descriptive and actionable
 * 
 * ============================================================================
 */

/**
 * Platform Contract Error Types
 */
export type PlatformContractErrorType =
  | 'REGISTRY_INVALID'
  | 'PERMISSION_INVALID'
  | 'CONTRACT_MISMATCH'
  | 'BUILDER_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Platform Contract Error
 * 
 * Standard error shape for platform contract violations.
 * These errors are developer-facing and should never be shown to end users.
 */
export class PlatformContractError extends Error {
  public readonly type: PlatformContractErrorType;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(
    type: PlatformContractErrorType,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PlatformContractError';
    this.type = type;
    this.context = context;
    this.timestamp = Date.now();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    const captureStackTrace = (
      Error as { captureStackTrace?: (target: object, constructorOpt?: abstract new (...args: never[]) => unknown) => void }
    ).captureStackTrace;
    if (typeof captureStackTrace === 'function') {
      captureStackTrace(this, PlatformContractError);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): {
    name: string;
    type: PlatformContractErrorType;
    message: string;
    context?: Record<string, unknown>;
    timestamp: number;
    stack?: string;
  } {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Create a registry validation error
 */
export function createRegistryError(
  message: string,
  context?: Record<string, unknown>
): PlatformContractError {
  return new PlatformContractError('REGISTRY_INVALID', message, context);
}

/**
 * Create a permission validation error
 */
export function createPermissionError(
  message: string,
  context?: Record<string, unknown>
): PlatformContractError {
  return new PlatformContractError('PERMISSION_INVALID', message, context);
}

/**
 * Create a contract mismatch error
 */
export function createContractMismatchError(
  message: string,
  context?: Record<string, unknown>
): PlatformContractError {
  return new PlatformContractError('CONTRACT_MISMATCH', message, context);
}

/**
 * Create a builder error
 */
export function createBuilderError(
  message: string,
  context?: Record<string, unknown>
): PlatformContractError {
  return new PlatformContractError('BUILDER_ERROR', message, context);
}

/**
 * Create a validation error
 */
export function createValidationError(
  message: string,
  context?: Record<string, unknown>
): PlatformContractError {
  return new PlatformContractError('VALIDATION_ERROR', message, context);
}

