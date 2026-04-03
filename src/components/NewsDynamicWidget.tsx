import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string;
  source: 'internal' | 'rss';
  source_name: string | null;
  sport_types: { name: string } | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-white-pure/10 bg-black-asphalt/50 overflow-hidden animate-pulse">
      <div className="h-40 bg-white-pure/10" />
      <div className="p-5 space-y-3">
        <div className="flex gap-3">
          <div className="h-3 w-16 bg-white-pure/10 rounded" />
          <div className="h-3 w-20 bg-white-pure/10 rounded" />
        </div>
        <div className="h-4 bg-white-pure/10 rounded w-3/4" />
        <div className="h-3 bg-white-pure/10 rounded" />
      </div>
    </div>
  );
}

export default function NewsDynamicWidget() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('news')
      .select('id, title, slug, excerpt, cover_image_url, published_at, source, source_name, sport_types(name)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setNews((data ?? []) as unknown as NewsItem[]);
        setLoading(false);
      });
  }, []);

  return (
    <section id="noticias" className="py-16 md:py-24 bg-white-pure/5">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white-pure mb-2">Noticias</h2>
            <p className="text-white-pure/60">Lo último del mundo deportivo</p>
          </div>
          <a href="/noticias" className="hidden md:inline-flex items-center gap-2 text-orange-primary hover:text-red-fire transition-colors font-medium text-sm">
            Ver todas
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : news.map((item) => (
                <a
                  key={item.id}
                  href={`/noticias?slug=${item.slug}`}
                  className="rounded-lg border border-white-pure/10 bg-black-asphalt/50 overflow-hidden hover:border-orange-primary/30 transition-colors"
                >
                  {item.cover_image_url ? (
                    <img
                      src={item.cover_image_url}
                      alt={item.title}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-white-pure/10 to-white-pure/5 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white-pure/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {item.sport_types && (
                        <span className="text-orange-primary text-xs font-medium">{item.sport_types.name}</span>
                      )}
                      {item.source === 'rss' && item.source_name && (
                        <span className="text-white-pure/40 text-xs">{item.source_name}</span>
                      )}
                      <span className="text-white-pure/40 text-xs">{formatDate(item.published_at)}</span>
                    </div>
                    <h3 className="text-white-pure font-bold text-base mb-2">{item.title}</h3>
                    {item.excerpt && (
                      <p className="text-white-pure/50 text-sm line-clamp-2">{item.excerpt}</p>
                    )}
                  </div>
                </a>
              ))}
        </div>

        <div className="md:hidden mt-6 text-center">
          <a href="/noticias" className="inline-flex items-center gap-2 text-orange-primary hover:text-red-fire transition-colors font-medium text-sm">
            Ver todas las noticias
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
