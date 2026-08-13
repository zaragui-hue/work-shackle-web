/**
 * Phase 1 IPC error codes emitted by Rust `AppError`.
 * Keep in sync with `src-tauri/src/errors/app_error.rs` (excluding Phase 2+ codes).
 */
export const PHASE1_IPC_ERROR_CODES = [
  "VALIDATION_FAILED",
  "WORKSPACE_NOT_FOUND",
  "WORKSPACE_NOT_WRITABLE",
  "DB_OPEN_FAILED",
  "DB_MIGRATION_FAILED",
  "DATABASE_ERROR",
  "APP_NOT_READY",
  "CONFIG_READ_FAILED",
  "CONFIG_WRITE_FAILED",
  "INVALID_PATH",
  "WORKSPACE_TARGET_NOT_EMPTY",
  "WORKSPACE_SWITCH_FAILED",
  "WORKSPACE_NETWORK_DRIVE_UNSUPPORTED",
  "WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED",
  "WORKSPACE_DRIVE_TYPE_UNKNOWN",
] as const;

export type Phase1ErrorCode = (typeof PHASE1_IPC_ERROR_CODES)[number];

export const ErrorCode = {
  ValidationFailed: "VALIDATION_FAILED",
  WorkspaceNotFound: "WORKSPACE_NOT_FOUND",
  WorkspaceNotWritable: "WORKSPACE_NOT_WRITABLE",
  DbOpenFailed: "DB_OPEN_FAILED",
  DbMigrationFailed: "DB_MIGRATION_FAILED",
  DatabaseError: "DATABASE_ERROR",
  AppNotReady: "APP_NOT_READY",
  ConfigReadFailed: "CONFIG_READ_FAILED",
  ConfigWriteFailed: "CONFIG_WRITE_FAILED",
  InvalidPath: "INVALID_PATH",
  WorkspaceTargetNotEmpty: "WORKSPACE_TARGET_NOT_EMPTY",
  WorkspaceSwitchFailed: "WORKSPACE_SWITCH_FAILED",
  WorkspaceNetworkDriveUnsupported: "WORKSPACE_NETWORK_DRIVE_UNSUPPORTED",
  WorkspaceRemovableDriveUnsupported: "WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED",
  WorkspaceDriveTypeUnknown: "WORKSPACE_DRIVE_TYPE_UNKNOWN",
} as const satisfies Record<string, Phase1ErrorCode>;

type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
type MissingFromErrorCode = Exclude<Phase1ErrorCode, ErrorCodeValue>;
type ExtraInErrorCode = Exclude<ErrorCodeValue, Phase1ErrorCode>;
type Phase1ErrorCodeContractOk = MissingFromErrorCode extends never
  ? ExtraInErrorCode extends never
    ? true
    : never
  : never;

/** Compile-time guard: Rust Phase 1 IPC codes must match `ErrorCode`. */
const phase1ErrorCodeContract: Phase1ErrorCodeContractOk = true;
void phase1ErrorCodeContract;

export function isPhase1ErrorCode(code: string): code is Phase1ErrorCode {
  return (PHASE1_IPC_ERROR_CODES as readonly string[]).includes(code);
}

export type StartupHandledErrorCode =
  | typeof ErrorCode.ValidationFailed
  | typeof ErrorCode.WorkspaceNotFound
  | typeof ErrorCode.WorkspaceNotWritable
  | typeof ErrorCode.DbOpenFailed
  | typeof ErrorCode.DbMigrationFailed
  | typeof ErrorCode.DatabaseError
  | typeof ErrorCode.AppNotReady;
