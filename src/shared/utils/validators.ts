/**
 * Shared validation utility functions
 */

export const isValidPhone = (phone: string): boolean => {
  // Indian phone number: 10 digits starting with 6-9
  return /^[6-9]\d{9}$/.test(phone);
};

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidOTP = (otp: string): boolean => {
  return /^\d{6}$/.test(otp);
};

export const isValidAadhaar = (aadhaar: string): boolean => {
  // 12 digits
  return /^\d{12}$/.test(aadhaar);
};

export const isValidName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 50;
};
