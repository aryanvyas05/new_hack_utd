'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitOnboarding } from '@/lib/api';
import { OnboardingRequest } from '@/types/api';

export default function OnboardPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<OnboardingRequest>({
    vendorName: '',
    contactEmail: '',
    businessDescription: '',
    taxId: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingRequest, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateTaxId = (taxId: string): boolean => {
    const taxIdRegex = /^\d{2}-\d{7}$|^\d{3}-\d{2}-\d{4}$/;
    return taxIdRegex.test(taxId);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof OnboardingRequest, string>> = {};

    if (!formData.vendorName.trim()) {
      newErrors.vendorName = 'Vendor name is required';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!validateEmail(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }

    if (!formData.businessDescription.trim()) {
      newErrors.businessDescription = 'Business description is required';
    } else if (formData.businessDescription.trim().length < 20) {
      newErrors.businessDescription = 'Please provide a more detailed description (at least 20 characters)';
    }

    if (!formData.taxId.trim()) {
      newErrors.taxId = 'Tax ID is required';
    } else if (!validateTaxId(formData.taxId)) {
      newErrors.taxId = 'Please enter a valid Tax ID (XX-XXXXXXX or XXX-XX-XXXX)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitOnboarding(formData);
      router.push(`/status/${response.requestId}`);
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to submit onboarding request. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof OnboardingRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4 text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Vendor Onboarding</h1>
          <p className="text-lg text-gray-600">
            Submit your information for automated risk assessment
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800">{submitError}</p>
              </div>
              <button
                onClick={() => setSubmitError(null)}
                className="text-red-600 hover:text-red-800 ml-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vendor Name */}
            <div>
              <label htmlFor="vendorName" className="block text-sm font-semibold text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="vendorName"
                value={formData.vendorName}
                onChange={(e) => handleChange('vendorName', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.vendorName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Acme Corporation"
              />
              {errors.vendorName && (
                <p className="mt-2 text-sm text-red-600">{errors.vendorName}</p>
              )}
            </div>

            {/* Contact Email */}
            <div>
              <label htmlFor="contactEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                Contact Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="contactEmail"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.contactEmail ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="contact@acme.com"
              />
              {errors.contactEmail && (
                <p className="mt-2 text-sm text-red-600">{errors.contactEmail}</p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                Use your company email domain for faster approval
              </p>
            </div>

            {/* Business Description */}
            <div>
              <label htmlFor="businessDescription" className="block text-sm font-semibold text-gray-700 mb-2">
                Business Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="businessDescription"
                value={formData.businessDescription}
                onChange={(e) => handleChange('businessDescription', e.target.value)}
                rows={6}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.businessDescription ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Describe your business, products, and services in detail..."
              />
              {errors.businessDescription && (
                <p className="mt-2 text-sm text-red-600">{errors.businessDescription}</p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                Provide detailed information about your business for accurate assessment
              </p>
            </div>

            {/* Tax ID */}
            <div>
              <label htmlFor="taxId" className="block text-sm font-semibold text-gray-700 mb-2">
                Tax ID (EIN or SSN) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="taxId"
                value={formData.taxId}
                onChange={(e) => handleChange('taxId', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.taxId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="12-3456789 or 123-45-6789"
              />
              {errors.taxId && (
                <p className="mt-2 text-sm text-red-600">{errors.taxId}</p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                Format: XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  Submit Application
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Info Box */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">What happens next?</p>
                <p>Your application will be analyzed in real-time using AWS AI services. You'll receive an instant decision based on fraud detection and content analysis.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
