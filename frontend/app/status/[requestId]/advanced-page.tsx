'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// This is the ADVANCED status page showing all three groundbreaking features

export default function AdvancedStatusPage() {
  const params = useParams();
  const requestId = params?.requestId as string;
  const [loading, setLoading] = useState(true);
  
  // Mock data for demo - in production, fetch from API
  const mockData = {
    vendorName: "TechCorp Solutions",
    status: "MANUAL_REVIEW",
    comprehensiveRisk: 0.67,
    
    // Individual scores
    networkRisk: 0.75,
    entityRisk: 0.45,
    behavioralRisk: 0.60,
    fraudRisk: 0.35,
    contentRisk: 0.25,
    
    // Network Analysis
    networkAnalysis: {
      ipClustering: {
        detected: true,
        count: 3,
        ip: "192.168.1.100"
      },
      textSimilarity: {
        detected: true,
        matches: 2,
        maxSimilarity: 0.87
      },
      graph: {
        nodes: 4,
        edges: 3
      }
    },
    
    // Entity Resolution
    entityResolution: {
      sanctionsMatch: false,
      watchlistMatches: [],
      jurisdictionRisk: "LOW",
      complianceStatus: "CLEAR",
      extractedEntities: [
        { text: "TechCorp", type: "ORGANIZATION", score: 0.95 },
        { text: "United States", type: "LOCATION", score: 0.92 }
      ]
    },
    
    // Behavioral Analysis
    behavioralAnalysis: {
      anomalies: [
        { type: "TIMING", severity: "LOW", description: "Submission outside business hours" },
        { type: "DATA_QUALITY", severity: "MEDIUM", description: "Description unusually brief" }
      ],
      botDetection: {
        detected: false,
        confidence: "LOW"
      }
    }
  };
  
  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <p className="text-xl text-gray-600">Running Advanced AI Analysis...</p>
          <p className="text-sm text-gray-500 mt-2">Network • Entity • Behavioral</p>
        </div>
      </div>
    );
  }
  
  const getRiskColor = (score: number) => {
    if (score >= 0.7) return 'text-red-600';
    if (score >= 0.4) return 'text-yellow-600';
    return 'text-green-600';
  };
  
  const getRiskBg = (score: number) => {
    if (score >= 0.7) return 'bg-red-50';
    if (score >= 0.4) return 'bg-yellow-50';
    return 'bg-green-50';
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-4 mb-2">
            Advanced KYC Analysis
          </h1>
          <p className="text-gray-600">
            Multi-Signal Risk Intelligence • Network-Aware • Real-Time
          </p>
        </div>
        
        {/* Comprehensive Risk Score */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Comprehensive Risk Assessment
            </h2>
            <div className={`inline-block ${getRiskBg(mockData.comprehensiveRisk)} rounded-full px-8 py-4 mb-4`}>
              <div className={`text-5xl font-bold ${getRiskColor(mockData.comprehensiveRisk)}`}>
                {(mockData.comprehensiveRisk * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Combined Risk Score</div>
            </div>
            <div className={`inline-block px-6 py-2 rounded-full font-semibold ${
              mockData.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
              mockData.status === 'MANUAL_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {mockData.status.replace('_', ' ')}
            </div>
          </div>
        </div>
        
        {/* Three Groundbreaking Features */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Network Analysis */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Network Analysis</h3>
                <p className="text-sm text-gray-500">Fraud Ring Detection</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Risk Score</span>
                <span className={`text-sm font-semibold ${getRiskColor(mockData.networkRisk)}`}>
                  {(mockData.networkRisk * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    mockData.networkRisk >= 0.7 ? 'bg-red-600' :
                    mockData.networkRisk >= 0.4 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${mockData.networkRisk * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-2">
              {mockData.networkAnalysis.ipClustering.detected && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-red-800">IP Clustering Detected</p>
                      <p className="text-xs text-red-600">
                        {mockData.networkAnalysis.ipClustering.count} vendors from same IP
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {mockData.networkAnalysis.textSimilarity.detected && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-yellow-800">Text Plagiarism</p>
                      <p className="text-xs text-yellow-600">
                        {mockData.networkAnalysis.textSimilarity.matches} similar descriptions
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Network Graph:</span> {mockData.networkAnalysis.graph.nodes} nodes, {mockData.networkAnalysis.graph.edges} connections
                </p>
              </div>
            </div>
          </div>
          
          {/* Entity Resolution */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Entity Resolution</h3>
                <p className="text-sm text-gray-500">Sanctions Screening</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Risk Score</span>
                <span className={`text-sm font-semibold ${getRiskColor(mockData.entityRisk)}`}>
                  {(mockData.entityRisk * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    mockData.entityRisk >= 0.7 ? 'bg-red-600' :
                    mockData.entityRisk >= 0.4 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${mockData.entityRisk * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className={`border rounded-lg p-3 ${
                mockData.entityResolution.sanctionsMatch ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <p className={`text-sm font-semibold ${
                  mockData.entityResolution.sanctionsMatch ? 'text-red-800' : 'text-green-800'
                }`}>
                  {mockData.entityResolution.sanctionsMatch ? '🚨 Sanctions Match' : '✅ No Sanctions Match'}
                </p>
                <p className={`text-xs ${
                  mockData.entityResolution.sanctionsMatch ? 'text-red-600' : 'text-green-600'
                }`}>
                  OFAC SDN List Screening
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-800 mb-2">Extracted Entities:</p>
                {mockData.entityResolution.extractedEntities.map((entity, idx) => (
                  <div key={idx} className="text-xs text-blue-600 mb-1">
                    • {entity.text} ({entity.type}) - {(entity.score * 100).toFixed(0)}% confidence
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">Compliance:</span> {mockData.entityResolution.complianceStatus}
                </p>
              </div>
            </div>
          </div>
          
          {/* Behavioral Analysis */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Behavioral Analysis</h3>
                <p className="text-sm text-gray-500">Anomaly Detection</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Risk Score</span>
                <span className={`text-sm font-semibold ${getRiskColor(mockData.behavioralRisk)}`}>
                  {(mockData.behavioralRisk * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    mockData.behavioralRisk >= 0.7 ? 'bg-red-600' :
                    mockData.behavioralRisk >= 0.4 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${mockData.behavioralRisk * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-2">
              {mockData.behavioralAnalysis.anomalies.map((anomaly, idx) => (
                <div key={idx} className={`border rounded-lg p-3 ${
                  anomaly.severity === 'HIGH' ? 'bg-red-50 border-red-200' :
                  anomaly.severity === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <p className={`text-sm font-semibold ${
                    anomaly.severity === 'HIGH' ? 'text-red-800' :
                    anomaly.severity === 'MEDIUM' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {anomaly.type.replace('_', ' ')}
                  </p>
                  <p className={`text-xs ${
                    anomaly.severity === 'HIGH' ? 'text-red-600' :
                    anomaly.severity === 'MEDIUM' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {anomaly.description}
                  </p>
                </div>
              ))}
              
              <div className={`border rounded-lg p-3 ${
                mockData.behavioralAnalysis.botDetection.detected ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <p className={`text-sm font-semibold ${
                  mockData.behavioralAnalysis.botDetection.detected ? 'text-red-800' : 'text-green-800'
                }`}>
                  {mockData.behavioralAnalysis.botDetection.detected ? '🤖 Bot Detected' : '✅ Human Behavior'}
                </p>
                <p className={`text-xs ${
                  mockData.behavioralAnalysis.botDetection.detected ? 'text-red-600' : 'text-green-600'
                }`}>
                  {mockData.behavioralAnalysis.botDetection.confidence} confidence
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-4">
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
