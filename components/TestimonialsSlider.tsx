'use client';
import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import react-slick so it only runs client-side
const Slider = dynamic(() => import('react-slick'), { ssr: false });

// Import the slick CSS in the client component
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

// Optional: custom arrow components
function NextArrow({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute right-4 bottom-4 z-10 bg-black/50 hover:bg-black/70 text-white
                 p-3 rounded-full focus:outline-none transition"
      aria-label="Next"
    >
      {/* Simple SVG Arrow */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 transform rotate-[-90deg]"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M9.293 15.707a1 1 0 010-1.414L12.586 11H3a1 1 0 110-2h9.586L9.293 5.707a1 1 0 111.414-1.414l4.999 4.999a1 1 0 010 1.414l-4.999 4.999a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

function PrevArrow({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute left-4 bottom-4 z-10 bg-black/50 hover:bg-black/70 text-white
                 p-3 rounded-full focus:outline-none transition"
      aria-label="Previous"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 transform rotate-90"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M9.293 15.707a1 1 0 010-1.414L12.586 11H3a1 1 0 110-2h9.586L9.293 5.707a1 1 0 111.414-1.414l4.999 4.999a1 1 0 010 1.414l-4.999 4.999a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

export default function TestimonialsSlider() {
  // Carousel settings
  const settings = {
    dots: true,
    infinite: true,
    speed: 600,
    fade: false, // crossfade effect
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    pauseOnHover: true,
    // enable arrow buttons
    arrows: true,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
  };

  // Example data for each testimonial
  const testimonials = [
    {
      name: 'Sarah L.',
      role: 'Investment Analyst',
      quote: `This platform has completely transformed how we approach due diligence.
              The AI insights are unparalleled!`,
      image: '/images/testimonial-1.jpg', // replace with a real image path
    },
    {
      name: 'James K.',
      role: 'Portfolio Manager',
      quote: `We’ve saved countless hours thanks to the automated document processing.
              Highly recommend it!`,
      image: '/images/testimonial-2.jpg',
    },
    {
      name: 'Emily T.',
      role: 'Managing Director',
      quote: `The support team is amazing, and the platform is intuitive. 
              It’s been a game-changer for our firm.`,
      image: '/images/testimonial-3.jpg',
    },
  ];

  return (
    <Slider {...settings} className="relative">
      {testimonials.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center justify-center min-h-[400px] md:min-h-[500px]
                     bg-cover bg-center bg-no-repeat
                     text-white relative"
          style={{ backgroundImage: `url(${item.image})` }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-20" />

          {/* Content */}
          <div className="relative z-10 max-w-2xl mx-4 p-6 
                          rounded-lg animate-fadeInUp
                          bg-black/50 md:bg-transparent 
                          md:backdrop-blur-sm
                          text-center md:text-left">
            <blockquote className="italic text-lg md:text-xl mb-4">
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <p className="font-semibold text-sm md:text-base">
              — {item.name}, {item.role}
            </p>
          </div>
        </div>

      ))}
    </Slider>
  );
}
