export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  isAvailable: boolean;
  isVerified?: boolean;
  rating?: number;
  completedServices?: number;
}

export interface ServiceRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientLocation: Location;
  hospitalId: string;
  hospitalName: string;
  hospitalLocation: Location;
  distance: number;
  estimatedPay: number;
  urgency: 'low' | 'medium' | 'high';
  status: ServiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  landmark?: string;
}

export interface PatientUser {
  name: string;
  phone?: string;
  avgRating?: number;
  totalRatings?: number;
}

export type ServiceStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Service extends ServiceRequest {
  helperId: string;
  helperName: string;
  acceptedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  actualPay?: number;
  helperRating?: number;
  patientRating?: number;
  otp?: string;
  otpVerified?: boolean;
  patientUser?: PatientUser;
  patient?: PatientUser;
  serviceType: string[];
  description?: string;
  estimatedFare?: number;
  expiresInMs?: number;
}

export interface Earnings {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
}

// A lightweight, focused shape for the currently active job shown in the
// dashboard/current-job components. This mirrors the important fields used by
// the UI while keeping the full `Service` type available for API responses.
export interface CurrentJob {
  id: string;
  status: ServiceStatus;
  patientName?: string;
  patientPhone?: string;
  patientLocation?: Location;
  patientUser?: PatientUser;
  hospitalName?: string;
  hospitalLocation?: Location;
  location?: string;
  distance?: number;
  estimatedPay?: number;
  estimatedEarnings?: number;
  helperId?: string;
  acceptedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  otp?: string;
  serviceType?: string[];
  description?: string;
}
