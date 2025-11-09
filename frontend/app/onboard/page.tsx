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
    tradingAsName: '',
    legalEntityIdentifier: '',
    dateOfIncorporation: '',
    countryOfIncorporation: '',
    companyRegistrationNumber: '',
    registeredAddress: '',
    principalPlaceOfBusiness: '',
    corporateTaxId: '',
    ultimateBeneficialOwners: '',
    natureOfBusiness: '',
    primaryProductsServices: '',
    purposeOfRelationship: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingRequest, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Demo data for quick testing
  const demoCompanies = {
    microsoft: {
      vendorName: 'Microsoft Corporation',
      contactEmail: 'contact@microsoft.com',
      tradingAsName: 'Microsoft',
      legalEntityIdentifier: 'INF9MR6LARFH6YFMYA47',
      dateOfIncorporation: '1975-04-04',
      countryOfIncorporation: 'United States',
      companyRegistrationNumber: '600413485',
      registeredAddress: 'One Microsoft Way, Redmond, WA 98052',
      principalPlaceOfBusiness: 'Redmond, Washington, United States',
      corporateTaxId: '91-1144442',
      ultimateBeneficialOwners: 'Satya Nadella (CEO), Public Shareholders (NASDAQ: MSFT)',
      natureOfBusiness: 'Technology - Software, Cloud Services, Hardware',
      primaryProductsServices: 'Windows OS, Microsoft Office, Azure Cloud, Xbox, Surface devices, LinkedIn, GitHub',
      purposeOfRelationship: 'Enterprise software licensing and cloud services partnership',
    },
    theranos: {
      vendorName: 'Theranos Inc',
      contactEmail: 'admin@theranos-fake.xyz',
      tradingAsName: 'Theranos',
      legalEntityIdentifier: 'N/A',
      dateOfIncorporation: '2003-09-01',
      countryOfIncorporation: 'United States',
      companyRegistrationNumber: 'C2745575',
      registeredAddress: '1601 S California Ave, Palo Alto, CA 94304',
      principalPlaceOfBusiness: 'Palo Alto, California (Defunct)',
      corporateTaxId: '11-1111111',
      ultimateBeneficialOwners: 'Elizabeth Holmes (Former CEO - Convicted), Ramesh Balwani (Former COO - Convicted)',
      natureOfBusiness: 'Healthcare Technology (Defunct) - Blood Testing Fraud',
      primaryProductsServices: 'Claimed revolutionary blood testing technology that was fraudulent. Company sued in 2023 for fraud. SEC charges filed. Federal investigation ongoing. Criminal charges. Ponzi scheme allegations. Money laundering investigation by FBI. Multiple regulatory violations by FDA.',
      purposeOfRelationship: 'TESTING FRAUD DETECTION - High Risk Vendor',
    },
    meta: {
      vendorName: 'Meta Platforms, Inc.',
      contactEmail: 'business@meta.com',
      tradingAsName: 'Meta (formerly Facebook)',
      legalEntityIdentifier: '549300RLBH1Y6CEQV023',
      dateOfIncorporation: '2004-07-29',
      countryOfIncorporation: 'United States',
      companyRegistrationNumber: 'C2745575',
      registeredAddress: '1 Hacker Way, Menlo Park, CA 94025',
      principalPlaceOfBusiness: 'Menlo Park, California, United States',
      corporateTaxId: '20-1665019',
      ultimateBeneficialOwners: 'Mark Zuckerberg (CEO & Controlling Shareholder), Public Shareholders (NASDAQ: META)',
      natureOfBusiness: 'Social Media & Technology - Metaverse Development',
      primaryProductsServices: 'Facebook, Instagram, WhatsApp, Messenger, Oculus VR, Reality Labs, Meta Quest',
      purposeOfRelationship: 'Digital advertising partnership and API integration services',
    },
    nestle: {
      vendorName: 'Nestlé S.A.',
      contactEmail: 'corporate@nestle.com',
      tradingAsName: 'Nestlé',
      legalEntityIdentifier: '529900XYFLVZE103H460',
      dateOfIncorporation: '1866-01-01',
      countryOfIncorporation: 'Switzerland',
      companyRegistrationNumber: 'CHE-103.622.035',
      registeredAddress: 'Avenue Nestlé 55, 1800 Vevey, Switzerland',
      principalPlaceOfBusiness: 'Vevey, Switzerland',
      corporateTaxId: '98-0000000',
      ultimateBeneficialOwners: 'Public Shareholders (SIX: NESN), Institutional Investors',
      natureOfBusiness: 'Food & Beverage Manufacturing - Global Consumer Goods',
      primaryProductsServices: 'Nescafé, KitKat, Maggi, Purina, Gerber, Perrier, San Pellegrino, Häagen-Dazs, nutrition products',
      purposeOfRelationship: 'Supply chain financing and international payment processing',
    },
  };

  const loadDemoData = (company: keyof typeof demoCompanies) => {
    setFormData(demoCompanies[company]);
    setErrors({});
    setSubmitError(null);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof OnboardingRequest, string>> = {};

    if (!formData.vendorName.trim()) {
      newErrors.vendorName = 'Company name is required';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!validateEmail(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }

    if (!formData.tradingAsName.trim()) {
      newErrors.tradingAsName = 'Trading As (DBA) Name is required';
    }

    if (!formData.dateOfIncorporation.trim()) {
      newErrors.dateOfIncorporation = 'Date of Incorporation is required';
    }

    if (!formData.countryOfIncorporation.trim()) {
      newErrors.countryOfIncorporation = 'Country of Incorporation is required';
    }

    if (!formData.companyRegistrationNumber.trim()) {
      newErrors.companyRegistrationNumber = 'Company Registration Number is required';
    }

    if (!formData.registeredAddress.trim()) {
      newErrors.registeredAddress = 'Registered Address is required';
    }

    if (!formData.principalPlaceOfBusiness.trim()) {
      newErrors.principalPlaceOfBusiness = 'Principal Place of Business is required';
    }

    if (!formData.corporateTaxId.trim()) {
      newErrors.corporateTaxId = 'Corporate Tax ID / TIN is required';
    }

    if (!formData.ultimateBeneficialOwners.trim()) {
      newErrors.ultimateBeneficialOwners = 'Ultimate Beneficial Owners is required';
    }

    if (!formData.natureOfBusiness.trim()) {
      newErrors.natureOfBusiness = 'Nature of Business / Industry is required';
    }

    if (!formData.primaryProductsServices.trim()) {
      newErrors.primaryProductsServices = 'Primary Products/Services is required';
    }

    if (!formData.purposeOfRelationship.trim()) {
      newErrors.purposeOfRelationship = 'Purpose of Relationship with Bank is required';
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

        {/* Demo Data Buttons */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6 border-2 border-blue-200">
          <p className="text-sm font-semibold text-gray-700 mb-3">🎯 Quick Demo - Load Sample Data:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => loadDemoData('microsoft')}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Microsoft Corporation
            </button>
            <button
              type="button"
              onClick={() => loadDemoData('theranos')}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Theranos Inc
            </button>
            <button
              type="button"
              onClick={() => loadDemoData('meta')}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Meta Platforms
            </button>
            <button
              type="button"
              onClick={() => loadDemoData('nestle')}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Nestlé S.A.
            </button>
          </div>
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

            {/* Trading As (DBA) Name */}
            <div>
              <label htmlFor="tradingAsName" className="block text-sm font-semibold text-gray-700 mb-2">
                Trading As (DBA) Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="tradingAsName"
                value={formData.tradingAsName}
                onChange={(e) => handleChange('tradingAsName', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.tradingAsName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Acme Trading Co."
              />
              {errors.tradingAsName && (
                <p className="mt-2 text-sm text-red-600">{errors.tradingAsName}</p>
              )}
            </div>

            {/* Legal Entity Identifier (LEI) */}
            <div>
              <label htmlFor="legalEntityIdentifier" className="block text-sm font-semibold text-gray-700 mb-2">
                Legal Entity Identifier (LEI)
              </label>
              <input
                type="text"
                id="legalEntityIdentifier"
                value={formData.legalEntityIdentifier}
                onChange={(e) => handleChange('legalEntityIdentifier', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="5493001KJTIIGC8Y1R12"
              />
              <p className="mt-2 text-sm text-gray-500">
                20-character alphanumeric code (optional)
              </p>
            </div>

            {/* Date of Incorporation */}
            <div>
              <label htmlFor="dateOfIncorporation" className="block text-sm font-semibold text-gray-700 mb-2">
                Date of Incorporation <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="dateOfIncorporation"
                value={formData.dateOfIncorporation}
                onChange={(e) => handleChange('dateOfIncorporation', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.dateOfIncorporation ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.dateOfIncorporation && (
                <p className="mt-2 text-sm text-red-600">{errors.dateOfIncorporation}</p>
              )}
            </div>

            {/* Country of Incorporation */}
            <div>
              <label htmlFor="countryOfIncorporation" className="block text-sm font-semibold text-gray-700 mb-2">
                Country of Incorporation <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="countryOfIncorporation"
                value={formData.countryOfIncorporation}
                onChange={(e) => handleChange('countryOfIncorporation', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.countryOfIncorporation ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="United States"
              />
              {errors.countryOfIncorporation && (
                <p className="mt-2 text-sm text-red-600">{errors.countryOfIncorporation}</p>
              )}
            </div>

            {/* Company Registration Number */}
            <div>
              <label htmlFor="companyRegistrationNumber" className="block text-sm font-semibold text-gray-700 mb-2">
                Company Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="companyRegistrationNumber"
                value={formData.companyRegistrationNumber}
                onChange={(e) => handleChange('companyRegistrationNumber', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.companyRegistrationNumber ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="C1234567"
              />
              {errors.companyRegistrationNumber && (
                <p className="mt-2 text-sm text-red-600">{errors.companyRegistrationNumber}</p>
              )}
            </div>

            {/* Registered Address (Legal) */}
            <div>
              <label htmlFor="registeredAddress" className="block text-sm font-semibold text-gray-700 mb-2">
                Registered Address (Legal) <span className="text-red-500">*</span>
              </label>
              <textarea
                id="registeredAddress"
                value={formData.registeredAddress}
                onChange={(e) => handleChange('registeredAddress', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.registeredAddress ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="123 Main Street, Suite 100, City, State, ZIP"
              />
              {errors.registeredAddress && (
                <p className="mt-2 text-sm text-red-600">{errors.registeredAddress}</p>
              )}
            </div>

            {/* Principal Place of Business (Operational HQ) */}
            <div>
              <label htmlFor="principalPlaceOfBusiness" className="block text-sm font-semibold text-gray-700 mb-2">
                Principal Place of Business (Operational HQ) <span className="text-red-500">*</span>
              </label>
              <textarea
                id="principalPlaceOfBusiness"
                value={formData.principalPlaceOfBusiness}
                onChange={(e) => handleChange('principalPlaceOfBusiness', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.principalPlaceOfBusiness ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="456 Business Blvd, City, State, ZIP"
              />
              {errors.principalPlaceOfBusiness && (
                <p className="mt-2 text-sm text-red-600">{errors.principalPlaceOfBusiness}</p>
              )}
            </div>

            {/* Corporate Tax ID / TIN */}
            <div>
              <label htmlFor="corporateTaxId" className="block text-sm font-semibold text-gray-700 mb-2">
                Corporate Tax ID / TIN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="corporateTaxId"
                value={formData.corporateTaxId}
                onChange={(e) => handleChange('corporateTaxId', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.corporateTaxId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="12-3456789"
              />
              {errors.corporateTaxId && (
                <p className="mt-2 text-sm text-red-600">{errors.corporateTaxId}</p>
              )}
            </div>

            {/* Ultimate Beneficial Owners */}
            <div>
              <label htmlFor="ultimateBeneficialOwners" className="block text-sm font-semibold text-gray-700 mb-2">
                Ultimate Beneficial Owners <span className="text-red-500">*</span>
              </label>
              <textarea
                id="ultimateBeneficialOwners"
                value={formData.ultimateBeneficialOwners}
                onChange={(e) => handleChange('ultimateBeneficialOwners', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.ultimateBeneficialOwners ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="List individuals with 25% or more ownership"
              />
              {errors.ultimateBeneficialOwners && (
                <p className="mt-2 text-sm text-red-600">{errors.ultimateBeneficialOwners}</p>
              )}
            </div>

            {/* Nature of Business / Industry */}
            <div>
              <label htmlFor="natureOfBusiness" className="block text-sm font-semibold text-gray-700 mb-2">
                Nature of Business / Industry <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="natureOfBusiness"
                value={formData.natureOfBusiness}
                onChange={(e) => handleChange('natureOfBusiness', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.natureOfBusiness ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="e.g., Technology, Manufacturing, Retail"
              />
              {errors.natureOfBusiness && (
                <p className="mt-2 text-sm text-red-600">{errors.natureOfBusiness}</p>
              )}
            </div>

            {/* Primary Products/Services */}
            <div>
              <label htmlFor="primaryProductsServices" className="block text-sm font-semibold text-gray-700 mb-2">
                Primary Products/Services <span className="text-red-500">*</span>
              </label>
              <textarea
                id="primaryProductsServices"
                value={formData.primaryProductsServices}
                onChange={(e) => handleChange('primaryProductsServices', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.primaryProductsServices ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Describe your main products or services"
              />
              {errors.primaryProductsServices && (
                <p className="mt-2 text-sm text-red-600">{errors.primaryProductsServices}</p>
              )}
            </div>

            {/* Purpose of Relationship with Bank */}
            <div>
              <label htmlFor="purposeOfRelationship" className="block text-sm font-semibold text-gray-700 mb-2">
                Purpose of Relationship with Bank <span className="text-red-500">*</span>
              </label>
              <textarea
                id="purposeOfRelationship"
                value={formData.purposeOfRelationship}
                onChange={(e) => handleChange('purposeOfRelationship', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.purposeOfRelationship ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="e.g., Payment processing, business loans, treasury services"
              />
              {errors.purposeOfRelationship && (
                <p className="mt-2 text-sm text-red-600">{errors.purposeOfRelationship}</p>
              )}
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
