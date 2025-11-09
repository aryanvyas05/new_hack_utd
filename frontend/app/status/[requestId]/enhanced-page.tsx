'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface RiskAnalysis {
  requestId: string;
  vendorName: string;
  overallRiskScore: number;
  riskLevel: string;
  fraudScore?: number;
  networkRiskScore?: number;
  entityRiskScore?: number;
  behavioralRiskScore?: number;
  paymentRiskScore?: number;
  legalRiskScore?: number;
  trustScore?: number;
  riskFactors?: string[];
  trustSignals?: any;
  paymentInsights?: any[];
  legalIssues?: any[];
  legalStatus?: string;
  reliabilityRating?: string;
  timestamp?: string;
}

const COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#991b1b'
};

const RISK_COLORS = ['#10b981', '#34d399', '#fbbf24', '#f59e0b', '#ef4444', '#dc2626'];

export default function EnhancedStatusPage({ params }: { params: { requestId: string } }) {
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchStatus();
  }, [params.requestId]);

  const fetchStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const response = await fetch(`${apiUrl}/status/${params.requestId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Request not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.8) return COLORS.critical;
    if (score >= 0.6) return COLORS.high;
    if (score >= 0.4) return COLORS.medium;
    return COLORS.low;
  };

  const getRiskLabel = (score: number) => {
    if (score >= 0.8) return 'Critical';
    if (score >= 0.6) return 'High';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  };

  // Prepare pie chart data for risk distribution
  const getRiskDistributionData = () => {
    if (!analysis) return [];
    
    return [
      { name: 'Fraud Risk', value: (analysis.fraudScore || 0) * 100, color: RISK_COLORS[0] },
      { name: 'Network Risk', value: (analysis.networkRiskScore || 0) * 100, color: RISK_COLORS[1] },
      { name: 'Entity Risk', value: (analysis.entityRiskScore || 0) * 100, color: RISK_COLORS[2] },
      { name: 'Behavioral Risk', value: (analysis.behavioralRiskScore || 0) * 100, color: RISK_COLORS[3] },
      { name: 'Payment Risk', value: (analysis.paymentRiskScore || 0) * 100, color: RISK_COLORS[4] },
      { name: 'Legal Risk', value: (analysis.legalRiskScore || 0) * 100, color: RISK_COLORS[5] },
    ].filter(item => item.value > 0);
  };

  // Prepare trust vs risk pie chart
  const getTrustVsRiskData = () => {
    if (!analysis) return [];
    
    const trustScore = (analysis.trustScore || 0) * 100;
    const riskScore = (analysis.overallRiskScore || 0) * 100;
    
    return [
      { name: 'Trust Score', value: trustScore, color: '#10b981' },
      { name: 'Risk Score', value: riskScore, color: '#ef4444' },
    ];
  };

  // Prepare bar chart data for all risk factors
  const getRiskFactorsBarData = () => {
    if (!analysis) return [];
    
    return [
      { name: 'Fraud', score: (analysis.fraudScore || 0) * 100 },
      { name: 'Network', score: (analysis.networkRiskScore || 0) * 100 },
      { name: 'Entity', score: (analysis.entityRiskScore || 0) * 100 },
      { name: 'Behavioral', score: (analysis.behavioralRiskScore || 0) * 100 },
      { name: 'Payment', score: (analysis.paymentRiskScore || 0) * 100 },
      { name: 'Legal', score: (analysis.legalRiskScore || 0) * 100 },
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing vendor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-red-600 text-xl font-bold mb-4">Error</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const riskDistributionData = getRiskDistributionData();
  const trustVsRiskData = getTrustVsRiskData();
  const riskFactorsBarData = getRiskFactorsBarData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {analysis.vendorName}
              </h1>
              <p className="text-gray-600">Request ID: {analysis.requestId}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-2">Overall Risk Score</div>
              <div 
                className="text-5xl font-bold"
                style={{ color: getRiskColor(analysis.overallRiskScore) }}
              >
                {(analysis.overallRiskScore * 100).toFixed(0)}
              </div>
              <div 
                className="text-lg font-semibold mt-1"
                style={{ color: getRiskColor(analysis.overallRiskScore) }}
              >
                {getRiskLabel(analysis.overallRiskScore)} Risk
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1: Risk Distribution & Trust vs Risk */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Risk Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Risk Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Trust vs Risk Pie Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Trust vs Risk</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={trustVsRiskData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {trustVsRiskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: All Risk Factors */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Risk Factors Breakdown</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={riskFactorsBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Risk Score (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Bar dataKey="score" fill="#6366f1">
                {riskFactorsBarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getRiskColor(entry.score / 100)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Scores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <ScoreCard
            title="Fraud Detection"
            score={analysis.fraudScore || 0}
            icon="🔍"
          />
          <ScoreCard
            title="Network Analysis"
            score={analysis.networkRiskScore || 0}
            icon="🕸️"
          />
          <ScoreCard
            title="Entity Resolution"
            score={analysis.entityRiskScore || 0}
            icon="🏢"
          />
          <ScoreCard
            title="Behavioral Analysis"
            score={analysis.behavioralRiskScore || 0}
            icon="📊"
          />
          <ScoreCard
            title="Payment History"
            score={analysis.paymentRiskScore || 0}
            icon="💳"
            subtitle={analysis.reliabilityRating}
          />
          <ScoreCard
            title="Legal Records"
            score={analysis.legalRiskScore || 0}
            icon="⚖️"
            subtitle={analysis.legalStatus}
          />
        </div>

        {/* Payment Insights */}
        {analysis.paymentInsights && analysis.paymentInsights.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💳 Payment Insights</h2>
            <div className="space-y-3">
              {analysis.paymentInsights.map((insight, index) => (
                <div key={index} className="border-l-4 pl-4 py-2" style={{
                  borderColor: insight.risk === 'HIGH' ? COLORS.high : 
                               insight.risk === 'MEDIUM' ? COLORS.medium : COLORS.low
                }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900">{insight.type}</div>
                      <div className="text-gray-600 text-sm">{insight.message}</div>
                    </div>
                    <div className="text-sm font-medium" style={{
                      color: insight.risk === 'HIGH' ? COLORS.high : 
                             insight.risk === 'MEDIUM' ? COLORS.medium : COLORS.low
                    }}>
                      {insight.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legal Issues */}
        {analysis.legalIssues && analysis.legalIssues.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">⚖️ Legal Issues Detected</h2>
            <div className="space-y-3">
              {analysis.legalIssues.slice(0, 10).map((issue, index) => (
                <div key={index} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{issue.category}</div>
                      {issue.keyword && (
                        <div className="text-sm text-gray-600 mt-1">
                          Keyword: <span className="font-medium">{issue.keyword}</span>
                        </div>
                      )}
                      {issue.context && (
                        <div className="text-sm text-gray-500 mt-1 italic">
                          {issue.context}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-red-600 ml-4">
                      Severity: {(issue.severity * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trust Signals */}
        {analysis.trustSignals && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔒 Trust Signals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(analysis.trustSignals).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className={`font-semibold ${value ? 'text-green-600' : 'text-red-600'}`}>
                    {value ? '✓ Pass' : '✗ Fail'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {analysis.riskFactors && analysis.riskFactors.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">⚠️ Risk Factors</h2>
            <div className="flex flex-wrap gap-2">
              {analysis.riskFactors.map((factor, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                >
                  {factor.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 font-semibold"
          >
            New Analysis
          </button>
          <button
            onClick={fetchStatus}
            className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ title, score, icon, subtitle }: { 
  title: string; 
  score: number; 
  icon: string;
  subtitle?: string;
}) {
  const getRiskColor = (score: number) => {
    if (score >= 0.8) return '#991b1b';
    if (score >= 0.6) return '#ef4444';
    if (score >= 0.4) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span 
          className="text-3xl font-bold"
          style={{ color: getRiskColor(score) }}
        >
          {(score * 100).toFixed(0)}
        </span>
      </div>
      <div className="text-gray-900 font-semibold">{title}</div>
      {subtitle && (
        <div className="text-sm text-gray-600 mt-1">{subtitle}</div>
      )}
      <div className="mt-3 bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{
            width: `${score * 100}%`,
            backgroundColor: getRiskColor(score)
          }}
        />
      </div>
    </div>
  );
}
