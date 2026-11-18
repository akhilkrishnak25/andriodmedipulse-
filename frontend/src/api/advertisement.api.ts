import { apiClient } from './client';
import { Advertisement, AdvertisementResponse } from '../types';

export const advertisementApi = {
  // Public
  getPublicPlatformAds: () =>
    apiClient<Advertisement[]>('/advertisements/platform'),

  getPublicHospitalAds: (hospitalId: string) =>
    apiClient<Advertisement[]>(`/advertisements/hospital/${hospitalId}`),

  getPublicLabAds: () =>
    apiClient<Advertisement[]>('/advertisements/labs'),

  getPublicLabAdsByLabId: (labId: string) =>
    apiClient<Advertisement[]>(`/advertisements/lab/${labId}`),

  // Shared Upload
  uploadImage: (fileData: string) =>
    apiClient<{ url: string; filename: string; mimeType: string; size: number }>(
      '/advertisements/upload',
      {
        method: 'POST',
        body: JSON.stringify({ fileData }),
      }
    ),

  // Super Admin Management
  getAdminPlatformAds: () =>
    apiClient<AdvertisementResponse>('/advertisements/admin/platform'),

  createAdminPlatformAd: (data: Partial<Advertisement>) =>
    apiClient<Advertisement>('/advertisements/admin/platform', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminPlatformAd: (id: string, data: Partial<Advertisement>) =>
    apiClient<Advertisement>(`/advertisements/admin/platform/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleAdminPlatformAdStatus: (id: string) =>
    apiClient<Advertisement>(`/advertisements/admin/platform/${id}/status`, {
      method: 'PATCH',
    }),

  deleteAdminPlatformAd: (id: string) =>
    apiClient<{ success: boolean; message: string }>(`/advertisements/admin/platform/${id}`, {
      method: 'DELETE',
    }),

  reorderAdminPlatformAds: (items: Array<{ id: string; displayOrder: number }>) =>
    apiClient<{ success: boolean; message: string }>('/advertisements/admin/platform/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Hospital Admin Management
  getAdminHospitalAds: () =>
    apiClient<AdvertisementResponse>('/advertisements/admin/hospital'),

  createAdminHospitalAd: (data: Partial<Advertisement>) =>
    apiClient<Advertisement>('/advertisements/admin/hospital', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminHospitalAd: (id: string, data: Partial<Advertisement>) =>
    apiClient<Advertisement>(`/advertisements/admin/hospital/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleAdminHospitalAdStatus: (id: string) =>
    apiClient<Advertisement>(`/advertisements/admin/hospital/${id}/status`, {
      method: 'PATCH',
    }),

  deleteAdminHospitalAd: (id: string) =>
    apiClient<{ success: boolean; message: string }>(`/advertisements/admin/hospital/${id}`, {
      method: 'DELETE',
    }),

  reorderAdminHospitalAds: (items: Array<{ id: string; displayOrder: number }>) =>
    apiClient<{ success: boolean; message: string }>('/advertisements/admin/hospital/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Lab Admin Management (Exactly 3 slots)
  getAdminLabAds: () =>
    apiClient<AdvertisementResponse>('/advertisements/admin/lab'),

  createAdminLabAd: (data: Partial<Advertisement>) =>
    apiClient<Advertisement>('/advertisements/admin/lab', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminLabAd: (id: string, data: Partial<Advertisement>) =>
    apiClient<Advertisement>(`/advertisements/admin/lab/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleAdminLabAdStatus: (id: string) =>
    apiClient<Advertisement>(`/advertisements/admin/lab/${id}/status`, {
      method: 'PATCH',
    }),

  deleteAdminLabAd: (id: string) =>
    apiClient<{ success: boolean; message: string }>(`/advertisements/admin/lab/${id}`, {
      method: 'DELETE',
    }),

  reorderAdminLabAds: (items: Array<{ id: string; displayOrder: number }>) =>
    apiClient<{ success: boolean; message: string }>('/advertisements/admin/lab/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Super Admin Oversight of Laboratory Advertisements
  getSuperAdminLabAds: () =>
    apiClient<{ advertisements: Advertisement[]; stats: { totalSlides: number; activeSlides: number; inactiveSlides: number } }>(
      '/advertisements/super-admin/labs'
    ),
};
