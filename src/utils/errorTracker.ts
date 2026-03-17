import * as Sentry from '@sentry/react';

// --- Context types (Interface Segregation Principle) ---

export interface FileUploadContext {
  kind: 'file_upload';
  uploadFunction: string;
  fileType?: string;
  fileSize?: number;
  customId?: string;
  httpStatus?: number;
  eventSlug?: string;
  eventId?: string;
  userEmail?: string;
}

export interface EdgeFunctionContext {
  kind: 'edge_function';
  functionName: string;
  httpStatus?: number;
  eventSlug?: string;
  eventId?: string;
  userEmail?: string;
}

export interface DataFetchContext {
  kind: 'data_fetch';
  resource: string;
  operation: 'query' | 'rpc' | 'view';
  eventSlug?: string;
  eventId?: string;
}

export interface FormSubmissionContext {
  kind: 'form_submission';
  step: string;
  isPairCategory?: boolean;
  eventSlug?: string;
  eventId?: string;
  userEmail?: string;
}

export type ErrorContext =
  | FileUploadContext
  | EdgeFunctionContext
  | DataFetchContext
  | FormSubmissionContext;

// --- Internal helpers (Single Responsibility) ---

function buildTags(context: ErrorContext): Record<string, string> {
  const tags: Record<string, string> = { error_kind: context.kind };

  if ('eventSlug' in context && context.eventSlug) tags.event_slug = context.eventSlug;
  if ('eventId' in context && context.eventId) tags.event_id = context.eventId;

  switch (context.kind) {
    case 'file_upload':
      tags.upload_function = context.uploadFunction;
      if (context.fileType) tags.file_type = context.fileType;
      if (context.httpStatus) tags.http_status = String(context.httpStatus);
      break;
    case 'edge_function':
      tags.function_name = context.functionName;
      if (context.httpStatus) tags.http_status = String(context.httpStatus);
      break;
    case 'data_fetch':
      tags.resource = context.resource;
      tags.operation = context.operation;
      break;
    case 'form_submission':
      tags.form_step = context.step;
      if (context.isPairCategory !== undefined) {
        tags.is_pair_category = String(context.isPairCategory);
      }
      break;
  }

  return tags;
}

function buildExtras(context: ErrorContext): Record<string, unknown> {
  const extras: Record<string, unknown> = {};

  if ('fileSize' in context && context.fileSize !== undefined) {
    extras.file_size_bytes = context.fileSize;
    extras.file_size_mb = (context.fileSize / (1024 * 1024)).toFixed(2) + ' MB';
  }

  if ('customId' in context && context.customId) {
    extras.cloudflare_custom_id = context.customId;
  }

  return extras;
}

// --- Public API (Dependency Inversion: consumers depend on this, not on Sentry directly) ---

/**
 * Captures an error in Sentry with structured context describing where and why it failed.
 * Only call this for unexpected system errors, not for user validation errors.
 */
export function captureError(error: unknown, context: ErrorContext): void {
  Sentry.withScope((scope) => {
    const tags = buildTags(context);
    const extras = buildExtras(context);

    Object.entries(tags).forEach(([key, value]) => scope.setTag(key, value));
    Object.entries(extras).forEach(([key, value]) => scope.setExtra(key, value));

    const email = 'userEmail' in context ? context.userEmail : undefined;
    if (email) scope.setUser({ email });

    Sentry.captureException(error);
  });
}

/**
 * Adds a breadcrumb to help trace user actions leading up to an error.
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({ message, level: 'info', data });
}
