import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  read_time: number | null;
  published_at: string | null;
  created_at: string;
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
    <article className="rounded-xl border border-white-pure/10 bg-white-pure/5 overflow-hidden animate-pulse">
      <div className="h-44 bg-white-pure/10" />
      <div className="p-5 space-y-3">
        <div className="flex gap-3">
          <div className="h-3 w-12 bg-white-pure/10 rounded" />
          <div className="h-3 w-16 bg-white-pure/10 rounded" />
          <div className="h-3 w-20 bg-white-pure/10 rounded" />
        </div>
        <div className="h-4 bg-white-pure/10 rounded w-3/4" />
        <div className="h-3 bg-white-pure/10 rounded" />
      </div>
    </article>
  );
}

export default function BlogDynamicWidget() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, read_time, published_at, created_at, sport_types(name)')
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setPosts((data ?? []) as unknown as BlogPost[]);
        setLoading(false);
      });
  }, []);

  return (
    <section id="blog" className="py-16 md:py-24 bg-black-asphalt">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-orange-primary text-sm font-medium uppercase tracking-widest mb-2">Blog</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white-pure">Para Organizadores</h2>
            <p className="text-white-pure/60 mt-2">Guías, tips y recursos para llevar tu evento al siguiente nivel</p>
          </div>
          <a href="/blog" className="hidden md:inline-flex items-center gap-2 text-orange-primary hover:text-red-fire transition-colors font-medium text-sm">
            Ver todos
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : posts.map((post) => {
                const displayDate = post.published_at || post.created_at;
                return (
                  <a
                    key={post.id}
                    href={`/blog?slug=${post.slug}`}
                    className="rounded-xl border border-white-pure/10 bg-white-pure/5 overflow-hidden hover:border-orange-primary/30 transition-colors group"
                  >
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-44 bg-gradient-to-br from-white-pure/10 to-white-pure/5 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white-pure/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {post.sport_types && (
                          <span className="text-orange-primary text-xs font-medium">{post.sport_types.name}</span>
                        )}
                        {post.read_time && (
                          <>
                            <span className="text-white-pure/30 text-xs">·</span>
                            <span className="text-white-pure/40 text-xs">{post.read_time} min lectura</span>
                          </>
                        )}
                        <span className="text-white-pure/30 text-xs">·</span>
                        <span className="text-white-pure/40 text-xs">{formatDate(displayDate)}</span>
                      </div>
                      <h3 className="text-white-pure font-bold text-base mb-2 group-hover:text-orange-primary transition-colors leading-snug">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-white-pure/50 text-sm line-clamp-2">{post.excerpt}</p>
                      )}
                    </div>
                  </a>
                );
              })}
        </div>

        <div className="md:hidden mt-6 text-center">
          <a href="/blog" className="inline-flex items-center gap-2 text-orange-primary hover:text-red-fire transition-colors font-medium text-sm">
            Ver todos los artículos
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
