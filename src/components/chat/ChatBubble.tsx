interface ChatBubbleProps {
  onClick: () => void
  isOpen: boolean
  showHint?: boolean
}

export default function ChatBubble({ onClick, isOpen, showHint }: ChatBubbleProps) {
  if (isOpen) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {showHint && (
        <button
          onClick={onClick}
          className="bg-gray-900 text-gray-200 text-sm px-4 py-2 rounded-xl shadow-lg border border-gray-700 animate-fade-in cursor-pointer hover:bg-gray-800 transition-colors max-w-[220px] text-right leading-snug"
        >
          ¿Necesitas ayuda? Haz clic aquí para conversar
        </button>
      )}
      <button
        onClick={onClick}
        className="w-14 h-14 rounded-full bg-orange-primary hover:bg-red-fire transition-colors duration-200 shadow-lg hover:shadow-xl flex items-center justify-center group relative"
        aria-label="Abrir chat de ayuda"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white group-hover:scale-110 transition-transform"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="absolute inset-0 rounded-full bg-orange-primary animate-ping opacity-20" />
      </button>
    </div>
  )
}
