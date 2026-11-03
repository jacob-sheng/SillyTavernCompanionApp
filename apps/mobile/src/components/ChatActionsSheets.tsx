import { useTranslation } from 'react-i18next';
import { Sheet, SheetActionRow } from '@/components/ui';
import { useTavern } from '@/stores/tavernStore';
export interface ChatTarget { avatar: string; file: string }
/** Mutations belong to Tavern so its active chat, plugins and metadata stay synchronized. */
export function ChatActionsSheets({ target, onClose }: { target: ChatTarget | null; onClose: () => void }) {
  const { t } = useTranslation();
  const open = (manage: boolean) => {
    if (!target) return;
    useTavern.getState().open({ kind: 'character', avatar: target.avatar, file: target.file.replace(/\.jsonl$/i, ''), action: manage ? 'manage' : 'continue' });
    onClose();
  };
  return <Sheet visible={target !== null} onClose={onClose}>
    <SheetActionRow icon="chats" label={t('character.open')} onPress={() => open(false)} />
    <SheetActionRow icon="edit" label={t('tavern.manageChat')} onPress={() => open(true)} />
  </Sheet>;
}
