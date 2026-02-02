import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import { parseRegistrationConfig, type ParsedField, isClubFieldEnabled, isClubFieldRequired, isClubNotInListEnabled, isExistingClubPhotoEnabled, isExistingClubPhotoRequired } from '../utils/registrationConfigParser';
import { uploadIdPhotoToCloudflare, uploadSocialPhotoToCloudflare, uploadPaymentProofToCloudflare, uploadClubLogoToCloudflare, uploadExistingClubPhotoToCloudflare } from '../utils/cloudflare';
import { validateEmailNotTemporary } from '../utils/emailValidation';
import { MEXICAN_STATES, checkClubExists, normalizeClubName } from '../utils/clubValidation';
import { FiX, FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';
import ReCAPTCHA from 'react-google-recaptcha';

interface Category {
  id: string;
  name: string;
  price: number | null;
  gender: string | null; // 'male', 'female', 'mixed', or null (mixed)
  distance_id: string | null;
  is_pair_category?: boolean; // Indica si es categoría de parejas
  event_distances: {
    id: string;
    name: string;
  } | null;
  required_kit_ids?: string[] | null; // IDs de kits obligatorios para esta categoría
}

interface Kit {
  id: string;
  name: string;
  price: number;
  has_sizes: boolean;
  is_pair_kit?: boolean; // Indica si el kit es para parejas
  max_quantity?: number | null;
  sold_quantity?: number | null;
}

interface KitSize {
  id: string;
  size: string; // La columna en la BD se llama 'size', no 'name'
}

interface Club {
  id: string;
  name: string;
  logo_url?: string | null;
  status?: string | null;
}

interface EventPricing {
  general_price: number | null;
  currency: string;
  categories: Category[];
}

interface RegistrationModalProps {
  eventId: string;
  eventSlug: string; // Slug del evento para Cloudflare
  registrationConfig: any;
  isOpen: boolean;
  onClose: () => void;
  eventPricing?: EventPricing | null;
  maxCompetitors?: number | null;
  registeredCount?: number;
  sportTypeId?: string | null; // ID del tipo de deporte del evento para filtrar clubs
}

export default function RegistrationModal({
  eventId,
  eventSlug,
  registrationConfig,
  isOpen,
  onClose,
  eventPricing,
  maxCompetitors,
  registeredCount = 0,
  sportTypeId,
}: RegistrationModalProps) {
  const [fields, setFields] = useState<ParsedField[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]); // Todas las categorías sin filtrar
  const [clubs, setClubs] = useState<Club[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clubNotInList, setClubNotInList] = useState<boolean>(false);
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [manualClubName, setManualClubName] = useState<string>('');
  // Estados para registro de nuevo club
  const [newClubCity, setNewClubCity] = useState<string>('');
  const [newClubState, setNewClubState] = useState<string>('');
  const [newClubLogo, setNewClubLogo] = useState<File | null>(null);
  const [clubDuplicateError, setClubDuplicateError] = useState<string>('');
  // Estado para foto de club existente sin logo
  const [existingClubPhoto, setExistingClubPhoto] = useState<File | null>(null);
  const [selectedGender, setSelectedGender] = useState<string>(''); // 'male' o 'female'
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [kits, setKits] = useState<Kit[]>([]);
  const [kitSizes, setKitSizes] = useState<KitSize[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<string>('');
  const [selectedKitSizeId, setSelectedKitSizeId] = useState<string>('');
  const [isPairCategory, setIsPairCategory] = useState<boolean>(false);
  const [pairFormData, setPairFormData] = useState<Record<string, any>>({});
  const [pairErrors, setPairErrors] = useState<Record<string, string>>({});

  // Estados para flujo de pasos en categorías de parejas
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [competitor1Data, setCompetitor1Data] = useState<Record<string, any>>({});
  const [competitor2Data, setCompetitor2Data] = useState<Record<string, any>>({});
  const [showCategoryChangeWarning, setShowCategoryChangeWarning] = useState(false);
  const [pendingCategoryChange, setPendingCategoryChange] = useState<string | null>(null);

  // Refs para scroll automático al error
  const errorRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Estados para reCAPTCHA
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaSiteKey = import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY || '';
  // Refs para campos con errores (usando un objeto para mapear nombre de campo -> ref)
  const fieldErrorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Función para registrar un ref de campo con error
  const registerFieldErrorRef = (fieldName: string, element: HTMLDivElement | null) => {
    fieldErrorRefs.current[fieldName] = element;
  };

  // Función para obtener el primer campo con error basado en el orden visual
  const getFirstErrorField = (): string | null => {
    if (Object.keys(errors).length === 0) return null;

    // Orden de prioridad basado en la posición visual en el formulario
    const errorOrder = [
      'general',
      'gender',
      'category_id',
      'kit_id',
      'kit_size_id',
      'club',
      'first_name',
      'last_name',
      'email',
      'phone',
      'birth_date',
      'emergency_contact_name',
      'emergency_contact_phone',
      'terms'
    ];

    // Buscar el primer error según el orden de prioridad
    for (const fieldName of errorOrder) {
      if (errors[fieldName]) {
        return fieldName;
      }
    }

    // Si no se encontró en el orden de prioridad, buscar el primero en el objeto errors
    return Object.keys(errors)[0];
  };

  // Efecto para hacer scroll hacia el mensaje de error de API
  useEffect(() => {
    if (submitError && errorRef.current) {
      setTimeout(() => {
        errorRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }, 100);
    }
  }, [submitError]);

  // Efecto para hacer scroll al primer campo con error de validación
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setTimeout(() => {
        const firstErrorField = getFirstErrorField();
        if (!firstErrorField) return;

        const errorElement = fieldErrorRefs.current[firstErrorField] ||
          (modalContentRef.current?.querySelector(`[data-field-error="${firstErrorField}"]`) as HTMLElement | null);

        if (errorElement) {
          errorElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
      }, 120);
    }
  }, [errors]);

  useEffect(() => {
    if (isOpen) {
      // Resetear estados de pasos
      setCurrentStep(1);
      setCompetitor1Data({});
      setCompetitor2Data({});
      setShowCategoryChangeWarning(false);
      setPendingCategoryChange(null);

      const parsedFields = parseRegistrationConfig(registrationConfig);
      // Ordenar campos: mantener orden de campos base (first_name, last_name, email) y luego el resto
      // Separar campos base, campos de emergencia y otros campos
      // Nota: club_id ahora se maneja de forma separada y configurable
      const baseFieldNames = ['first_name', 'last_name', 'email'];
      const emergencyFieldNames = ['emergency_contact_name', 'emergency_contact_phone'];

      const baseFields = parsedFields.filter((f) => baseFieldNames.includes(f.name));
      const emergencyFields = parsedFields.filter((f) => emergencyFieldNames.includes(f.name));
      const otherFields = parsedFields.filter((f) => !baseFieldNames.includes(f.name) && !emergencyFieldNames.includes(f.name));

      // Ordenar otros campos: obligatorios primero, opcionales después
      const sortedOtherFields = [
        ...otherFields.filter((f) => f.required),
        ...otherFields.filter((f) => !f.required),
      ];

      // Ordenar campos de emergencia: obligatorios primero, opcionales después
      const sortedEmergencyFields = [
        ...emergencyFields.filter((f) => f.required),
        ...emergencyFields.filter((f) => !f.required),
      ];

      // Combinar: campos base en orden + otros campos ordenados + campos de emergencia al final
      const sortedFields = [...baseFields, ...sortedOtherFields, ...sortedEmergencyFields];
      setFields(sortedFields);
      setFormData({});
      setErrors({});
      setSuccess(false);
      setSuccessMessage('');
      setSubmitError(null);
      setClubNotInList(false);
      setSelectedClubId('');
      setManualClubName('');
      setNewClubCity('');
      setNewClubState('');
      setNewClubLogo(null);
      setClubDuplicateError('');
      setExistingClubPhoto(null);
      setSelectedGender('');
      setAcceptedTerms(false);
      setSelectedKitId('');
      setSelectedKitSizeId('');
      setIsPairCategory(false);
      setPairFormData({});
      setPairErrors({});
      setKits([]);
      setKitSizes([]);
      loadCategories();
      loadClubs();
    }
  }, [isOpen, registrationConfig, eventId, sportTypeId]);

  // Verificar si hay datos en el formulario
  const hasFormData = () => {
    const hasData = Object.keys(formData).some(key => {
      const value = formData[key];
      return value !== null && value !== undefined && value !== '';
    });
    const hasSelection = selectedGender !== '' || selectedKitId !== '' || selectedClubId !== '' || manualClubName !== '';
    return hasData || hasSelection;
  };

  // Manejar cierre del modal con confirmación si hay datos
  const handleClose = () => {
    if (hasFormData()) {
      if (window.confirm('¿Estás seguro de que deseas cerrar? Se perderán los datos ingresados.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, formData, selectedGender, selectedKitId, selectedClubId, manualClubName]);

  // Prevenir cierre/recarga de página si hay datos en el formulario
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isOpen && hasFormData()) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requiere esto
      }
    };

    if (isOpen) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOpen, formData, selectedGender, selectedKitId, selectedClubId, manualClubName]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select(`
          id,
          name,
          price,
          gender,
          distance_id,
          is_pair_category,
          required_kit_ids,
          event_distances (
            id,
            name
          )
        `)
        .eq('event_id', eventId)
        .order('name');

      if (error) throw error;
      const loadedCategories = (data || []) as unknown as Category[];
      setAllCategories(loadedCategories);
      // Inicialmente no hay categorías visibles hasta que se seleccione un género
      setCategories([]);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKits = async (categoryId: string) => {
    try {
      setLoading(true);

      // Obtener la categoría seleccionada para verificar required_kit_ids
      const selectedCategory = allCategories.find(cat => cat.id === categoryId);

      const now = new Date().toISOString();

      // Cargar TODOS los kits activos del evento primero (incluyendo category_ids e is_pair_kit)
      const { data: allKitsData, error: kitsError } = await supabase
        .from('kits')
        .select('id, name, price, description, image_url, sold_quantity, max_quantity, category_ids, is_pair_kit')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .or(`sale_deadline.is.null,sale_deadline.gte.${now}`)
        .order('price', { ascending: true });

      if (kitsError) {
        console.error('[RegistrationModal] Error loading kits:', kitsError);
        throw kitsError;
      }


      if (!allKitsData || allKitsData.length === 0) {
        setKits([]);
        setKitSizes([]);
        setLoading(false);
        return;
      }

      // Filtrar kits según la categoría seleccionada
      let filteredKits = allKitsData;

      // Si es una categoría de parejas, solo mostrar kits de parejas
      if (selectedCategory?.is_pair_category) {
        filteredKits = allKitsData.filter((kit: any) => kit.is_pair_kit === true);
      }
      // Si la categoría tiene required_kit_ids, solo mostrar esos kits
      else if (selectedCategory?.required_kit_ids && selectedCategory.required_kit_ids.length > 0) {
        const requiredIds = selectedCategory.required_kit_ids;
        filteredKits = allKitsData.filter((kit: any) =>
          requiredIds.includes(kit.id)
        );
      } else {
        // Si no, mostrar kits donde category_ids incluye esta categoría o está vacío/null/undefined
        // PERO excluir kits de parejas si no es categoría de parejas
        filteredKits = allKitsData.filter((kit: any) => {
          // Excluir kits de parejas si no es categoría de parejas
          if (kit.is_pair_kit === true) {
            return false;
          }

          // Si category_ids es null, undefined, o un array vacío, el kit está disponible para todas las categorías
          if (!kit.category_ids || (Array.isArray(kit.category_ids) && kit.category_ids.length === 0)) {
            return true;
          }
          // Si category_ids es un array, verificar si incluye la categoría seleccionada
          if (Array.isArray(kit.category_ids)) {
            return kit.category_ids.includes(categoryId);
          }
          return false;
        });
      }

      if (filteredKits.length === 0) {
        setKits([]);
        setKitSizes([]);
        setLoading(false);
        return;
      }

      // Verificar cuáles kits tienen tallas
      const kitsWithSizes = await Promise.all(
        filteredKits.map(async (kit: any) => {
          const { data: sizesData } = await supabase
            .from('kit_sizes')
            .select('id')
            .eq('kit_id', kit.id)
            .limit(1);

          return {
            ...kit,
            has_sizes: (sizesData?.length || 0) > 0,
          } as Kit;
        })
      );

      // Filtrar por disponibilidad (max_quantity)
      const availableKits = kitsWithSizes.filter((kit) => {
        const maxQuantity = kit.max_quantity !== null ? Number(kit.max_quantity) : null;
        const soldQuantity = Number(kit.sold_quantity) || 0;
        return maxQuantity === null || soldQuantity < maxQuantity;
      });

      setKits(availableKits);

      // Si hay un kit seleccionado, cargar sus tallas
      if (selectedKitId) {
        await loadKitSizes(selectedKitId);
      } else {
        setKitSizes([]);
      }
    } catch (error) {
      console.error('[RegistrationModal] Error loading kits:', error);
      setKits([]);
      setKitSizes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadKitSizes = async (kitId: string) => {
    try {
      const { data, error } = await supabase
        .from('kit_sizes')
        .select('id, size')
        .eq('kit_id', kitId)
        .order('size');

      if (error) throw error;
      setKitSizes(data || []);
    } catch (error) {
      console.error('Error loading kit sizes:', error);
      setKitSizes([]);
    }
  };

  // Filtrar categorías según el género seleccionado
  useEffect(() => {
    if (!selectedGender) {
      setCategories([]);
      return;
    }

    // Mostrar categorías del género seleccionado + categorías mixtas (gender null o 'mixed')
    const filtered = allCategories.filter(
      (cat) => cat.gender === selectedGender || cat.gender === null || cat.gender === 'mixed'
    );
    setCategories(filtered);
  }, [selectedGender, allCategories]);

  // Cargar kits cuando se selecciona una categoría
  useEffect(() => {
    if (formData.category_id) {
      const selectedCat = allCategories.find(c => c.id === formData.category_id);
      const wasPairCategory = isPairCategory;
      const isNowPairCategory = selectedCat?.is_pair_category || false;

      // Detectar cambio de categoría de parejas a no parejas
      if (wasPairCategory && !isNowPairCategory && currentStep === 1 && Object.keys(pairFormData).length > 0) {
        // Mostrar advertencia si hay datos del competidor 2
        setPendingCategoryChange(formData.category_id);
        setShowCategoryChangeWarning(true);
        return; // No aplicar el cambio todavía
      }

      setIsPairCategory(isNowPairCategory);
      loadKits(formData.category_id);
      // Limpiar kit seleccionado cuando cambia la categoría
      setSelectedKitId('');
      setSelectedKitSizeId('');
      handleChange('kit_id', '');
      // No guardar kit_size_id en formData
    } else {
      setKits([]);
      setKitSizes([]);
      setSelectedKitId('');
      setSelectedKitSizeId('');
    }
  }, [formData.category_id]);

  // Cargar tallas cuando se selecciona un kit
  useEffect(() => {
    if (selectedKitId) {
      loadKitSizes(selectedKitId);
      setSelectedKitSizeId('');
      // No guardar kit_size_id en formData
    } else {
      setKitSizes([]);
      setSelectedKitSizeId('');
    }
  }, [selectedKitId]);

  const loadClubs = async () => {
    try {
      let clubsData: Club[] = [];

      if (sportTypeId) {
        // Si el evento tiene un deporte principal, filtrar clubs por ese deporte
        const { data: filteredClubs, error: clubsError } = await supabase
          .from('club_sports')
          .select(`
            club_id,
            clubs!inner (
              id,
              name,
              logo_url,
              status
            )
          `)
          .eq('sport_type_id', sportTypeId);

        if (clubsError) {
          console.error('Error fetching clubs by sport:', clubsError);
        }

        if (filteredClubs && filteredClubs.length > 0) {
          // Extraer clubs del resultado, filtrar por status aprobado (defensivo), y ordenar por nombre
          clubsData = filteredClubs
            .map((cs: any) => cs.clubs)
            .filter(Boolean)
            // Filtrado defensivo: si no tiene status o es 'approved', mostrar
            .filter((club: Club) => !('status' in club) || club.status === 'approved' || club.status === null)
            .sort((a: Club, b: Club) => a.name.localeCompare(b.name));
        } else {
          // Fallback: si no hay matches, carga todos los clubs para no dejar el selector vacío
          const { data: allClubs, error: allClubsError } = await supabase
            .from('clubs')
            .select('id, name, logo_url, status')
            .order('name');

          if (allClubsError) {
            console.error('Error fetching all clubs fallback:', allClubsError);
          }
          // Filtrado defensivo: si no tiene status o es 'approved', mostrar
          clubsData = (allClubs || []).filter((club: Club) => 
            !('status' in club) || club.status === 'approved' || club.status === null
          );
        }
      } else {
        // Si no hay deporte principal, mostrar todos los clubs
        const { data: allClubs, error: allClubsError } = await supabase
          .from('clubs')
          .select('id, name, logo_url, status')
          .order('name');

        if (allClubsError) {
          console.error('Error fetching all clubs:', allClubsError);
        }
        // Filtrado defensivo: si no tiene status o es 'approved', mostrar
        clubsData = (allClubs || []).filter((club: Club) => 
          !('status' in club) || club.status === 'approved' || club.status === null
        );
      }

      setClubs(clubsData);
    } catch (error) {
      console.error('Error loading clubs:', error);
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    // Si se cambia el email, limpiar errores de email único
    if (name === 'email') {
      // Limpiar error del paso 1
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (newErrors.email && (newErrors.email.includes('ya está registrado') || newErrors.email.includes('por otra persona'))) {
          delete newErrors.email;
        }
        return newErrors;
      });
      // Limpiar error del paso 2 (siempre, no solo en paso 2)
      setPairErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.pair_email;
        return newErrors;
      });
    }
  };

  const handlePairChange = (name: string, value: any) => {
    setPairFormData((prev) => ({ ...prev, [name]: value }));
    if (pairErrors[`pair_${name}`]) {
      setPairErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`pair_${name}`];
        return newErrors;
      });
    }
  };

  const validateEmailUnique = async (emailValue: string, isPairEmail: boolean = false) => {
    if (!emailValue || !emailValue.trim()) {
      return;
    }

    // Validar formato de email primero
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      return; // No validar si el formato no es válido
    }

    try {
      // Si es email del segundo competidor en parejas, permitir que sea el mismo que el primero
      if (isPairCategory && isPairEmail && formData.email) {
        const firstEmail = formData.email.trim().toLowerCase();
        const secondEmail = emailValue.trim().toLowerCase();

        // Si ambos emails son iguales, permitirlo (parejas pueden compartir email)
        if (firstEmail === secondEmail) {
          setPairErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.pair_email;
            return newErrors;
          });
          return;
        }
      }

      // Consultar la vista para verificar si el email ya está registrado en este evento
      const { data, error: checkError } = await supabase
        .from('competitor_email_check')
        .select('count')
        .eq('event_id', eventId)
        .eq('email', emailValue.trim().toLowerCase())
        .maybeSingle();

      if (checkError) {
        // Si hay un error, no bloquear el registro, solo loguear
        // El error 406 puede ocurrir si la vista no está disponible, pero no debe bloquear el registro
        console.warn('Error checking email uniqueness (non-blocking):', checkError);
        // Continuar sin validar email si hay error en la vista
        return;
      }

      if (data && data.count > 0) {
        if (isPairEmail) {
          setPairErrors((prev) => ({
            ...prev,
            pair_email: 'Este correo electrónico ya está registrado en este evento por otra persona.',
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            email: 'Este correo electrónico ya está registrado en este evento. Solo se permite un registro por correo.',
          }));
        }
      } else {
        // Limpiar error si el email no está registrado
        if (isPairEmail) {
          setPairErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.pair_email;
            return newErrors;
          });
        } else {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors.email;
            return newErrors;
          });
        }
      }
    } catch (err: any) {
      console.error('Error validating email uniqueness:', err);
      // No mostrar error al usuario si falla la validación, solo loguear
    }
  };

  const validatePhone = (phone: string): boolean => {
    // Remover espacios, guiones y paréntesis
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Validar que sean exactamente 10 dígitos
    return /^\d{10}$/.test(cleaned);
  };

  const formatPhone = (phone: string): string => {
    // Remover todo excepto dígitos
    return phone.replace(/\D/g, '');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // En paso 2, validar datos del competidor 2
    if (isPairCategory && currentStep === 2) {
      // Validar que tengamos datos del competidor 1
      if (!competitor1Data || !competitor1Data.category_id) {
        newErrors.general = 'Error: No se encontraron datos del Competidor 1';
        setErrors(newErrors);
        return false;
      }

      // Validar talla del competidor 2 (puede ser diferente)
      if (selectedKitId) {
        const selectedKit = kits.find(k => k.id === selectedKitId);
        if (selectedKit?.has_sizes && !selectedKitSizeId) {
          newErrors.kit_size_id = 'La talla es requerida';
        }
      }

      // Validar club del competidor 2
      if (isClubFieldEnabled(registrationConfig)) {
        if (!clubNotInList && !selectedClubId) {
          if (isClubFieldRequired(registrationConfig)) {
            newErrors.club = 'Debes seleccionar un equipo o marcar "Mi club no está en la lista"';
          }
        } else if (clubNotInList && !manualClubName.trim()) {
          if (isClubFieldRequired(registrationConfig)) {
            newErrors.club = 'Debes escribir el nombre del equipo';
          }
        }
      }
    } else {
      // Validación normal para paso 1 o categorías no de parejas

      // Validar género (siempre requerido)
      if (!selectedGender) {
        newErrors.gender = 'El género es requerido';
      }

      // Validar categoría (siempre requerida después de seleccionar género)
      if (selectedGender && !formData.category_id) {
        newErrors.category_id = 'La categoría es requerida';
      }

      // Validar kit (solo si hay kits disponibles para esta categoría)
      if (formData.category_id && kits.length > 0 && !selectedKitId) {
        newErrors.kit_id = 'El kit es requerido';
      }

      // Validar talla solo si el kit seleccionado tiene tallas disponibles
      if (selectedKitId) {
        const selectedKit = kits.find(k => k.id === selectedKitId);
        if (selectedKit?.has_sizes && !selectedKitSizeId) {
          newErrors.kit_size_id = 'La talla es requerida';
        }
      }

      // Validar club
      if (isClubFieldEnabled(registrationConfig)) {
        if (!clubNotInList && !selectedClubId) {
          if (isClubFieldRequired(registrationConfig)) {
            newErrors.club = 'Debes seleccionar un equipo o marcar "Mi club no está en la lista"';
          }
        } else if (clubNotInList && !manualClubName.trim()) {
          if (isClubFieldRequired(registrationConfig)) {
            newErrors.club = 'Debes escribir el nombre del equipo';
          }
        }
      }
    }

    fields.forEach((field) => {
      // Saltar validación de gender, category_id y club_id ya que se validan arriba o en sección especial
      if (field.name === 'gender' || field.name === 'category_id' || field.name === 'club_id' || field.name === 'club') {
        return;
      }

      // Para categorías de parejas, el correo es obligatorio también para el segundo competidor
      if (field.required) {
        const value = formData[field.name];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field.name] = `${field.label} es requerido`;
        }
      }

      // Validar formato de email si se proporciona (obligatorio en paso 1, opcional en paso 2)
      if (field.type === 'email' && formData[field.name]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.name])) {
          newErrors[field.name] = 'Correo electrónico inválido';
        } else if (!validateEmailNotTemporary(formData[field.name])) {
          newErrors[field.name] = 'No se permiten cuentas de email temporales. Por favor, usa una cuenta de email válida.';
        }
      }

      // Validar teléfonos de 10 dígitos
      if ((field.type === 'tel' || field.name === 'phone' || field.name === 'emergency_contact_phone') && formData[field.name]) {
        const phoneValue = formData[field.name];
        if (!validatePhone(phoneValue)) {
          newErrors[field.name] = 'El teléfono debe tener exactamente 10 dígitos';
        }
      }
    });

    // Validar términos y condiciones
    if (!acceptedTerms) {
      newErrors.terms = 'Debes aceptar los términos y condiciones para registrarte';
    }

    // Validar email único en paso 1 (competidor 1)
    if (!isPairCategory || currentStep === 1) {
      const emailField = fields.find(f => f.name === 'email');
      if (emailField && formData.email) {
        // Verificar si hay error de email único ya detectado
        if (errors.email && errors.email.includes('ya está registrado')) {
          newErrors.email = errors.email;
        }
      }
    }

    // Validar email único en paso 2 (competidor 2)
    if (isPairCategory && currentStep === 2) {
      const emailField = fields.find(f => f.name === 'email');
      if (emailField && formData.email) {
        // Verificar si hay error de email único ya detectado
        if (pairErrors.pair_email) {
          // Agregar el error a newErrors para que se muestre
          newErrors.email = pairErrors.pair_email;
        }
      }
    }

    setErrors(newErrors);
    // También verificar pairErrors para el paso 2
    const hasPairErrors = isPairCategory && currentStep === 2 && Object.keys(pairErrors).length > 0;
    const isValid = Object.keys(newErrors).length === 0 && !hasPairErrors;
    return isValid;
  };

  const handleFileChange = async (name: string, file: File | null) => {
    if (!file) {
      handleChange(name, null);
      return;
    }

    // Validar tamaño antes de intentar subir (2MB máximo)
    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      setErrors((prev) => ({
        ...prev,
        [name]: 'La imagen debe ser menor a 2MB',
      }));
      return;
    }

    try {
      setLoading(true);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });

      // Subir a Cloudflare Images según el tipo de campo
      let imageUrl: string;
      if (name === 'social_media_photo_url') {
        imageUrl = await uploadSocialPhotoToCloudflare(file, eventSlug, eventId);
      } else if (name === 'payment_proof_url') {
        imageUrl = await uploadPaymentProofToCloudflare(file, eventSlug, eventId);
      } else {
        // Por defecto, usar uploadIdPhotoToCloudflare (para id_photo_url y otros)
        imageUrl = await uploadIdPhotoToCloudflare(file, eventSlug, eventId);
      }

      // Guardar la URL en el formulario
      handleChange(name, imageUrl);
    } catch (error: any) {
      console.error('Error uploading file to Cloudflare:', error);
      setErrors((prev) => ({
        ...prev,
        [name]: error.message || 'Error al subir la imagen. Por favor, intenta de nuevo.',
      }));
    } finally {
      setLoading(false);
    }
  };

  const checkEventIsFree = (): boolean => {
    if (!eventPricing) return false;

    // Verificar precio general
    if (eventPricing.general_price !== null && eventPricing.general_price > 0) {
      return false;
    }

    // Verificar precios de categorías
    // Si no hay categorías, considerar gratis si el precio general es 0 o null
    if (!eventPricing.categories || eventPricing.categories.length === 0) {
      return eventPricing.general_price === null || eventPricing.general_price === 0;
    }

    // Verificar que todas las categorías sean gratis (precio null o 0)
    const hasPaidCategories = eventPricing.categories.some(
      (cat) => cat.price !== null && cat.price > 0
    );

    return !hasPaidCategories;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Si es categoría de parejas y estamos en paso 1, guardar datos y avanzar al paso 2
    if (isPairCategory && currentStep === 1) {
      const isValid = validateForm();
      if (!isValid) {
        return;
      }

      // Validar email único antes de avanzar (si hay email)
      // Esto asegura que se valide incluso si el usuario no hizo onBlur
      const emailField = fields.find(f => f.name === 'email');
      if (emailField && formData.email) {
        // Verificar si hay error de email único existente
        if (errors.email && errors.email.includes('ya está registrado')) {
          // No permitir avanzar si el email ya está registrado
          return;
        }

        // Validar formato de email primero
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(formData.email)) {
          // Validar email único de forma asíncrona antes de avanzar
          try {
            // Consultar la vista para verificar si el email ya está registrado
            const { data, error: checkError } = await supabase
              .from('competitor_email_check')
              .select('count')
              .eq('event_id', eventId)
              .eq('email', formData.email.trim().toLowerCase())
              .maybeSingle();

            if (checkError) {
              // Si hay un error, no bloquear el registro, solo loguear
              console.warn('Error checking email uniqueness (non-blocking):', checkError);
              // Continuar sin validar email si hay error en la vista
            } else if (data && data.count > 0) {
              // Email ya está registrado - mostrar error y no permitir avanzar
              setErrors((prev) => ({
                ...prev,
                email: 'Este correo electrónico ya está registrado en este evento. Solo se permite un registro por correo.',
              }));
              return; // No permitir avanzar
            }
          } catch (err: any) {
            console.error('Error validating email uniqueness:', err);
            // En caso de error, permitir avanzar (no bloquear por error de red)
          }
        }
      }

      // Guardar datos del competidor 1
      setCompetitor1Data({
        ...formData,
        gender: selectedGender,
        category_id: formData.category_id,
        kit_id: selectedKitId,
        kit_size_id: selectedKitSizeId,
        club_not_in_list: clubNotInList,
        selected_club_id: selectedClubId,
        manual_club_name: manualClubName,
      });

      // Verificar si la categoría es mixta
      const selectedCat = allCategories.find(c => c.id === formData.category_id);
      const isMixedCategory = selectedCat?.gender === 'mixed' || selectedCat?.gender === null;

      // Verificar si hay datos guardados del Competidor 2 (en caso de volver al paso 1 y luego regresar)
      if (competitor2Data && Object.keys(competitor2Data).length > 0) {
        // Restaurar datos del Competidor 2
        const { club_not_in_list, selected_club_id, manual_club_name, kit_size_id, gender, ...restData } = competitor2Data;
        setFormData(restData);
        setSelectedGender(gender || '');
        setSelectedKitSizeId(kit_size_id || '');
        setClubNotInList(club_not_in_list || false);
        setSelectedClubId(selected_club_id || '');
        setManualClubName(manual_club_name || '');
      } else {
        // Limpiar el formulario para el Competidor 2 (primera vez)
        setFormData({
          category_id: formData.category_id, // Mantener la categoría
        });

        // Limpiar estados del formulario para Competidor 2
        setClubNotInList(false);
        setSelectedClubId('');
        setManualClubName('');
        setSelectedKitSizeId(''); // Cada competidor elige su propia talla

        // Mantener género si NO es mixta, limpiar si ES mixta
        if (!isMixedCategory) {
          setSelectedGender(selectedGender); // Mantener el mismo género
        } else {
          setSelectedGender(''); // Limpiar para que el usuario elija
        }
      }

      // Avanzar al paso 2
      setCurrentStep(2);
      setErrors({});

      // Hacer scroll suave hasta arriba del modal
      setTimeout(() => {
        const modalContent = document.getElementById('registration-modal-content');
        if (modalContent) {
          modalContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);

      return;
    }

    // Verificar si se alcanzó el máximo antes de permitir el registro
    if (maxCompetitors !== null && maxCompetitors !== undefined && maxCompetitors > 0) {
      const currentCount = Number(registeredCount) || 0;
      if (currentStep === 2 && isPairCategory) {
        // Para parejas, verificar que haya espacio para 2 competidores
        if (currentCount + 1 >= maxCompetitors) {
          setSubmitError('Lo sentimos, no hay suficientes lugares disponibles para registrar la pareja.');
          return;
        }
      } else if (currentCount >= maxCompetitors) {
        setSubmitError('Lo sentimos, el evento ha alcanzado el máximo de competidores registrados.');
        return;
      }
    }

    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    // Si es categoría de parejas y estamos en paso 2, validar email único del segundo competidor antes de registrar
    if (isPairCategory && currentStep === 2) {
      const emailField = fields.find(f => f.name === 'email');
      if (emailField && formData.email) {
        // Verificar si hay error de email único existente
        if (pairErrors.pair_email || (errors.email && (errors.email.includes('ya está registrado') || errors.email.includes('por otra persona')))) {
          // No permitir registrar si el email ya está registrado
          return;
        }

        // Validar formato de email primero
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(formData.email)) {
          // Validar email único de forma asíncrona antes de registrar
          try {
            // Si es email del segundo competidor en parejas, permitir que sea el mismo que el primero
            if (competitor1Data && competitor1Data.email) {
              const firstEmail = competitor1Data.email.trim().toLowerCase();
              const secondEmail = formData.email.trim().toLowerCase();

              // Si ambos emails son iguales, permitirlo (parejas pueden compartir email)
              if (firstEmail === secondEmail) {
                // Limpiar errores si los emails son iguales
                setPairErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.pair_email;
                  return newErrors;
                });
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  if (newErrors.email && newErrors.email.includes('ya está registrado')) {
                    delete newErrors.email;
                  }
                  return newErrors;
                });
              } else {
                // Si son diferentes, validar que el segundo email no esté registrado
                const { data, error: checkError } = await supabase
                  .from('competitor_email_check')
                  .select('count')
                  .eq('event_id', eventId)
                  .eq('email', formData.email.trim().toLowerCase())
                  .maybeSingle();

                if (checkError) {
                  console.warn('Error checking email uniqueness (non-blocking):', checkError);
                  // Continuar sin validar email si hay error en la vista
                } else if (data && data.count > 0) {
                  // Email ya está registrado - mostrar error y no permitir registrar
                  setPairErrors((prev) => ({
                    ...prev,
                    pair_email: 'Este correo electrónico ya está registrado en este evento por otra persona.',
                  }));
                  setErrors((prev) => ({
                    ...prev,
                    email: 'Este correo electrónico ya está registrado en este evento por otra persona.',
                  }));
                  return; // No permitir registrar
                }
              }
            } else {
              // Si no hay email del primer competidor, validar normalmente
              const { data, error: checkError } = await supabase
                .from('competitor_email_check')
                .select('count')
                .eq('event_id', eventId)
                .eq('email', formData.email.trim().toLowerCase())
                .maybeSingle();

              if (checkError) {
                console.warn('Error checking email uniqueness (non-blocking):', checkError);
                // Continuar sin validar email si hay error en la vista
              } else if (data && data.count > 0) {
                // Email ya está registrado - mostrar error y no permitir registrar
                setPairErrors((prev) => ({
                  ...prev,
                  pair_email: 'Este correo electrónico ya está registrado en este evento por otra persona.',
                }));
                setErrors((prev) => ({
                  ...prev,
                  email: 'Este correo electrónico ya está registrado en este evento por otra persona.',
                }));
                return; // No permitir registrar
              }
            }
          } catch (err: any) {
            console.error('Error validating email uniqueness:', err);
            // En caso de error, permitir registrar (no bloquear por error de red)
          }
        }
      }
    }

    // Validar reCAPTCHA solo en el paso final (no en paso 1 de parejas)
    if (recaptchaSiteKey && (!isPairCategory || currentStep === 2)) {
      if (!recaptchaToken) {
        setErrors((prev) => ({
          ...prev,
          recaptcha: 'Por favor, completa el reCAPTCHA para continuar.',
        }));
        // Scroll al reCAPTCHA
        setTimeout(() => {
          recaptchaContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return;
      }

      // Validar el token con la edge function
      try {
        const { data, error: recaptchaError } = await supabase.functions.invoke('verify-recaptcha', {
          body: { token: recaptchaToken },
        });

        // Manejar errores de la edge function
        if (recaptchaError) {
          // Si es un error de red o conexión
          if (recaptchaError.message?.includes('fetch') || recaptchaError.message?.includes('network')) {
            throw new Error('No se pudo conectar con el servidor. Por favor, verifica tu conexión e intenta de nuevo.');
          }
          // Si es un error de status code
          if (recaptchaError.message?.includes('status code')) {
            throw new Error('Error al verificar el reCAPTCHA. Por favor, intenta de nuevo.');
          }
          // Error genérico
          throw new Error(recaptchaError.message || 'Error al verificar el reCAPTCHA. Por favor, intenta de nuevo.');
        }

        // Verificar si la validación fue exitosa
        if (!data || !data.valid) {
          const errorMessage = data?.error || 'No se pudo verificar el reCAPTCHA. Por favor, intenta de nuevo.';
          throw new Error(errorMessage);
        }
      } catch (recaptchaValidationError: any) {
        console.error('Error validando reCAPTCHA:', recaptchaValidationError);
        // Mostrar mensaje amigable al usuario
        const userMessage = recaptchaValidationError.message || 'Error al verificar el reCAPTCHA. Por favor, intenta de nuevo.';
        setErrors((prev) => ({
          ...prev,
          recaptcha: userMessage,
        }));
        // Resetear reCAPTCHA
        recaptchaRef.current?.reset();
        setRecaptchaToken(null);
        return;
      }
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      // Preparar datos del competidor
      // Si estamos en paso 2, usar datos guardados del paso 1
      const sourceData = (isPairCategory && currentStep === 2) ? competitor1Data : formData;
      const sourceGender = (isPairCategory && currentStep === 2) ? competitor1Data.gender : selectedGender;
      const sourceCategoryId = (isPairCategory && currentStep === 2) ? competitor1Data.category_id : formData.category_id;
      const sourceKitId = (isPairCategory && currentStep === 2) ? competitor1Data.kit_id : selectedKitId;
      const sourceKitSizeId = (isPairCategory && currentStep === 2) ? competitor1Data.kit_size_id : selectedKitSizeId;
      const sourceClubNotInList = (isPairCategory && currentStep === 2) ? competitor1Data.club_not_in_list : clubNotInList;
      const sourceSelectedClubId = (isPairCategory && currentStep === 2) ? competitor1Data.selected_club_id : selectedClubId;
      const sourceManualClubName = (isPairCategory && currentStep === 2) ? competitor1Data.manual_club_name : manualClubName;

      const competitorData: Record<string, any> = {
        event_id: eventId,
        gender: sourceGender, // Asegurar que el género se guarde
        category_id: sourceCategoryId, // Asegurar que la categoría se guarde
        kit_id: sourceKitId, // Asegurar que el kit se guarde
      };

      // Agregar talla si el kit tiene tallas (usar el texto de la talla, no el ID)
      if (sourceKitSizeId) {
        const selectedSize = kitSizes.find(size => size.id === sourceKitSizeId);
        if (selectedSize) {
          competitorData.kit_size = selectedSize.size; // Usar 'kit_size' (texto) en lugar de 'kit_size_id'
        }
      }

      // Agregar datos del formulario (excluir kit_size_id ya que no existe en la BD, usar kit_size en su lugar)
      Object.keys(sourceData).forEach((key) => {
        // Excluir kit_size_id y campos de control ya que no existen en la tabla competitors
        if (key === 'kit_size_id' || key === 'club_not_in_list' || key === 'selected_club_id' || key === 'manual_club_name') {
          return;
        }
        if (sourceData[key] !== null && sourceData[key] !== undefined && sourceData[key] !== '') {
          competitorData[key] = sourceData[key];
        }
      });

      // Manejar club/equipo
      if (!sourceClubNotInList && sourceSelectedClubId) {
        // Si el checkbox NO está marcado, usar el select
        if (sourceSelectedClubId === 'independent') {
          competitorData.club = 'Independiente';
          competitorData.club_id = null;
        } else {
          competitorData.club_id = sourceSelectedClubId;
          
          // Si hay foto de club existente sin logo, subirla y actualizar el club
          if (existingClubPhoto) {
            try {
              const clubPhotoUrl = await uploadExistingClubPhotoToCloudflare(
                existingClubPhoto,
                sourceSelectedClubId,
                eventSlug,
                eventId
              );
              // Actualizar el logo del club existente (defensivo, puede fallar si columna no existe)
              await supabase
                .from('clubs')
                .update({ logo_url: clubPhotoUrl })
                .eq('id', sourceSelectedClubId);
            } catch (uploadError) {
              console.warn('No se pudo subir la foto del club existente:', uploadError);
              // No bloquear el registro por este error
            }
          }
        }
      } else if (sourceClubNotInList && sourceManualClubName && sourceManualClubName.trim()) {
        // Si el checkbox SÍ está marcado, guardar el nombre como club_text (NO club_id)
        competitorData.club = sourceManualClubName.trim();
        competitorData.club_id = null;
        
        // Intentar crear un club pendiente para aprobación futura (defensivo)
        try {
          let newClubLogoUrl: string | null = null;
          
          // Subir logo si se proporcionó
          if (newClubLogo) {
            try {
              newClubLogoUrl = await uploadClubLogoToCloudflare(
                newClubLogo,
                sourceManualClubName.trim(),
                eventSlug,
                eventId
              );
            } catch (logoError) {
              console.warn('No se pudo subir el logo del nuevo club:', logoError);
            }
          }
          
          // Crear el club pendiente (defensivo - puede fallar si columnas no existen)
          const newClubData: Record<string, any> = {
            name: sourceManualClubName.trim(),
            city: newClubCity || null,
            status: 'pending',
            logo_url: newClubLogoUrl,
          };
          
          // Agregar state si está disponible
          if (newClubState) {
            newClubData.state = newClubState;
          }
          
          const { data: createdClub, error: clubError } = await supabase
            .from('clubs')
            .insert(newClubData)
            .select('id')
            .single();
          
          if (!clubError && createdClub) {
            // Agregar el deporte al club creado
            if (sportTypeId) {
              await supabase
                .from('club_sports')
                .insert({
                  club_id: createdClub.id,
                  sport_type_id: sportTypeId,
                });
            }
          }
        } catch (clubCreateError) {
          console.warn('No se pudo crear el club pendiente (columnas pueden no existir):', clubCreateError);
          // No bloquear el registro - el competidor se guarda con club_text normalmente
        }
      }

      // Formatear teléfonos (solo dígitos)
      if (competitorData.phone) {
        competitorData.phone = formatPhone(competitorData.phone);
      }
      if (competitorData.emergency_contact_phone) {
        competitorData.emergency_contact_phone = formatPhone(competitorData.emergency_contact_phone);
      }

      // Asegurar que kit_size_id no esté en competitorData (no existe en la BD)
      delete competitorData.kit_size_id;

      let competitor1Id: string;
      let competitor2Id: string | null = null;

      // Insertar primer competidor usando función RPC para evitar problemas de RLS
      const { data: insertedData, error } = await supabase.rpc('insert_competitor', {
        competitor_data: competitorData
      });

      if (error) {
        console.error('[RegistrationModal] Error inserting competitor:', error);
        throw error;
      }
      competitor1Id = insertedData.id;

      // Si es categoría de parejas y estamos en paso 2, insertar segundo competidor
      if (isPairCategory && currentStep === 2) {
        const pairCompetitorData: Record<string, any> = {
          event_id: eventId,
          gender: selectedGender, // Puede ser diferente si la categoría es mixta
          category_id: formData.category_id, // Misma categoría que competidor 1
          kit_id: selectedKitId, // Mismo kit que competidor 1
        };

        // Agregar talla del competidor 2 (puede ser diferente)
        if (selectedKitSizeId) {
          const selectedSize = kitSizes.find(size => size.id === selectedKitSizeId);
          if (selectedSize) {
            pairCompetitorData.kit_size = selectedSize.size;
          }
        }

        // Agregar datos del segundo competidor desde formData (paso 2 - formData está limpio)
        Object.keys(formData).forEach((key) => {
          // Excluir campos de control
          if (key === 'kit_size_id' || key === 'category_id') {
            return;
          }
          if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
            pairCompetitorData[key] = formData[key];
          }
        });

        // Manejar club/equipo del competidor 2 (independiente del competidor 1)
        if (!clubNotInList && selectedClubId) {
          if (selectedClubId === 'independent') {
            pairCompetitorData.club = 'Independiente';
            pairCompetitorData.club_id = null;
          } else {
            pairCompetitorData.club_id = selectedClubId;
          }
        } else if (clubNotInList && manualClubName.trim()) {
          pairCompetitorData.club = manualClubName.trim();
          pairCompetitorData.club_id = null;
        }

        // Formatear teléfonos del segundo competidor
        if (pairCompetitorData.phone) {
          pairCompetitorData.phone = formatPhone(pairCompetitorData.phone);
        }
        if (pairCompetitorData.emergency_contact_phone) {
          pairCompetitorData.emergency_contact_phone = formatPhone(pairCompetitorData.emergency_contact_phone);
        }

        // Asegurar que kit_size_id no esté en pairCompetitorData (no existe en la BD)
        delete pairCompetitorData.kit_size_id;

        // Insertar segundo competidor usando función RPC
        const { data: pairInsertedData, error: pairError } = await supabase.rpc('insert_competitor', {
          competitor_data: pairCompetitorData
        });

        if (pairError) throw pairError;
        competitor2Id = pairInsertedData.id;

        // Crear relación de pareja usando función RPC segura
        // Esta función valida y crea el pair, además actualiza ambos competidores automáticamente
        const { data: pairData, error: pairRelationError } = await supabase.rpc('create_competitor_pair', {
          p_event_id: eventId,
          p_competitor_1_id: competitor1Id,
          p_competitor_2_id: competitor2Id
        });

        if (pairRelationError) {
          console.error('[RegistrationModal] Error creating competitor pair:', pairRelationError);
          throw pairRelationError;
        }
      }

      // Verificar si el evento es gratis
      const isFree = checkEventIsFree();

      if (isFree) {
        setSuccessMessage('¡Registro exitoso! Te has registrado correctamente en el evento.');
      } else {
        setSuccessMessage(
          '¡Registro exitoso! Recuerda realizar tu pago y enviar el comprobante al organizador para confirmar tu participación.'
        );
      }

      setSuccess(true);
      // Resetear reCAPTCHA después de éxito
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
      // El usuario cerrará manualmente el modal
    } catch (error: any) {
      console.error('Error submitting registration:', error);
      setSubmitError(error.message || 'Error al registrar. Por favor, intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Separar campos obligatorios y opcionales
  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);

  // Club field configuration - using helper functions that check the registration config
  const hasClubField = isClubFieldEnabled(registrationConfig);
  const clubFieldRequired = isClubFieldRequired(registrationConfig);
  const showClubNotInList = isClubNotInListEnabled(registrationConfig);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-asphalt/80 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalContentRef}
        id="registration-modal-content"
        className="bg-black-asphalt border border-white-pure/20 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-black-asphalt border-b border-white-pure/20 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 id="modal-title" className="text-2xl font-bold text-white-pure">
              {isPairCategory
                ? `Registro de Competidor ${currentStep}`
                : 'Registro de Competidor'}
            </h2>
            <button
              onClick={handleClose}
              className="text-white-pure/70 hover:text-white-pure transition-colors"
              aria-label="Cerrar"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Indicador de progreso para categorías de parejas */}
          {isPairCategory && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <div className={`flex-1 h-2 rounded-full ${currentStep >= 1 ? 'bg-orange-primary' : 'bg-white-pure/20'}`} />
                <div className={`flex-1 h-2 rounded-full ${currentStep >= 2 ? 'bg-orange-primary' : 'bg-white-pure/20'}`} />
              </div>
              <span className="text-white-pure/70 text-sm whitespace-nowrap">
                Paso {currentStep} de 2
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 relative">
          {/* Overlay de carga mientras se procesa el registro */}
          {submitting && (
            <div className="absolute inset-0 bg-black-asphalt/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-b-2xl">
              <FiLoader className="animate-spin text-orange-primary mb-4" size={48} />
              <p className="text-white-pure text-lg font-semibold">
                {isPairCategory && currentStep === 1 ? 'Guardando datos...' : 'Procesando registro...'}
              </p>
              <p className="text-gray-400 text-sm mt-2">Por favor espera, no cierres esta ventana</p>
            </div>
          )}

          {success ? (
            <div className="text-center py-8">
              <FiCheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-white-pure text-lg font-semibold mb-6">
                {successMessage || '¡Registro exitoso!'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Selector de género - editable en paso 2 solo si categoría es mixta */}
                <div
                  ref={(el) => registerFieldErrorRef('gender', el)}
                  data-field-error="gender"
                  className="space-y-2"
                >
                  <label className="block text-white-pure text-sm font-medium mb-2">
                    Género <span className="text-red-fire ml-1">*</span>
                  </label>
                  {isPairCategory && currentStep === 2 ? (
                    <>
                      {(() => {
                        const selectedCat = allCategories.find(c => c.id === formData.category_id);
                        const isMixedCategory = selectedCat?.gender === 'mixed' || selectedCat?.gender === null;

                        if (isMixedCategory) {
                          // Si es categoría mixta, permitir cambiar género
                          return (
                            <select
                              value={selectedGender}
                              onChange={(e) => {
                                setSelectedGender(e.target.value);
                                handleChange('gender', e.target.value);
                              }}
                              required
                              className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                              style={{ backgroundColor: '#212121', color: '#FFF' }}
                            >
                              <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona tu género</option>
                              <option value="male" style={{ backgroundColor: '#212121', color: '#FFF' }}>Masculino</option>
                              <option value="female" style={{ backgroundColor: '#212121', color: '#FFF' }}>Femenino</option>
                            </select>
                          );
                        } else {
                          // Si no es mixta, bloqueado
                          return (
                            <div className="w-full px-4 py-2 bg-white-pure/5 border border-white-pure/20 rounded-lg text-white-pure/70">
                              {selectedGender === 'male' ? 'Masculino' : 'Femenino'}
                            </div>
                          );
                        }
                      })()}
                    </>
                  ) : (
                    <select
                      value={selectedGender}
                      onChange={(e) => {
                        setSelectedGender(e.target.value);
                        handleChange('gender', e.target.value);
                        // Limpiar categoría seleccionada cuando cambia el género
                        handleChange('category_id', '');
                      }}
                      required
                      className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                      style={{ backgroundColor: '#212121', color: '#FFF' }}
                    >
                      <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona tu género</option>
                      <option value="male" style={{ backgroundColor: '#212121', color: '#FFF' }}>Masculino</option>
                      <option value="female" style={{ backgroundColor: '#212121', color: '#FFF' }}>Femenino</option>
                    </select>
                  )}
                  {errors.gender && (
                    <p className="mt-1 text-sm text-red-fire">{errors.gender}</p>
                  )}
                </div>

                {/* Selector de categoría - bloqueado en paso 2 */}
                {selectedGender && (
                  <div
                    ref={(el) => registerFieldErrorRef('category_id', el)}
                    data-field-error="category_id"
                    className="space-y-2"
                  >
                    <label className="block text-white-pure text-sm font-medium mb-2">
                      Categoría <span className="text-red-fire ml-1">*</span>
                    </label>
                    {isPairCategory && currentStep === 2 ? (
                      <div className="w-full px-4 py-2 bg-white-pure/5 border border-white-pure/20 rounded-lg text-white-pure/70">
                        {categories.find(c => c.id === formData.category_id)?.name || 'Categoría seleccionada'}
                      </div>
                    ) : (
                      <select
                        value={formData.category_id || ''}
                        onChange={(e) => {
                          handleChange('category_id', e.target.value);
                          // Limpiar kit seleccionado cuando cambia la categoría
                          setSelectedKitId('');
                          setSelectedKitSizeId('');
                          handleChange('kit_id', '');
                          // No guardar kit_size_id en formData
                        }}
                        required
                        className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                        style={{ backgroundColor: '#212121', color: '#FFF' }}
                      >
                        <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona una categoría</option>
                        {categories.map((cat) => {
                          const distanceName = cat.event_distances?.name || '';
                          const priceText = cat.price !== null && cat.price > 0 ? `- $${cat.price} ${eventPricing?.currency || 'MXN'}` : '';
                          const displayText = [cat.name, distanceName, priceText].filter(Boolean).join(' ');
                          return (
                            <option key={cat.id} value={cat.id} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                              {displayText}
                            </option>
                          );
                        })}
                      </select>
                    )}
                    {errors.category_id && (
                      <p className="mt-1 text-sm text-red-fire">{errors.category_id}</p>
                    )}
                    {categories.length === 0 && selectedGender && (
                      <p className="mt-1 text-sm text-white-pure/70">No hay categorías disponibles para este género</p>
                    )}
                  </div>
                )}

                {/* Selector de kit - bloqueado en paso 2 */}
                {formData.category_id && kits.length > 0 && (
                  <div
                    ref={(el) => registerFieldErrorRef('kit_id', el)}
                    data-field-error="kit_id"
                    className="space-y-2"
                  >
                    <label className="block text-white-pure text-sm font-medium mb-2">
                      Kit <span className="text-red-fire ml-1">*</span>
                    </label>
                    {isPairCategory && currentStep === 2 ? (
                      <div className="w-full px-4 py-2 bg-white-pure/5 border border-white-pure/20 rounded-lg text-white-pure/70">
                        {kits.find(k => k.id === selectedKitId)?.name || 'Kit seleccionado'}
                      </div>
                    ) : (
                      <select
                        value={selectedKitId}
                        onChange={(e) => {
                          setSelectedKitId(e.target.value);
                          handleChange('kit_id', e.target.value);
                          // Limpiar talla cuando cambia el kit
                          setSelectedKitSizeId('');
                          // No guardar kit_size_id en formData
                        }}
                        required
                        className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                        style={{ backgroundColor: '#212121', color: '#FFF' }}
                      >
                        <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona un kit</option>
                        {kits.map((kit) => (
                          <option key={kit.id} value={kit.id} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                            {kit.name} - ${Number(kit.price).toLocaleString('es-MX', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </option>
                        ))}
                      </select>
                    )}
                    {errors.kit_id && (
                      <p className="mt-1 text-sm text-red-fire">{errors.kit_id}</p>
                    )}
                  </div>
                )}

                {/* Selector de talla - independiente para cada competidor */}
                {selectedKitId && kitSizes.length > 0 && (
                  <div
                    ref={(el) => registerFieldErrorRef('kit_size_id', el)}
                    data-field-error="kit_size_id"
                    className="space-y-2"
                  >
                    <label className="block text-white-pure text-sm font-medium mb-2">
                      Talla <span className="text-red-fire ml-1">*</span>
                    </label>
                    <select
                      value={selectedKitSizeId}
                      onChange={(e) => {
                        setSelectedKitSizeId(e.target.value);
                        // No guardar kit_size_id en formData, solo mantenerlo en el estado
                      }}
                      required
                      className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                      style={{ backgroundColor: '#212121', color: '#FFF' }}
                    >
                      <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona una talla</option>
                      {kitSizes.map((size) => (
                        <option key={size.id} value={size.id} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                          {size.size}
                        </option>
                      ))}
                    </select>
                    {errors.kit_size_id && (
                      <p className="mt-1 text-sm text-red-fire">{errors.kit_size_id}</p>
                    )}
                  </div>
                )}

                {/* Campo de Club - Solo mostrar en paso 1 o si no es categoría de parejas */}
                {hasClubField && !(isPairCategory && currentStep === 2) && (
                  <div
                    ref={(el) => registerFieldErrorRef('club', el)}
                    data-field-error="club"
                    className="space-y-2"
                  >
                    <label className="block text-white-pure text-sm font-medium mb-2">
                      Club/Equipo
                      {clubFieldRequired && <span className="text-red-fire ml-1">*</span>}
                    </label>

                    <Select
                      options={[
                        { value: 'independent', label: 'Independiente' },
                        ...clubs.map((club) => ({
                          value: club.id,
                          label: club.name,
                        }))
                      ]}
                      value={selectedClubId ? (
                        selectedClubId === 'independent'
                          ? { value: 'independent', label: 'Independiente' }
                          : clubs.find(c => c.id === selectedClubId)
                            ? { value: selectedClubId, label: clubs.find(c => c.id === selectedClubId)!.name }
                            : null
                      ) : null}
                      onChange={(option) => {
                        const value = option?.value || '';
                        setSelectedClubId(value);
                        handleChange('club_id', value);
                        handleChange('club', '');
                      }}
                      isDisabled={clubNotInList}
                      isClearable
                      placeholder={clubFieldRequired ? "Buscar equipo..." : "Buscar equipo (opcional)..."}
                      noOptionsMessage={() => "No se encontraron equipos"}
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: '#212121',
                          borderColor: state.isFocused ? '#FF5722' : 'rgba(255, 255, 255, 0.2)',
                          borderWidth: '1px',
                          borderRadius: '0.5rem',
                          padding: '0.25rem',
                          boxShadow: state.isFocused ? '0 0 0 2px #FF5722' : 'none',
                          '&:hover': {
                            borderColor: '#FF5722',
                          },
                          opacity: clubNotInList ? 0.5 : 1,
                          cursor: clubNotInList ? 'not-allowed' : 'default',
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: '#212121',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '0.5rem',
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused ? '#FF5722' : '#212121',
                          color: '#FFF',
                          cursor: 'pointer',
                          '&:active': {
                            backgroundColor: '#E64A19',
                          },
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: '#FFF',
                        }),
                        input: (base) => ({
                          ...base,
                          color: '#FFF',
                        }),
                        placeholder: (base) => ({
                          ...base,
                          color: 'rgba(255, 255, 255, 0.5)',
                        }),
                      }}
                    />

                    {showClubNotInList && (
                      <label className={`flex items-center mt-3 p-3 rounded-lg border-2 border-orange-primary bg-orange-primary/10 cursor-pointer hover:bg-orange-primary/20 transition-all ${selectedClubId === 'independent' ? 'animate-pulse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={clubNotInList}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setClubNotInList(checked);
                            // Limpiar errores de validación del club
                            setErrors((prev) => {
                              const newErrors = { ...prev };
                              delete newErrors.club;
                              return newErrors;
                            });
                            setClubDuplicateError('');
                            if (checked) {
                              // Al marcar: deshabilitar select, limpiar selectedClubId, mostrar input
                              setSelectedClubId('');
                              handleChange('club_id', '');
                              setExistingClubPhoto(null);
                            } else {
                              // Al desmarcar: habilitar select, limpiar datos de nuevo club
                              setManualClubName('');
                              setNewClubCity('');
                              setNewClubState('');
                              setNewClubLogo(null);
                              handleChange('club', '');
                            }
                          }}
                          className="w-5 h-5 text-orange-primary bg-black-asphalt border-orange-primary rounded focus:ring-orange-primary focus:ring-2"
                        />
                        <span className="ml-3 text-white-pure text-sm font-semibold">Mi club no está en la lista</span>
                      </label>
                    )}

                    {clubNotInList && (
                      <div className="space-y-3 mt-3 p-4 bg-white-pure/5 rounded-lg border border-white-pure/20">
                        <p className="text-sm text-gray-400 mb-2">Registra tu club para que otros competidores puedan encontrarlo en el futuro.</p>
                        
                        {/* Nombre del club */}
                        <input
                          type="text"
                          value={manualClubName}
                          onChange={async (e) => {
                            const value = e.target.value;
                            setManualClubName(value);
                            handleChange('club', value);
                            handleChange('club_id', '');
                            setClubDuplicateError('');
                            // Limpiar error de validación cuando el usuario escribe
                            if (errors.club) {
                              setErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors.club;
                                return newErrors;
                              });
                            }
                          }}
                          onBlur={async () => {
                            // Validar duplicados al perder foco
                            if (manualClubName.trim() && sportTypeId) {
                              const { exists, matchedClub } = await checkClubExists(manualClubName.trim(), sportTypeId);
                              if (exists) {
                                setClubDuplicateError(`Ya existe un club aprobado con un nombre similar: "${matchedClub}". Por favor selecciónalo de la lista.`);
                              }
                            }
                          }}
                          placeholder="Nombre del equipo *"
                          className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                        />
                        {clubDuplicateError && (
                          <p className="text-sm text-yellow-400">{clubDuplicateError}</p>
                        )}

                        {/* Ciudad del club */}
                        <input
                          type="text"
                          value={newClubCity}
                          onChange={(e) => setNewClubCity(e.target.value.slice(0, 50))}
                          placeholder="Ciudad del club (opcional, máx 50 caracteres)"
                          maxLength={50}
                          className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                        />

                        {/* Estado del club */}
                        <select
                          value={newClubState}
                          onChange={(e) => setNewClubState(e.target.value)}
                          className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                        >
                          <option value="">Selecciona un estado (opcional)</option>
                          {MEXICAN_STATES.map((state) => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>

                        {/* Logo del club */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Logo del club (opcional, PNG/JPG, máx 2MB)</label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              if (file) {
                                // Validar tipo
                                if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
                                  setErrors((prev) => ({ ...prev, newClubLogo: 'Solo se permiten archivos PNG, JPG o JPEG' }));
                                  return;
                                }
                                // Validar tamaño
                                if (file.size > 2 * 1024 * 1024) {
                                  setErrors((prev) => ({ ...prev, newClubLogo: 'El archivo debe ser menor a 2MB' }));
                                  return;
                                }
                                setErrors((prev) => {
                                  const newErrors = { ...prev };
                                  delete newErrors.newClubLogo;
                                  return newErrors;
                                });
                              }
                              setNewClubLogo(file);
                            }}
                            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:bg-orange-primary file:text-white-pure hover:file:bg-orange-primary/80"
                          />
                          {errors.newClubLogo && (
                            <p className="mt-1 text-sm text-red-fire">{errors.newClubLogo}</p>
                          )}
                          {newClubLogo && (
                            <p className="mt-1 text-sm text-green-400">Archivo seleccionado: {newClubLogo.name}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Foto para club existente sin logo */}
                    {!clubNotInList && selectedClubId && selectedClubId !== 'independent' && isExistingClubPhotoEnabled(registrationConfig) && (() => {
                      const selectedClub = clubs.find(c => c.id === selectedClubId);
                      return selectedClub && !selectedClub.logo_url;
                    })() && (
                      <div className="mt-3 p-3 bg-white-pure/5 rounded-lg border border-white-pure/20">
                        <label className="block text-sm text-gray-400 mb-2">
                          Tu club no tiene logo. ¿Quieres subir uno?
                          {isExistingClubPhotoRequired(registrationConfig) && <span className="text-orange-primary ml-1">*</span>}
                        </label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file) {
                              if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
                                setErrors((prev) => ({ ...prev, existingClubPhoto: 'Solo se permiten archivos PNG, JPG o JPEG' }));
                                return;
                              }
                              if (file.size > 2 * 1024 * 1024) {
                                setErrors((prev) => ({ ...prev, existingClubPhoto: 'El archivo debe ser menor a 2MB' }));
                                return;
                              }
                              setErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors.existingClubPhoto;
                                return newErrors;
                              });
                            }
                            setExistingClubPhoto(file);
                          }}
                          className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:bg-orange-primary file:text-white-pure hover:file:bg-orange-primary/80"
                        />
                        {errors.existingClubPhoto && (
                          <p className="mt-1 text-sm text-red-fire">{errors.existingClubPhoto}</p>
                        )}
                        {existingClubPhoto && (
                          <p className="mt-1 text-sm text-green-400">Archivo seleccionado: {existingClubPhoto.name}</p>
                        )}
                      </div>
                    )}

                    {!clubNotInList && errors.club && (
                      <p className="mt-1 text-sm text-red-fire">{errors.club}</p>
                    )}
                  </div>
                )}

                {/* Campos obligatorios - Solo mostrar en paso 1 o si no es categoría de parejas */}
                {requiredFields.length > 0 && !(isPairCategory && currentStep === 2) && (
                  <>
                    {requiredFields
                      .filter((field) => field.name !== 'gender' && field.name !== 'category_id') // Excluir gender y category_id ya que se manejan arriba
                      .map((field) => renderField(field))}
                  </>
                )}

                {/* Campos opcionales - Solo mostrar en paso 1 o si no es categoría de parejas */}
                {!(isPairCategory && currentStep === 2) && optionalFields
                  .filter((field) => field.name !== 'gender' && field.name !== 'category_id') // Excluir gender y category_id
                  .map((field) => renderField(field))}
              </div>

              {/* Campos del segundo competidor (solo para categorías de parejas en paso 2) */}
              {isPairCategory && currentStep === 2 && (
                <div className="space-y-4">
                  <div className="pt-4 border-t border-white-pure/20">
                    <h3 className="text-xl font-bold text-white-pure mb-6">
                      Datos del Segundo Competidor
                    </h3>
                  </div>

                  {/* Campo de Club para competidor 2 */}
                  {hasClubField && (
                    <div
                      ref={(el) => registerFieldErrorRef('club', el)}
                      data-field-error="club"
                      className="space-y-2"
                    >
                      <label className="block text-white-pure text-sm font-medium mb-2">
                        Club/Equipo
                        {clubFieldRequired && <span className="text-red-fire ml-1">*</span>}
                      </label>

                      <Select
                        options={[
                          { value: 'independent', label: 'Independiente' },
                          ...clubs.map((club) => ({
                            value: club.id,
                            label: club.name,
                          }))
                        ]}
                        value={selectedClubId ? (
                          selectedClubId === 'independent'
                            ? { value: 'independent', label: 'Independiente' }
                            : clubs.find(c => c.id === selectedClubId)
                              ? { value: selectedClubId, label: clubs.find(c => c.id === selectedClubId)!.name }
                              : null
                        ) : null}
                        onChange={(option) => {
                          const value = option?.value || '';
                          setSelectedClubId(value);
                          handleChange('club_id', value);
                          handleChange('club', '');
                        }}
                        isDisabled={clubNotInList}
                        isClearable
                        placeholder={clubFieldRequired ? "Buscar equipo..." : "Buscar equipo (opcional)..."}
                        noOptionsMessage={() => "No se encontraron equipos"}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor: '#212121',
                            borderColor: state.isFocused ? '#FF5722' : 'rgba(255, 255, 255, 0.2)',
                            borderWidth: '1px',
                            borderRadius: '0.5rem',
                            padding: '0.25rem',
                            boxShadow: state.isFocused ? '0 0 0 2px #FF5722' : 'none',
                            '&:hover': {
                              borderColor: '#FF5722',
                            },
                            opacity: clubNotInList ? 0.5 : 1,
                            cursor: clubNotInList ? 'not-allowed' : 'default',
                          }),
                          menu: (base) => ({
                            ...base,
                            backgroundColor: '#212121',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '0.5rem',
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isFocused ? '#FF5722' : '#212121',
                            color: '#FFF',
                            cursor: 'pointer',
                            '&:active': {
                              backgroundColor: '#E64A19',
                            },
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: '#FFF',
                          }),
                          input: (base) => ({
                            ...base,
                            color: '#FFF',
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: 'rgba(255, 255, 255, 0.5)',
                          }),
                        }}
                      />

                      {showClubNotInList && (
                        <label className={`flex items-center mt-3 p-3 rounded-lg border-2 border-orange-primary bg-orange-primary/10 cursor-pointer hover:bg-orange-primary/20 transition-all ${selectedClubId === 'independent' ? 'animate-pulse' : ''}`}>
                          <input
                            type="checkbox"
                            checked={clubNotInList}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setClubNotInList(checked);
                              setClubDuplicateError('');
                              setErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors.club;
                                return newErrors;
                              });
                              if (checked) {
                                setSelectedClubId('');
                                handleChange('club_id', '');
                                setExistingClubPhoto(null);
                              } else {
                                setManualClubName('');
                                handleChange('club', '');
                              }
                            }}
                            className="w-5 h-5 text-orange-primary bg-black-asphalt border-orange-primary rounded focus:ring-orange-primary focus:ring-2"
                          />
                          <span className="ml-3 text-white-pure text-sm font-semibold">Mi club no está en la lista</span>
                        </label>
                      )}

                      {clubNotInList && (
                        <input
                          type="text"
                          value={manualClubName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setManualClubName(value);
                            handleChange('club', value);
                            handleChange('club_id', '');
                            if (errors.club) {
                              setErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors.club;
                                return newErrors;
                              });
                            }
                          }}
                          placeholder="Escribe el nombre del equipo"
                          {...(clubFieldRequired && clubNotInList ? { required: true } : {})}
                          className="mt-2 w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                        />
                      )}

                      {errors.club && (
                        <p className="mt-1 text-sm text-red-fire">{errors.club}</p>
                      )}
                    </div>
                  )}

                  {/* Renderizar TODOS los campos para el competidor 2 */}
                  {/* Primero los campos obligatorios */}
                  {requiredFields
                    .filter((field) => !['gender', 'category_id'].includes(field.name))
                    .map((field) => {
                      const isEmailField = field.name === 'email';

                      return (
                        <div key={`comp2_${field.name}`}>
                          <label className="block text-white-pure text-sm font-medium mb-2">
                            {field.label}
                            {/* Email NO es obligatorio para competidor 2 */}
                            {field.required && !isEmailField && <span className="text-red-fire ml-1">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={formData[field.name] || ''}
                              onChange={(e) => handleChange(field.name, e.target.value)}
                              onBlur={async (e) => {
                                if (isEmailField && e.target.value) {
                                  await validateEmailUnique(e.target.value, true);
                                }
                              }}
                              required={field.required && !isEmailField}
                              rows={4}
                              className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent resize-y"
                            />
                          ) : field.type === 'select' && field.name === 'blood_type' ? (
                            <select
                              value={formData[field.name] || ''}
                              onChange={(e) => handleChange(field.name, e.target.value)}
                              required={field.required}
                              className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                              style={{ backgroundColor: '#212121', color: '#FFF' }}
                            >
                              <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona tipo de sangre</option>
                              {field.options?.map((opt) => (
                                <option key={opt.value} value={opt.value} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'file' ? (
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png"
                              onChange={(e) => handleFileChange(field.name, e.target.files?.[0] || null)}
                              required={field.required}
                              className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-primary file:text-white-pure hover:file:bg-red-fire"
                            />
                          ) : (
                            <input
                              type={field.type}
                              value={formData[field.name] || ''}
                              onChange={(e) => {
                                if (field.type === 'tel' || field.name === 'phone' || field.name === 'emergency_contact_phone') {
                                  const value = e.target.value.replace(/\D/g, '');
                                  if (value.length <= 10) {
                                    handleChange(field.name, value);
                                  }
                                } else {
                                  const newValue = e.target.value;
                                  handleChange(field.name, newValue);
                                  // Limpiar error de email único cuando se cambia el email del segundo competidor
                                  if (isEmailField) {
                                    // Limpiar ambos errores inmediatamente
                                    setPairErrors((prev) => {
                                      const newErrors = { ...prev };
                                      delete newErrors.pair_email;
                                      return newErrors;
                                    });
                                    setErrors((prev) => {
                                      const newErrors = { ...prev };
                                      // Limpiar error de email si existe (buscar ambos mensajes posibles)
                                      if (newErrors.email && (newErrors.email.includes('ya está registrado') || newErrors.email.includes('por otra persona'))) {
                                        delete newErrors.email;
                                      }
                                      return newErrors;
                                    });
                                  }
                                }
                              }}
                              onBlur={async (e) => {
                                if (isEmailField && e.target.value) {
                                  await validateEmailUnique(e.target.value, true);
                                }
                              }}
                              maxLength={field.type === 'tel' ? 10 : undefined}
                              required={field.required && !isEmailField}
                              className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                            />
                          )}
                          {/* Mostrar errores de email único del paso 2 */}
                          {isEmailField && pairErrors.pair_email && (
                            <p className="mt-1 text-sm text-red-fire">{pairErrors.pair_email}</p>
                          )}
                          {errors[field.name] && (
                            <p className="mt-1 text-sm text-red-fire">{errors[field.name]}</p>
                          )}
                        </div>
                      );
                    })}

                  {/* Luego los campos opcionales */}
                  {optionalFields
                    .filter((field) => !['gender', 'category_id'].includes(field.name))
                    .map((field) => (
                      <div key={`comp2_opt_${field.name}`}>
                        <label className="block text-white-pure text-sm font-medium mb-2">
                          {field.label}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={formData[field.name] || ''}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            rows={4}
                            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent resize-y"
                          />
                        ) : field.type === 'select' && field.name === 'blood_type' ? (
                          <select
                            value={formData[field.name] || ''}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                            style={{ backgroundColor: '#212121', color: '#FFF' }}
                          >
                            <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona tipo de sangre</option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'file' ? (
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            onChange={(e) => handleFileChange(field.name, e.target.files?.[0] || null)}
                            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-primary file:text-white-pure hover:file:bg-red-fire"
                          />
                        ) : (
                          <input
                            type={field.type}
                            value={formData[field.name] || ''}
                            onChange={(e) => {
                              if (field.type === 'tel' || field.name === 'phone' || field.name === 'emergency_contact_phone') {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 10) {
                                  handleChange(field.name, value);
                                }
                              } else {
                                handleChange(field.name, e.target.value);
                              }
                            }}
                            maxLength={field.type === 'tel' ? 10 : undefined}
                            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
                          />
                        )}
                        {errors[field.name] && (
                          <p className="mt-1 text-sm text-red-fire">{errors[field.name]}</p>
                        )}
                      </div>
                    )
                    )}
                </div>
              )}


              {/* Checkbox de Términos y Condiciones */}
              <div
                ref={(el) => registerFieldErrorRef('terms', el)}
                data-field-error="terms"
                className="mt-6 mb-4"
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (errors.terms) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.terms;
                          return newErrors;
                        });
                      }
                    }}
                    className="mt-1 w-5 h-5 text-orange-primary bg-black-asphalt border-white-pure/20 rounded focus:ring-orange-primary focus:ring-2"
                    required
                  />
                  <span className="text-white-pure/90 text-sm">
                    Acepto los{' '}
                    <a
                      href="/terminos-y-condiciones"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-primary hover:text-red-fire underline"
                    >
                      términos y condiciones
                    </a>
                    {' '}y el{' '}
                    <a
                      href="/aviso-de-privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-primary hover:text-red-fire underline"
                    >
                      aviso de privacidad
                    </a>
                    <span className="text-red-fire ml-1">*</span>
                  </span>
                </label>
                {errors.terms && (
                  <p className="mt-1 text-sm text-red-fire">{errors.terms}</p>
                )}
              </div>

              {/* reCAPTCHA - Solo mostrar en el paso final (no en paso 1 de parejas) */}
              {recaptchaSiteKey && (!isPairCategory || currentStep === 2) && (
                <div ref={recaptchaContainerRef} className="mt-4 mb-4 flex flex-col items-center">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={recaptchaSiteKey}
                    theme="dark"
                    onChange={(token) => {
                      setRecaptchaToken(token);
                      // Limpiar error de reCAPTCHA si existe
                      if (errors.recaptcha) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.recaptcha;
                          return newErrors;
                        });
                      }
                    }}
                    onExpired={() => {
                      setRecaptchaToken(null);
                    }}
                    onError={() => {
                      setRecaptchaToken(null);
                      setErrors((prev) => ({
                        ...prev,
                        recaptcha: 'Error al cargar reCAPTCHA. Por favor, recarga la página.',
                      }));
                    }}
                  />
                  {errors.recaptcha && (
                    <p className="mt-2 text-sm text-red-fire text-center w-full">{errors.recaptcha}</p>
                  )}
                </div>
              )}

              {submitError && (
                <div
                  ref={errorRef}
                  className="mt-4 p-4 bg-red-fire/20 border border-red-fire rounded-lg flex items-start"
                >
                  <FiAlertCircle className="text-red-fire mr-3 mt-0.5" size={20} />
                  <p className="text-white-pure text-sm">{submitError}</p>
                </div>
              )}

              <div className="mt-6 flex gap-4 justify-between">
                <div className="flex gap-4">
                  {/* Botón Volver - solo visible en paso 2 */}
                  {isPairCategory && currentStep === 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        // Guardar datos del Competidor 2 antes de volver
                        setCompetitor2Data({
                          ...formData,
                          gender: selectedGender,
                          kit_size_id: selectedKitSizeId,
                          club_not_in_list: clubNotInList,
                          selected_club_id: selectedClubId,
                          manual_club_name: manualClubName,
                        });

                        // Volver al paso 1 y cargar datos guardados del Competidor 1
                        setCurrentStep(1);

                        // Restaurar todos los datos del Competidor 1
                        const { club_not_in_list, selected_club_id, manual_club_name, kit_size_id, gender, kit_id, ...restData } = competitor1Data;
                        setFormData(restData);
                        setSelectedGender(gender || '');
                        setSelectedKitId(kit_id || '');
                        setSelectedKitSizeId(kit_size_id || '');
                        setClubNotInList(club_not_in_list || false);
                        setSelectedClubId(selected_club_id || '');
                        setManualClubName(manual_club_name || '');
                        setErrors({});

                        // Hacer scroll suave hasta arriba del modal
                        setTimeout(() => {
                          const modalContent = document.getElementById('registration-modal-content');
                          if (modalContent) {
                            modalContent.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }, 100);
                      }}
                      className="px-6 py-2 border border-white-pure/20 rounded-lg text-white-pure hover:bg-white-pure/10 transition-colors"
                      disabled={submitting}
                    >
                      Volver
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-2 border border-white-pure/20 rounded-lg text-white-pure hover:bg-white-pure/10 transition-colors"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting || loading || !acceptedTerms}
                  className="px-6 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin" />
                      {isPairCategory && currentStep === 1 ? 'Guardando...' : 'Registrando...'}
                    </>
                  ) : (
                    isPairCategory && currentStep === 1 ? 'Siguiente' : 'Registrarse'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      {/* Modal de confirmación de cambio de categoría */}
      {showCategoryChangeWarning && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black-asphalt/90 backdrop-blur-sm"
          onClick={() => setShowCategoryChangeWarning(false)}
        >
          <div
            className="bg-black-asphalt border border-white-pure/20 rounded-lg shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white-pure mb-4">Cambio de Categoría</h3>
            <p className="text-white-pure/90 mb-6">
              Si cambias a una categoría individual, se perderán los datos del Competidor 2 que hayas ingresado. ¿Deseas continuar?
            </p>
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryChangeWarning(false);
                  setPendingCategoryChange(null);
                }}
                className="px-6 py-2 border border-white-pure/20 rounded-lg text-white-pure hover:bg-white-pure/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  // Aplicar el cambio de categoría
                  if (pendingCategoryChange) {
                    const selectedCat = allCategories.find(c => c.id === pendingCategoryChange);
                    setIsPairCategory(selectedCat?.is_pair_category || false);
                    handleChange('category_id', pendingCategoryChange);
                    loadKits(pendingCategoryChange);
                    setSelectedKitId('');
                    setSelectedKitSizeId('');
                    handleChange('kit_id', '');
                    // Limpiar datos del competidor 2
                    setPairFormData({});
                    setPairErrors({});
                    setCurrentStep(1);
                  }
                  setShowCategoryChangeWarning(false);
                  setPendingCategoryChange(null);
                }}
                className="px-6 py-2 bg-orange-primary hover:bg-red-fire text-white-pure rounded-lg font-semibold transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderField(field: ParsedField) {
    // No renderizar gender y category_id aquí, se manejan arriba
    if (field.name === 'gender' || field.name === 'category_id') {
      return null;
    }

    return (
      <div
        key={field.name}
        ref={(el) => registerFieldErrorRef(field.name, el)}
        data-field-error={field.name}
      >
        <label
          htmlFor={field.name}
          className="block text-white-pure text-sm font-medium mb-2"
        >
          {field.label}
          {field.required && <span className="text-red-fire ml-1">*</span>}
        </label>

        {field.type === 'select' && field.name === 'gender' ? (
          <select
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
            style={{ backgroundColor: '#212121', color: '#FFF' }}
          >
            <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === 'select' && field.name === 'blood_type' ? (
          <select
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            className="w-full px-4 py-2 bg-black-asphalt border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
            style={{ backgroundColor: '#212121', color: '#FFF' }}
          >
            <option value="" style={{ backgroundColor: '#212121', color: '#FFF' }}>Selecciona tipo de sangre</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ backgroundColor: '#212121', color: '#FFF' }}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
            rows={4}
            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent resize-y"
          />
        ) : field.type === 'file' ? (
          <input
            type="file"
            id={field.name}
            name={field.name}
            accept="image/*"
            onChange={(e) => handleFileChange(field.name, e.target.files?.[0] || null)}
            required={field.required}
            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-primary file:text-white-pure hover:file:bg-red-fire focus:outline-none focus:ring-2 focus:ring-orange-primary"
            // Restricción de tamaño: máximo 2MB
            data-max-size={2 * 1024 * 1024}
          />
        ) : (
          <input
            type={field.type}
            id={field.name}
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => {
              // Formatear teléfonos mientras se escribe
              if (field.type === 'tel' || field.name === 'phone' || field.name === 'emergency_contact_phone') {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  handleChange(field.name, value);
                }
              } else {
                handleChange(field.name, e.target.value);
              }
            }}
            onBlur={async (e) => {
              // Validar email único cuando pierde el foco
              if (field.type === 'email' && field.name === 'email') {
                await validateEmailUnique(e.target.value);
              }
            }}
            maxLength={field.type === 'tel' ? 10 : undefined}
            required={field.required}
            className="w-full px-4 py-2 bg-white-pure/10 border border-white-pure/20 rounded-lg text-white-pure focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent"
          />
        )}

        {errors[field.name] && (
          <p className="mt-1 text-sm text-red-fire">{errors[field.name]}</p>
        )}
      </div>
    );
  }
}
