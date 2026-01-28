interface SlateTextNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: string; // "12px", "14px", "18px", "24px", "32px"
}

interface SlateLinkNode {
  type: 'link';
  url: string;
  children: SlateTextNode[];
}

interface SlateImageNode {
  type: 'image';
  url: string;
  alt?: string;
  children: [{ text: '' }];
}

type SlateChild = SlateTextNode | SlateLinkNode | SlateImageNode | {
  type: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  children: SlateChild[];
};

interface SlateNode {
  type: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  url?: string;
  alt?: string;
  children: SlateChild[];
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

function renderTextNode(child: SlateTextNode): string {
  let html = escapeHtml(child.text || '');
  const styles: string[] = [];
  
  if (child.color) {
    styles.push(`color: ${child.color}`);
  }
  if (child.fontSize) {
    styles.push(`font-size: ${child.fontSize}`);
  }
  
  if (child.bold) html = `<strong>${html}</strong>`;
  if (child.italic) html = `<em>${html}</em>`;
  if (child.underline) html = `<u>${html}</u>`;
  
  if (styles.length > 0) {
    html = `<span style="${styles.join('; ')}">${html}</span>`;
  }
  
  return html;
}

function renderLinkNode(node: SlateLinkNode): string {
  const content = node.children
    .map((child) => renderTextNode(child))
    .join('');
  const safeUrl = escapeHtml(node.url);
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">${content}</a>`;
}

function renderImageNode(node: SlateImageNode): string {
  const safeUrl = escapeHtml(node.url);
  const safeAlt = escapeHtml(node.alt || '');
  return `<div class="my-4"><img src="${safeUrl}" alt="${safeAlt}" class="max-w-full h-auto rounded-lg" style="max-height: 500px; object-fit: contain;" loading="lazy" /></div>`;
}

// Renderiza un child que puede ser texto, link o imagen
function renderChild(child: SlateChild): string {
  // Si es un link
  if (typeof child === 'object' && 'type' in child && child.type === 'link') {
    return renderLinkNode(child as SlateLinkNode);
  }
  
  // Si es una imagen
  if (typeof child === 'object' && 'type' in child && child.type === 'image') {
    return renderImageNode(child as SlateImageNode);
  }
  
  // Si es texto
  if (typeof child === 'object' && 'text' in child) {
    return renderTextNode(child as SlateTextNode);
  }
  
  return '';
}

function renderSlateNode(node: SlateNode): string {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  }[node.align || 'left'];

  // Renderizar imágenes (nodo de nivel superior)
  if (node.type === 'image') {
    return renderImageNode(node as unknown as SlateImageNode);
  }

  // Renderizar tablas
  if (node.type === 'table') {
    const rows = node.children
      .map((row: any) => {
        if (row.type === 'table-row' && row.children) {
          const cells = row.children
            .map((cell: any) => {
              if (cell.type === 'table-cell' && cell.children) {
                const cellAlign = {
                  left: 'text-left',
                  center: 'text-center',
                  right: 'text-right',
                  justify: 'text-justify',
                }[cell.align || 'left'];
                
                const content = cell.children
                  .map((paragraph: any) => {
                    if (paragraph.type === 'paragraph' && paragraph.children) {
                      const paraAlign = {
                        left: 'text-left',
                        center: 'text-center',
                        right: 'text-right',
                        justify: 'text-justify',
                      }[paragraph.align || 'left'];
                      
                      const textContent = paragraph.children
                        .map((child: any) => renderChild(child))
                        .join('');
                      
                      return `<p class="${paraAlign}">${textContent}</p>`;
                    }
                    return '';
                  })
                  .join('');
                
                return `<td class="border border-white-pure/20 px-4 py-2 ${cellAlign}">${content}</td>`;
              }
              return '';
            })
            .join('');
          return `<tr>${cells}</tr>`;
        }
        return '';
      })
      .join('');
    
    return `<div class="overflow-x-auto my-4"><table class="w-full border-collapse border border-white-pure/20 min-w-max ${alignClass}"><tbody>${rows}</tbody></table></div>`;
  }

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
            .map((child: any) => renderChild(child))
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
      .map((child: any) => renderChild(child))
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

