/**
 * Shared Types for AI Assistant System
 * Used across Electron, Node.js, and Python services
 */

// Authentication
export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  voiceProfileId: string;
  isOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceProfile {
  id: string;
  userId: string;
  voiceEmbeddings: number[][];
  enrollmentSamples: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  password: string;
  email?: string;
}

// Voice & Audio
export interface AudioFrame {
  data: Buffer;
  timestamp: number;
  sampleRate: number;
}

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  timestamp: Date;
}

export interface VoiceVerificationResult {
  verified: boolean;
  similarity: number;
  userId?: string;
}

// Commands
export interface CommandAction {
  type: CommandType;
  parameters: Record<string, any>;
  requiresConfirmation?: boolean;
}

export enum CommandType {
  OPEN_APP = "OPEN_APP",
  OPEN_URL = "OPEN_URL",
  CLOSE_APP = "CLOSE_APP",
  DELETE_FILE = "DELETE_FILE",
  CREATE_FILE = "CREATE_FILE",
  OPEN_FOLDER = "OPEN_FOLDER",
  OPEN_FILE = "OPEN_FILE",
  SET_VOLUME = "SET_VOLUME",
  MUTE_VOLUME = "MUTE_VOLUME",
  SCREENSHOT = "SCREENSHOT",
  SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN",
  SYSTEM_RESTART = "SYSTEM_RESTART",
  LOCK_SCREEN = "LOCK_SCREEN",
  SLEEP_SYSTEM = "SLEEP_SYSTEM",
  TYPE_TEXT = "TYPE_TEXT",
  RUN_COMMAND = "RUN_COMMAND",
  CUSTOM_COMMAND = "CUSTOM_COMMAND",
}

// Command Execution
export interface CommandExecution {
  id: string;
  userId: string;
  command: string;
  action: CommandAction;
  status: ExecutionStatus;
  result?: string;
  error?: string;
  timestamp: Date;
  voiceResponse: string;
}

export enum ExecutionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  EXECUTING = "EXECUTING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
}

// UI Status
export enum UIStatus {
  IDLE = "IDLE",
  LISTENING = "LISTENING",
  PROCESSING = "PROCESSING",
  EXECUTING = "EXECUTING",
  ERROR = "ERROR",
}

// API Responses
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface VoiceCommandRequest {
  audioData: Buffer;
  sessionId: string;
  userId: string;
}

export interface VoiceCommandResponse {
  command: string;
  action: CommandAction;
  confidence: number;
  voiceResponse: string;
}
