import React, { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';

/** Largest stored photo (a data URL); the server enforces the same limit. */
export const MAX_AVATAR_CHARS = 300_000;
const SIZE = 256;

/** Reads an image file, crops it to a centred square and returns a small JPEG data URL. */
export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That photo is too large (max 15 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file couldn't be opened as a photo."));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    for (const quality of [0.85, 0.7, 0.55]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= MAX_AVATAR_CHARS) return data;
    }
    throw new Error('That photo could not be made small enough. Try another one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The profile picture with "Change photo" / "Remove" controls. */
export const ProfilePhoto: React.FC<{ name: string; avatar?: string; onChange: (avatar: string | undefined) => void }> = ({
  name,
  avatar,
  onChange,
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still fires
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await toAvatarDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-emerald-800 text-white border-2 border-emerald-600 flex items-center justify-center text-3xl font-semibold">
          {avatar ? (
            <img src={avatar} alt={`${name}'s profile photo`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={avatar ? 'Change profile photo' : 'Add profile photo'}
          title={avatar ? 'Change photo' : 'Add photo'}
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#3E6553] hover:bg-[#2D4C3C] text-white border-2 border-white flex items-center justify-center shadow-sm disabled:opacity-60"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="hidden" aria-hidden="true" tabIndex={-1} />
      </div>
      {avatar && (
        <button type="button" onClick={() => onChange(undefined)} className="text-[11px] text-slate-500 hover:text-red-600 inline-flex items-center gap-1">
          <Trash2 className="w-3 h-3" aria-hidden="true" /> Remove
        </button>
      )}
      {busy && <p className="text-[11px] text-slate-500" role="status">Uploading…</p>}
      {error && (
        <p role="alert" className="text-[11px] text-red-600 max-w-[10rem] text-center">
          {error}
        </p>
      )}
    </div>
  );
};
