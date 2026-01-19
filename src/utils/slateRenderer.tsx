import React from 'react';

// Tipo base para texto con estilos
interface TextLeaf {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: string;
}

// Tipo para links inline
interface LinkNode {
  type: 'link';
  url: string;
  children: TextLeaf[];
}

// Tipo para imágenes
interface ImageNode {
  type: 'image';
  url: string;
  alt?: string;
  children: [{ text: '' }];
}

// Tipo para nodos que pueden ser texto o link
type ChildNode = TextLeaf | LinkNode | {
  type: string;
  children: Array<TextLeaf | LinkNode>;
};

interface SlateNode {
  type: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  url?: string;
  alt?: string;
  children: ChildNode[];
}

// Renderiza un nodo de texto con estilos
function renderTextLeaf(child: TextLeaf, key: number): React.ReactNode {
  return (
    <span
      key={key}
      style={{
        fontWeight: child.bold ? 'bold' : 'normal',
        fontStyle: child.italic ? 'italic' : 'normal',
        textDecoration: child.underline ? 'underline' : 'none',
        color: child.color || 'inherit',
        fontSize: child.fontSize || 'inherit',
      }}
    >
      {child.text}
    </span>
  );
}

// Renderiza children que pueden ser texto o links
function renderChildren(children: ChildNode[]): React.ReactNode {
  return children.map((child: any, childIndex: number) => {
    // Si es un link
    if (child.type === 'link') {
      return (
        <a
          key={childIndex}
          href={child.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {child.children?.map((linkChild: TextLeaf, linkChildIndex: number) =>
            renderTextLeaf(linkChild, linkChildIndex)
          )}
        </a>
      );
    }

    // Si es texto con estilos
    if ('text' in child) {
      return renderTextLeaf(child as TextLeaf, childIndex);
    }

    // Otros nodos (como list-item children)
    if (child.children) {
      return (
        <span key={childIndex}>
          {renderChildren(child.children)}
        </span>
      );
    }

    return null;
  });
}

export function renderSlateContent(
  jsonString: string | null | undefined
): React.ReactNode {
  if (!jsonString || !jsonString.trim()) {
    return null;
  }

  try {
    const nodes = JSON.parse(jsonString) as SlateNode[];

    return (
      <div className="slate-content prose prose-invert max-w-none">
        {nodes.map((node, index) => {
          const alignClass = {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right',
            justify: 'text-justify',
          }[node.align || 'left'];

          // Renderizar imágenes
          if (node.type === 'image') {
            return (
              <div key={index} className={`my-4 ${alignClass}`}>
                <img
                  src={node.url}
                  alt={node.alt || ''}
                  className="max-w-full h-auto rounded-lg"
                  style={{ maxHeight: '500px', objectFit: 'contain' }}
                  loading="lazy"
                />
              </div>
            );
          }

          // Renderizar listas
          if (node.type === 'bulleted-list' || node.type === 'numbered-list') {
            const ListTag = node.type === 'bulleted-list' ? 'ul' : 'ol';
            return (
              <ListTag key={index} className={`my-4 list-inside ${alignClass}`}>
                {node.children.map((item: any, itemIndex: number) => (
                  <li key={itemIndex} className="my-2">
                    {item.children && renderChildren(item.children)}
                  </li>
                ))}
              </ListTag>
            );
          }

          // Renderizar párrafos
          if (node.type === 'paragraph') {
            return (
              <p key={index} className={`my-4 ${alignClass}`}>
                {renderChildren(node.children)}
              </p>
            );
          }

          return null;
        })}
      </div>
    );
  } catch (error) {
    // Fallback: mostrar como texto plano si no es JSON válido
    return (
      <div className="prose prose-invert max-w-none">
        <p className="text-white-pure/90 whitespace-pre-wrap">
          {jsonString}
        </p>
      </div>
    );
  }
}


