/**
 * Auth Feature - Public API
 */

// Pages
export { default as AuthPage } from './pages/AuthPage';
export { default as OnboardingPage } from './pages/OnboardingPage';

// Components
export { OTPInput } from './components/OTPInput';
export { ImageUpload } from './components/ImageUpload';

// Hooks (re-export from core for convenience)
export { useAuth } from '@/core/providers/AuthProvider';
