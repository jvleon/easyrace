import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../../lib/supabase'
import { isDemoSubdomain } from '../../utils/subdomain'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatWindowProps {
  onMinimize: () => void
  isVisible: boolean
  eventSlug?: string
  sessionId: string
}

const WELCOME_MESSAGE = '¡Hola! Soy **Cronito**, el asistente virtual de EasyRace. Estoy aquí para ayudarte con tus dudas sobre eventos y carreras.'

const STORAGE_KEYS = {
  conversationId: 'easyrace_chat_conversation_id',
  messages: 'easyrace_chat_messages',
  terms: 'easyrace_chat_terms',
  // localStorage key for cross-tab persistence
  conversationIdShared: 'easyrace_chat_active_conversation',
}

interface BankInfo {
  bank?: string
  holder?: string
  account?: string
  clabe?: string
  reference?: string
  event_name?: string
}

/** Extrae marcador <<quick_replies:[...]>> del mensaje del asistente. */
function parseQuickReplies(content: string): { text: string; quickReplies: string[] } {
  const match = content.match(/<<quick_replies:\s*(\[[\s\S]*\])>>/)
  if (!match) return { text: content, quickReplies: [] }
  try {
    const replies = JSON.parse(match[1]) as string[]
    if (!Array.isArray(replies)) return { text: content, quickReplies: [] }
    const text = content.replace(/<<quick_replies:\s*\[[\s\S]*\]\s*>>/, '').trim()
    return { text, quickReplies: replies.filter((r) => typeof r === 'string') }
  } catch {
    return { text: content, quickReplies: [] }
  }
}

/** Extrae marcador <<bank_info:{...}>> del mensaje del asistente. */
function parseBankInfo(content: string): { text: string; bankInfo: BankInfo | null } {
  const match = content.match(/<<bank_info:([\s\S]*?)>>/)
  if (!match) return { text: content, bankInfo: null }
  try {
    const bankInfo = JSON.parse(match[1]) as BankInfo
    const text = content.replace(/<<bank_info:[\s\S]*?>>/, '').trim()
    return { text, bankInfo }
  } catch {
    return { text: content, bankInfo: null }
  }
}

/** Formatea CLABE con espacios cada 6 dígitos. */
function formatClabe(clabe: string): string {
  return clabe.replace(/(\d{6})(?=\d)/g, '$1 ')
}

