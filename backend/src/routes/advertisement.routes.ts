import { Router } from 'express';
import { AdvertisementController } from '../controllers/advertisement.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ==========================================
// PUBLIC ROUTES (Homepage & Hospital Detail)
// ==========================================
router.get('/platform', AdvertisementController.getPublicPlatformAds);
router.get('/hospital/:hospitalId', AdvertisementController.getPublicHospitalAds);

// ==========================================
// SHARED ASSET UPLOAD
// ==========================================
router.post(
  '/upload',
  authenticate,
  requireRole(['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN']),
  AdvertisementController.uploadAdvertisementImage
);

// ==========================================
// SUPER ADMIN MANAGEMENT ROUTES
// ==========================================
router.get(
  '/admin/platform',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  AdvertisementController.getAdminPlatformAds
);

router.post(
  '/admin/platform',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  AdvertisementController.createAdminPlatformAd
);

router.put(
  '/admin/platform/:id',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  AdvertisementController.updateAdminPlatformAd
);

router.patch(
  '/admin/platform/:id/status',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  AdvertisementController.toggleAdminPlatformAdStatus
);

router.delete(
  '/admin/platform/:id',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  AdvertisementController.deleteAdminPlatformAd
);

router.post(
  '/admin/platform/reorder',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  AdvertisementController.reorderAdminPlatformAds
);

// ==========================================
// HOSPITAL ADMIN MANAGEMENT ROUTES
// ==========================================
router.get(
  '/admin/hospital',
  authenticate,
  requireRole(['HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN']),
  AdvertisementController.getAdminHospitalAds
);

router.post(
  '/admin/hospital',
  authenticate,
  requireRole(['HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN']),
  AdvertisementController.createAdminHospitalAd
);

router.put(
  '/admin/hospital/:id',
  authenticate,
  requireRole(['HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN']),
  AdvertisementController.updateAdminHospitalAd
);

router.patch(
  '/admin/hospital/:id/status',
  authenticate,
  requireRole(['HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN']),
  AdvertisementController.toggleAdminHospitalAdStatus
);

router.delete(
  '/admin/hospital/:id',
  authenticate,
  requireRole(['HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN']),
  AdvertisementController.deleteAdminHospitalAd
);

router.post(
  '/admin/hospital/reorder',
  authenticate,
  requireRole(['HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN']),
  AdvertisementController.reorderAdminHospitalAds
);

export default router;
