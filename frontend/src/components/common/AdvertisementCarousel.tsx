import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Advertisement } from '../../types';
import { getMediaUrl } from '../../api/client';

interface AdvertisementCarouselProps {
  advertisements: Advertisement[];
  autoSlideInterval?: number; // milliseconds, default 5000
  className?: string;
  showDetailsOverlay?: boolean;
}

export const AdvertisementCarousel: React.FC<AdvertisementCarouselProps> = ({
  advertisements = [],
  autoSlideInterval = 5000,
  className = '',
  showDetailsOverlay = true,
}) => {
  const navigate = useNavigate();
  // Filter active slides just in case
  const activeSlides = advertisements.filter((ad) => ad && ad.isActive !== false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // If no active slides exist, do NOT render any empty or broken boxes
  if (!activeSlides || activeSlides.length === 0) {
    return null;
  }

  // Adjust currentIndex if slides length changed
  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(0);
    }
  }, [activeSlides.length, currentIndex]);

  // Auto-play timer
  useEffect(() => {
    if (activeSlides.length <= 1 || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, autoSlideInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSlides.length, isHovered, autoSlideInterval]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  const handleSlideClick = (ad: Advertisement) => {
    if (!ad.redirectUrl) return;
    const url = ad.redirectUrl.trim();
    if (!url) return;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url.startsWith('/') ? url : `/${url}`);
    }
  };

  const currentAd = activeSlides[currentIndex];
  if (!currentAd) return null;

  const hasRedirect = Boolean(currentAd.redirectUrl && currentAd.redirectUrl.trim());

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl shadow-md border border-slate-200/80 bg-slate-900 group select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="Advertisement Banner"
    >
      {/* Slide Image Container */}
      <div
        className={`relative w-full aspect-[16/7] sm:aspect-[21/8] md:aspect-[24/8] lg:aspect-[24/7] min-h-[160px] sm:min-h-[220px] md:min-h-[260px] max-h-[380px] overflow-hidden ${
          hasRedirect ? 'cursor-pointer' : ''
        }`}
        onClick={() => handleSlideClick(currentAd)}
        title={hasRedirect ? `Click to visit ${currentAd.redirectUrl}` : currentAd.title}
      >
        <img
          key={currentAd.id}
          src={getMediaUrl(currentAd.imageUrl)}
          alt={currentAd.title}
          className="w-full h-full object-cover object-center transition-all duration-700 ease-out transform group-hover:scale-[1.01]"
          onError={(e) => {
            // Fallback for missing/broken images
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.src = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80';
          }}
        />

        {/* Gradient Overlay for Text Readability */}
        {showDetailsOverlay && (currentAd.title || currentAd.description) && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex flex-col justify-end p-4 sm:p-6 md:p-8">
            <div className="max-w-3xl text-white">
              {currentAd.title && (
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow-md">
                    {currentAd.title}
                  </h3>
                  {hasRedirect && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/30">
                      <span>Visit</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  )}
                </div>
              )}
              {currentAd.description && (
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-slate-200 line-clamp-2 max-w-2xl drop-shadow">
                  {currentAd.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Previous / Next Navigation Arrows (Only if > 1 slide) */}
      {activeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/80 hover:bg-white text-slate-800 backdrop-blur-md shadow-lg flex items-center justify-center transition-all duration-200 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-105 active:scale-95 z-10"
            aria-label="Previous advertisement slide"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/80 hover:bg-white text-slate-800 backdrop-blur-md shadow-lg flex items-center justify-center transition-all duration-200 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:scale-105 active:scale-95 z-10"
            aria-label="Next advertisement slide"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Pagination Dot Indicators (Only if > 1 slide) */}
      {activeSlides.length > 1 && (
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md z-10">
          {activeSlides.map((slide, idx) => (
            <button
              key={slide.id || idx}
              type="button"
              onClick={(e) => handleDotClick(e, idx)}
              className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'w-6 sm:w-8 bg-white'
                  : 'w-2 sm:w-2.5 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={idx === currentIndex ? 'true' : 'false'}
            />
          ))}
        </div>
      )}
    </div>
  );
};
