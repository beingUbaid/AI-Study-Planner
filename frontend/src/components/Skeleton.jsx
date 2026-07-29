import React from 'react';

export const SkeletonText = ({ className = 'h-4 w-full' }) => {
  return (
    <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700/50 ${className}`} />
  );
};

export const SkeletonCard = ({ className = 'h-32' }) => {
  return (
    <div className={`animate-pulse rounded-2xl bg-gray-200/50 dark:bg-gray-800/30 backdrop-blur-md border border-gray-200/20 dark:border-gray-700/10 p-6 ${className}`}>
      <div className="h-6 w-1/3 bg-gray-300 dark:bg-gray-700 rounded mb-4" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-2/3" />
      </div>
    </div>
  );
};

export const SkeletonList = ({ count = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-800/30 border border-gray-200/25 dark:border-gray-700/15">
          <div className="flex items-center space-x-3 w-2/3">
            <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full flex-shrink-0" />
            <div className="space-y-2 w-full">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3" />
            </div>
          </div>
          <div className="h-8 w-20 bg-gray-300 dark:bg-gray-700 rounded-lg" />
        </div>
      ))}
    </div>
  );
};
