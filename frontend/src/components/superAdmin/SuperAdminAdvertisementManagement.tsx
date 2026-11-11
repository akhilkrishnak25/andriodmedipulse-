import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Image,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Check,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  Upload,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { advertisementApi } from '../../api/advertisement.api';
import { getMediaUrl } from '../../api/client';
import { Advertisement } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { AdvertisementCarousel } from '../common/AdvertisementCarousel';

export const SuperAdminAdvertisementManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [replacingAd, setReplacingAd] = useState<Advertisement | null>(null);
  const [deletingAd, setDeletingAd] = useState<Advertisement | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Form State for Create / Edit
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Query Platform Advertisements & Stats
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-platform-advertisements'],
    queryFn: () => advertisementApi.getAdminPlatformAds(),
  });

  const advertisements = data?.advertisements || [];
  const stats = data?.stats || {
    totalSlides: 0,
    activeSlides: 0,
    inactiveSlides: 0,
    remainingSlots: 8,
    maxSlots: 8,
  };

  const isLimitReached = stats.totalSlides >= 8;

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (newAd: Partial<Advertisement>) =>
      advertisementApi.createAdminPlatformAd(newAd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'platform'] });
      toast.success('Platform advertisement slide uploaded successfully!');
      closeCreateModal();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create advertisement');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Advertisement> }) =>
      advertisementApi.updateAdminPlatformAd(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'platform'] });
      toast.success('Advertisement slide updated successfully!');
      setEditingAd(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update advertisement');
    },
  });

  // Toggle Status Mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => advertisementApi.toggleAdminPlatformAdStatus(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'platform'] });
      toast.success(`Advertisement marked as ${updated.isActive ? 'active' : 'inactive'}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update advertisement status');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => advertisementApi.deleteAdminPlatformAd(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'platform'] });
      toast.success('Advertisement deleted. Slot is now free for new uploads.');
      setDeletingAd(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete advertisement');
    },
  });

  // Reorder Mutation
  const reorderMutation = useMutation({
    mutationFn: (items: Array<{ id: string; displayOrder: number }>) =>
      advertisementApi.reorderAdminPlatformAds(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'platform'] });
      toast.success('Slide order updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reorder advertisements');
    },
  });

  // Open Create Modal
  const openCreateModal = () => {
    if (isLimitReached) {
      toast.error('Maximum limit of 8 advertisement slides reached. Please delete an existing slide to upload a new one.');
      return;
    }
    setTitle('');
    setDescription('');
    setRedirectUrl('');
    setDisplayOrder(advertisements.length);
    setIsActive(true);
    setImagePreview('');
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setImagePreview('');
  };

  // Open Edit Modal
  const openEditModal = (ad: Advertisement) => {
    setEditingAd(ad);
    setTitle(ad.title);
    setDescription(ad.description || '');
    setRedirectUrl(ad.redirectUrl || '');
    setDisplayOrder(ad.displayOrder);
    setIsActive(ad.isActive);
    setImagePreview(ad.imageUrl);
  };

  // Handle File Input Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isReplacing = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type: JPG, JPEG, PNG, WebP
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate size: 8MB max
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image file size must not exceed 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setIsUploadingImage(true);
      try {
        const uploadRes = await advertisementApi.uploadImage(base64Data);
        setImagePreview(uploadRes.url);

        if (isReplacing && replacingAd) {
          // Immediately update slide image
          await updateMutation.mutateAsync({
            id: replacingAd.id,
            data: { imageUrl: uploadRes.url },
          });
          toast.success('Advertisement image replaced successfully!');
          setReplacingAd(null);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload image');
      } finally {
        setIsUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Create Form
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter an advertisement title.');
      return;
    }
    if (!imagePreview) {
      toast.error('Please upload an advertisement image.');
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      imageUrl: imagePreview,
      redirectUrl: redirectUrl.trim() || undefined,
      displayOrder: Number(displayOrder),
      isActive,
    });
  };

  // Submit Edit Form
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;
    if (!title.trim()) {
      toast.error('Please enter an advertisement title.');
      return;
    }
    if (!imagePreview) {
      toast.error('Please provide an advertisement image.');
      return;
    }

    updateMutation.mutate({
      id: editingAd.id,
      data: {
        title: title.trim(),
        description: description.trim() || null,
        imageUrl: imagePreview,
        redirectUrl: redirectUrl.trim() || null,
        displayOrder: Number(displayOrder),
        isActive,
      },
    });
  };

  // Move slide up or down in order
  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= advertisements.length) return;

    const list = [...advertisements];
    const current = list[index];
    const neighbor = list[targetIndex];

    const currentOrder = current.displayOrder;
    const neighborOrder = neighbor.displayOrder;

    const itemsToUpdate = [
      { id: current.id, displayOrder: neighborOrder },
      { id: neighbor.id, displayOrder: currentOrder },
    ];

    reorderMutation.mutate(itemsToUpdate);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-royal-50 text-royal-600">
              <Layers className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Platform Advertisement Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Configure up to <strong className="text-slate-800">8 platform-wide advertisement slides</strong> displayed on the MedPulse homepage banner carousel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={openCreateModal}
            disabled={isLimitReached}
            className={`flex items-center gap-1.5 font-bold text-xs shadow-md ${
              isLimitReached
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-royal-600 hover:bg-royal-700 text-white'
            }`}
            title={
              isLimitReached
                ? 'Maximum 8 slides reached. Delete an existing slide to upload a new one.'
                : 'Upload new advertisement slide'
            }
          >
            <Plus className="w-4 h-4" />
            Upload Slide ({stats.remainingSlots} left)
          </Button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Slides
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {stats.totalSlides}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 8 max</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-royal-600 flex items-center justify-center font-bold">
              <Image className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Slides
              </p>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                {stats.activeSlides}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Inactive Slides
              </p>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">
                {stats.inactiveSlides}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <EyeOff className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Remaining Slots
              </p>
              <div
                className={`text-2xl sm:text-3xl font-black mt-1 ${
                  stats.remainingSlots === 0 ? 'text-rose-600' : 'text-royal-600'
                }`}
              >
                {stats.remainingSlots}
              </div>
            </div>
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
                stats.remainingSlots === 0
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LIMIT NOTICE WARNING */}
      {isLimitReached && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <strong className="font-bold">Maximum limit of 8 advertisement slides reached.</strong>
            <span className="ml-1 text-rose-700">
              To upload a new advertisement slide, you must first delete an existing slide. Toggling status or editing existing slides does not free up a slot.
            </span>
          </div>
        </div>
      )}

      {/* LIVE HOMEPAGE PREVIEW SECTION */}
      {advertisements.some((ad) => ad.isActive) && (
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/80 border-b border-slate-200 py-3 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-royal-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                Live Homepage Carousel Preview (Active Slides Only)
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLivePreview(!showLivePreview)}
              className="text-xs py-1 h-7"
            >
              {showLivePreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </CardHeader>
          {showLivePreview && (
            <CardContent className="p-4 sm:p-6 bg-slate-900/90">
              <div className="max-w-5xl mx-auto">
                <AdvertisementCarousel
                  advertisements={advertisements.filter((ad) => ad.isActive)}
                  autoSlideInterval={4000}
                />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ADVERTISEMENTS LIST & MANAGEMENT TABLE */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Configured Platform Slides</span>
            <Badge variant="outline" className="font-semibold text-xs">
              {advertisements.length} / 8 Slides
            </Badge>
          </CardTitle>
          <span className="text-xs text-slate-400">
            Order determines display priority on the homepage
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-royal-600" />
              Loading advertisements...
            </div>
          ) : advertisements.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Image className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Advertisements Uploaded Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Upload your first platform advertisement banner slide. It will appear on the homepage banner carousel.
              </p>
              <Button
                size="sm"
                onClick={openCreateModal}
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold text-xs shadow-md mt-2"
              >
                <Plus className="w-4 h-4 mr-1" /> Upload First Slide
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">Order</th>
                    <th className="py-3 px-4 w-40">Preview</th>
                    <th className="py-3 px-4">Title & Details</th>
                    <th className="py-3 px-4 w-44">Destination Link</th>
                    <th className="py-3 px-4 w-28 text-center">Status</th>
                    <th className="py-3 px-4 w-52 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {advertisements.map((ad, idx) => (
                    <tr
                      key={ad.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !ad.isActive ? 'bg-slate-50/40 text-slate-400' : ''
                      }`}
                    >
                      {/* Order and Reorder Buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveOrder(idx, 'up')}
                            disabled={idx === 0 || reorderMutation.isPending}
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-200 rounded transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-extrabold text-slate-700 text-xs px-1">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMoveOrder(idx, 'down')}
                            disabled={
                              idx === advertisements.length - 1 || reorderMutation.isPending
                            }
                            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-200 rounded transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Preview Image */}
                      <td className="py-3 px-4">
                        <div className="relative w-36 aspect-[16/7] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm group">
                          <img
                            src={getMediaUrl(ad.imageUrl)}
                            alt={ad.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setReplacingAd(ad);
                              const fileInput = document.getElementById('replace-file-input');
                              fileInput?.click();
                            }}
                            className="absolute inset-0 bg-slate-950/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold"
                            title="Click to replace image"
                          >
                            <Upload className="w-3.5 h-3.5 mb-0.5" />
                            Replace
                          </button>
                        </div>
                      </td>

                      {/* Title & Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {ad.title}
                        </div>
                        {ad.description ? (
                          <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 max-w-md">
                            {ad.description}
                          </p>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No description</span>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>Display Order: {ad.displayOrder}</span>
                          <span>•</span>
                          <span>Added {new Date(ad.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>

                      {/* Destination Link */}
                      <td className="py-3 px-4">
                        {ad.redirectUrl ? (
                          <a
                            href={ad.redirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-royal-600 hover:text-royal-700 font-semibold text-xs hover:underline break-all max-w-[170px]"
                            title={ad.redirectUrl}
                          >
                            <span className="truncate">{ad.redirectUrl}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs italic">None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleMutation.mutate(ad.id)}
                          disabled={toggleMutation.isPending}
                          className="focus:outline-none"
                          title="Click to toggle status"
                        >
                          {ad.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Inactive
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active / Inactive */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMutation.mutate(ad.id)}
                            disabled={toggleMutation.isPending}
                            className="h-8 px-2 text-xs"
                            title={ad.isActive ? 'Deactivate slide' : 'Activate slide'}
                          >
                            {ad.isActive ? (
                              <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </Button>

                          {/* Edit Details */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(ad)}
                            className="h-8 px-2 text-xs text-slate-700 hover:text-royal-600"
                            title="Edit details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingAd(ad)}
                            className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                            title="Delete slide"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HIDDEN FILE INPUT FOR IMAGE REPLACEMENT */}
      <input
        type="file"
        id="replace-file-input"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFileChange(e, true)}
      />

      {/* UPLOAD / CREATE MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Upload Platform Advertisement Slide"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {/* Remaining upload slots indicator */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-royal-800 flex items-center justify-between">
            <span className="font-semibold">Platform Slot Allowance:</span>
            <span className="font-black">
              {stats.totalSlides} of 8 used ({stats.remainingSlots} available)
            </span>
          </div>

          {/* Image Upload Area */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Advertisement Image <span className="text-rose-500">*</span>
              <span className="font-normal text-slate-400 ml-1">
                (JPG, JPEG, PNG, WebP up to 8MB)
              </span>
            </label>

            {imagePreview ? (
              <div className="relative w-full aspect-[21/8] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                <img
                  src={getMediaUrl(imagePreview)}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview('')}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-[21/8] min-h-[140px] border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-royal-500 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="font-semibold text-slate-700 text-xs">
                    {isUploadingImage ? 'Uploading image...' : 'Click to select advertisement banner image'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Recommended resolution: 1920×640 or 1200×400 (aspect ratio approx 3:1)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, false)}
                  disabled={isUploadingImage}
                />
              </label>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Advertisement Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Free Full Body Health Checkup Camp This Sunday"
              required
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Avail comprehensive cardiology & diabetes screenings with top consultants across our accredited network."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
            />
          </div>

          {/* Redirect URL */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Destination / Redirect URL <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="e.g. /hospitals or https://healthcamp.org"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
            />
          </div>

          {/* Display Order & Active Status */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-royal-600 rounded border-slate-300 focus:ring-royal-500"
                />
                <span className="font-semibold text-slate-800">
                  Active (Display immediately)
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              className="bg-royal-600 hover:bg-royal-700 text-white font-bold"
              isLoading={createMutation.isPending || isUploadingImage}
            >
              Upload Slide
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      {editingAd && (
        <Modal
          isOpen={!!editingAd}
          onClose={() => setEditingAd(null)}
          title="Edit Platform Advertisement Slide"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            {/* Image Preview & Replace */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Banner Image
              </label>
              <div className="relative w-full aspect-[21/8] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                <img
                  src={getMediaUrl(imagePreview)}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
                <label className="absolute inset-0 bg-slate-950/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-semibold text-xs">
                  <Upload className="w-5 h-5 mb-1" />
                  Click to replace image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, false)}
                  />
                </label>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Advertisement Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Description <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            {/* Redirect URL */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Destination / Redirect URL <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="e.g. /hospitals or https://example.com"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
              />
            </div>

            {/* Display Order & Active Status */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  min={0}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-royal-500 bg-white"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-royal-600 rounded border-slate-300 focus:ring-royal-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Active (Display immediately)
                  </span>
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="outline" size="sm" type="button" onClick={() => setEditingAd(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold"
                isLoading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingAd && (
        <Modal
          isOpen={!!deletingAd}
          onClose={() => setDeletingAd(null)}
          title="Delete Advertisement Slide"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to delete the advertisement slide{' '}
              <strong className="text-slate-900 font-bold">"{deletingAd.title}"</strong>?
            </p>
            <p className="text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              ✓ Deleting this slide will free up 1 slot, allowing you to upload another slide (up to the maximum of 8).
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setDeletingAd(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={() => deleteMutation.mutate(deletingAd.id)}
                isLoading={deleteMutation.isPending}
              >
                Delete Slide
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
