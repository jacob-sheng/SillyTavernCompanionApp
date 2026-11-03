import { Image, type ImageProps } from 'react-native';
import { useConnection } from '@/stores/connectionStore';

/** Shared authenticated source for avatars, attachments, markdown and full-screen previews. */
export function ServerImage({ uri, ...props }: Omit<ImageProps, 'source'> & { uri: string }) {
  const client = useConnection((s) => s.client);
  return <Image {...props} source={client?.imageSource(uri) ?? { uri }} />;
}
