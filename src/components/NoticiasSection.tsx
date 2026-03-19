import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { slateToHtml } from '../utils/slateToHtml';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  status: string;
  source: 'internal' | 'rss';
  source_url: string | null;
  source_name: string | null;
  published_at: string;
  sport_types: { name: string } | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Skeleton loader para la lista
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white-pure/10 bg-white-pure/5 overflow-hidden animate-pulse">
      <div className="h-44 bg-white-pure/10" />
      <div className="p-5 space-y-3">
        <div className="flex gap-3">
          <div className="h-3 w-16 bg-white-pure/10 rounded" />
          <div className="h-3 w-20 bg-white-pure/10 rounded" />
        </div>
        <div className="h-5 bg-white-pure/10 rounded w-3/4" />
        <div className="h-3 bg-white-pure/10 rounded" />
        <div className="h-3 bg-white-pure/10 rounded w-2/3" />
      </div>
    </div>
  );
}

// Vista detalle de una noticia
function NewsDetail({ news }: { news: NewsItem }) {
  const isRss = news.source === 'rss';

  let bodyHtml = '';
  if (!isRss && news.content) {
    // Intentar renderizar como Slate JSON; si falla usa como texto
    bodyHtml = slateToHtml(news.content);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <a
        href="/noticias"
        className="inline-flex items-center gap-2 text-sm text-white-pure/50 hover:text-white-pure mb-8 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
        Volver a Noticias
      </a>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {news.sport_types && (
            <>
              <span className="text-orange-primary text-sm font-medium">{news.sport_types.name}</span>
              <span className="text-white-pure/30 text-sm">·</span>
            </>
          )}
          {isRss && news.source_name && (
            <>
              <span className="text-white-pure/40 text-sm">{news.source_name}</span>
              <span className="text-white-pure/30 text-sm">·</span>
            </>
          )}
          <span className="text-white-pure/50 text-sm">{formatDate(news.published_at)}</span>
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white-pure leading-tight mb-4">
          {news.title}
        </h1>
        {news.excerpt && (
          <p className="text-white-pure/60 text-lg">{news.excerpt}</p>
        )}
      </div>

      {news.cover_image_url ? (
        <img
          src={news.cover_image_url}
          alt={news.title}
          className="w-full h-56 md:h-72 rounded-xl object-cover mb-10"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-56 md:h-72 rounded-xl bg-gradient-to-br from-white-pure/10 to-white-pure/5 flex items-center justify-center mb-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-white-pure/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
      )}

      {isRss ? (
        <div className="space-y-6">
          {news.excerpt && (
            <p className="text-white-pure/80 text-lg leading-relaxed">{news.excerpt}</p>
          )}
          {news.source_url && (
            <div className="rounded-xl border border-white-pure/10 bg-white-pure/5 p-6">
              <p className="text-white-pure/60 text-sm mb-3">
                Esta noticia proviene de una fuente externa. Lee el artículo completo en:
              </p>
              <a
                href={news.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-orange-primary hover:text-orange-primary/80 font-medium transition-colors"
              >
                {news.source_name || new URL(news.source_url).hostname}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
      ) : (
        <article
          className="prose prose-invert prose-lg max-w-none
            prose-headings:text-white-pure prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
            prose-p:text-white-pure/80 prose-p:leading-relaxed
            prose-a:text-orange-primary hover:prose-a:text-red-fire
            prose-ul:text-white-pure/80 prose-ol:text-white-pure/80
            prose-li:my-1 prose-strong:text-white-pure"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}

      <div className="mt-12 pt-8 border-t border-white-pure/10">
        <a
          href="/noticias"
          className="inline-flex items-center gap-2 text-sm text-white-pure/50 hover:text-white-pure transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
          Ver todas las noticias
        </a>
      </div>
    </div>
  );
}

// Vista lista de noticias
function NewsList() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    async function fetchNews() {
      const { data } = await supabase
        .from('news')
        .select('id, title, slug, excerpt, cover_image_url, source, source_url, source_name, published_at, sport_types(name)')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      setNews((data ?? []) as unknown as NewsItem[]);
      setLoading(false);
    }
    fetchNews();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return news;
    return news.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.excerpt ?? '').toLowerCase().includes(q) ||
        (n.source_name ?? '').toLowerCase().includes(q) ||
        (n.sport_types?.name ?? '').toLowerCase().includes(q)
    );
  }, [query, news]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setPage(1);
  }

  return (
    <div>
      {/* Búsqueda */}
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
          placeholder="Buscar noticias..."
          value={query}
          onChange={handleSearch}
          className="w-full max-w-md pl-12 pr-4 py-3 rounded-lg bg-white-pure/10 border border-white-pure/10 text-white-pure placeholder-white-pure/40 focus:outline-none focus:border-orange-primary transition-colors text-sm"
        />
      </div>

      {query && (
        <p className="text-white-pure/50 text-sm mb-6">
          {filtered.length === 0
            ? 'Sin resultados para esta búsqueda'
            : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "${query}"`}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white-pure/50 text-lg">No se encontraron noticias.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginated.map((item) => (
            <a
              key={item.id}
              href={`/noticias?slug=${item.slug}`}
              className="rounded-xl border border-white-pure/10 bg-white-pure/5 overflow-hidden hover:border-orange-primary/40 transition-all duration-300 group flex flex-col"
            >
              {item.cover_image_url ? (
                <img
                  src={item.cover_image_url}
                  alt={item.title}
                  className="h-44 w-full object-cover flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="h-44 bg-gradient-to-br from-white-pure/10 to-white-pure/5 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white-pure/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
              )}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  {item.sport_types && (
                    <span className="text-orange-primary text-xs font-medium">{item.sport_types.name}</span>
                  )}
                  {item.source === 'rss' && item.source_name && (
                    <span className="text-white-pure/40 text-xs bg-white-pure/10 px-2 py-0.5 rounded">
                      {item.source_name}
                    </span>
                  )}
                  <span className="text-white-pure/40 text-xs">{formatDate(item.published_at)}</span>
                </div>
                <h2 className="text-white-pure font-bold text-base mb-2 group-hover:text-orange-primary transition-colors leading-snug flex-1">
                  {item.title}
                </h2>
                {item.excerpt && (
                  <p className="text-white-pure/50 text-sm line-clamp-2 mt-auto">{item.excerpt}</p>
                )}
                <span className="mt-4 inline-flex items-center gap-1 text-orange-primary text-xs font-medium group-hover:gap-2 transition-all">
                  {item.source === 'rss' ? 'Leer más' : 'Leer artículo'}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Paginación */}
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

export default function NoticiasSection() {
  const [slug, setSlug] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('slug');
    setSlug(s);

    if (s) {
      setLoadingDetail(true);
      supabase
        .from('news')
        .select('*, sport_types(name)')
        .eq('slug', s)
        .eq('status', 'published')
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setNotFound(true);
          } else {
            setNews(data as unknown as NewsItem);
          }
          setLoadingDetail(false);
        });
    }
  }, []);

  if (slug) {
    if (loadingDetail) {
      return (
        <div className="max-w-3xl mx-auto animate-pulse space-y-6">
          <div className="h-4 w-24 bg-white-pure/10 rounded" />
          <div className="h-8 bg-white-pure/10 rounded w-3/4" />
          <div className="h-72 bg-white-pure/10 rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-white-pure/10 rounded" />
            ))}
          </div>
        </div>
      );
    }

    if (notFound || !news) {
      return (
        <div className="text-center py-16">
          <p className="text-white-pure/50 text-lg">Noticia no encontrada.</p>
          <a href="/noticias" className="mt-4 inline-block text-orange-primary hover:underline text-sm">
            Ver todas las noticias
          </a>
        </div>
      );
    }

    return <NewsDetail news={news} />;
  }

  return <NewsList />;
}
