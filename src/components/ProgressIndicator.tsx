'use client'

import { ReadinessEvaluator } from '@/lib/readinessEvaluator'

interface ProgressIndicatorProps {
  readinessScore?: import('@/lib/readinessEvaluator').ReadinessScore
  className?: string
}

export default function ProgressIndicator({ readinessScore, className = '' }: ProgressIndicatorProps) {
  if (!readinessScore) {
    return null
  }

  const status = ReadinessEvaluator.getReadinessStatus(readinessScore)
  const progressPercentage = readinessScore.overall

  const categoryProgress = Object.entries(readinessScore.categories).map(([key, value]) => ({
    name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    score: value,
    isComplete: value >= 50
  }))

  const getStatusColor = (stage: string) => {
    switch (stage) {
      case 'discovery': return 'text-red-600 bg-red-50 border-red-200'
      case 'ready': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'refinement': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getProgressBarColor = (score: number) => {
    if (score >= 70) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(status.stage)} ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Discovery Progress</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status.stage)}`}>
          {status.message}
        </span>
      </div>

      {/* Overall Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Overall Readiness</span>
          <span>{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(progressPercentage)}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Required Categories</h4>
        {categoryProgress.map((category) => (
          <div key={category.name} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${category.isComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">{category.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-16 bg-gray-200 rounded-full h-1">
                <div 
                  className={`h-1 rounded-full ${getProgressBarColor(category.score)}`}
                  style={{ width: `${category.score}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 w-8">{category.score}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Missing Information */}
      {readinessScore.missingCritical.length > 0 && (
        <div className="mt-4 p-3 bg-white bg-opacity-50 rounded">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Still Needed:</h4>
          <ul className="text-sm space-y-1">
            {readinessScore.missingCritical.map((item, index) => (
              <li key={index} className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Focus */}
      <div className="mt-3 text-sm">
        <span className="font-medium">Next Focus: </span>
        <span className="text-gray-700">{readinessScore.nextFocus}</span>
      </div>
    </div>
  )
}
