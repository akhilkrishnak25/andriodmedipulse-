import prisma from '../config/prisma';
import { AuditService } from '../utils/audit';
import ExcelJS from 'exceljs';
import { Response } from 'express';

export type PlatformFeeType = 'FIXED' | 'PERCENTAGE' | 'NONE';

export interface FeeCalculationResult {
  hospitalId: string;
  hospitalName?: string;
  serviceAmount: number;
  platformFee: number;
  platformFeeType: PlatformFeeType;
  feeValue: number;
  isEnabled: boolean;
  totalAmount: number;
  description: string;
}

export class PlatformFeeService {
  /**
   * Retrieves the configured platform fee for a specific hospital
   * Falls back safely to default Fixed ₹20 (enabled) if not yet configured
   */
  static async getHospitalFeeConfig(hospitalId: string) {
    let config = await prisma.hospitalPlatformFee.findUnique({
      where: { hospitalId },
      include: {
        hospital: {
          select: { id: true, name: true, code: true, status: true, city: true, state: true },
        },
      },
    });

    if (!config) {
      // Auto-create default configuration for hospital
      try {
        config = await prisma.hospitalPlatformFee.create({
          data: {
            hospitalId,
            feeType: 'FIXED',
            feeValue: 20,
            isEnabled: true,
          },
          include: {
            hospital: {
              select: { id: true, name: true, code: true, status: true, city: true, state: true },
            },
          },
        });
      } catch {
        // Return fallback object if race condition occurs
        return {
          id: '',
          hospitalId,
          feeType: 'FIXED' as const,
          feeValue: 20,
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          hospital: null,
        };
      }
    }

    return config;
  }

  /**
   * Authoritative backend fee calculation for any hospital service
   * Prevents frontend manipulation and ensures precise 2-decimal rounding
   */
  static async calculateFee(hospitalId: string, serviceAmount: number): Promise<FeeCalculationResult> {
    const safeServiceAmount = Math.max(0, Number(serviceAmount) || 0);

    const config = await this.getHospitalFeeConfig(hospitalId);

    // If disabled or service is free, platform fee is 0
    if (!config.isEnabled || safeServiceAmount === 0) {
      return {
        hospitalId,
        hospitalName: config.hospital?.name,
        serviceAmount: safeServiceAmount,
        platformFee: 0,
        platformFeeType: 'NONE',
        feeValue: config.feeValue,
        isEnabled: false,
        totalAmount: safeServiceAmount,
        description: 'Platform fee disabled (₹0.00)',
      };
    }

    let calculatedFee = 0;
    let feeType: PlatformFeeType = 'FIXED';
    let description = '';

    if (config.feeType === 'PERCENTAGE') {
      feeType = 'PERCENTAGE';
      // Percentage calculation: (Transaction Amount * Platform Fee Percentage) / 100
      const rawFee = (safeServiceAmount * config.feeValue) / 100;
      calculatedFee = Math.round(rawFee * 100) / 100;
      description = `${config.feeValue}% of ₹${safeServiceAmount.toFixed(2)}`;
    } else {
      feeType = 'FIXED';
      calculatedFee = Math.round(config.feeValue * 100) / 100;
      description = `Fixed ₹${config.feeValue.toFixed(2)}`;
    }

    // Ensure non-negative fee
    calculatedFee = Math.max(0, calculatedFee);
    const totalAmount = Math.round((safeServiceAmount + calculatedFee) * 100) / 100;

    return {
      hospitalId,
      hospitalName: config.hospital?.name,
      serviceAmount: safeServiceAmount,
      platformFee: calculatedFee,
      platformFeeType: feeType,
      feeValue: config.feeValue,
      isEnabled: true,
      totalAmount,
      description,
    };
  }