/** Tarjeta de datos bancarios con botón copiar por campo. */
function BankInfoCard({ info }: { info: BankInfo }) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const fields: { label: string; value: string; key: string }[] = []
  if (info.bank) fields.push({ label: 'Banco', value: info.bank, key: 'bank' })
  if (info.holder) fields.push({ label: 'Titular', value: info.holder, key: 'holder' })
  if (info.account) fields.push({ label: 'Cuenta', value: info.account, key: 'account' })
  if (info.clabe) fields.push({ label: 'CLABE', value: formatClabe(info.clabe), key: 'clabe' })
  if (info.reference) fields.push({ label: 'Concepto', value: info.reference, key: 'reference' })

  return (
    <div className="mt-2 rounded-lg border border-gray-600 bg-gray-800/80 overflow-hidden">
      <div className="px-3 py-2 bg-gray-700/50 border-b border-gray-600 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-orange-400">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <span className="text-xs font-medium text-gray-300">Datos para transferencia</span>
      </div>
      <div className="divide-y divide-gray-700">
        {fields.map(({ label, value, key }) => (
          <div key={key} className="flex items-center justify-between px-3 py-2 gap-2">
            <div className="min-w-0">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
              <div className="text-sm text-white font-mono truncate">{value}</div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(key === 'clabe' ? info.clabe! : value, key)}
              className="shrink-0 text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              aria-label={`Copiar ${label}`}
            >
              {copied === key ? '✓' : 'Copiar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Carga mensajes de la BD para una conversación existente. */
async function loadMessagesFromDB(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20)

  if (error || !data || data.length === 0) return []

  return data.map((m: any) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
}

export default function ChatWindow({ onMinimize, isVisible, eventSlug, sessionId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [{ id: 'welcome', role: 'assistant' as const, content: WELCOME_MESSAGE }]
    const saved = sessionStorage.getItem(STORAGE_KEYS.messages)
    if (saved) {
      try {
        return JSON.parse(saved) as Message[]
      } catch { /* ignore */ }
    }
    return [{ id: 'welcome', role: 'assistant' as const, content: WELCOME_MESSAGE }]
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(STORAGE_KEYS.conversationId) || null
  })
  const [acceptedTerms, setAcceptedTerms] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEYS.terms) === '1'
  )
  const [termsChecked, setTermsChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Intentar recuperar conversación de otra pestaña si no tenemos en sessionStorage
  useEffect(() => {
    if (conversationId || !acceptedTerms) return

    const sharedConvId = localStorage.getItem(STORAGE_KEYS.conversationIdShared)
    if (!sharedConvId) return

    setIsLoading(true)
    loadMessagesFromDB(sharedConvId).then((dbMessages) => {
      if (dbMessages.length > 0) {
        setConversationId(sharedConvId)
        sessionStorage.setItem(STORAGE_KEYS.conversationId, sharedConvId)
        const allMessages = [
          { id: 'welcome', role: 'assistant' as const, content: WELCOME_MESSAGE },
          ...dbMessages,
        ]
        setMessages(allMessages)
        sessionStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(allMessages))
      }
      setIsLoading(false)
    })
  }, [conversationId, acceptedTerms])

  // Persistir mensajes en sessionStorage al cambiar
  const saveMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs)
    sessionStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(msgs))
  }, [])

  // Persistir conversationId
  const saveConversationId = useCallback((id: string) => {
    setConversationId(id)
    sessionStorage.setItem(STORAGE_KEYS.conversationId, id)
    localStorage.setItem(STORAGE_KEYS.conversationIdShared, id)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (acceptedTerms && !isLoading) {
      inputRef.current?.focus()
    }
  }, [acceptedTerms, isLoading])

  const handleAcceptTerms = () => {
    if (!termsChecked) return
    setAcceptedTerms(true)
    sessionStorage.setItem(STORAGE_KEYS.terms, '1')
  }

  /** Reinicia completamente la conversación */
  const forceReset = () => {
    setConversationId(null)
    sessionStorage.removeItem(STORAGE_KEYS.conversationId)
    sessionStorage.removeItem(STORAGE_KEYS.messages)
    localStorage.removeItem(STORAGE_KEYS.conversationIdShared)
    sessionStorage.removeItem('easyrace_chat_event_slug')
    const resetMessages = [{ id: 'welcome', role: 'assistant' as const, content: WELCOME_MESSAGE }]
    setMessages(resetMessages)
    sessionStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(resetMessages))
    setError(null)
    setInput('')
  }

  const sendMessage = async (overrideMessage?: string) => {
    const trimmedInput = (overrideMessage ?? input).trim()
    if (!trimmedInput || sending) return

    // Comando especial: reiniciar conversación
    if (trimmedInput === '!force-reset') {
      forceReset()
      return
    }

    setError(null)

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
    }
    const newMessages = [...messages, userMsg]
    saveMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('chat-agent', {
        body: {
          conversation_id: conversationId,
          session_id: sessionId,
          event_slug: eventSlug,
          message: trimmedInput,
          accepted_terms: !conversationId ? true : undefined,
          is_demo: isDemoSubdomain(),
        },
      })

      if (fnError) {
        throw new Error(fnError.message || 'Error al enviar mensaje')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      if (data?.conversation_id && !conversationId) {
        saveConversationId(data.conversation_id)
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.message || 'Sin respuesta',
      }
      saveMessages([...newMessages, assistantMsg])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMsg)
      saveMessages(messages) // Restaurar sin el mensaje del usuario
      setInput(trimmedInput)
    } finally {
      setSending(false)
    }
  }

  const handleQuickReply = (text: string) => {
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Pantalla de aceptar términos
  if (!acceptedTerms) {
    return (
      <div className={`fixed z-[60] bg-gray-900 shadow-2xl border border-gray-700 flex flex-col overflow-hidden bottom-2 left-2 right-2 rounded-xl max-h-[calc(100dvh-5rem)] sm:left-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-6rem)] sm:rounded-2xl ${!isVisible ? 'hidden' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-white font-medium text-sm">Asistente EasyRace</span>
          </div>
          <button
            onClick={onMinimize}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Minimizar chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Consent content */}
        <div className="p-5 flex flex-col gap-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-orange-primary/20 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6 text-orange-primary">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg">Asistente Virtual</h3>
            <p className="text-gray-400 text-sm mt-1">
              Soy un asistente con inteligencia artificial que puede ayudarte con preguntas sobre EasyRace y sus eventos.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-600 text-orange-primary focus:ring-orange-primary bg-gray-800"
            />
            <span className="text-gray-300 text-sm leading-relaxed">
              Acepto los{' '}
              <a
                href="/terminos-y-condiciones"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-primary hover:text-orange-400 underline"
              >
                Términos y Condiciones
              </a>
              {' '}y el{' '}
              <a
                href="/aviso-de-privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-primary hover:text-orange-400 underline"
              >
                Aviso de Privacidad
              </a>
              {' '}para usar el chat.
            </span>
          </label>

          <button
            onClick={handleAcceptTerms}
            disabled={!termsChecked}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-primary hover:bg-red-fire text-white"
          >
            Iniciar conversación
          </button>
        </div>
      </div>
    )
  }

  // Chat activo
  return (
    <div className={`fixed z-[60] bg-gray-900 shadow-2xl border border-gray-700 flex flex-col overflow-hidden bottom-1 left-2 right-2 rounded-xl h-[min(520px,calc(100dvh-6rem))] sm:left-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:max-w-[calc(100vw-2rem)] sm:h-[min(520px,calc(100dvh-7.8rem))] sm:rounded-2xl ${!isVisible ? 'hidden' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-white font-medium text-sm">Asistente EasyRace</span>
        </div>
        <button
          onClick={onMinimize}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Minimizar chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <span className="text-gray-400 text-sm">Cargando conversación...</span>
          </div>
        ) : (
          messages.map((msg: Message) => {
            const isLastMessage = msg.id === messages[messages.length - 1]?.id
            // Parse bank info first, then quick replies from the remaining text
            const { text: textAfterBank, bankInfo } =
              msg.role === 'assistant' ? parseBankInfo(msg.content) : { text: msg.content, bankInfo: null }
            const { text: assistantText, quickReplies } =
              msg.role === 'assistant' ? parseQuickReplies(textAfterBank) : { text: textAfterBank, quickReplies: [] as string[] }
            const showQuickReplies =
              msg.role === 'assistant' && isLastMessage && !sending && quickReplies.length > 0

            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[80%] rounded-xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-orange-primary text-white">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[80%]">
                    <div className="rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed break-words bg-gray-800 text-gray-200 chat-markdown">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children, ...props }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                              {children}
                            </a>
                          ),
                        }}
                      >{assistantText}</ReactMarkdown>
                    </div>
                    {bankInfo && <BankInfoCard info={bankInfo} />}
                    {showQuickReplies && (
                      <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Respuestas rápidas">
                        {quickReplies.map((reply, i) => (
                          <button
                            key={`${msg.id}-qr-${i}`}
                            type="button"
                            onClick={() => handleQuickReply(reply)}
                            disabled={sending}
                            className="text-xs px-3 py-1.5 rounded-full border border-orange-primary/60 text-orange-primary hover:bg-orange-primary hover:text-white transition-colors duration-150 disabled:opacity-50"
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-[90%] bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-center">
            <p className="text-red-300 text-xs mb-1.5">No se pudo enviar tu mensaje. Intenta de nuevo.</p>
            <button
              type="button"
              onClick={() => { setError(null); if (input) sendMessage(input) }}
              className="text-xs px-3 py-1 rounded-full border border-red-600/60 text-red-300 hover:bg-red-800/40 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700 shrink-0">
        {input.length > 0 && (
          <div className={`text-right text-xs mb-1 ${input.length >= 450 ? 'text-red-400' : input.length >= 400 ? 'text-yellow-400' : 'text-gray-500'}`}>
            {input.length}/450
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            maxLength={450}
            disabled={sending || isLoading}
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3.5 py-2.5 border border-gray-700 focus:border-orange-primary focus:outline-none placeholder-gray-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending || isLoading}
            className="shrink-0 w-10 h-10 rounded-lg bg-orange-primary hover:bg-red-fire disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            aria-label="Enviar mensaje"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
