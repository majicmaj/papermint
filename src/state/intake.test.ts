import { describe, expect, it, vi } from 'vitest';
import type { Tag } from '../api/types';
import { buildTagModel } from '../domain/tags';
import { fileIntake, fileNameToTitle, intakeTags, type IntakeForm } from './intake';

const tag = (id: number, name: string, parent: number | null = null): Tag => ({
  id,
  name,
  parent,
  slug: name.toLowerCase(),
  color: 'x',
});
// Areas LLC (1) and Personal (2). Topics Tax (6) and Finance (8) under LLC, Health (10) under Personal.
const model = buildTagModel(
  [
    tag(5, 'Signed'),
    tag(9, 'Superseded'),
    tag(13, 'Current'),
    tag(1, 'LLC'),
    tag(2, 'Personal'),
    tag(6, 'Tax', 1),
    tag(8, 'Finance', 1),
    tag(10, 'Health', 2),
  ],
  [],
);
const form = (patch: Partial<IntakeForm> = {}): IntakeForm => ({
  title: 'x',
  statusId: 13,
  areaIds: [1],
  topicIds: [],
  targetId: null,
  ...patch,
});

function deps() {
  return { patch: vi.fn(async () => undefined), merge: vi.fn(async () => undefined) };
}

describe('intake', () => {
  it('prefills the title from the file name', () => {
    expect(fileNameToTitle('Operating agreement v2.pdf')).toBe('Operating agreement v2');
    expect(fileNameToTitle('archive.tar.gz')).toBe('archive.tar');
    expect(fileNameToTitle('.env')).toBe('.env');
  });

  it('replaces the status and writes the chosen area with its topics', () => {
    const tags = intakeTags([9], form({ topicIds: [6, 8] }), model);
    expect([...tags].sort((x, y) => x - y)).toEqual([1, 6, 8, 13]);
  });

  it('allows several areas and drops topics outside the chosen areas', () => {
    const tags = intakeTags([9], form({ areaIds: [1, 2], topicIds: [6, 10] }), model);
    expect([...tags].sort((x, y) => x - y)).toEqual([1, 2, 6, 10, 13]);
    const narrow = intakeTags([9], form({ areaIds: [2], topicIds: [6, 10] }), model);
    expect([...narrow].sort((x, y) => x - y)).toEqual([2, 10, 13]);
  });

  it('replaces areas and topics that the file already had', () => {
    const tags = intakeTags([9, 2, 10], form({ areaIds: [1], topicIds: [6] }), model);
    expect([...tags].sort((x, y) => x - y)).toEqual([1, 6, 13]);
  });

  it('keeps tags that are neither status, area nor topic', () => {
    expect(intakeTags([9, 5], form({ statusId: null }), model)).toEqual([9, 5, 1]);
  });

  it('files without a target: one PATCH with title and tags, no merge', async () => {
    const d = deps();
    const result = await fileIntake(
      101,
      [9],
      form({ title: '  Tax form  ', statusId: 9, topicIds: [6] }),
      model,
      d,
    );
    expect(result).toEqual({ kind: 'filed' });
    expect(d.merge).not.toHaveBeenCalled();
    expect(d.patch).toHaveBeenCalledWith(101, { title: 'Tax form', tags: [9, 1, 6] });
  });

  it('merges into the chosen record as a new version and writes nothing else', async () => {
    const d = deps();
    const result = await fileIntake(
      101,
      [9],
      form({ title: 'Signed copy', statusId: 5, topicIds: [6], targetId: 13 }),
      model,
      d,
    );
    expect(result).toEqual({ kind: 'merged', rootId: 13 });
    expect(d.merge).toHaveBeenCalledTimes(1);
    expect(d.merge).toHaveBeenCalledWith(13, 101, 'Signed copy');
    expect(d.patch).not.toHaveBeenCalled();
  });

  it('never merges a document into itself', async () => {
    const d = deps();
    await fileIntake(
      101,
      [9],
      form({ title: '', statusId: null, areaIds: [], targetId: 101 }),
      model,
      d,
    );
    expect(d.merge).not.toHaveBeenCalled();
    expect(d.patch).toHaveBeenCalledWith(101, { tags: [9] });
  });

  it('passes a merge failure to the caller', async () => {
    const d = deps();
    d.merge.mockRejectedValueOnce(new Error('400'));
    await expect(
      fileIntake(101, [9], form({ title: 't', statusId: 9, targetId: 13 }), model, d),
    ).rejects.toThrow('400');
  });
});
