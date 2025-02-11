'use client';

import { useEffect, useState } from 'react';

export default function AlphyAnimation() {
  const [letters, setLetters] = useState<string[]>([]);

  useEffect(() => {
    // Split the word "Alphy" into individual letters
    const word = 'Alphy'.split('');

    // Animate each letter with a delay
    word.forEach((letter, index) => {
      setTimeout(() => {
        setLetters((prevLetters) => [...prevLetters, letter]);
      }, index * 150); // Reduced delay for faster animation
    });
  }, []);

  return (
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">
          {letters.map((letter, index) => (
            <span
              key={index}
              className="inline-block animate-bounce-in"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {letter}
            </span>
          ))}
        </h1>
  );
}