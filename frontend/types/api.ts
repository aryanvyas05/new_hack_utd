// API Request/Response Types

export interface OnboardingRequest {
  vendorName: string;
  contactEmail: string;
  businessDescription: string;
  taxId: string;
}

export interface OnboardingResponse {
  requestId: string;
  status: 'SUBMITTED';
  message: string;
}

export interface AuditTrailEvent {
  timestamp: number;
  action: string;
  actor: string;
  details?: string;
}

export interface StatusResponse {
  requestId: string;
  status: 'SUBMITTED' | 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
  vendorName: string;
  contactEmail: string;
  businessDescription: string;
  createdAt: number;
  updatedAt: number;
  riskScores?: {
    fraudScore: number;
    contentRiskScore: number;
    combinedRiskScore: number;
  };
  fraudDetails?: {
    modelVersion: string;
    riskFactors: string[];
  };
  sentimentDetails?: {
    sentiment: string;
    keyPhrases: string[];
  };
  auditTrail?: AuditTrailEvent[];
  
  // GROUNDBREAKING FEATURES
  networkAnalysis?: {
    networkRiskScore: number;
    networkRiskFactors: string[];
    networkGraph?: any;
  };
  entityResolution?: {
    entityRiskScore: number;
    entityRiskFactors: string[];
    complianceStatus: string;
    matchedEntities?: any[];
    extractedEntities?: any[];
  };
  behavioralAnalysis?: {
    behavioralRiskScore: number;
    behavioralRiskFactors: string[];
    detectedAnomalies?: any[];
    behavioralProfile?: any;
  };
}

export interface ApiError {
  message: string;
  statusCode: number;
}
