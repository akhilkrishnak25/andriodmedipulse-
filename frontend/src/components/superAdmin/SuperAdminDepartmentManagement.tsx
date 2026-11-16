import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Search,
  Upload,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Building2,
  Stethoscope,
  HeartPulse,
  Brain,
  Bone,
  Baby,
  Activity,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';
import { superAdminApi } from '../../api/superAdmin.api';
import { getMediaUrl } from '../../api/client';
import { Department } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

// Clinical discipline icon map
const deptIcons: Record<string, React.ReactNode> = {
  cardiology: <HeartPulse className="w-5 h-5" />,
  orthopedics: <Bone className="w-5 h-5" />,
  neurology: <Brain className="w-5 h-5" />,
  pediatrics: <Baby className="w-5 h-5" />,
  'general-medicine': <Stethoscope className="w-5 h-5" />,
  dermatology: <Sparkles className="w-5 h-5" />,
  ent: <Activity className="w-5 h-5" />,
  gynecology: <HeartPulse className="w-5 h-5" />,
  oncology: <Activity className="w-5 h-5" />,
};

export const SuperAdminDepartmentManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'distinct' | 'all'>('distinct');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('');

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDeptForUpload, setSelectedDeptForUpload] = useState<Department | null>(null);
  const [manualDeptSlug, setManualDeptSlug] = useState('');
  const [applyToAllMatching, setApplyToAllMatching] = useState(true);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');

  // Delete modal state
  const [deptToDeleteImage, setDeptToDeleteImage] = useState<Department | null>(null);

  // Queries
  const { data: departments = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['super-admin-departments', searchQuery, selectedHospitalFilter, viewMode],
    queryFn: () =>
      superAdminApi.getDepartments({
        search: searchQuery || undefined,
        hospitalId: selectedHospitalFilter || undefined,
        distinct: viewMode === 'distinct',
      }),
  });

  const { data: hospitals = [] } = useQuery({
    queryKey: ['super-admin-hospitals'],
    queryFn: () => superAdminApi.getHospitals(),
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { departmentId?: string; slug?: string; fileData: string; applyToAllMatching?: boolean }) =>
      superAdminApi.uploadDepartmentImage(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(
        'Department Image Saved',
        `Image successfully updated for ${res.updatedCount} department record(s).`
      );
      closeUploadModal();
    },
    onError: (err: any) => {
      toast.error('Upload Failed', err.message || 'Could not save department image');
    },
  });

  // Remove Mutation
  const removeMutation = useMutation({
    mutationFn: ({ departmentId, slug, applyToAll }: { departmentId?: string; slug?: string; applyToAll: boolean }) =>
      superAdminApi.removeDepartmentImage(departmentId, slug, applyToAll),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-departments'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(
        'Image Removed',
        `Department image removed from ${res.removedCount || 1} record(s). Default placeholder restored.`
      );
      setDeptToDeleteImage(null);
    },
    onError: (err: any) => {
      toast.error('Removal Failed', err.message || 'Could not remove department image');
    },
  });

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError('');
    if (!file) return;

    // Validate format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setFileError('Invalid format. Only JPG, JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate size (8MB max)
    if (file.size > 8 * 1024 * 1024) {
      setFileError('File size exceeds the 8MB limit. Please upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result);
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const openUploadModal = (dept?: Department) => {
    setFileError('');
    setFileBase64('');
    if (dept) {
      setSelectedDeptForUpload(dept);
      setManualDeptSlug(dept.slug);
      setPreviewUrl(dept.imageUrl ? getMediaUrl(dept.imageUrl) : '');
    } else {
      setSelectedDeptForUpload(null);
      setManualDeptSlug(departments[0]?.slug || 'cardiology');
      setPreviewUrl('');
    }
    setApplyToAllMatching(true);
    setIsUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setSelectedDeptForUpload(null);
    setFileBase64('');
    setPreviewUrl('');
    setFileError('');
  };

  const handleSaveImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileBase64 && !previewUrl) {
      setFileError('Please select an image file to upload.');
      return;
    }
    if (!fileBase64 && previewUrl) {
      toast.info('No changes', 'The selected image is already active.');
      closeUploadModal();
      return;
    }

    const targetSlug = selectedDeptForUpload ? selectedDeptForUpload.slug : manualDeptSlug;
    const targetDeptId = viewMode === 'all' && !applyToAllMatching ? selectedDeptForUpload?.id : undefined;

    uploadMutation.mutate({
      departmentId: targetDeptId,
      slug: targetSlug,
      fileData: fileBase64,
      applyToAllMatching,
    });
  };

  const handleConfirmRemove = () => {
    if (!deptToDeleteImage) return;
    removeMutation.mutate({
      departmentId: viewMode === 'all' ? deptToDeleteImage.id : undefined,
      slug: deptToDeleteImage.slug,
      applyToAll: viewMode === 'distinct' ? true : false,
    });
  };

  const activeWithCustomImages = departments.filter((d) => d.imageUrl).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-royal-600 font-extrabold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-royal-600" />
            Speciality Showcase & Digital Assets
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Popular Clinical Departments & Image Branding
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Upload and update high-resolution cover images for popular departments. Uploaded images dynamically appear on the public homepage cards, replacing plain text listings with modern visual cards.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => openUploadModal()}
            className="bg-royal-600 hover:bg-royal-700 text-white font-bold text-xs shadow-sm"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload Department Image
          </Button>
        </div>
      </div>

      {/* KPI Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-royal-50 flex items-center justify-center text-royal-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Departments</div>
            <div className="text-2xl font-black text-slate-900">{departments.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Custom Images Uploaded</div>
            <div className="text-2xl font-black text-emerald-600">{activeWithCustomImages}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Default Placeholders</div>
            <div className="text-2xl font-black text-slate-700">{departments.length - activeWithCustomImages}</div>
          </div>
        </div>
      </div>

      {/* Filter and View Mode Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl max-w-md">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by department name or clinical slug..."
            className="w-full text-xs bg-transparent focus:outline-none text-slate-800 font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'all' && (
            <select
              value={selectedHospitalFilter}
              onChange={(e) => setSelectedHospitalFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-royal-500"
            >
              <option value="">All Hospitals</option>
              {hospitals.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
            <button
              onClick={() => {
                setViewMode('distinct');
                setSelectedHospitalFilter('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'distinct' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Clinical Specialties
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'all' ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Hospital Departments
            </button>
          </div>
        </div>
      </div>

      {/* DEPARTMENT CARDS GRID */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Departments Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No departments matching "${searchQuery}". Try a different keyword.`
              : 'No department records exist yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {departments.map((dept) => {
            const hasCustomImage = Boolean(dept.imageUrl);
            const mediaUrl = hasCustomImage ? getMediaUrl(dept.imageUrl) : '';

            return (
              <Card
                key={dept.id || dept.slug}
                className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-md hover:border-royal-400 transition-all"
              >
                {/* Visual Card Image Preview */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                  {hasCustomImage ? (
                    <img
                      src={mediaUrl}
                      alt={dept.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    /* Clean Default Medical Placeholder */
                    <div className="w-full h-full bg-gradient-to-br from-royal-950 via-royal-900 to-indigo-950 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                      <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-royal-200 mb-2 shadow-inner group-hover:scale-110 transition-transform">
                        {deptIcons[dept.slug] || <Activity className="w-6 h-6" />}
                      </div>
                      <span className="text-[10px] font-semibold text-royal-300 uppercase tracking-widest">
                        Default Placeholder
                      </span>
                    </div>
                  )}

                  {/* Gradient Overlay for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />

                  {/* Status Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    {hasCustomImage ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm">
                        <CheckCircle2 className="w-3 h-3" /> Custom Image
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-900/80 text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm">
                        Placeholder
                      </span>
                    )}
                  </div>

                  {/* Overlaid Title */}
                  <div className="absolute bottom-2.5 left-3 right-3 text-white pointer-events-none">
                    <h3 className="font-extrabold text-sm sm:text-base leading-snug drop-shadow-sm line-clamp-1">
                      {dept.name}
                    </h3>
                    <p className="text-[11px] text-slate-200 line-clamp-1 opacity-90">
                      {dept.description || 'Specialized outpatient clinical care'}
                    </p>
                  </div>
                </div>

                {/* Card Details & Actions */}
                <div className="p-3.5 flex-1 flex flex-col justify-between bg-white space-y-3">
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        /{dept.slug}
                      </span>
                      {viewMode === 'distinct' && dept.hospitalCount !== undefined && (
                        <span className="font-semibold text-royal-600 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {dept.hospitalCount} {dept.hospitalCount === 1 ? 'Hospital' : 'Hospitals'}
                        </span>
                      )}
                      {viewMode === 'all' && dept.hospital && (
                        <span className="font-semibold text-slate-700 truncate max-w-[130px]" title={dept.hospital.name}>
                          {dept.hospital.name}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Clinical Doctors:</span>
                      <span className="font-bold text-slate-800">
                        {dept.doctorCount !== undefined ? dept.doctorCount : dept._count?.doctors || 0} Doctors
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => openUploadModal(dept)}
                      className={`flex-1 text-xs font-bold ${
                        hasCustomImage
                          ? 'bg-slate-100 hover:bg-royal-50 text-slate-700 hover:text-royal-700 border border-slate-200'
                          : 'bg-royal-600 hover:bg-royal-700 text-white'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      {hasCustomImage ? 'Change Image' : 'Upload Image'}
                    </Button>

                    {hasCustomImage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeptToDeleteImage(dept)}
                        className="text-rose-600 hover:bg-rose-50 border-rose-200 p-2"
                        title="Remove custom image and restore clean default placeholder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* UPLOAD / CHANGE IMAGE MODAL WITH LIVE PREVIEW */}
      {isUploadModalOpen && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={closeUploadModal}
          title={selectedDeptForUpload ? `Upload Image – ${selectedDeptForUpload.name}` : 'Upload Department Image'}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveImage} className="space-y-5 text-xs">
            {/* Department Selection if opened generally */}
            {!selectedDeptForUpload && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Department</label>
                <select
                  value={manualDeptSlug}
                  onChange={(e) => {
                    setManualDeptSlug(e.target.value);
                    const match = departments.find((d) => d.slug === e.target.value);
                    if (match && match.imageUrl) {
                      setPreviewUrl(getMediaUrl(match.imageUrl));
                    } else {
                      setPreviewUrl('');
                    }
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-royal-500"
                >
                  {departments.map((d) => (
                    <option key={d.id || d.slug} value={d.slug}>
                      {d.name} ({d.slug}) {d.imageUrl ? '✓ Has Image' : '— No Image'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* File Upload Zone */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Choose Image File (JPG, JPEG, PNG, WebP)
              </label>
              <div className="border-2 border-dashed border-slate-300 hover:border-royal-500 rounded-2xl p-5 text-center bg-slate-50/50 transition-colors">
                <input
                  type="file"
                  id="dept-image-file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="dept-image-file" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-royal-50 text-royal-600 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-royal-600 hover:underline">Click to browse</span> or drag and drop
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Supports JPG, PNG, WebP • Max file size: 8MB • Ideal aspect ratio: 4:3 or 16:9
                  </div>
                </label>
              </div>
            </div>

            {/* Error banner if file validation fails */}
            {fileError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{fileError}</span>
              </div>
            )}

            {/* LIVE PREVIEW OF PUBLIC CARD BEFORE SAVING */}
            {previewUrl && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Public Website Card Preview (Live Mockup)
                  </span>
                  <span className="text-[11px] text-slate-400">Card appears like this to visitors</span>
                </div>

                <div className="max-w-xs mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-md relative aspect-[4/3] bg-slate-950">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />
                  <div className="absolute top-2.5 right-2.5">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      Preview
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white pointer-events-none">
                    <div className="font-extrabold text-base leading-snug drop-shadow-sm">
                      {selectedDeptForUpload?.name ||
                        departments.find((d) => d.slug === manualDeptSlug)?.name ||
                        'Department Name'}
                    </div>
                    <div className="text-[11px] text-slate-200 opacity-90 line-clamp-1">
                      Specialized outpatient clinical care
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scope / Synchronize Option */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAllMatching}
                  onChange={(e) => setApplyToAllMatching(e.target.checked)}
                  className="rounded text-royal-600 focus:ring-royal-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800">
                  Apply to all network partner hospitals offering this clinical discipline
                </span>
              </label>
              <p className="text-[11px] text-slate-500 pl-6">
                Recommended: Keeps visual branding synchronized across Apollo, Fortis, AIIMS, and all future hospitals offering this department.
              </p>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={closeUploadModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={uploadMutation.isPending || (!fileBase64 && !previewUrl)}
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold"
              >
                {uploadMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Image...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Department Image
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CONFIRM REMOVE MODAL */}
      {deptToDeleteImage && (
        <Modal
          isOpen={Boolean(deptToDeleteImage)}
          onClose={() => setDeptToDeleteImage(null)}
          title={`Remove Department Image – ${deptToDeleteImage.name}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <Info className="w-4 h-4 text-amber-600" />
                Restore Default Placeholder
              </div>
              <p className="text-[11px] text-amber-700">
                Are you sure you want to remove the custom uploaded image for <strong>{deptToDeleteImage.name}</strong>?
                The public website and booking flows will immediately revert to the clean default placeholder card.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeptToDeleteImage(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={removeMutation.isPending}
                onClick={handleConfirmRemove}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {removeMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Confirm Removal
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
