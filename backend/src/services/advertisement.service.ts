import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { uploadToStorage } from '../utils/storage';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const ADS_DIR = path.join(UPLOAD_ROOT, 'advertisements');

try {
  if (!fs.existsSync(ADS_DIR)) {
    fs.mkdirSync(ADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize advertisements directory:', e);
}

export interface AdvertisementData {
  title: string;
  description?: string | null;
  imageUrl: string;
  redirectUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface AdvertisementStats {
  totalSlides: number;
  activeSlides: number;
  inactiveSlides: number;
  remainingSlots: number;
  maxSlots: number;
}

export class AdvertisementService {
  /**
   * Resolve hospitalId for Hospital Admin / Sub-Admin if missing from token
   */
  static async resolveHospitalId(userId: string, tokenHospitalId?: string): Promise<string | null> {
    if (tokenHospitalId) return tokenHospitalId;
    const admin = await prisma.hospitalAdmin.findFirst({ where: { userId } });
    if (admin) return admin.hospitalId;
    const subAdmin = await prisma.hospitalSubAdmin.findFirst({ where: { userId } });
    if (subAdmin) return subAdmin.hospitalId;
    return null;
  }

  /**
   * Get Platform Advertisements (Super Admin or Public)
   * Super Admin sees all (active + inactive) + stats
   * Public sees only active advertisements ordered by displayOrder ASC
   */
  static async getPlatformAdvertisements(includeInactive = false) {
    const whereClause: any = { ownerType: 'SUPER_ADMIN' };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const advertisements = await prisma.advertisement.findMany({
      where: whereClause,
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const totalCount = await prisma.advertisement.count({
      where: { ownerType: 'SUPER_ADMIN' },
    });
    const activeCount = await prisma.advertisement.count({
      where: { ownerType: 'SUPER_ADMIN', isActive: true },
    });

    const stats: AdvertisementStats = {
      totalSlides: totalCount,
      activeSlides: activeCount,
      inactiveSlides: totalCount - activeCount,
      remainingSlots: Math.max(0, 8 - totalCount),
      maxSlots: 8,
    };

    return {
      advertisements,
      stats,
    };
  }

  /**
   * Get Hospital Advertisements (Hospital Admin or Public)
   * Hospital Admin sees all for their hospital (active + inactive) + stats
   * Public sees only active advertisements for that hospital ordered by displayOrder ASC
   */
  static async getHospitalAdvertisements(hospitalId: string, includeInactive = false) {
    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    const whereClause: any = {
      ownerType: 'HOSPITAL_ADMIN',
      hospitalId,
    };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const advertisements = await prisma.advertisement.findMany({
      where: whereClause,
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        hospital: {
          select: { id: true, name: true, code: true, logoUrl: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const totalCount = await prisma.advertisement.count({
      where: { ownerType: 'HOSPITAL_ADMIN', hospitalId },
    });
    const activeCount = await prisma.advertisement.count({
      where: { ownerType: 'HOSPITAL_ADMIN', hospitalId, isActive: true },
    });

    const stats: AdvertisementStats = {
      totalSlides: totalCount,
      activeSlides: activeCount,
      inactiveSlides: totalCount - activeCount,
      remainingSlots: Math.max(0, 3 - totalCount),
      maxSlots: 3,
    };

    return {
      advertisements,
      stats,
    };
  }

  /**
   * Create an advertisement for Super Admin (Limit: 8)
   */
  static async createPlatformAdvertisement(data: AdvertisementData, userId: string) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Advertisement title is required');
    }
    if (!data.imageUrl || !data.imageUrl.trim()) {
      throw new Error('Advertisement image is required');
    }

    const currentCount = await prisma.advertisement.count({
      where: { ownerType: 'SUPER_ADMIN' },
    });

    if (currentCount >= 8) {
      const error: any = new Error('Maximum limit of 8 advertisement slides reached for the platform. Please delete an existing slide to upload a new one.');
      error.statusCode = 400;
      throw error;
    }

    // Determine default display order if not specified
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined || displayOrder === null) {
      const highestOrder = await prisma.advertisement.findFirst({
        where: { ownerType: 'SUPER_ADMIN' },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      displayOrder = (highestOrder?.displayOrder ?? -1) + 1;
    }

    return await prisma.advertisement.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        imageUrl: data.imageUrl.trim(),
        redirectUrl: data.redirectUrl?.trim() || null,
        displayOrder,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        ownerType: 'SUPER_ADMIN',
        hospitalId: null,
        createdById: userId,
      },
    });
  }

  /**
   * Create an advertisement for Hospital Admin (Limit: 3 per hospital)
   */
  static async createHospitalAdvertisement(hospitalId: string, data: AdvertisementData, userId: string) {
    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }
    if (!data.title || !data.title.trim()) {
      throw new Error('Advertisement title is required');
    }
    if (!data.imageUrl || !data.imageUrl.trim()) {
      throw new Error('Advertisement image is required');
    }

    const currentCount = await prisma.advertisement.count({
      where: { ownerType: 'HOSPITAL_ADMIN', hospitalId },
    });

    if (currentCount >= 3) {
      const error: any = new Error('Maximum limit of 3 advertisement slides reached for this hospital. Please delete an existing slide to upload a new one.');
      error.statusCode = 400;
      throw error;
    }

    let displayOrder = data.displayOrder;
    if (displayOrder === undefined || displayOrder === null) {
      const highestOrder = await prisma.advertisement.findFirst({
        where: { ownerType: 'HOSPITAL_ADMIN', hospitalId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      displayOrder = (highestOrder?.displayOrder ?? -1) + 1;
    }

    return await prisma.advertisement.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        imageUrl: data.imageUrl.trim(),
        redirectUrl: data.redirectUrl?.trim() || null,
        displayOrder,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        ownerType: 'HOSPITAL_ADMIN',
        hospitalId,
        createdById: userId,
      },
    });
  }

  /**
   * Update an advertisement (edit fields or replace image)
   * Editing / replacing does NOT increment slide count!
   */
  static async updateAdvertisement(
    id: string,
    data: Partial<AdvertisementData>,
    scope: { isSuperAdmin: boolean; hospitalId?: string | null }
  ) {
    const ad = await prisma.advertisement.findUnique({
      where: { id },
    });

    if (!ad) {
      const error: any = new Error('Advertisement not found');
      error.statusCode = 404;
      throw error;
    }

    // Role and Scope Enforcement
    if (!scope.isSuperAdmin) {
      if (ad.ownerType !== 'HOSPITAL_ADMIN' || ad.hospitalId !== scope.hospitalId) {
        const error: any = new Error('Access denied: You can only modify advertisements belonging to your hospital');
        error.statusCode = 403;
        throw error;
      }
    } else {
      if (ad.ownerType !== 'SUPER_ADMIN') {
        const error: any = new Error('Super Admin can only manage platform-level advertisements directly here');
        error.statusCode = 403;
        throw error;
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl.trim();
    if (data.redirectUrl !== undefined) updateData.redirectUrl = data.redirectUrl?.trim() || null;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    return await prisma.advertisement.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Toggle Advertisement active status
   */
  static async toggleStatus(
    id: string,
    scope: { isSuperAdmin: boolean; hospitalId?: string | null }
  ) {
    const ad = await prisma.advertisement.findUnique({
      where: { id },
    });

    if (!ad) {
      const error: any = new Error('Advertisement not found');
      error.statusCode = 404;
      throw error;
    }

    if (!scope.isSuperAdmin) {
      if (ad.ownerType !== 'HOSPITAL_ADMIN' || ad.hospitalId !== scope.hospitalId) {
        const error: any = new Error('Access denied: You can only modify advertisements belonging to your hospital');
        error.statusCode = 403;
        throw error;
      }
    } else {
      if (ad.ownerType !== 'SUPER_ADMIN') {
        const error: any = new Error('Super Admin can only manage platform-level advertisements');
        error.statusCode = 403;
        throw error;
      }
    }

    return await prisma.advertisement.update({
      where: { id },
      data: {
        isActive: !ad.isActive,
      },
    });
  }

  /**
   * Delete an advertisement
   * Frees up a slot for subsequent uploads!
   */
  static async deleteAdvertisement(
    id: string,
    scope: { isSuperAdmin: boolean; hospitalId?: string | null }
  ) {
    const ad = await prisma.advertisement.findUnique({
      where: { id },
    });

    if (!ad) {
      const error: any = new Error('Advertisement not found');
      error.statusCode = 404;
      throw error;
    }

    if (!scope.isSuperAdmin) {
      if (ad.ownerType !== 'HOSPITAL_ADMIN' || ad.hospitalId !== scope.hospitalId) {
        const error: any = new Error('Access denied: You can only delete advertisements belonging to your hospital');
        error.statusCode = 403;
        throw error;
      }
    } else {
      if (ad.ownerType !== 'SUPER_ADMIN') {
        const error: any = new Error('Super Admin can only manage platform-level advertisements');
        error.statusCode = 403;
        throw error;
      }
    }

    await prisma.advertisement.delete({
      where: { id },
    });

    return { success: true, message: 'Advertisement deleted successfully' };
  }

  /**
   * Reorder advertisements
   */
  static async reorderAdvertisements(
    items: Array<{ id: string; displayOrder: number }>,
    scope: { isSuperAdmin: boolean; hospitalId?: string | null }
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Valid list of advertisements to reorder is required');
    }

    // Verify all items belong to current owner/hospital scope
    const ids = items.map((i) => i.id);
    const ads = await prisma.advertisement.findMany({
      where: { id: { in: ids } },
    });

    if (ads.length !== items.length) {
      const error: any = new Error('One or more advertisements not found');
      error.statusCode = 404;
      throw error;
    }

    for (const ad of ads) {
      if (!scope.isSuperAdmin) {
        if (ad.ownerType !== 'HOSPITAL_ADMIN' || ad.hospitalId !== scope.hospitalId) {
          const error: any = new Error('Access denied: All reordered advertisements must belong to your hospital');
          error.statusCode = 403;
          throw error;
        }
      } else {
        if (ad.ownerType !== 'SUPER_ADMIN') {
          const error: any = new Error('Access denied: Super Admin can only reorder platform-level advertisements');
          error.statusCode = 403;
          throw error;
        }
      }
    }

    // Execute updates in transaction
    await prisma.$transaction(
      items.map((item) =>
        prisma.advertisement.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    return { success: true, message: 'Advertisements reordered successfully' };
  }

  /**
   * Process and save uploaded advertisement image
   * Supports: JPG, JPEG, PNG, WebP
   * Max Size: 8MB
   * Saves to local disk, Neon S3, and StoredFile table for resilience
   */
  static async uploadAdvertisementImage(fileData: string, prefix = 'ad') {
    if (!fileData) {
      const error: any = new Error('Image data (base64) is required');
      error.statusCode = 400;
      throw error;
    }

    let base64Content = fileData;
    let extension = '.jpg';
    let mimeType = 'image/jpeg';

    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      const matches = fileData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        const error: any = new Error('Invalid image format. Supported formats: JPG, JPEG, PNG, and WebP.');
        error.statusCode = 400;
        throw error;
      }

      let ext = matches[1].toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      if (!['jpg', 'png', 'webp'].includes(ext)) {
        const error: any = new Error('Unsupported image format. Allowed formats: JPG, JPEG, PNG, and WebP.');
        error.statusCode = 400;
        throw error;
      }

      extension = `.${ext}`;
      mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      base64Content = matches[2];
    }

    const buffer = Buffer.from(base64Content, 'base64');
    if (buffer.length > 8 * 1024 * 1024) {
      const error: any = new Error('Image size exceeds maximum limit of 8MB');
      error.statusCode = 400;
      throw error;
    }

    const randomName = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;
    const filePath = path.join(ADS_DIR, randomName);

    // 1. Write to local uploads/advertisements directory
    try {
      fs.writeFileSync(filePath, buffer);
    } catch (writeErr) {
      console.warn('Failed to write advertisement image to disk:', writeErr);
    }

    let publicUrl = `/uploads/advertisements/${randomName}`;

    // 2. Upload to Neon Object Storage if configured
    try {
      const s3Url = await uploadToStorage(`advertisements/${randomName}`, buffer, mimeType);
      if (s3Url) {
        publicUrl = s3Url;
      }
    } catch (s3Err) {
      console.warn('Neon storage upload warning for advertisement:', s3Err);
    }

    // 3. Resilient backup in StoredFile DB table
    try {
      await prisma.storedFile.upsert({
        where: { path: `advertisements/${randomName}` },
        update: {
          fileData: base64Content,
          size: buffer.length,
          mimeType,
        },
        create: {
          path: `advertisements/${randomName}`,
          filename: randomName,
          mimeType,
          fileData: base64Content,
          size: buffer.length,
        },
      });
    } catch (dbErr) {
      console.warn('Could not backup advertisement image to StoredFile:', dbErr);
    }

    return {
      url: publicUrl,
      filename: randomName,
      mimeType,
      size: buffer.length,
    };
  }
}
