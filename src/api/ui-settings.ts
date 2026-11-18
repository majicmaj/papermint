import { getJson, postJson } from './http';

/** Tag id (as text) to the name of a Lucide icon. */
export type TagIcons = Record<string, string>;

type Settings = Record<string, unknown>;

interface UiSettingsResponse {
  settings: Settings | null;
}

function iconsOf(settings: Settings | null): TagIcons {
  const majin = settings?.['majin'];
  const icons = majin && typeof majin === 'object' ? (majin as Settings)['tagIcons'] : null;
  if (!icons || typeof icons !== 'object') return {};
  return Object.fromEntries(
    Object.entries(icons).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export async function fetchTagIcons(): Promise<TagIcons> {
  return iconsOf((await getJson<UiSettingsResponse>('/api/ui_settings/')).settings);
}

/** The lock every tab takes around a change to the settings. */
export const SETTINGS_LOCK = 'majin-ui-settings';

/** Run one read-modify-write with no other tab in the middle of its own. */
function exclusive<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? locks.request(SETTINGS_LOCK, run) : run();
}

/**
 * Paperless replaces the whole settings object on POST. So the write reads the current
 * settings first, changes only settings.majin.tagIcons[id], and sends everything back.
 * The read is the server's answer now (never a cached copy), and the read and the write
 * happen under one lock shared by every tab, so two tabs saving two icons keep both.
 * Within a tab, calls also run one after the other.
 */
let chain: Promise<unknown> = Promise.resolve();

export function saveTagIcon(tagId: number, icon: string | null): Promise<TagIcons> {
  const run = async (): Promise<TagIcons> => {
    const current = (await getJson<UiSettingsResponse>('/api/ui_settings/')).settings ?? {};
    const majin = (current['majin'] as Settings | undefined) ?? {};
    const icons = { ...iconsOf(current) };
    if (icon) icons[String(tagId)] = icon;
    else delete icons[String(tagId)];
    await postJson('/api/ui_settings/', {
      settings: { ...current, majin: { ...majin, tagIcons: icons } },
    });
    return icons;
  };
  const locked = () => exclusive(run);
  const next = chain.then(locked, locked);
  chain = next.catch(() => undefined);
  return next;
}
