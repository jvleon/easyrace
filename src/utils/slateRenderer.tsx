import React from 'react';

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

          // Renderizar listas
          if (node.type === 'bulleted-list' || node.type === 'numbered-list') {
            const ListTag = node.type === 'bulleted-list' ? 'ul' : 'ol';
            return (
              <ListTag key={index} className={`my-4 list-inside ${alignClass}`}>
                {node.children.map((item: any, itemIndex: number) => (
                  <li key={itemIndex} className="my-2">
                    {item.children?.map((child: any, childIndex: number) => (
                      <span
                        key={childIndex}
                        style={{
                          fontWeight: child.bold ? 'bold' : 'normal',
                          fontStyle: child.italic ? 'italic' : 'normal',
                          textDecoration: child.underline ? 'underline' : 'none',
                          color: child.color || 'inherit',
                        }}
                      >
                        {child.text}
                      </span>
                    ))}
                  </li>
                ))}
              </ListTag>
            );
          }

          // Renderizar párrafos
          if (node.type === 'paragraph') {
            return (
              <p key={index} className={`my-4 ${alignClass}`}>
                {node.children.map((child: any, childIndex: number) => (
                  <span
                    key={childIndex}
                    style={{
                      fontWeight: child.bold ? 'bold' : 'normal',
                      fontStyle: child.italic ? 'italic' : 'normal',
                      textDecoration: child.underline ? 'underline' : 'none',
                      color: child.color || 'inherit',
                    }}
                  >
                    {child.text}
                  </span>
                ))}
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

