import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './platform';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      } else {
        reject(new Error('Failed to encode file data'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file data'));
    reader.readAsDataURL(blob);
  });
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function saveOrOpenBlob(
  blob: Blob,
  filename: string,
  options?: { openInNewTab?: boolean; shareTitle?: string }
): Promise<void> {
  const safeName = sanitizeFilename(filename || 'document.pdf');

  if (isNativeApp()) {
    const base64Data = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: safeName,
      data: base64Data,
      directory: Directory.Cache,
    });
    const { uri } = await Filesystem.getUri({
      path: safeName,
      directory: Directory.Cache,
    });

    try {
      await Share.share({
        title: options?.shareTitle || safeName,
        text: 'Rocket Wheel MediPulse Document',
        url: uri,
        dialogTitle: 'Open or Save Document',
      });
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (!msg.includes('cancel') && !msg.includes('dismiss')) {
        throw err;
      }
    }
    return;
  }

  const url = window.URL.createObjectURL(blob);
  if (options?.openInNewTab) {
    const win = window.open(url, '_blank');
    if (win) {
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      return;
    }
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
}
