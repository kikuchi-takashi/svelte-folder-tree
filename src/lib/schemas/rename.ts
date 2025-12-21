import * as v from 'valibot';

export const renameSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, 'ファイル名を入力してください'),
    v.maxLength(255, 'ファイル名が長すぎます'),
    v.check((name) => !name.includes('/'), 'ファイル名に / は使用できません'),
    v.check((name) => !name.includes('\\'), 'ファイル名に \\ は使用できません')
  ),
});

export type RenameSchema = typeof renameSchema;
