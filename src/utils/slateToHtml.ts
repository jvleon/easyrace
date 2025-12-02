interface SlateNode {
  type: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  children: Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  } | {
    type: string;
    children: Array<{
      text: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      color?: string;
    }>;
  }>;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function renderSlateNode(node: SlateNode): string {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  }[node.align || 'left'];

  // Renderizar listas
  if (node.type === 'bulleted-list' || node.type === 'numbered-list') {
    const tag = node.type === 'bulleted-list' ? 'ul' : 'ol';
    const listClass = node.type === 'bulleted-list' 
      ? 'list-disc list-outside' 
      : 'list-decimal list-outside';
    const items = node.children
      .map((item: any) => {
        if (item.type === 'list-item' && item.children) {
          const content = item.children
            .map((child: any) => {
              let html = escapeHtml(child.text || '');
              if (child.bold) html = `<strong>${html}</strong>`;
              if (child.italic) html = `<em>${html}</em>`;
              if (child.underline) html = `<u>${html}</u>`;
              if (child.color) {
                html = `<span style="color: ${child.color}">${html}</span>`;
              }
              return html;
            })
            .join('');
          return `<li class="my-2">${content}</li>`;
        }
        return '';
      })
      .filter(item => item !== '')
      .join('');
    return `<${tag} class="my-4 ${listClass} ${alignClass} pl-6 ml-4">${items}</${tag}>`;
  }

  // Renderizar párrafos
  if (node.type === 'paragraph') {
    const content = node.children
      .map((child: any) => {
        let html = escapeHtml(child.text || '');
        if (child.bold) html = `<strong>${html}</strong>`;
        if (child.italic) html = `<em>${html}</em>`;
        if (child.underline) html = `<u>${html}</u>`;
        if (child.color) {
          html = `<span style="color: ${child.color}">${html}</span>`;
        }
        return html;
      })
      .join('');
    return `<p class="my-4 ${alignClass}">${content}</p>`;
  }

  return '';
}

export function slateToHtml(jsonString: string | null | undefined): string {
  if (!jsonString || !jsonString.trim()) {
    return '';
  }

  try {
    const nodes = JSON.parse(jsonString) as SlateNode[];
    const html = nodes.map((node) => renderSlateNode(node)).join('');
    return html;
  } catch (error) {
    // Fallback: mostrar como texto plano si no es JSON válido
    return `<p class="text-white-pure/90 whitespace-pre-wrap">${escapeHtml(jsonString)}</p>`;
  }
}

