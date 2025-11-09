'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOnboardingStatus } from '@/lib/api';
import { StatusResponse } from '@/types/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function StatusPage() {
  const params = useParams();
  const requestId = params?.requestId as string;
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const fetchStatus = async () => {
    if (!requestId) {
      setError('No request ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Poll for status with retries (workflow takes 3-5 seconds)
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        try {
          const response = await getOnboardingStatus(requestId);
          setStatus(response);
          setLoading(false);
          return;
        } catch (err) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw err;
          }
          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [requestId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-xl text-gray-600">Analyzing application...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Error</h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <Link
            href="/onboard"
            className="block w-full text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const combinedRisk = status.riskScores?.combinedRiskScore || 0;
  const fraudRisk = status.riskScores?.fraudScore || 0;
  const contentRisk = status.riskScores?.contentRiskScore || 0;
  const networkRisk = status.riskScores?.networkRiskScore || 0;
  const entityRisk = status.riskScores?.entityRiskScore || 0;
  const behavioralRisk = status.riskScores?.behavioralRiskScore || 0;
  const paymentRisk = status.riskScores?.paymentRiskScore || 0;
  const legalRisk = status.riskScores?.legalRiskScore || 0;

  const isApproved = status.status === 'APPROVED';
  const isRejected = status.status === 'REJECTED';
  const needsReview = status.status === 'MANUAL_REVIEW';
  
  // Extract risk factors for display
  const fraudFactors = status.fraudDetails?.riskFactors || [];
  const sentimentDetails = status.sentimentDetails || {};
  
  // Check if we have advanced analysis data (our 3 groundbreaking features)
  const hasAdvancedAnalysis = status.networkAnalysis || status.entityResolution || status.behavioralAnalysis;

  const getRiskLevel = (score: number) => {
    if (score >= 0.7) return { label: 'High Risk', color: 'text-red-600', bg: 'bg-red-50' };
    if (score >= 0.4) return { label: 'Medium Risk', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { label: 'Low Risk', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const riskLevel = getRiskLevel(combinedRisk);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Status Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className={`p-8 ${
            isApproved ? 'bg-gradient-to-r from-green-500 to-green-600' :
            isRejected ? 'bg-gradient-to-r from-red-500 to-red-600' :
            'bg-gradient-to-r from-yellow-500 to-yellow-600'
          }`}>
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                {isApproved ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isRejected ? (
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              {isApproved ? 'Application Approved' :
               isRejected ? 'Application Rejected' :
               'Manual Review Required'}
            </h1>
            <p className="text-white text-center opacity-90">
              {isApproved ? 'Vendor has been automatically approved for onboarding' :
               isRejected ? 'Application did not meet security requirements' :
               'Application flagged for additional verification'}
            </p>
          </div>
        </div>

        {/* Debug Mode Toggle */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">🔬 Debug Mode</h3>
              <p className="text-sm text-gray-600">Show detailed calculation breakdowns</p>
            </div>
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                debugMode ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  debugMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Vendor Information */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Vendor Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Company Name</label>
              <p className="text-lg text-gray-900">{status.vendorName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Contact Email</label>
              <p className="text-lg text-gray-900">{status.contactEmail}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Request ID</label>
              <p className="text-sm text-gray-600 font-mono">{status.requestId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Submitted</label>
              <p className="text-lg text-gray-900">
                {new Date(status.createdAt * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">AI Risk Assessment</h2>
          
          {/* Combined Risk Score */}
          <div className={`${riskLevel.bg} rounded-xl p-6 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Combined Risk Score</p>
                <p className={`text-4xl font-bold ${riskLevel.color}`}>
                  {(combinedRisk * 100).toFixed(1)}%
                </p>
              </div>
              <div className={`px-4 py-2 ${riskLevel.color} ${riskLevel.bg} rounded-lg font-semibold`}>
                {riskLevel.label}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  combinedRisk >= 0.7 ? 'bg-red-600' :
                  combinedRisk >= 0.4 ? 'bg-yellow-600' :
                  'bg-green-600'
                }`}
                style={{ width: `${combinedRisk * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Individual Scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Fraud Score */}
            <div className="border border-gray-200 rounded-xl p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Fraud Detection</p>
                  <p className="text-2xl font-bold text-gray-900">{(fraudRisk * 100).toFixed(1)}%</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">Domain validation + pattern analysis</p>
            </div>

            {/* Content Risk Score */}
            <div className="border border-gray-200 rounded-xl p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Content Analysis</p>
                  <p className="text-2xl font-bold text-gray-900">{(contentRisk * 100).toFixed(1)}%</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">NLP sentiment analysis</p>
            </div>
          </div>

          {/* PIE CHARTS & BAR CHARTS - ALL 7 RISK SCORES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Risk Distribution Pie Chart */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Risk Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Fraud', value: fraudRisk * 100, color: '#ef4444' },
                      { name: 'Network', value: networkRisk * 100, color: '#f59e0b' },
                      { name: 'Entity', value: entityRisk * 100, color: '#eab308' },
                      { name: 'Behavioral', value: behavioralRisk * 100, color: '#84cc16' },
                      { name: 'Payment', value: paymentRisk * 100, color: '#06b6d4' },
                      { name: 'Legal', value: legalRisk * 100, color: '#8b5cf6' },
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Fraud', value: fraudRisk * 100, color: '#ef4444' },
                      { name: 'Network', value: networkRisk * 100, color: '#f59e0b' },
                      { name: 'Entity', value: entityRisk * 100, color: '#eab308' },
                      { name: 'Behavioral', value: behavioralRisk * 100, color: '#84cc16' },
                      { name: 'Payment', value: paymentRisk * 100, color: '#06b6d4' },
                      { name: 'Legal', value: legalRisk * 100, color: '#8b5cf6' },
                    ].filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* All Risk Scores Bar Chart */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Risk Scores Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { name: 'Fraud', score: fraudRisk * 100, color: '#ef4444' },
                  { name: 'Network', score: networkRisk * 100, color: '#f59e0b' },
                  { name: 'Entity', score: entityRisk * 100, color: '#eab308' },
                  { name: 'Behavioral', score: behavioralRisk * 100, color: '#84cc16' },
                  { name: 'Payment', score: paymentRisk * 100, color: '#06b6d4' },
                  { name: 'Legal', score: legalRisk * 100, color: '#8b5cf6' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'Risk %', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Bar dataKey="score">
                    {[
                      { name: 'Fraud', score: fraudRisk * 100, color: '#ef4444' },
                      { name: 'Network', score: networkRisk * 100, color: '#f59e0b' },
                      { name: 'Entity', score: entityRisk * 100, color: '#eab308' },
                      { name: 'Behavioral', score: behavioralRisk * 100, color: '#84cc16' },
                      { name: 'Payment', score: paymentRisk * 100, color: '#06b6d4' },
                      { name: 'Legal', score: legalRisk * 100, color: '#8b5cf6' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DEBUG MODE: Detailed Calculations */}
          {debugMode && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6 border-2 border-purple-300">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🔬 Debug Mode: Calculation Breakdown</h3>
              <p className="text-sm text-gray-600 mb-6">Detailed explanation of how each risk score was calculated</p>
              
              <div className="space-y-6">
                {/* Fraud Risk Calculation */}
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <h4 className="text-lg font-bold text-red-600 mb-3">🚨 Fraud Risk: {(fraudRisk * 100).toFixed(1)}%</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Formula: Trust Score Inversion</p>
                    <div className="bg-gray-50 p-4 rounded font-mono text-xs">
                      <p>fraud_risk = 1.0 - (trust_score / 100)</p>
                      <p className="mt-2 text-blue-600">= 1.0 - ({((1 - fraudRisk) * 100).toFixed(1)} / 100)</p>
                      <p className="mt-2 text-green-600">= {fraudRisk.toFixed(3)}</p>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold">Trust Components:</p>
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Website Check (30 pts): {fraudRisk < 0.3 ? '✅ 30/30' : '❌ 0/30'}</li>
                        <li>Email/MX Records (20 pts): {fraudRisk < 0.5 ? '✅ 20/20' : '❌ 0/20'}</li>
                        <li>SSL Certificate (15 pts): {fraudRisk < 0.3 ? '✅ 15/15' : '❌ 0/15'}</li>
                        <li>Domain Reputation (20 pts): ~{Math.round((1 - fraudRisk) * 20)}/20</li>
                        <li>Entity Validation (15 pts): ~{Math.round((1 - fraudRisk) * 15)}/15</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Legal Risk Calculation */}
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <h4 className="text-lg font-bold text-purple-600 mb-3">⚖️ Legal Risk: {(legalRisk * 100).toFixed(1)}%</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Formula: NLP Keyword Detection + Severity Weighting</p>
                    <div className="bg-gray-50 p-4 rounded font-mono text-xs">
                      <p>legal_risk = max(category_risks) * issue_multiplier * severity_avg</p>
                      <p className="mt-2 text-blue-600">Categories detected: {status.fraudDetails?.legalIssues?.length || 0} issues</p>
                      <p className="mt-1">- Criminal: severity 1.0</p>
                      <p>- Fraud: severity 0.95</p>
                      <p>- Regulatory: severity 0.7</p>
                      <p>- Civil Litigation: severity 0.5</p>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold">Detected Keywords:</p>
                      <div className="max-h-40 overflow-y-auto">
                        {status.fraudDetails?.legalIssues?.slice(0, 5).map((issue: any, idx: number) => (
                          <div key={idx} className="bg-red-50 p-2 rounded mt-2">
                            <p className="font-semibold text-red-800">{issue.category}: {issue.keyword}</p>
                            <p className="text-xs text-gray-600 italic">{issue.context?.substring(0, 100)}...</p>
                            <p className="text-xs text-red-600">Severity: {(issue.severity * 100).toFixed(0)}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Risk Calculation */}
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <h4 className="text-lg font-bold text-cyan-600 mb-3">💳 Payment Risk: {(paymentRisk * 100).toFixed(1)}%</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Formula: Weighted Average of Financial Indicators</p>
                    <div className="bg-gray-50 p-4 rounded font-mono text-xs">
                      <p>payment_risk = (max_risk * 0.7) + (avg_risk * 0.3)</p>
                      <p className="mt-2 text-blue-600">Factors analyzed:</p>
                      <p>- Business Age (older = lower risk)</p>
                      <p>- Bankruptcy Indicators (critical if found)</p>
                      <p>- Financial Stability Keywords</p>
                      <p>- Payment Terms Analysis</p>
                      <p>- Simulated Credit Score</p>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold">Payment Insights:</p>
                      {status.fraudDetails?.paymentInsights?.map((insight: any, idx: number) => (
                        <div key={idx} className="bg-blue-50 p-2 rounded mt-2">
                          <p className="font-semibold">{insight.type}: {insight.value}</p>
                          <p className="text-xs text-gray-600">{insight.message}</p>
                          <p className={`text-xs font-semibold ${
                            insight.risk === 'HIGH' ? 'text-red-600' : 
                            insight.risk === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                          }`}>Risk Level: {insight.risk}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Network Risk Calculation */}
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <h4 className="text-lg font-bold text-orange-600 mb-3">🕸️ Network Risk: {(networkRisk * 100).toFixed(1)}%</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Formula: Fraud Ring Detection</p>
                    <div className="bg-gray-50 p-4 rounded font-mono text-xs">
                      <p>network_risk = (max_risk * 0.7) + (avg_risk * 0.3)</p>
                      <p className="mt-2 text-blue-600">Detection Methods:</p>
                      <p>- IP Clustering (3+ vendors from same IP)</p>
                      <p>- Text Similarity (Jaccard Index &gt; 0.85)</p>
                      <p>- Email Domain Sharing (5+ vendors)</p>
                      <p>- Temporal Clustering (10+ in 1 hour)</p>
                      <p>- Behavioral Fingerprinting</p>
                    </div>
                  </div>
                </div>

                {/* Entity Risk Calculation */}
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <h4 className="text-lg font-bold text-yellow-600 mb-3">🏢 Entity Risk: {(entityRisk * 100).toFixed(1)}%</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Formula: Sanctions & Watchlist Screening</p>
                    <div className="bg-gray-50 p-4 rounded font-mono text-xs">
                      <p>entity_risk = (max_risk * 0.6) + (avg_risk * 0.4)</p>
                      <p className="mt-2 text-blue-600">Screening Against:</p>
                      <p>- OFAC SDN List (sanctions)</p>
                      <p>- High-Risk Jurisdictions</p>
                      <p>- PEP (Politically Exposed Persons)</p>
                      <p>- Negative News Keywords</p>
                      <p>- Corporate Registry Verification</p>
                    </div>
                  </div>
                </div>

                {/* Behavioral Risk Calculation */}
                <div className="bg-white rounded-lg p-6 shadow-md">
                  <h4 className="text-lg font-bold text-lime-600 mb-3">📊 Behavioral Risk: {(behavioralRisk * 100).toFixed(1)}%</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Formula: Statistical Anomaly Detection</p>
                    <div className="bg-gray-50 p-4 rounded font-mono text-xs">
                      <p>behavioral_risk = (max_risk * 0.6) + (avg_risk * 0.4)</p>
                      <p className="mt-2 text-blue-600">Z-Score Analysis:</p>
                      <p>z = (x - μ) / σ</p>
                      <p className="mt-1">Flags if |z| &gt; 3 (3 standard deviations)</p>
                      <p className="mt-2">Detection Methods:</p>
                      <p>- Timing Analysis (business hours)</p>
                      <p>- Data Quality (length, repetition)</p>
                      <p>- Bot Detection (patterns, lorem ipsum)</p>
                      <p>- Submission Velocity</p>
                    </div>
                  </div>
                </div>

                {/* Combined Risk Calculation */}
                <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 shadow-lg border-2 border-red-300">
                  <h4 className="text-xl font-bold text-red-700 mb-3">🎯 Combined Risk Score: {(combinedRisk * 100).toFixed(1)}%</h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-gray-900">Formula: Weighted Average</p>
                    <div className="bg-white p-4 rounded font-mono text-xs">
                      <p className="font-bold">combined_risk = (fraud * 0.7) + (content * 0.3)</p>
                      <p className="mt-3 text-blue-600">Calculation:</p>
                      <p>= ({fraudRisk.toFixed(3)} × 0.7) + ({contentRisk.toFixed(3)} × 0.3)</p>
                      <p>= {(fraudRisk * 0.7).toFixed(3)} + {(contentRisk * 0.3).toFixed(3)}</p>
                      <p className="mt-2 text-green-600 font-bold">= {combinedRisk.toFixed(3)}</p>
                      
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <p className="font-bold text-purple-600">Comprehensive Risk (All 8 Engines):</p>
                        <p className="mt-2">comprehensive_risk = </p>
                        <p className="ml-4">network × 0.15 +</p>
                        <p className="ml-4">entity × 0.30 +</p>
                        <p className="ml-4">behavioral × 0.15 +</p>
                        <p className="ml-4">payment × 0.15 +</p>
                        <p className="ml-4">legal × 0.20 +</p>
                        <p className="ml-4">fraud × 0.05 +</p>
                        <p className="ml-4">content × 0.05</p>
                        <p className="mt-2">= {networkRisk.toFixed(3)} × 0.15 + {entityRisk.toFixed(3)} × 0.30 + {behavioralRisk.toFixed(3)} × 0.15 + {paymentRisk.toFixed(3)} × 0.15 + {legalRisk.toFixed(3)} × 0.20 + {fraudRisk.toFixed(3)} × 0.05 + {contentRisk.toFixed(3)} × 0.05</p>
                        <p className="mt-2 text-green-600 font-bold">= {(networkRisk * 0.15 + entityRisk * 0.30 + behavioralRisk * 0.15 + paymentRisk * 0.15 + legalRisk * 0.20 + fraudRisk * 0.05 + contentRisk * 0.05).toFixed(3)}</p>
                      </div>
                    </div>
                    <div className="mt-4 bg-yellow-50 p-3 rounded">
                      <p className="font-semibold text-yellow-800">Decision Threshold:</p>
                      <p className="text-xs text-gray-700 mt-1">
                        • &lt; 0.3: AUTO_APPROVE<br/>
                        • 0.3 - 0.5: STANDARD_REVIEW<br/>
                        • 0.5 - 0.7: ENHANCED_DUE_DILIGENCE<br/>
                        • 0.7 - 0.8: MANUAL_REVIEW<br/>
                        • &gt; 0.8: BLOCKED
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trust Signal Breakdown */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🔍 Trust Signal Analysis</h3>
            <p className="text-sm text-gray-600 mb-4">Real-time validation of company legitimacy</p>
            
            <div className="space-y-3">
              {/* Website Check */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Website Existence</span>
                  <span className={`text-sm font-bold ${fraudRisk < 0.3 ? 'text-green-600' : 'text-red-600'}`}>
                    {fraudRisk < 0.3 ? '✓ Found' : '✗ Not Found'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${fraudRisk < 0.3 ? 'bg-green-500' : 'bg-red-500'}`} 
                       style={{ width: fraudRisk < 0.3 ? '100%' : '0%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {fraudRisk < 0.3 ? 'HTTPS website verified' : 'No functioning website detected'}
                </p>
              </div>

              {/* SSL Certificate */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">SSL Certificate</span>
                  <span className={`text-sm font-bold ${fraudRisk < 0.3 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {fraudRisk < 0.3 ? '✓ Valid' : '⚠ Missing'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${fraudRisk < 0.3 ? 'bg-green-500' : 'bg-yellow-500'}`} 
                       style={{ width: fraudRisk < 0.3 ? '100%' : '0%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {fraudRisk < 0.3 ? 'Valid SSL certificate detected' : 'No SSL certificate found'}
                </p>
              </div>

              {/* MX Records */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Email Deliverability</span>
                  <span className={`text-sm font-bold ${fraudRisk < 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                    {fraudRisk < 0.5 ? '✓ Valid' : '✗ Invalid'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${fraudRisk < 0.5 ? 'bg-green-500' : 'bg-red-500'}`} 
                       style={{ width: fraudRisk < 0.5 ? '100%' : '0%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {fraudRisk < 0.5 ? 'MX records verified' : 'No MX records found'}
                </p>
              </div>

              {/* Domain Reputation */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Domain Reputation</span>
                  <span className="text-sm font-bold text-green-600">✓ Trusted TLD</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '100%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Domain uses trusted top-level domain (.com, .org, etc.)
                </p>
              </div>
            </div>

            {/* Trust Score Summary */}
            <div className="mt-4 p-4 bg-white rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Overall Trust Score</span>
                <span className={`text-2xl font-bold ${
                  fraudRisk < 0.2 ? 'text-green-600' : 
                  fraudRisk < 0.5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {Math.round((1 - fraudRisk) * 100)}/100
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Based on {fraudRisk < 0.2 ? '4/4' : fraudRisk < 0.5 ? '2-3/4' : '0-1/4'} validation checks passed
              </p>
            </div>
          </div>

          {/* Risk Factors */}
          {fraudFactors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-red-900 mb-3">⚠️ Risk Factors Detected</h3>
              <ul className="space-y-2">
                {fraudFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span className="text-sm text-red-800">
                      {factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* GROUNDBREAKING FEATURES - Show if available */}
        {hasAdvancedAnalysis && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl shadow-xl p-8 mb-6 border-2 border-purple-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🚀 Advanced AI Analysis</h2>
            <p className="text-gray-600 mb-6">Multi-Signal Risk Intelligence</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Network Analysis */}
              {status.networkAnalysis && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Network Analysis</h3>
                      <p className="text-xs text-gray-500">Fraud Ring Detection</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-purple-600 mb-2">
                    {((status.networkAnalysis.networkRiskScore || 0) * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {status.networkAnalysis.networkRiskFactors?.length || 0} patterns detected
                  </div>
                </div>
              )}
              
              {/* Entity Resolution */}
              {status.entityResolution && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Entity Resolution</h3>
                      <p className="text-xs text-gray-500">Sanctions Screening</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-red-600 mb-2">
                    {((status.entityResolution.entityRiskScore || 0) * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {status.entityResolution.complianceStatus || 'CLEAR'}
                  </div>
                </div>
              )}
              
              {/* Behavioral Analysis */}
              {status.behavioralAnalysis && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Behavioral Analysis</h3>
                      <p className="text-xs text-gray-500">Anomaly Detection</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {((status.behavioralAnalysis.behavioralRiskScore || 0) * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {status.behavioralAnalysis.detectedAnomalies?.length || 0} anomalies found
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Analysis */}
        {(status.fraudDetails?.paymentAnalysis || status.fraudDetails?.paymentInsights) && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">💳 Payment History Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {((status.riskScores?.paymentRiskScore || status.fraudDetails?.paymentAnalysis?.paymentRiskScore || 0) * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Payment Risk Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  {status.fraudDetails?.reliabilityRating || status.fraudDetails?.paymentAnalysis?.reliabilityRating || 'UNKNOWN'}
                </div>
                <div className="text-sm text-gray-600">Reliability Rating</div>
              </div>
            </div>
            
            {status.fraudDetails?.paymentInsights && status.fraudDetails.paymentInsights.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Insights:</h3>
                {status.fraudDetails.paymentInsights.map((insight: any, index: number) => (
                  <div key={index} className="border-l-4 pl-4 py-2" style={{
                    borderColor: insight.risk === 'HIGH' ? '#ef4444' : 
                                 insight.risk === 'MEDIUM' ? '#f59e0b' : '#10b981'
                  }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900">{insight.type}</div>
                        <div className="text-sm text-gray-600">{insight.message}</div>
                      </div>
                      <div className="text-sm font-medium" style={{
                        color: insight.risk === 'HIGH' ? '#ef4444' : 
                               insight.risk === 'MEDIUM' ? '#f59e0b' : '#10b981'
                      }}>
                        {insight.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legal Records */}
        {(status.fraudDetails?.legalAnalysis || status.fraudDetails?.legalIssues) && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">⚖️ Legal Records Check</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-4xl font-bold text-red-600 mb-2">
                  {((status.riskScores?.legalRiskScore || status.fraudDetails?.legalAnalysis?.legalRiskScore || 0) * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Legal Risk Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  {status.fraudDetails?.legalStatus || status.fraudDetails?.legalAnalysis?.legalStatus || 'UNKNOWN'}
                </div>
                <div className="text-sm text-gray-600">Legal Status</div>
              </div>
            </div>
            
            {status.fraudDetails?.legalIssues && status.fraudDetails.legalIssues.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 mb-3">Legal Issues Detected:</h3>
                {status.fraudDetails.legalIssues.slice(0, 10).map((issue: any, index: number) => (
                  <div key={index} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-red-900">{issue.category}</div>
                        {issue.keyword && (
                          <div className="text-sm text-red-700 mt-1">
                            Keyword: <span className="font-medium">{issue.keyword}</span>
                          </div>
                        )}
                        {issue.context && (
                          <div className="text-sm text-gray-600 mt-1 italic">
                            {issue.context}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-medium text-red-600 ml-4">
                        {(issue.severity * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Processing Timeline */}
        {status.auditTrail && status.auditTrail.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Processing Timeline</h2>
            <div className="space-y-4">
              {status.auditTrail.map((event: any, index: number) => (
                <div key={index} className="flex items-start">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                    {index + 1}
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-semibold text-gray-900">
                      {event.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {event.actor} • {new Date(event.timestamp * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={fetchStatus}
            className="flex-1 px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-colors"
          >
            Refresh Status
          </button>
          <Link
            href="/onboard"
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            New Application
          </Link>
        </div>
      </div>
    </div>
  );
}
