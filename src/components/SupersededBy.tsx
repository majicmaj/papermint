import { useMemo } from 'preact/hooks';
import type { Doc } from '../api/types';
import { linkedIds, replacedIds, successorId, type DetailedDoc } from '../domain/record-details';
import { statusOf } from '../domain/tags';
import { useApp } from '../state/app';
import { navigate, recordPath } from '../state/router';

/** The links of one record: its successor if Superseded, the records it replaced if not. */
export function useLinks(doc: Doc): { successor: Doc | null; replaced: Doc[] } {
  const field = useApp((state) => state.successorField);
  const docs = useApp((state) => state.docs);
  const model = useApp((state) => state.model);
  return useMemo(() => {
    const byId = new Map(docs.map((item) => [item.id, item]));
    const isSuperseded = (id: number) => {
      const linked = byId.get(id);
      return !!linked && statusOf(linked, model) === 'superseded';
    };
    const detail = doc as DetailedDoc;
    const linksOf = (id: number) => {
      const linked = byId.get(id);
      return linked ? linkedIds(linked as DetailedDoc, field) : [];
    };
    if (statusOf(doc, model) === 'superseded') {
      const id = successorId(detail, field, isSuperseded, linksOf);
      return { successor: id === null ? null : (byId.get(id) ?? null), replaced: [] };
    }
    const replaced = replacedIds(detail, field, isSuperseded).flatMap((id) => byId.get(id) ?? []);
    return { successor: null, replaced };
  }, [doc, docs, model, field]);
}

export function RecordLink({
  doc,
  item,
  onOpen,
}: {
  doc: Doc;
  item?: boolean;
  onOpen?: () => void;
}) {
  const path = recordPath(doc.id);
  return (
    <a
      href={path}
      role={item ? 'menuitem' : undefined}
      class={item ? 'menu-item marks-item' : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        onOpen?.();
        navigate(path);
      }}
    >
      {doc.title}
    </a>
  );
}

/** "Superseded by <title>" for a Superseded record. Nothing for any other record. */
export function SupersededBy({ doc }: { doc: Doc }) {
  const { successor } = useLinks(doc);
  if (!successor) return null;
  return (
    <span class="successor">
      Superseded by <RecordLink doc={successor} />
    </span>
  );
}
