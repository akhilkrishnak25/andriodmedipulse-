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
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  Upload,
  CheckCircle2,
  Megaphone,
  X,
  Sparkles,
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

export const LabAdvertisementManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [replacingAd, setReplacingAd] = useState<Advertisement | null>(null);
  const [deletingAd, setDeletingAd] = useState<Advertisement | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Query Laboratory Advertisements & Stats
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-lab-advertisements'],
    queryFn: () => advertisementApi.getAdminLabAds(),
  });

  const advertisements = data?.advertisements || [];
  const stats = data?.stats || {
    totalSlides: 0,
    activeSlides: 0,
    inactiveSlides: 0,
    remainingSlots: 3,
    maxSlots: 3,
  };

  const isLimitReached = stats.totalSlides >= 3;

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (newAd: Partial<Advertisement>) =>
      advertisementApi.createAdminLabAd(newAd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lab-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'labs'] });
      toast.success('Laboratory advertisement slide created successfully!');
      closeCreateModal();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create advertisement');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Advertisement> }) =>
      advertisementApi.updateAdminLabAd(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lab-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'labs'] });
      toast.success('Advertisement updated successfully!');
      setEditingAd(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update advertisement');
    },
  });

  // Toggle Status Mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => advertisementApi.toggleAdminLabAdStatus(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin-lab-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'labs'] });
      toast.success(`Advertisement marked as ${updated.isActive ? 'active' : 'inactive'}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update advertisement status');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => advertisementApi.deleteAdminLabAd(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lab-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'labs'] });
      toast.success('Advertisement deleted. Slide slot is now available for new upload.');
      setDeletingAd(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete advertisement');
    },
  });

  // Reorder Mutation
  const reorderMutation = useMutation({
    mutationFn: (items: Array<{ id: string; displayOrder: number }>) =>
      advertisementApi.reorderAdminLabAds(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lab-advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisements', 'labs'] });
      toast.success('Advertisement slide order updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reorder advertisements');
    },
  });

  // Open Create Modal
  const openCreateModal = () => {
    if (isLimitReached) {
      toast.error('Maximum limit of 3 advertisement slides reached. Please delete an existing slide to upload a new one.');
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

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG, and WebP images are allowed.');
      return;
    }

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
      description: description.trim() || null,
      imageUrl: imagePreview,
      redirectUrl: redirectUrl.trim() || null,
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

  // Move slide up or down
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-purple-50 text-purple-600">
              <Megaphone className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Laboratory Advertisement Slides
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl">
                Manage exactly <strong className="text-purple-700">3 promotional slide slots</strong> featured on the MedPulse Home Page and laboratory promotion carousels.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={openCreateModal}
            disabled={isLimitReached}
            className={`flex items-center gap-1.5 font-bold text-xs shadow-md rounded-xl ${
              isLimitReached
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
            title={
              isLimitReached
                ? 'Maximum 3 slides reached. Delete an existing slide to upload a new one.'
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
        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Slides
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {stats.totalSlides}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 3 max</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Image className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
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

        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Disabled Slides
              </p>
              <div className="text-2xl sm:text-3xl font-black text-slate-600 mt-1">
                {stats.inactiveSlides}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <EyeOff className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Available Slots
              </p>
              <div className="text-2xl sm:text-3xl font-black text-purple-600 mt-1">
                {stats.remainingSlots}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              {stats.remainingSlots}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3 SLOTS SYSTEM STATUS BANNER */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-purple-200 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">Dedicated 3-Slide Lab Promotion Slots</h3>
            <p className="text-xs text-purple-200/90 mt-0.5">
              Each laboratory is allocated exactly 3 promotional banner slots. Active slides rotate dynamically on the MedPulse homepage.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {[1, 2, 3].map((slotNumber) => {
            const hasSlide = slotNumber <= advertisements.length;
            const slide = advertisements[slotNumber - 1];
            return (
              <div
                key={slotNumber}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                  hasSlide
                    ? slide?.isActive
                      ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                    : 'bg-white/10 border-white/20 text-purple-200'
                }`}
              >
                <span>Slot {slotNumber}</span>
                {hasSlide ? (
                  slide?.isActive ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )
                ) : (
                  <span className="text-[10px] text-purple-300/70">Empty</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LIVE CAROUSEL PREVIEW (Active Slides) */}
      {advertisements.some((a) => a.isActive) && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base font-black text-slate-900">
                Live Visitor Carousel Preview
              </h2>
              <Badge variant="purple" className="text-[10px]">
                {advertisements.filter((a) => a.isActive).length} Active Slide(s)
              </Badge>
            </div>
            <button
              onClick={() => setShowLivePreview(!showLivePreview)}
              className="text-xs font-bold text-purple-600 hover:text-purple-700"
            >
              {showLivePreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          {showLivePreview && (
            <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 p-2">
              <AdvertisementCarousel
                advertisements={advertisements.filter((a) => a.isActive)}
                autoSlideInterval={4500}
              />
            </div>
          )}
        </div>
      )}

      {/* 3 SLOTS GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Configured Advertisement Slides</span>
            <span className="text-xs font-normal text-slate-500">
              ({advertisements.length} of 3 slots used)
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((index) => {
              const ad = advertisements[index];
              const slotNumber = index + 1;

              if (ad) {
                return (
                  <Card
                    key={ad.id}
                    className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between bg-white rounded-2xl group"
                  >
                    <div>
                      {/* SLIDE IMAGE PREVIEW */}
                      <div className="relative aspect-[16/9] w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                        <img
                          src={getMediaUrl(ad.imageUrl)}
                          alt={ad.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://placehold.co/800x450/4f46e5/ffffff?text=Advertisement+Image';
                          }}
                        />

                        {/* SLOT & STATUS BADGES */}
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900/80 text-white backdrop-blur-sm">
                            Slot {slotNumber}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-sm ${
                              ad.isActive
                                ? 'bg-emerald-500/90 text-white shadow-sm'
                                : 'bg-slate-700/80 text-slate-200'
                            }`}
                          >
                            {ad.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>

                        {/* QUICK ACTION BUTTONS OVERLAY */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 hover:opacity-100">
                          <button
                            type="button"
                            title="Replace Image"
                            onClick={() => {
                              setReplacingAd(ad);
                              document.getElementById(`replace-file-input-${ad.id}`)?.click();
                            }}
                            className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-sm text-xs backdrop-blur-sm"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="file"
                            id={`replace-file-input-${ad.id}`}
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => handleFileChange(e, true)}
                          />
                        </div>
                      </div>

                      {/* CONTENT BODY */}
                      <div className="p-4 sm:p-5 space-y-2.5">
                        <h3 className="font-bold text-slate-900 text-sm line-clamp-1">
                          {ad.title}
                        </h3>
                        {ad.description ? (
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {ad.description}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No description provided</p>
                        )}

                        {ad.redirectUrl ? (
                          <div className="flex items-center gap-1 text-[11px] text-purple-600 truncate font-mono pt-1">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{ad.redirectUrl}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 pt-1">No redirect URL configured</div>
                        )}
                      </div>
                    </div>

                    {/* CARD FOOTER ACTIONS */}
                    <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        {/* REORDER BUTTONS */}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveOrder(index, 'up')}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Slide Earlier"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === advertisements.length - 1}
                          onClick={() => handleMoveOrder(index, 'down')}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move Slide Later"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* TOGGLE ACTIVE */}
                        <button
                          type="button"
                          onClick={() => toggleMutation.mutate(ad.id)}
                          className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 ml-1 ${
                            ad.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                          title={ad.isActive ? 'Disable Slide' : 'Enable Slide'}
                        >
                          {ad.isActive ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Active</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Disabled</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(ad)}
                          className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-50 border-slate-200"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingAd(ad)}
                          className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              }

              {/* EMPTY SLOT PLACEHOLDER */}
              return (
                <div
                  key={`empty-slot-${slotNumber}`}
                  className="rounded-2xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-purple-50/30 hover:border-purple-300 transition-all min-h-[300px] space-y-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Slot {slotNumber} is Empty
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Upload an advertisement image to publish slide #{slotNumber}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={openCreateModal}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Configure Slot {slotNumber}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={closeCreateModal}
          title={`Upload Advertisement Slide (${advertisements.length + 1} of 3)`}
          maxWidth="lg"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-5">
            {/* IMAGE UPLOAD & PREVIEW */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Advertisement Image <span className="text-rose-500">*</span>
              </label>

              {imagePreview ? (
                <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group">
                  <img
                    src={getMediaUrl(imagePreview)}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('create-file-input')?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-bold text-xs shadow-md flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Change Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setImagePreview('')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById('create-file-input')?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-purple-50/30 flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    Click to browse and upload slide image
                  </p>
                  <p className="text-[11px] text-slate-400">
                    JPG, PNG, or WebP up to 8MB. Recommended aspect ratio: 16:9
                  </p>
                </div>
              )}

              <input
                type="file"
                id="create-file-input"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e, false)}
              />
            </div>

            {/* TITLE */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Slide Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Complete Health Checkup 30% Off"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief summary of offer, discount code, or diagnostic package details"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* REDIRECT URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Redirect Link (Optional)
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="e.g., /lab-tests?labId=... or https://example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Visitors who click this slide will be navigated to this URL.
              </p>
            </div>

            {/* ACTIVE STATUS TOGGLE */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Publish Slide Immediately
                </span>
                <span className="text-[11px] text-slate-500">
                  Slide will be live in the home page carousel right after saving.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            {/* MODAL ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeCreateModal}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || isUploadingImage || !imagePreview}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                {createMutation.isPending ? 'Publishing...' : 'Save & Publish Slide'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {editingAd && (
        <Modal
          isOpen={Boolean(editingAd)}
          onClose={() => setEditingAd(null)}
          title={`Edit Advertisement Slide`}
          maxWidth="lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-5">
            {/* IMAGE PREVIEW & REPLACE */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Advertisement Image <span className="text-rose-500">*</span>
              </label>

              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group">
                <img
                  src={getMediaUrl(imagePreview)}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById('edit-file-input')?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-bold text-xs shadow-md flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Replace Image
                  </button>
                </div>
              </div>

              <input
                type="file"
                id="edit-file-input"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e, false)}
              />
            </div>

            {/* TITLE */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Slide Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* REDIRECT URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Redirect Link (Optional)
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* ACTIVE STATUS TOGGLE */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Active Status
                </span>
                <span className="text-[11px] text-slate-500">
                  When enabled, this slide appears in public carousels.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            {/* MODAL ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingAd(null)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateMutation.isPending || isUploadingImage}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Slide'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingAd && (
        <Modal
          isOpen={Boolean(deletingAd)}
          onClose={() => setDeletingAd(null)}
          title="Delete Advertisement Slide"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 flex items-start gap-3 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <strong className="block font-bold">Are you sure?</strong>
                This slide will be permanently deleted from the database and freed up for future uploads.
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Slide to delete: <strong className="text-slate-900">{deletingAd.title}</strong>
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingAd(null)}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => deleteMutation.mutate(deletingAd.id)}
                disabled={deleteMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
