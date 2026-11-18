import { Icon } from '../icons/Icon';
import { filePath, recoveryFiles } from '../shell/recovery-files';
import { navigate, useRoute } from '../state/router';

/**
 * Recovery files as rows. A row opens the file in the right pane. Only the icon button downloads.
 */
export function Recovery() {
  const route = useRoute();
  const selected = route.name === 'file' ? route.key : null;
  return (
    <>
      {recoveryFiles().map((file) => (
        <div class="row-wrap" key={file.key}>
          <a
            class="row row--file"
            href={filePath(file.key)}
            data-file={file.key}
            aria-current={selected === file.key ? 'true' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              navigate(filePath(file.key), { from: 'recovery' });
            }}
          >
            <span class="row-title">{file.title}</span>
            <span class="row-meta">
              <span class="pill">{file.label}</span>
            </span>
          </a>
          <a
            class="btn btn--icon btn--ghost row-download"
            href={file.href}
            download={file.filename}
            aria-label={`Download ${file.title}`}
          >
            <Icon name="download" />
          </a>
        </div>
      ))}
    </>
  );
}
