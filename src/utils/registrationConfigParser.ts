export interface FieldConfig {
  id: string;
  name?: string; // Para compatibilidad
  type?: string;
  label: string;
  required: boolean;
  enabled?: boolean;
}

export interface RegistrationConfig {
  optional_fields?: string[];
  required_fields?: string[];
  fields?: FieldConfig[];
}

export interface ParsedField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'file';
  label: string;
  required: boolean;
  options?: { value: string; label: string }[];
}

/**
 * Helper to get the club field configuration from registration config
 * Returns the club field config or null if not found
 */
function getClubFieldConfig(config: RegistrationConfig | null | undefined): FieldConfig | null {
  if (!config?.fields || !Array.isArray(config.fields)) {
    return null;
  }
  return config.fields.find((field) => field.id === 'club' || field.id === 'club_id') || null;
}

/**
 * Check if the club field is enabled in the registration config
 * Defaults to true for backward compatibility
 */
export function isClubFieldEnabled(config: RegistrationConfig | null | undefined): boolean {
  const clubField = getClubFieldConfig(config);
  // Default to enabled for backward compatibility
  if (!clubField) return true;
  return clubField.enabled !== false;
}

/**
 * Check if the club field is required in the registration config
 * Defaults to false (optional) for new configurations
 */
export function isClubFieldRequired(config: RegistrationConfig | null | undefined): boolean {
  const clubField = getClubFieldConfig(config);
  // Default to false (optional) for new configurations
  if (!clubField) return false;
  return clubField.required === true;
}

/**
 * Check if the "Mi club no está en la lista" option is enabled
 * Defaults to true for backward compatibility
 */
export function isClubNotInListEnabled(config: RegistrationConfig | null | undefined): boolean {
  if (!config?.fields || !Array.isArray(config.fields)) {
    return true; // Default to enabled for backward compatibility
  }
  const clubNotInListField = config.fields.find((field) => field.id === 'club_not_in_list');
  // Default to enabled for backward compatibility
  if (!clubNotInListField) return true;
  return clubNotInListField.enabled !== false;
}

const fieldLabels: Record<string, string> = {
  first_name: 'Nombre',
  last_name: 'Apellido',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  birth_date: 'Fecha de nacimiento',
  gender: 'Género',
  club: 'Club',
  club_id: 'Club',
  category_id: 'Categoría',
  blood_type: 'Tipo de sangre',
  insurance_policy: 'Póliza de seguro',
  emergency_contact_name: 'Nombre de contacto de emergencia',
  emergency_contact_phone: 'Teléfono de contacto de emergencia',
  allergies: 'Alergias',
  id_photo_url: 'Foto de identificación',
  social_media_photo_url: 'Foto para redes sociales',
  payment_proof_url: 'Comprobante de pago',
};

const fieldTypes: Record<string, ParsedField['type']> = {
  first_name: 'text',
  last_name: 'text',
  email: 'email',
  phone: 'tel',
  emergency_contact_phone: 'tel',
  birth_date: 'date',
  gender: 'select',
  club: 'text',
  club_id: 'select',
  category_id: 'select',
  blood_type: 'select',
  insurance_policy: 'text',
  emergency_contact_name: 'text',
  allergies: 'textarea',
  id_photo_url: 'file',
  social_media_photo_url: 'file',
  payment_proof_url: 'file',
};

export function parseRegistrationConfig(
  config: RegistrationConfig | null | undefined
): ParsedField[] {
  // Base fields that are always shown (club_id is now configurable and handled separately)
  const baseFields: ParsedField[] = [
    {
      name: 'first_name',
      type: 'text',
      label: 'Nombre',
      required: true,
    },
    {
      name: 'last_name',
      type: 'text',
      label: 'Apellido',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Correo electrónico',
      required: true,
    },
  ];

  if (!config) {
    return [...baseFields, ...getDefaultFields().slice(3)]; // Excluir first_name, last_name y email de default
  }

  let additionalFields: ParsedField[] = [];

  if (config.fields && Array.isArray(config.fields)) {
    const seenFields = new Set<string>();
    additionalFields = config.fields
      .filter((field) => field.enabled !== false) // Filtrar campos deshabilitados
      .map((field) => {
        const fieldId = field.id || field.name || '';
        // Excluir first_name, last_name, email, club_id/club (handled separately), and club_not_in_list (config option)
        if (
          fieldId === 'first_name' || 
          fieldId === 'last_name' || 
          fieldId === 'email' || 
          fieldId === 'club_id' || 
          fieldId === 'club' || 
          fieldId === 'club_not_in_list'
        ) {
          return null;
        }
        const normalizedFieldId = fieldId;
        // Evitar duplicados
        if (seenFields.has(normalizedFieldId)) {
          return null;
        }
        seenFields.add(normalizedFieldId);
        return {
          name: normalizedFieldId,
          type: (fieldTypes[normalizedFieldId] || field.type || 'text') as ParsedField['type'],
          label: field.label || fieldLabels[normalizedFieldId] || normalizedFieldId,
          required: field.required,
          options: getFieldOptions(normalizedFieldId),
        };
      })
      .filter((field): field is ParsedField => field !== null);
  } else {
    const required = config.required_fields || [];
    const optional = config.optional_fields || [];
    const allFields = [...new Set([...required, ...optional])];

    additionalFields = allFields
      .filter((fieldName) => 
        fieldName !== 'first_name' && 
        fieldName !== 'last_name' && 
        fieldName !== 'email' && 
        fieldName !== 'club_id' && 
        fieldName !== 'club' &&
        fieldName !== 'club_not_in_list'
      )
      .map((fieldName) => {
        return {
          name: fieldName,
          type: (fieldTypes[fieldName] || 'text') as ParsedField['type'],
          label: fieldLabels[fieldName] || fieldName,
          required: required.includes(fieldName),
          options: getFieldOptions(fieldName),
        };
      });
  }

  return [...baseFields, ...additionalFields];
}

function getDefaultFields(): ParsedField[] {
  return [
    {
      name: 'first_name',
      type: 'text',
      label: 'Nombre',
      required: true,
    },
    {
      name: 'last_name',
      type: 'text',
      label: 'Apellido',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Correo electrónico',
      required: false,
    },
    {
      name: 'phone',
      type: 'tel',
      label: 'Teléfono',
      required: false,
    },
    {
      name: 'birth_date',
      type: 'date',
      label: 'Fecha de nacimiento',
      required: false,
    },
  ];
}

function getFieldOptions(fieldName: string): { value: string; label: string }[] | undefined {
  if (fieldName === 'gender') {
    return [
      { value: 'male', label: 'Masculino' },
      { value: 'female', label: 'Femenino' },
    ];
  }
  if (fieldName === 'blood_type') {
    return [
      { value: 'A+', label: 'A+' },
      { value: 'A-', label: 'A-' },
      { value: 'B+', label: 'B+' },
      { value: 'B-', label: 'B-' },
      { value: 'AB+', label: 'AB+' },
      { value: 'AB-', label: 'AB-' },
      { value: 'O+', label: 'O+' },
      { value: 'O-', label: 'O-' },
    ];
  }
  return undefined;
}


