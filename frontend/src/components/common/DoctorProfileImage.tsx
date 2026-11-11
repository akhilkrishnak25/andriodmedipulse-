import React, { useState } from 'react';
import { getMediaUrl } from '../../api/client';

export interface DoctorProfileImageProps {
  photoUrl?: string | null;
  name?: string;
  className?: string;
  blankClassName?: string;
}

/**
 * Checks if the given photoUrl is a genuine uploaded image rather than a
 * stock/random/external automatic fallback.
 */
export const isUploadedDoctorImage = (photoUrl?: string | null): boolean => {
  if (!photoUrl || typeof photoUrl !== 'string') return false;
  const trimmed = photoUrl.trim();
  if (!trimmed) return false;
  // External stock / auto-generated avatars are strictly barred
  if (
    trimmed.includes('unsplash.com') ||
    trimmed.includes('dicebear.com') ||
    trimmed.includes('pravatar.cc') ||
    trimmed.includes('ui-avatars.com') ||
    trimmed.includes('placeholder')
  ) {
    return false;
  }
  return true;
};

/**
 * Doctor Profile Image display following MedPulse strict display rules:
 * - Never display random, stock, or automatically generated images.
 * - If uploaded image exists, display it.
 * - If not uploaded or removed, display a blank profile image area.
 * - Do not use external image URLs or default doctor avatars.
 * - Preserves existing layout and dimensions unchanged.
 */
export const DoctorProfileImage: React.FC<DoctorProfileImageProps> = ({
  photoUrl,
  name,
  className = 'w-16 h-16 rounded-2xl shrink-0',
  blankClassName,
}) => {
  const [hasError, setHasError] = useState(false);

  const isValidUploaded = isUploadedDoctorImage(photoUrl) && !hasError;

  if (isValidUploaded && photoUrl) {
    return (
      <img
        src={getMediaUrl(photoUrl)}
        alt={name || 'Doctor Profile'}
        className={`${className} object-cover`}
        onError={() => setHasError(true)}
      />
    );
  }

  // Display a blank profile image area preserving dimensions and layout
  return (
    <div
      className={`${className} ${blankClassName || 'bg-slate-100 border border-slate-200'} shrink-0`}
      aria-label="Doctor profile (no photo uploaded)"
      role="img"
    />
  );
};
