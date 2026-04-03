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

// --- Friendly message helpers ---

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as any).httpStatus ?? (error as any).status;
}

const FILE_UPLOAD_MESSAGES: Record<number, string> = {
  400: 'El archivo no es válido o está dañado. Intenta con otra imagen.',
  401: 'Tu sesión ha expirado. Recarga la página e intenta de nuevo.',
  403: 'No tienes permiso para subir este archivo. Recarga la página e intenta de nuevo.',
  413: 'El archivo es demasiado grande. Usa una imagen menor a 2 MB.',
  429: 'Demasiados intentos seguidos. Espera un momento e intenta de nuevo.',
  500: 'El servicio de imágenes no está disponible. Intenta más tarde.',
  502: 'El servicio de imágenes no está disponible. Intenta más tarde.',
  503: 'El servicio de imágenes está en mantenimiento. Intenta más tarde.',
};

const EDGE_FUNCTION_MESSAGES: Record<string, string> = {
  'verify-recaptcha': 'No se pudo verificar el reCAPTCHA. Recarga la página e intenta de nuevo.',
  'validate-competitor': 'No se pudo validar tu información. Por favor, intenta de nuevo.',
  'upload-payment-proof': 'No se pudo enviar el comprobante. Por favor, intenta de nuevo.',
  'cloudflare-direct-upload': 'No se pudo preparar la subida de la imagen. Intenta más tarde.',
};

/**
 * Returns a user-friendly error message based on the error and its context.
 * Use this for messages shown in the UI instead of raw error.message.
 */
export function getUserFriendlyMessage(error: unknown, context: ErrorContext): string {
  if (isNetworkError(error)) {
    return 'Sin conexión a internet. Verifica tu conexión e intenta de nuevo.';
  }

  const status = extractHttpStatus(error);

  switch (context.kind) {
    case 'file_upload': {
      if (status && FILE_UPLOAD_MESSAGES[status]) return FILE_UPLOAD_MESSAGES[status];
      if (status && status >= 500) return 'El servicio de subida no está disponible. Intenta más tarde.';
      return 'No se pudo subir el archivo. Verifica tu conexión e intenta de nuevo.';
    }

    case 'edge_function': {
      if (status === 429) return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
      if (status && status >= 500) return 'El servidor no está disponible en este momento. Intenta más tarde.';
      return EDGE_FUNCTION_MESSAGES[context.functionName] ?? 'Error de comunicación con el servidor. Por favor, intenta de nuevo.';
    }

    case 'form_submission': {
      if (status === 429) return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
      if (status && status >= 500) return 'El servidor no está disponible. Intenta más tarde.';
      return 'Error al completar el registro. Por favor, intenta de nuevo.';
    }

    case 'data_fetch': {
      return 'Error al cargar la información. Por favor, recarga la página.';
    }
  }
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
