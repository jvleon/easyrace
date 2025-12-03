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
};

export function parseRegistrationConfig(
  config: RegistrationConfig | null | undefined
): ParsedField[] {
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
    {
      name: 'club_id',
      type: 'select',
      label: 'Club',
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
        // Excluir first_name, last_name, email y club_id ya que siempre están al inicio
        if (fieldId === 'first_name' || fieldId === 'last_name' || fieldId === 'email' || fieldId === 'club_id' || fieldId === 'club') {
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
      .filter((fieldName) => fieldName !== 'first_name' && fieldName !== 'last_name' && fieldName !== 'email' && fieldName !== 'club_id' && fieldName !== 'club')
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


