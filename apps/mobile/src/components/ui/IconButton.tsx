import { PressableScale } from './animated';
import { Icon, type IconName } from '@/theme/icons';
import { hitSlop, iconSize } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useThemeColors';
import { haptics } from '@/theme/haptics';

export interface IconButtonProps {
  name: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: keyof typeof iconSize;
  color?: string;
  /** Highlights the icon in the accent color (e.g. an active toggle). */
  active?: boolean;
  /** Filled circular surface behind the icon. */
  surface?: boolean;
  disabled?: boolean;
  haptic?: boolean;
}

/** Icon-only control with a guaranteed 44pt touch target and required a11y label. */
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = 'md',
  color,
  active = false,
  surface = false,
  disabled = false,
  haptic = true,
}: IconButtonProps) {
  const colors = useThemeColors();
  return (
    <PressableScale
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={hitSlop}
      disabled={disabled}
      onPress={() => {
        if (haptic) haptics.selection();
        onPress?.();
      }}
      className={`h-11 w-11 items-center justify-center rounded-full ${surface ? 'bg-surface-2 active:bg-surface-3' : 'active:bg-surface-2'} ${disabled ? 'opacity-30' : ''}`}
    >
      <Icon name={name} size={iconSize[size]} color={active ? colors.accent : color ?? colors.textMuted} />
    </PressableScale>
  );
}
