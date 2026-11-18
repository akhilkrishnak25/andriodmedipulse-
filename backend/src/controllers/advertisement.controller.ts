import { Request, Response } from 'express';
import { AdvertisementService } from '../services/advertisement.service';
import { successResponse, errorResponse } from '../utils/response';

export class AdvertisementController {
  /**
   * Helper to resolve hospitalId from req.user
   */
  private static async getHospitalId(req: Request): Promise<string> {
    const userId = req.user?.id;
    if (!userId) {
      const err: any = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const hospitalId = await AdvertisementService.resolveHospitalId(userId, req.user?.hospitalId);
    if (!hospitalId) {
      const err: any = new Error('No hospital associated with this account');
      err.statusCode = 403;
      throw err;
    }
    return hospitalId;
  }

  /**
   * Helper to resolve labId from req.user
   */
  private static async getLabId(req: Request): Promise<string> {
    const userId = req.user?.id;
    if (!userId) {
      const err: any = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const labId = await AdvertisementService.resolveLabId(userId, req.user?.labId);
    if (!labId) {
      const err: any = new Error('No laboratory associated with this account');
      err.statusCode = 403;
      throw err;
    }
    return labId;
  }

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  static async getPublicPlatformAds(req: Request, res: Response) {
    try {
      const result = await AdvertisementService.getPlatformAdvertisements(false);
      return successResponse(res, result.advertisements, 'Platform active advertisements retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve platform advertisements', error.statusCode || 500);
    }
  }

  static async getPublicHospitalAds(req: Request, res: Response) {
    try {
      const hospitalId = (req.params.hospitalId as string) || '';
      if (!hospitalId) {
        return errorResponse(res, 'Hospital ID is required', 400);
      }
      const result = await AdvertisementService.getHospitalAdvertisements(hospitalId, false);
      return successResponse(res, result.advertisements, 'Hospital active advertisements retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve hospital advertisements', error.statusCode || 500);
    }
  }

  static async getPublicLabAds(req: Request, res: Response) {
    try {
      const advertisements = await AdvertisementService.getAllActiveLabAdvertisements();
      return successResponse(res, advertisements, 'All active laboratory advertisements retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve laboratory advertisements', error.statusCode || 500);
    }
  }

  static async getPublicLabAdsByLabId(req: Request, res: Response) {
    try {
      const labId = (req.params.labId as string) || '';
      if (!labId) {
        return errorResponse(res, 'Laboratory ID is required', 400);
      }
      const result = await AdvertisementService.getLabAdvertisements(labId, false);
      return successResponse(res, result.advertisements, 'Laboratory active advertisements retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve laboratory advertisements', error.statusCode || 500);
    }
  }

  // ==========================================
  // SUPER ADMIN ENDPOINTS
  // ==========================================

  static async getAdminPlatformAds(req: Request, res: Response) {
    try {
      const result = await AdvertisementService.getPlatformAdvertisements(true);
      return successResponse(res, result, 'Platform advertisements and statistics retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve platform advertisements', error.statusCode || 500);
    }
  }

  static async createAdminPlatformAd(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 'Authentication required', 401);
      }
      const ad = await AdvertisementService.createPlatformAdvertisement(req.body, userId);
      return successResponse(res, ad, 'Advertisement created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create advertisement', error.statusCode || 500);
    }
  }

  static async updateAdminPlatformAd(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updated = await AdvertisementService.updateAdvertisement(id, req.body, { isSuperAdmin: true });
      return successResponse(res, updated, 'Advertisement updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update advertisement', error.statusCode || 500);
    }
  }

  static async toggleAdminPlatformAdStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updated = await AdvertisementService.toggleStatus(id, { isSuperAdmin: true });
      return successResponse(res, updated, `Advertisement marked as ${updated.isActive ? 'active' : 'inactive'}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to toggle advertisement status', error.statusCode || 500);
    }
  }

  static async deleteAdminPlatformAd(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const result = await AdvertisementService.deleteAdvertisement(id, { isSuperAdmin: true });
      return successResponse(res, result, 'Advertisement deleted successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete advertisement', error.statusCode || 500);
    }
  }

  static async reorderAdminPlatformAds(req: Request, res: Response) {
    try {
      const { items } = req.body;
      const result = await AdvertisementService.reorderAdvertisements(items, { isSuperAdmin: true });
      return successResponse(res, result, 'Platform advertisements reordered successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reorder advertisements', error.statusCode || 500);
    }
  }

  // ==========================================
  // HOSPITAL ADMIN ENDPOINTS
  // ==========================================

  static async getAdminHospitalAds(req: Request, res: Response) {
    try {
      const hospitalId = await AdvertisementController.getHospitalId(req);
      const result = await AdvertisementService.getHospitalAdvertisements(hospitalId, true);
      return successResponse(res, result, 'Hospital advertisements and statistics retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve hospital advertisements', error.statusCode || 500);
    }
  }

  static async createAdminHospitalAd(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 'Authentication required', 401);
      }
      const hospitalId = await AdvertisementController.getHospitalId(req);
      const ad = await AdvertisementService.createHospitalAdvertisement(hospitalId, req.body, userId);
      return successResponse(res, ad, 'Advertisement created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create advertisement', error.statusCode || 500);
    }
  }

  static async updateAdminHospitalAd(req: Request, res: Response) {
    try {
      const hospitalId = await AdvertisementController.getHospitalId(req);
      const id = req.params.id as string;
      const updated = await AdvertisementService.updateAdvertisement(id, req.body, { isSuperAdmin: false, hospitalId });
      return successResponse(res, updated, 'Advertisement updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update advertisement', error.statusCode || 500);
    }
  }

  static async toggleAdminHospitalAdStatus(req: Request, res: Response) {
    try {
      const hospitalId = await AdvertisementController.getHospitalId(req);
      const id = req.params.id as string;
      const updated = await AdvertisementService.toggleStatus(id, { isSuperAdmin: false, hospitalId });
      return successResponse(res, updated, `Advertisement marked as ${updated.isActive ? 'active' : 'inactive'}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to toggle advertisement status', error.statusCode || 500);
    }
  }

  static async deleteAdminHospitalAd(req: Request, res: Response) {
    try {
      const hospitalId = await AdvertisementController.getHospitalId(req);
      const id = req.params.id as string;
      const result = await AdvertisementService.deleteAdvertisement(id, { isSuperAdmin: false, hospitalId });
      return successResponse(res, result, 'Advertisement deleted successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete advertisement', error.statusCode || 500);
    }
  }

  static async reorderAdminHospitalAds(req: Request, res: Response) {
    try {
      const hospitalId = await AdvertisementController.getHospitalId(req);
      const { items } = req.body;
      const result = await AdvertisementService.reorderAdvertisements(items, { isSuperAdmin: false, hospitalId });
      return successResponse(res, result, 'Hospital advertisements reordered successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reorder advertisements', error.statusCode || 500);
    }
  }

  // ==========================================
  // LAB ADMIN ENDPOINTS
  // ==========================================

  static async getAdminLabAds(req: Request, res: Response) {
    try {
      const labId = await AdvertisementController.getLabId(req);
      const result = await AdvertisementService.getLabAdvertisements(labId, true);
      return successResponse(res, result, 'Laboratory advertisements and statistics retrieved');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve laboratory advertisements', error.statusCode || 500);
    }
  }

  static async createAdminLabAd(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 'Authentication required', 401);
      }
      const labId = await AdvertisementController.getLabId(req);
      const ad = await AdvertisementService.createLabAdvertisement(labId, req.body, userId);
      return successResponse(res, ad, 'Advertisement created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create advertisement', error.statusCode || 500);
    }
  }

  static async updateAdminLabAd(req: Request, res: Response) {
    try {
      const labId = await AdvertisementController.getLabId(req);
      const id = req.params.id as string;
      const updated = await AdvertisementService.updateAdvertisement(id, req.body, { isSuperAdmin: false, labId });
      return successResponse(res, updated, 'Advertisement updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update advertisement', error.statusCode || 500);
    }
  }

  static async toggleAdminLabAdStatus(req: Request, res: Response) {
    try {
      const labId = await AdvertisementController.getLabId(req);
      const id = req.params.id as string;
      const updated = await AdvertisementService.toggleStatus(id, { isSuperAdmin: false, labId });
      return successResponse(res, updated, `Advertisement marked as ${updated.isActive ? 'active' : 'inactive'}`);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to toggle advertisement status', error.statusCode || 500);
    }
  }

  static async deleteAdminLabAd(req: Request, res: Response) {
    try {
      const labId = await AdvertisementController.getLabId(req);
      const id = req.params.id as string;
      const result = await AdvertisementService.deleteAdvertisement(id, { isSuperAdmin: false, labId });
      return successResponse(res, result, 'Advertisement deleted successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to delete advertisement', error.statusCode || 500);
    }
  }

  static async reorderAdminLabAds(req: Request, res: Response) {
    try {
      const labId = await AdvertisementController.getLabId(req);
      const { items } = req.body;
      const result = await AdvertisementService.reorderAdvertisements(items, { isSuperAdmin: false, labId });
      return successResponse(res, result, 'Laboratory advertisements reordered successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reorder advertisements', error.statusCode || 500);
    }
  }

  // ==========================================
  // SUPER ADMIN LAB AD ENDPOINTS
  // ==========================================

  static async getSuperAdminLabAds(req: Request, res: Response) {
    try {
      const result = await AdvertisementService.getAllLabAdvertisementsForSuperAdmin();
      return successResponse(res, result, 'All laboratory advertisements retrieved for Super Admin');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve laboratory advertisements', error.statusCode || 500);
    }
  }

  // ==========================================
  // SHARED UPLOAD ENDPOINT
  // ==========================================

  static async uploadAdvertisementImage(req: Request, res: Response) {
    try {
      const { fileData } = req.body;
      const prefix =
        req.user?.role === 'SUPER_ADMIN'
          ? 'platform-ad'
          : req.user?.role === 'LAB_TECHNICIAN'
          ? `lab-ad-${req.user?.labId || 'general'}`
          : `hosp-ad-${req.user?.hospitalId || 'general'}`;
      const result = await AdvertisementService.uploadAdvertisementImage(fileData, prefix);
      return successResponse(res, result, 'Advertisement image uploaded successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to upload advertisement image', error.statusCode || 500);
    }
  }
}
