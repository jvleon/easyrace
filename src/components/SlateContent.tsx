import { renderSlateContent } from '../utils/slateRenderer';

interface SlateContentProps {
  content: string | null | undefined;
}

export default function SlateContent({ content }: SlateContentProps) {
  if (!content) {
    return null;
  }

  return <>{renderSlateContent(content)}</>;
}

