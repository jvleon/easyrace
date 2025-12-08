/**
 * Lista de dominios de email temporales comunes a bloquear
 */
const TEMPORARY_EMAIL_DOMAINS = [
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'tempmail.com',
  'tempmail.org',
  'tempmail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'mailinator.com',
  'mailinator.net',
  '10minutemail.com',
  '10minutemail.net',
  'throwaway.email',
  'trashmail.com',
  'getnada.com',
  'maildrop.cc',
];

/**
 * Valida si un email pertenece a un dominio temporal
 * @param email - Dirección de email a validar
 * @returns true si el email NO es temporal, false si es temporal
 */
export function validateEmailNotTemporary(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Extraer el dominio del email
  const emailParts = email.toLowerCase().trim().split('@');
  if (emailParts.length !== 2) {
    return false; // Email inválido
  }

  const domain = emailParts[1];

  // Verificar si el dominio está en la lista de temporales
  return !TEMPORARY_EMAIL_DOMAINS.includes(domain);
}


