import { useState, useMemo } from 'react';

interface Article {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  readTime?: string;
}

interface ArticleListProps {
  articles: Article[];
  basePath: string; // '/noticias' or '/blog'
  pageSize?: number;
}

export default function ArticleList({ articles, basePath, pageSize = 6 }: ArticleListProps) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [query, articles]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setPage(1);
  }

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-8">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-white-pure/40 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar..."
          value={query}
          onChange={handleSearch}
          className="w-full max-w-md pl-12 pr-4 py-3 rounded-lg bg-white-pure/10 border border-white-pure/10 text-white-pure placeholder-white-pure/40 focus:outline-none focus:border-orange-primary transition-colors text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setPage(1); }}
            className="absolute left-[calc(max(100%,theme(maxWidth.md))-2.5rem] top-1/2 -translate-y-1/2 text-white-pure/40 hover:text-white-pure transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results count when searching */}
      {query && (
        <p className="text-white-pure/50 text-sm mb-6">
          {filtered.length === 0
            ? 'Sin resultados para esta búsqueda'
            : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "${query}"`}
        </p>
      )}

      {/* Grid */}
      {paginated.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white-pure/50 text-lg">No se encontraron artículos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginated.map((article) => (
            <a
              key={article.slug}
              href={`${basePath}/${article.slug}`}
              className="rounded-xl border border-white-pure/10 bg-white-pure/5 overflow-hidden hover:border-orange-primary/40 transition-all duration-300 group flex flex-col"
            >
              <div className="h-44 bg-gradient-to-br from-white-pure/10 to-white-pure/5 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white-pure/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-orange-primary text-xs font-medium">{article.category}</span>
                  {article.readTime && (
                    <>
                      <span className="text-white-pure/30 text-xs">·</span>
                      <span className="text-white-pure/40 text-xs">{article.readTime} lectura</span>
                    </>
                  )}
                  <span className="text-white-pure/30 text-xs">·</span>
                  <span className="text-white-pure/40 text-xs">{article.date}</span>
                </div>
                <h2 className="text-white-pure font-bold text-base mb-2 group-hover:text-orange-primary transition-colors leading-snug flex-1">
                  {article.title}
                </h2>
                <p className="text-white-pure/50 text-sm line-clamp-2 mt-auto">{article.excerpt}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-orange-primary text-xs font-medium group-hover:gap-2 transition-all">
                  Leer más
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-white-pure/10 text-white-pure/70 text-sm disabled:opacity-30 hover:bg-white-pure/20 transition-colors"
          >
            ← Anterior
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-orange-primary text-white-pure'
                  : 'bg-white-pure/10 text-white-pure/70 hover:bg-white-pure/20'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg bg-white-pure/10 text-white-pure/70 text-sm disabled:opacity-30 hover:bg-white-pure/20 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