  /**
   * Super Admin: Update platform fee configuration for a specific hospital
   */
  static async updateHospitalFeeConfig(
    hospitalId: string,
    data: {
      feeType: 'FIXED' | 'PERCENTAGE';
      feeValue: number;
      isEnabled: boolean;
    },
    requestingUserId?: string
  ) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new Error(`Hospital with ID ${hospitalId} not found`);
    }

    if (!['FIXED', 'PERCENTAGE'].includes(data.feeType)) {
      throw new Error('Invalid feeType. Must be either "FIXED" or "PERCENTAGE"');
    }

    const feeValue = Number(data.feeValue);
    if (isNaN(feeValue) || feeValue < 0) {
      throw new Error('feeValue must be a valid non-negative number');
    }

    if (data.feeType === 'PERCENTAGE' && feeValue > 100) {
      throw new Error('Percentage platform fee cannot exceed 100%');
    }

    const isEnabled = Boolean(data.isEnabled);

    const updatedConfig = await prisma.hospitalPlatformFee.upsert({
      where: { hospitalId },
      update: {
        feeType: data.feeType,
        feeValue,
        isEnabled,
      },
      create: {
        hospitalId,
        feeType: data.feeType,
        feeValue,
        isEnabled,
      },
      include: {
        hospital: {
          select: { id: true, name: true, code: true, city: true, state: true },
        },
      },
    });

    if (requestingUserId) {
      await AuditService.log({
        userId: requestingUserId,
        action: 'UPDATE_HOSPITAL_PLATFORM_FEE',
        entity: 'HospitalPlatformFee',
        entityId: updatedConfig.id,
        details: {
          hospitalId,
          hospitalName: hospital.name,
          feeType: data.feeType,
          feeValue,
          isEnabled,
        },
      });
    }

    return updatedConfig;
  }

  /**
   * Super Admin: List all hospitals with their platform fee settings and transaction revenue
   */
  static async getAllHospitalFeeConfigs(search?: string) {
    const whereClause: any = {};
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    const hospitals = await prisma.hospital.findMany({
      where: whereClause,
      include: {
        platformFeeConfig: true,
        appointments: {
          where: {
            status: { in: ['CONFIRMED', 'COMPLETED', 'WAITING', 'IN_CONSULTATION'] },
          },
          select: {
            id: true,
            consultationFee: true,
            platformFee: true,
            platformFeeType: true,
            totalAmount: true,
            appointmentDate: true,
            bookingType: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return hospitals.map((h) => {
      const totalTransactions = h.appointments.length;
      const platformFeeCollected = h.appointments.reduce((sum, a) => sum + (a.platformFee || 0), 0);
      const serviceRevenue = h.appointments.reduce((sum, a) => sum + (a.consultationFee || 0), 0);
      const totalRevenue = h.appointments.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
      const avgFee = totalTransactions > 0 ? platformFeeCollected / totalTransactions : 0;

      return {
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalCode: h.code,
        city: h.city,
        state: h.state,
        status: h.status,
        logoUrl: h.logoUrl,
        platformFeeConfig: h.platformFeeConfig || {
          feeType: 'FIXED',
          feeValue: 20,
          isEnabled: true,
        },
        metrics: {
          totalTransactions,
          platformFeeCollected: Math.round(platformFeeCollected * 100) / 100,
          serviceRevenue: Math.round(serviceRevenue * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averageFee: Math.round(avgFee * 100) / 100,
        },
      };
    });
  }

  /**
   * Super Admin: Financial report with total, hospital-wise, date-wise, and recent transaction breakdowns
   */
  static async getPlatformFeeRevenueReport(filters?: {
    startDate?: string;
    endDate?: string;
    hospitalId?: string;
  }) {
    const where: any = {
      status: { in: ['CONFIRMED', 'COMPLETED', 'WAITING', 'IN_CONSULTATION'] },
    };

    if (filters?.hospitalId) {
      where.hospitalId = filters.hospitalId;
    }

    if (filters?.startDate && filters?.endDate) {
      where.appointmentDate = {
        gte: filters.startDate,
        lte: filters.endDate,
      };
    } else if (filters?.startDate) {
      where.appointmentDate = { gte: filters.startDate };
    } else if (filters?.endDate) {
      where.appointmentDate = { lte: filters.endDate };
    }

    const [appointments, hospitals, feeConfigs] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          hospital: { select: { id: true, name: true, code: true, city: true, state: true } },
          doctor: { select: { id: true, name: true, specialization: true } },
          patient: { select: { id: true, fullName: true, mobileNumber: true } },
          payment: { select: { id: true, status: true, paymentMethod: true, razorpayPaymentId: true } },
        },
        orderBy: { appointmentDate: 'desc' },
      }),
      prisma.hospital.findMany({
        where: filters?.hospitalId ? { id: filters.hospitalId } : {},
        select: { id: true, name: true, code: true, city: true, state: true },
        orderBy: { name: 'asc' },
      }),
      prisma.hospitalPlatformFee.findMany(),
    ]);

    const feeConfigMap = new Map<string, any>();
    for (const c of feeConfigs) {
      feeConfigMap.set(c.hospitalId, c);
    }

    let totalPlatformFeeCollected = 0;
    let totalServiceRevenue = 0;
    let totalRevenue = 0;
    const totalTransactions = appointments.length;

    // Hospital-wise map
    const hospitalMap = new Map<string, any>();
    for (const h of hospitals) {
      const cfg = feeConfigMap.get(h.id) || { feeType: 'FIXED', feeValue: 20, isEnabled: true };
      hospitalMap.set(h.id, {
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalCode: h.code,
        city: h.city,
        state: h.state,
        feeType: cfg.feeType,
        feeValue: cfg.feeValue,
        isEnabled: cfg.isEnabled,
        totalTransactions: 0,
        platformFeeCollected: 0,
        serviceRevenue: 0,
        totalCollected: 0,
        averagePlatformFee: 0,
      });
    }

    // Date-wise map
    const dateMap = new Map<string, any>();

    for (const apt of appointments) {
      const pFee = Number(apt.platformFee || 0);
      const sFee = Number(apt.consultationFee || 0);
      const tAmt = Number(apt.totalAmount || (pFee + sFee));

      totalPlatformFeeCollected += pFee;
      totalServiceRevenue += sFee;
      totalRevenue += tAmt;

      // Update hospital map
      if (hospitalMap.has(apt.hospitalId)) {
        const hEntry = hospitalMap.get(apt.hospitalId);
        hEntry.totalTransactions += 1;
        hEntry.platformFeeCollected += pFee;
        hEntry.serviceRevenue += sFee;
        hEntry.totalCollected += tAmt;
      }

      // Update date map
      const dKey = apt.appointmentDate || 'Unknown Date';
      if (!dateMap.has(dKey)) {
        dateMap.set(dKey, {
          date: dKey,
          totalTransactions: 0,
          platformFee: 0,
          serviceAmount: 0,
          totalAmount: 0,
        });
      }
      const dEntry = dateMap.get(dKey);
      dEntry.totalTransactions += 1;
      dEntry.platformFee += pFee;
      dEntry.serviceAmount += sFee;
      dEntry.totalAmount += tAmt;
    }

    // Compute averages for hospital breakdown
    const hospitalWiseRevenue = Array.from(hospitalMap.values()).map((h) => ({
      ...h,
      platformFeeCollected: Math.round(h.platformFeeCollected * 100) / 100,
      serviceRevenue: Math.round(h.serviceRevenue * 100) / 100,
      totalCollected: Math.round(h.totalCollected * 100) / 100,
      averagePlatformFee:
        h.totalTransactions > 0
          ? Math.round((h.platformFeeCollected / h.totalTransactions) * 100) / 100
          : 0,
    }));

    // Date-wise reports sorted descending by date
    const dateWiseReports = Array.from(dateMap.values())
      .map((d) => ({
        date: d.date,
        totalTransactions: d.totalTransactions,
        platformFee: Math.round(d.platformFee * 100) / 100,
        serviceAmount: Math.round(d.serviceAmount * 100) / 100,
        totalAmount: Math.round(d.totalAmount * 100) / 100,
        averageFee:
          d.totalTransactions > 0
            ? Math.round((d.platformFee / d.totalTransactions) * 100) / 100
            : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Recent transactions list
    const recentTransactions = appointments.slice(0, 50).map((apt) => ({
      id: apt.id,
      appointmentNumber: apt.appointmentNumber,
      appointmentDate: apt.appointmentDate,
      timeSlot: apt.timeSlot,
      hospitalId: apt.hospitalId,
      hospitalName: apt.hospital?.name || 'Hospital',
      hospitalCode: apt.hospital?.code || 'HOSP',
      doctorName: apt.doctor?.name || 'Doctor',
      patientName: apt.patient?.fullName || 'Patient',
      patientMobile: apt.patient?.mobileNumber || '',
      consultationFee: apt.consultationFee,
      platformFee: apt.platformFee,
      platformFeeType: apt.platformFeeType || 'FIXED',
      totalAmount: apt.totalAmount,
      status: apt.status,
      bookingType: apt.bookingType,
      paymentStatus: apt.payment?.status || (apt.bookingType === 'OFFLINE' ? 'PAID_COUNTER' : 'PENDING'),
      paymentMethod: apt.payment?.paymentMethod || (apt.bookingType === 'OFFLINE' ? 'Cash/Counter' : 'Razorpay'),
      razorpayPaymentId: apt.payment?.razorpayPaymentId || null,
    }));

    const activeHospitalsWithFee = hospitalWiseRevenue.filter((h) => h.isEnabled).length;
    const disabledHospitalsCount = hospitalWiseRevenue.filter((h) => !h.isEnabled).length;
    const avgPerTx = totalTransactions > 0 ? totalPlatformFeeCollected / totalTransactions : 0;

    return {
      summary: {
        totalPlatformFeeCollected: Math.round(totalPlatformFeeCollected * 100) / 100,
        totalServiceRevenue: Math.round(totalServiceRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTransactions,
        platformFeePerTransaction: Math.round(avgPerTx * 100) / 100,
        activeHospitalsWithFee,
        disabledHospitalsCount,
      },
      hospitalWiseRevenue,
      dateWiseReports,
      recentTransactions,
    };
  }

  /**
   * Super Admin: Export comprehensive Platform Fee Report in Excel format
   */
  static async exportPlatformFeeExcel(
    res: Response,
    filters?: { startDate?: string; endDate?: string; hospitalId?: string }
  ) {
    const reportData = await this.getPlatformFeeRevenueReport(filters);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RocketWheel MedPulse Super Admin';
    workbook.created = new Date();

    // -------------------------------------------------------------
    // SHEET 1: Hospital-Wise Platform Revenue
    // -------------------------------------------------------------
    const hospitalSheet = workbook.addWorksheet('Hospital-Wise Revenue');
    hospitalSheet.columns = [
      { header: 'Hospital Name', key: 'hospitalName', width: 32 },
      { header: 'Hospital Code', key: 'hospitalCode', width: 16 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Fee Type', key: 'feeType', width: 14 },
      { header: 'Configured Fee', key: 'configuredFee', width: 16 },
      { header: 'Fee Status', key: 'feeStatus', width: 14 },
      { header: 'Total Transactions', key: 'totalTransactions', width: 18 },
      { header: 'Platform Fee Collected (₹)', key: 'platformFeeCollected', width: 25 },
      { header: 'Hospital Service Revenue (₹)', key: 'serviceRevenue', width: 26 },
      { header: 'Total Gross Volume (₹)', key: 'totalCollected', width: 22 },
      { header: 'Avg Fee / Tx (₹)', key: 'averagePlatformFee', width: 16 },
    ];

    const hHeader = hospitalSheet.getRow(1);
    hHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E20E0' }, // Royal Blue
    };
    hHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const h of reportData.hospitalWiseRevenue) {
      hospitalSheet.addRow({
        hospitalName: h.hospitalName,
        hospitalCode: h.hospitalCode,
        city: h.city,
        feeType: h.feeType,
        configuredFee: h.feeType === 'PERCENTAGE' ? `${h.feeValue}%` : `₹${h.feeValue}`,
        feeStatus: h.isEnabled ? 'ENABLED' : 'DISABLED',
        totalTransactions: h.totalTransactions,
        platformFeeCollected: h.platformFeeCollected,
        serviceRevenue: h.serviceRevenue,
        totalCollected: h.totalCollected,
        averagePlatformFee: h.averagePlatformFee,
      });
    }

    // -------------------------------------------------------------
    // SHEET 2: Date-Wise Platform Revenue
    // -------------------------------------------------------------
    const dateSheet = workbook.addWorksheet('Date-Wise Platform Revenue');
    dateSheet.columns = [
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Total Transactions', key: 'totalTransactions', width: 18 },
      { header: 'Platform Fee (₹)', key: 'platformFee', width: 20 },
      { header: 'Service Revenue (₹)', key: 'serviceAmount', width: 22 },
      { header: 'Total Amount (₹)', key: 'totalAmount', width: 20 },
      { header: 'Avg Fee / Tx (₹)', key: 'averageFee', width: 16 },
    ];

    const dHeader = dateSheet.getRow(1);
    dHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D9488' }, // Teal
    };
    dHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const d of reportData.dateWiseReports) {
      dateSheet.addRow(d);
    }

    // -------------------------------------------------------------
    // SHEET 3: Transactions Log
    // -------------------------------------------------------------
    const txSheet = workbook.addWorksheet('Transactions Breakdown');
    txSheet.columns = [
      { header: 'Booking ID', key: 'appointmentNumber', width: 20 },
      { header: 'Date', key: 'appointmentDate', width: 14 },
      { header: 'Hospital', key: 'hospitalName', width: 26 },
      { header: 'Doctor', key: 'doctorName', width: 22 },
      { header: 'Patient', key: 'patientName', width: 20 },
      { header: 'Consultation Fee (₹)', key: 'consultationFee', width: 20 },
      { header: 'Platform Fee (₹)', key: 'platformFee', width: 18 },
      { header: 'Fee Calculation Type', key: 'platformFeeType', width: 22 },
      { header: 'Total Amount (₹)', key: 'totalAmount', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 16 },
      { header: 'Payment Method', key: 'paymentMethod', width: 20 },
      { header: 'Payment Ref (Razorpay)', key: 'razorpayPaymentId', width: 24 },
    ];

    const tHeader = txSheet.getRow(1);
    tHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    tHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' }, // Slate
    };
    tHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const tx of reportData.recentTransactions) {
      txSheet.addRow(tx);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="MedPulse_Platform_Fee_Report_${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
