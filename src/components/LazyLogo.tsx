import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

interface LazyLogoProps {
  src?: string;
  alt?: string;
  className?: string;
  size?: number;
}

export default function LazyLogo({ src, alt = "", className = "", size = 16 }: LazyLogoProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const normalizedSrc = React.useMemo(() => {
    if (!src) return '';
    if (src.startsWith('/public/images/logos/')) {
      return src.replace('/public/images/logos/', 'https://img.7fun7-api.online/');
    }
    if (src.includes('7fun7.promo/public/images/logos/')) {
      return src.replace(/https?:\/\/7fun7\.promo\/public\/images\/logos\//, 'https://img.7fun7-api.online/');
    }
    return src;
  }, [src]);

  useEffect(() => {
    if (!normalizedSrc) return;
    
    const img = new Image();
    img.src = normalizedSrc;
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
  }, [normalizedSrc]);

  const sizeStyle = size !== 16 ? { width: size, height: size } : undefined;

  if (!normalizedSrc || error) {
    return (
      <div className={`flex items-center justify-center bg-white/5 rounded-full flex-shrink-0 ${className}`} style={sizeStyle}>
        <Trophy size={size * 0.6} className="text-white/20" />
      </div>
    );
  }

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={sizeStyle}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5 rounded-full animate-pulse">
          <Trophy size={size * 0.6} className="text-white/20" />
        </div>
      )}
      <img
        src={normalizedSrc}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
