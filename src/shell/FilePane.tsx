import { Icon } from '../icons/Icon';
import { PreviewFailed } from '../components/Preview';
import { navigate } from '../state/router';
import { VIEW_PATH } from '../domain/views';
import type { Route } from '../state/routes';
import { formatBytes } from './bytes';
import { Frame } from './Frame';
import { recoveryFile, type RecoveryFile } from './recovery-files';
import { useRecoveryContent, type Content } from './useRecoveryContent';

type FileRoute = Extract<Route, { name: 'file' }>;

function DownloadButton({ file }: { file: RecoveryFile }) {
  return (
    <a class="btn btn--primary btn--grow" href={file.href} download={file.filename}>
      <Icon name="download" />
      Download
    </a>
  );
}

function FileCard({ file, size }: { file: RecoveryFile; size: number | null }) {
  return (
    <div class="file-card">
      <Icon name="file_archive" size={28} />
      <div class="file-card-name">{file.filename}</div>
      <div class="file-card-meta">
        <span>{file.label}</span>
        <span>{size === null ? '' : formatBytes(size)}</span>
      </div>
      <a class="btn btn--primary" href={file.href} download={file.filename}>
        <Icon name="download" />
        Download
      </a>
    </div>
  );
}

function Body({ file, content }: { file: RecoveryFile; content: Content }) {
  if (content.state === 'failed') return <PreviewFailed />;
  if (content.state === 'text') {
    return (
      <div class="preview-scroll">
        <pre class="preview-text">{content.text}</pre>
      </div>
    );
  }
  if (content.state === 'pdf') {
    return (
      <iframe
        class="preview-frame"
        src={`${content.url}#view=FitH&navpanes=0`}
        title={file.title}
      />
    );
  }
  if (content.state === 'archive') return <FileCard file={file} size={content.size} />;
  return null;
}

/** A recovery file in the right pane, like any record. Download is explicit, never a side effect of opening. */
export function FilePane({ route }: { route: FileRoute }) {
  const file = recoveryFile(route.key)!;
  const content = useRecoveryContent(file);
  const size =
    content.state === 'archive' && content.size !== null ? formatBytes(content.size) : '';
  return (
    <Frame
      titleKey={file.key}
      title={<h1 title={file.title}>{file.title}</h1>}
      meta={
        <div class="pane-meta">
          <span>{file.label}</span>
          <span class="pane-size">{size}</span>
        </div>
      }
      actions={() => <DownloadButton file={file} />}
      body={<Body file={file} content={content} />}
      onBack={() => navigate(VIEW_PATH[route.from ?? 'recovery'])}
    />
  );
}
