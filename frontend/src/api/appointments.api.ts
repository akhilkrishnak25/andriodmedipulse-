import { api, getApiBaseUrl } from './client';
import { Appointment, QueueStatus, FeeCalculationResponse } from '../types';
import { saveOrOpenBlob } from '../utils/fileDownload';

export interface CreateAppointmentDTO {
  hospitalId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string;
  timeSlot?: string;
  patient: {
    fullName: string;
    mobileNumber: string;
    email: string;
    age?: number | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    address?: string | null;
    bloodGroup?: string | null;
    emergencyContact?: string | null;
  };
  notes?: string | null;
}

export interface PendingAppointmentResponse {
  appointment: Appointment;
  paymentOrder: {
    orderId: string;
    amount: number;
    amountRupees: number;
    currency: string;
    receipt: string;
    keyId: string;
    appointmentId: string;
  };
}

export const appointmentsApi = {
  getFeeBreakdown: (hospitalId: string, amount: number) =>
    api.get<FeeCalculationResponse>(
      `/appointments/fee-breakdown?hospitalId=${encodeURIComponent(hospitalId)}&amount=${amount}`
    ),

  create: (dto: CreateAppointmentDTO) =>
    api.post<PendingAppointmentResponse>('/appointments', dto),

  confirmPayment: (dto: {
    appointmentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => api.post<{ appointment: Appointment; alreadyConfirmed: boolean }>('/appointments/confirm-payment', dto),

  getById: (id: string) => api.get<Appointment>(`/appointments/${id}`),

  getQueueStatus: (id: string) => api.get<QueueStatus>(`/appointments/${id}/queue`),

  verifyOp: (token: string) => api.get<any>(`/appointments/verify-op/${token}`),

  getPdfUrl: (idOrOp: string) => `${getApiBaseUrl()}/appointments/${idOrOp}/pdf`,

  downloadPdf: async (idOrOp: string, filename?: string) => {
    const baseUrl = getApiBaseUrl();
    const token = localStorage.getItem('rocketwheel_access_token') || localStorage.getItem('medipulse_access_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/appointments/${idOrOp}/pdf`, { headers });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.message || 'Failed to download Digital OP PDF');
    }
    const blob = await res.blob();
    await saveOrOpenBlob(blob, filename || `Digital_OP_${idOrOp}.pdf`, {
      shareTitle: `Digital OP Slip - ${idOrOp}`,
    });
  },
};
