import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Lock,
  ShieldCheck,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { InlineSpinner } from '../ui/Loading';

interface AdminEditProfileSectionProps {
  hospitalProfile?: any;
  onProfileUpdated?: () => void;
}

export const AdminEditProfileSection: React.FC<AdminEditProfileSectionProps> = ({
  hospitalProfile,
  onProfileUpdated,
}) => {
  const { user, updateUser, refreshUser } = useAuth();
  const toast = useToast();

  // Server profile state
  const [profileData, setProfileData] = useState<{ admin: any; hospital: any } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // View vs Edit mode (View mode by default)
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for Profile Details
  const [hospitalName, setHospitalName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [pincode, setPincode] = useState('');
  const [designation, setDesignation] = useState('');

  // Change Email OTP Modal States
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'enter_email' | 'verify_otp'>('enter_email');
  const [newEmail, setNewEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Change Password Modal / Inline Section States
  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getAdminProfile();
      setProfileData(res);
      syncFormFields(res);
    } catch (err: any) {
      toast.error('Failed to Load Profile', err.message || 'Could not retrieve administrator profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const syncFormFields = (data: { admin: any; hospital: any }) => {
    setHospitalName(data.hospital?.name || hospitalProfile?.name || user?.hospital?.name || '');
    setAdminName(data.admin?.name || user?.name || '');
    setContactNumber(data.admin?.phone || user?.phone || data.hospital?.phone || '');
    setHospitalAddress(data.hospital?.address || hospitalProfile?.address || '');
    setCity(data.hospital?.city || hospitalProfile?.city || '');
    setStateVal(data.hospital?.state || hospitalProfile?.state || '');
    setPincode(data.hospital?.pincode || hospitalProfile?.pincode || '');
    setDesignation(data.admin?.designation || 'Hospital Administrator');
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleEnterEditMode = () => {
    if (profileData) {
      syncFormFields(profileData);
    }
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (profileData) {
      syncFormFields(profileData);
    }
    setIsEditMode(false);
  };

  const handleSaveProfileChanges = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminName.trim() || adminName.trim().length < 2) {
      toast.error('Validation Error', 'Admin Name must be at least 2 characters.');
      return;
    }
    if (!hospitalName.trim() || hospitalName.trim().length < 2) {
      toast.error('Validation Error', 'Hospital Name must be at least 2 characters.');
      return;
    }
    if (!contactNumber.trim() || contactNumber.trim().length < 7) {
      toast.error('Validation Error', 'Please provide a valid Contact Number.');
      return;
    }
    if (!hospitalAddress.trim() || hospitalAddress.trim().length < 3) {
      toast.error('Validation Error', 'Please provide a valid Hospital Address.');
      return;
    }
    if (pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
      toast.error('Validation Error', 'PIN Code must be a valid 6-digit number.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await adminApi.updateAdminProfile({
        adminName: adminName.trim(),
        phone: contactNumber.trim(),
        designation: designation.trim() || undefined,
        hospitalName: hospitalName.trim(),
        hospitalAddress: hospitalAddress.trim(),
        city: city.trim() || undefined,
        state: stateVal.trim() || undefined,
        pincode: pincode.trim() || undefined,
      });

      setProfileData(updated);
      syncFormFields(updated);
      setIsEditMode(false);

      // Update AuthContext state immediately
      updateUser({
        name: updated.admin.name,
        phone: updated.admin.phone,
        hospital: {
          ...(user?.hospital as any),
          ...updated.hospital,
        },
      });
      await refreshUser();
      onProfileUpdated?.();

      toast.success('Profile Updated', 'Your administrator and hospital profile details have been saved.');
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Unable to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Email Change Flow
  const openEmailChangeModal = () => {
    setNewEmail('');
    setOtpCode('');
    setDemoOtpHint(null);
    setEmailStep('enter_email');
    setIsEmailModalOpen(true);
  };

  const handleRequestEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newEmail.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      toast.error('Invalid Email', 'Please enter a valid new email address.');
      return;
    }

    if (cleaned === (profileData?.admin?.email || user?.email)?.toLowerCase()) {
      toast.error('Same Email', 'The new email address must be different from your current registered email.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await adminApi.requestEmailChangeOtp(cleaned);
      setEmailStep('verify_otp');
      if (res.demoOtp) {
        setDemoOtpHint(res.demoOtp);
      }
      toast.success('Verification Code Sent', res.message || 'Please check your new email inbox for the 6-digit OTP.');
    } catch (err: any) {
      toast.error('Request Failed', err.message || 'Could not send email verification OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      toast.error('OTP Required', 'Please enter the verification code sent to your new email.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await adminApi.verifyEmailChangeOtp(newEmail.trim().toLowerCase(), otpCode.trim());

      // Maintain authentication session securely with updated JWT tokens
      if (res.accessToken) {
        localStorage.setItem('rocketwheel_access_token', res.accessToken);
        if (localStorage.getItem('medipulse_access_token')) {
          localStorage.setItem('medipulse_access_token', res.accessToken);
        }
      }
      if (res.refreshToken) {
        localStorage.setItem('rocketwheel_refresh_token', res.refreshToken);
        if (localStorage.getItem('medipulse_refresh_token')) {
          localStorage.setItem('medipulse_refresh_token', res.refreshToken);
        }
      }

      updateUser({
        email: res.user?.email || newEmail.trim().toLowerCase(),
      });
      await refreshUser();
      await loadProfile();
      onProfileUpdated?.();

      setIsEmailModalOpen(false);
      toast.success('Email Updated', 'Your registered email address has been verified and updated securely.');
    } catch (err: any) {
      toast.error('Verification Failed', err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Password Strength Validation
  const pwdCriteria = {
    minLength: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
  };
  const isPasswordStrong =
    pwdCriteria.minLength &&
    pwdCriteria.hasUpper &&
    pwdCriteria.hasLower &&
    pwdCriteria.hasNumber &&
    pwdCriteria.hasSpecial;
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Current Password Required', 'Please enter your current password to authorize this change.');
      return;
    }
    if (!isPasswordStrong) {
      toast.error('Weak Password', 'Please meet all password strength requirements before saving.');
      return;
    }
    if (!doPasswordsMatch) {
      toast.error('Password Mismatch', 'New Password and Confirm New Password fields do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await adminApi.changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      // Maintain authentication session securely with refreshed JWT tokens
      if (res.accessToken) {
        localStorage.setItem('rocketwheel_access_token', res.accessToken);
        if (localStorage.getItem('medipulse_access_token')) {
          localStorage.setItem('medipulse_access_token', res.accessToken);
        }
      }
      if (res.refreshToken) {
        localStorage.setItem('rocketwheel_refresh_token', res.refreshToken);
        if (localStorage.getItem('medipulse_refresh_token')) {
          localStorage.setItem('medipulse_refresh_token', res.refreshToken);
        }
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordEditing(false);
      toast.success('Password Changed', 'Your password has been verified, hashed securely, and updated.');
    } catch (err: any) {
      toast.error('Password Change Failed', err.message || 'Could not update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading && !profileData) {
    return (
      <div className="p-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
        <InlineSpinner size="lg" className="text-royal-600 mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading Hospital Administrator profile...</p>
      </div>
    );
  }

  const admin = profileData?.admin || user;
  const hospital = profileData?.hospital || hospitalProfile || user?.hospital;

  return (
    <div className="space-y-6">
      {/* Top Security & Mode Status Banner */}
      <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-royal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">Hospital Administrator Profile</h2>
              <Badge variant={isEditMode ? 'warning' : 'success'} className="text-[10px]">
                {isEditMode ? 'Edit Mode Active' : 'View Mode'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your official profile information, registered email verification, and account password security.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isEditMode ? (
            <Button
              type="button"
              onClick={handleEnterEditMode}
              size="sm"
              className="bg-royal-600 hover:bg-royal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="text-slate-700 bg-white border-slate-300 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Cancel Editing
            </Button>
          )}
        </div>
      </div>

      {/* SECTION 1: PROFILE DETAILS (View Mode by Default -> Edit Mode on click) */}
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-royal-600" />
            <h3 className="font-bold text-sm text-slate-900">Profile Details & Facility Information</h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" /> Role & Hospital ID are system-locked
          </span>
        </div>

        <form onSubmit={handleSaveProfileChanges} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Hospital Name */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-royal-600" />
                Hospital Name
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 focus:border-royal-500 outline-none transition-all"
                  placeholder="Enter hospital name"
                />
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm font-semibold text-slate-900">
                  {hospital?.name || '—'}
                </div>
              )}
            </div>

            {/* Admin Name */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-royal-600" />
                Admin Name
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 focus:border-royal-500 outline-none transition-all"
                  placeholder="Enter administrator full name"
                />
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm font-semibold text-slate-900">
                  {admin?.name || '—'}
                </div>
              )}
            </div>

            {/* Registered Email Address */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-royal-600" />
                Registered Email Address
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm font-semibold text-slate-900 flex items-center justify-between">
                  <span className="truncate">{admin?.email || '—'}</span>
                  <Badge variant="success" className="text-[10px] shrink-0">Verified</Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openEmailChangeModal}
                  className="shrink-0 border-royal-200 text-royal-700 hover:bg-royal-50 font-bold text-xs py-2.5"
                >
                  Change Email
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                Updating registered email requires OTP verification to protect your login credentials.
              </p>
            </div>

            {/* Contact Number */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-royal-600" />
                Contact Number
              </label>
              {isEditMode ? (
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 focus:border-royal-500 outline-none transition-all"
                  placeholder="Enter contact phone number"
                />
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm font-semibold text-slate-900">
                  {admin?.phone || hospital?.phone || '—'}
                </div>
              )}
            </div>

            {/* Designation */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-royal-600" />
                Designation
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 focus:border-royal-500 outline-none transition-all"
                  placeholder="e.g. Hospital Administrator, Medical Superintendent"
                />
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm font-semibold text-slate-900">
                  {admin?.designation || 'Hospital Administrator'}
                </div>
              )}
            </div>

            {/* Read-only System Security Identifiers (Role & Hospital ID) */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                System Role & Hospital ID (Protected)
              </label>
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs font-semibold text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Role: <strong className="text-slate-900">{admin?.role || 'HOSPITAL_ADMIN'}</strong>
                </span>
                <span className="font-mono text-royal-700 bg-royal-50 px-2 py-0.5 rounded border border-royal-100">
                  ID: {hospital?.code || hospital?.id?.slice(0, 8)}
                </span>
              </div>
            </div>

            {/* Hospital Address (Full Row) */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-royal-600" />
                Hospital Address
              </label>
              {isEditMode ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={hospitalAddress}
                    onChange={(e) => setHospitalAddress(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 focus:border-royal-500 outline-none transition-all"
                    placeholder="Street address / building / locality"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">State</label>
                      <input
                        type="text"
                        value={stateVal}
                        onChange={(e) => setStateVal(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                        placeholder="State"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">PIN Code</label>
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        maxLength={6}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                        placeholder="6-digit PIN"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm font-semibold text-slate-900">
                  {[hospital?.address, hospital?.city, hospital?.state, hospital?.pincode].filter(Boolean).join(', ') || '—'}
                </div>
              )}
            </div>
          </div>

          {/* Save Changes & Cancel Buttons when in Edit Mode */}
          {isEditMode && (
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="text-slate-700 bg-white border-slate-300 hover:bg-slate-50 font-bold text-xs px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold text-xs px-5 flex items-center gap-1.5 shadow-sm"
              >
                {isSaving ? <InlineSpinner size="sm" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* SECTION 2: CHANGE PASSWORD & ACCOUNT SECURITY */}
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-royal-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Password & Authentication Security</h3>
              <p className="text-[11px] text-slate-500">
                Verify your current password and set a strong replacement password.
              </p>
            </div>
          </div>
          {!isPasswordEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPasswordEditing(true)}
              className="border-royal-200 text-royal-700 hover:bg-royal-50 font-bold text-xs"
            >
              Change Password
            </Button>
          )}
        </div>

        {isPasswordEditing ? (
          <form onSubmit={handleChangePassword} className="p-6 space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPwd ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showCurrentPwd ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                    placeholder="Create strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showNewPwd ? 'Hide password' : 'Show password'}
                  >
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showConfirmPwd ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Strength & Match Validation Checklist */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                Password Strength Requirements
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                <div className={`flex items-center gap-1.5 ${pwdCriteria.minLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  {pwdCriteria.minLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                  At least 8 characters
                </div>
                <div className={`flex items-center gap-1.5 ${pwdCriteria.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  {pwdCriteria.hasUpper ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                  One uppercase letter (A-Z)
                </div>
                <div className={`flex items-center gap-1.5 ${pwdCriteria.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  {pwdCriteria.hasLower ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                  One lowercase letter (a-z)
                </div>
                <div className={`flex items-center gap-1.5 ${pwdCriteria.hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  {pwdCriteria.hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                  One numeric digit (0-9)
                </div>
                <div className={`flex items-center gap-1.5 ${pwdCriteria.hasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  {pwdCriteria.hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                  One special symbol (!@#$...)
                </div>
                <div className={`flex items-center gap-1.5 ${doPasswordsMatch ? 'text-emerald-700 font-semibold' : confirmPassword ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                  {doPasswordsMatch ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}
                  Passwords match
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPasswordEditing(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isChangingPassword}
                className="text-slate-700 bg-white border-slate-300 font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isChangingPassword || !isPasswordStrong || !doPasswordsMatch || !currentPassword}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 flex items-center gap-1.5"
              >
                {isChangingPassword ? <InlineSpinner size="sm" /> : <Lock className="w-3.5 h-3.5" />}
                {isChangingPassword ? 'Updating Password...' : 'Save Password'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-slate-800">Account Password Protection</div>
              <p className="text-slate-500">
                Your password is encrypted with industry-standard bcrypt hashing. Keep your credentials private and update them periodically.
              </p>
            </div>
            <div className="text-slate-400 font-mono text-sm tracking-widest shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              ••••••••••••
            </div>
          </div>
        )}
      </Card>

      {/* CHANGE EMAIL OTP VERIFICATION MODAL */}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => !isSendingOtp && !isVerifyingOtp && setIsEmailModalOpen(false)}
        title="Update Registered Email Address"
        maxWidth="md"
      >
        {emailStep === 'enter_email' ? (
          <form onSubmit={handleRequestEmailOtp} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 space-y-1">
              <div className="font-bold">Security Verification Required</div>
              <p className="text-sky-800 leading-relaxed">
                To update your registered email address, we will send a 6-digit One-Time Password (OTP) to your new email address. Your current email ({admin?.email}) remains active until verified.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Current Registered Email</label>
              <input
                type="email"
                value={admin?.email || ''}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                New Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                placeholder="new.admin@hospital.org"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEmailModalOpen(false)}
                disabled={isSendingOtp}
                className="text-slate-700 bg-white border-slate-300 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSendingOtp}
                className="bg-royal-600 hover:bg-royal-700 text-white font-bold flex items-center gap-1.5"
              >
                {isSendingOtp ? <InlineSpinner size="sm" /> : <Mail className="w-3.5 h-3.5" />}
                {isSendingOtp ? 'Sending OTP...' : 'Send Verification OTP'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyEmailOtp} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="font-bold">OTP Sent to {newEmail}</div>
              <p className="text-emerald-800">
                Enter the 6-digit verification code sent to <strong>{newEmail}</strong> to finalize updating your registered email.
              </p>
              {demoOtpHint && (
                <div className="mt-2 p-2 bg-white/80 rounded-lg border border-emerald-300 font-mono text-xs text-emerald-900 flex items-center justify-between">
                  <span>Development Verification Code:</span>
                  <strong className="text-sm tracking-widest">{demoOtpHint}</strong>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                6-Digit Verification OTP <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                maxLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-center font-mono text-lg font-bold tracking-[0.4em] text-slate-900 focus:ring-2 focus:ring-royal-500 outline-none"
                placeholder="000000"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setEmailStep('enter_email')}
                className="text-royal-600 hover:text-royal-800 font-semibold underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Change email / Resend
              </button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEmailModalOpen(false)}
                  disabled={isVerifyingOtp}
                  className="text-slate-700 bg-white border-slate-300 font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isVerifyingOtp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                >
                  {isVerifyingOtp ? <InlineSpinner size="sm" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isVerifyingOtp ? 'Verifying...' : 'Verify & Update Email'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
