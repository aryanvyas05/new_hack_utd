import { OnboardingRequest, OnboardingResponse, StatusResponse, ApiError } from '@/types/api';

const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://4idq862c8f.execute-api.us-east-1.amazonaws.com/prod/';

/**
 * Submit a new onboarding request
 * @param data - The onboarding request data
 * @returns Promise with the onboarding response including requestId
 * @throws Error if the request fails
 */
export async function submitOnboarding(data: OnboardingRequest): Promise<OnboardingResponse> {
  try {
    console.log('Submitting to:', `${API_ENDPOINT}onboard`);
    console.log('Data:', data);
    
    // Transform new KYC form to backend format
    const backendPayload = {
      vendorName: data.vendorName,
      contactEmail: data.contactEmail,
      businessDescription: `${data.natureOfBusiness}. Primary products/services: ${data.primaryProductsServices}. Purpose: ${data.purposeOfRelationship}. Trading as: ${data.tradingAsName}. Incorporated in ${data.countryOfIncorporation} on ${data.dateOfIncorporation}. Registration: ${data.companyRegistrationNumber}. Address: ${data.registeredAddress}. Principal place: ${data.principalPlaceOfBusiness}. UBOs: ${data.ultimateBeneficialOwners}.`,
      taxId: data.corporateTaxId || '00-0000000',
      sourceIp: '127.0.0.1'
    };
    
    console.log('Backend payload:', backendPayload);
    
    const response = await fetch(`${API_ENDPOINT}onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendPayload),
    });

    console.log('Response status:', response.status);
    const responseData = await response.json();
    console.log('Response data:', responseData);
    
    // API returns data directly, not wrapped in body
    const body = responseData;

    if (!response.ok) {
      throw new Error(body.error || body.message || 'Failed to submit onboarding request');
    }

    return body as OnboardingResponse;
  } catch (error) {
    console.error('Error submitting onboarding request:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while submitting the request');
  }
}

/**
 * Get the status of an onboarding request
 * @param requestId - The unique request ID
 * @returns Promise with the status response
 * @throws Error if the request fails
 */
export async function getOnboardingStatus(requestId: string): Promise<StatusResponse> {
  try {
    console.log('Fetching status from:', `${API_ENDPOINT}status/${requestId}`);
    
    const response = await fetch(`${API_ENDPOINT}status/${requestId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Status response:', response.status);
    const responseData = await response.json();
    console.log('Status data:', responseData);
    
    // API returns data directly, not wrapped in body
    const body = responseData;

    if (!response.ok) {
      throw new Error(body.error || body.message || 'Failed to fetch onboarding status');
    }

    return body as StatusResponse;
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while fetching the status');
  }
}
