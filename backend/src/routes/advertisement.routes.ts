import { Router } from 'express';
import { AdvertisementController } from '../controllers/advertisement.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ==========================================
// PUBLIC ROUTES (Homepage & Hospital Detail)
// ==========================================
router.get('/platform', AdvertisementController.getPublicPlatformAds);
router.get('/hospital/:hospitalId', AdvertisementController.getPublicHospitalAds);
router.get('/labs', AdvertisementController.getPublicLabAds);
router.get('/lab/:labId', AdvertisementController.getPublicLabAdsByLabId);

// ==========================================
// SHARED ASSET UPLOAD
// ==========================================
router.post(
  '/upload',
  authenticate,
  requireRole(['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'HOSPITAL_SUB_ADMIN', 'LAB_TECHNICIAN']),
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

router.get(
  '/super-admin/labs',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  AdvertisementController.getSuperAdminLabAds
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

// ==========================================
// LAB ADMIN MANAGEMENT ROUTES
// ==========================================
router.get(
  '/admin/lab',
  authenticate,
  requireRole(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  AdvertisementController.getAdminLabAds
);

router.post(
  '/admin/lab',
  authenticate,
  requireRole(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  AdvertisementController.createAdminLabAd
);

router.put(
  '/admin/lab/:id',
  authenticate,
  requireRole(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  AdvertisementController.updateAdminLabAd
);

router.patch(
  '/admin/lab/:id/status',
  authenticate,
  requireRole(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  AdvertisementController.toggleAdminLabAdStatus
);

router.delete(
  '/admin/lab/:id',
  authenticate,
  requireRole(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  AdvertisementController.deleteAdminLabAd
);

router.post(
  '/admin/lab/reorder',
  authenticate,
  requireRole(['LAB_TECHNICIAN', 'SUPER_ADMIN']),
  AdvertisementController.reorderAdminLabAds
);

export default router;
