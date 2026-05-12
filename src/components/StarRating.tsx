import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // The average or static rating (0-5)
  size?: number; // Icon size
  interactive?: boolean; // Whether the user can click to score
  onRatingChange?: (rating: number) => void;
  className?: string; // Optional wrapper class
}

export default function StarRating({ 
  rating, 
  size = 16, 
  interactive = false, 
  onRatingChange,
  className = ''
}: StarRatingProps) {
  
  const renderStar = (index: number) => {
    // Determine fill percentage
    const fill = Math.max(0, Math.min(1, rating - index));
    const isInteractiveStyle = interactive ? 'cursor-pointer hover:scale-110 transition-transform' : '';
    
    return (
      <div 
        key={index} 
        className={`relative inline-block ${isInteractiveStyle}`}
        onClick={() => interactive && onRatingChange?.(index + 1)}
      >
        {/* Background Star (Gray) */}
        <Star size={size} className="text-gray-300" />
        
        {/* Foreground Star (Yellow) with dynamic width based on fill */}
        <div 
          className="absolute top-0 left-0 overflow-hidden" 
          style={{ width: `${fill * 100}%` }}
        >
          <Star size={size} className="text-yellow-400 fill-yellow-400" />
        </div>
      </div>
    );
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {[0, 1, 2, 3, 4].map(renderStar)}
    </div>
  );
}
