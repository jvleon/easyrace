import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ChatBubble from './ChatBubble'
import ChatWindow from './ChatWindow'

interface ChatWidgetProps {
  eventSlug?: string
}

const STORAGE_KEYS = {
  sessionId: 'easyrace_chat_session_id',
  isOpen: 'easyrace_chat_open',
  eventSlug: 'easyrace_chat_event_slug',
}

/**
 * Widget principal del chatbot.
 * Persiste estado en sessionStorage para sobrevivir navegación entre páginas.
 */
export default function ChatWidget({ eventSlug }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(STORAGE_KEYS.isOpen) === '1'
  })
  const [isMounted, setIsMounted] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(STORAGE_KEYS.isOpen) === '1'
  })
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [hasAcceptedTerms] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem('easyrace_chat_terms') === '1'
  )

  // Resolver el slug real del evento desde la URL
  const resolvedSlug = (() => {
    if (!eventSlug) return undefined
    if (typeof window === 'undefined') return eventSlug
    if (eventSlug === 'dynamic') {
      const pathParts = window.location.pathname.split('/eventos/')
      if (pathParts.length > 1) {
        return pathParts[1].split('/')[0]?.replace(/\/$/, '').trim() || undefined
      }
    }
    return eventSlug
  })()

  // Guardar el eventSlug inicial en sessionStorage (contexto persistente)
  useEffect(() => {
    if (resolvedSlug) {
      // Solo guardar si no hay slug previo (el primer evento visitado es el contexto)
      if (!sessionStorage.getItem(STORAGE_KEYS.eventSlug)) {
        sessionStorage.setItem(STORAGE_KEYS.eventSlug, resolvedSlug)
      }
    }
  }, [resolvedSlug])

  // Generar o recuperar session_id de localStorage
  useEffect(() => {
    let id = localStorage.getItem(STORAGE_KEYS.sessionId)
    if (!id) {
      id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem(STORAGE_KEYS.sessionId, id)
    }
    setSessionId(id)
  }, [])

  // Verificar si el chatbot está habilitado
  useEffect(() => {
    if (!eventSlug) {
      setIsEnabled(true)
      return
    }

    const currentSlug = resolvedSlug || eventSlug

    async function checkEnabled() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('modules_config')
          .eq('slug', currentSlug)
          .in('status', ['published', 'completed'])
          .single()

        if (error || !data) {
          setIsEnabled(false)
          return
        }

        const config = data.modules_config as Record<string, boolean> | null
        setIsEnabled(config?.chatbot === true)
      } catch {
        setIsEnabled(false)
      }
    }

    checkEnabled()
  }, [eventSlug, resolvedSlug])

  if (isEnabled === null || !isEnabled || !sessionId) {
    return null
  }

  // El eventSlug persistido es el contexto original del chat
  const chatEventSlug = sessionStorage.getItem(STORAGE_KEYS.eventSlug) || resolvedSlug

  const handleOpen = () => {
    setIsMounted(true)
    setIsOpen(true)
    sessionStorage.setItem(STORAGE_KEYS.isOpen, '1')
  }

  const handleMinimize = () => {
    setIsOpen(false)
    sessionStorage.setItem(STORAGE_KEYS.isOpen, '0')
  }

  return (
    <>
      <ChatBubble
        onClick={handleOpen}
        isOpen={isOpen}
        showHint={!hasAcceptedTerms && !isMounted}
      />
      {isMounted && (
        <ChatWindow
          onMinimize={handleMinimize}
          isVisible={isOpen}
          eventSlug={chatEventSlug}
          sessionId={sessionId}
        />
      )}
    </>
  )
}
