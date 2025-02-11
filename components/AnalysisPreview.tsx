// components/AnalysisPreview.tsx
'use client';

import { motion } from 'framer-motion';

const bars = [
  { height: 2*40, delay: 0.2 },
  { height: 2*60, delay: 0.4 },
  { height: 2*30, delay: 0.6 },
  { height: 2*80, delay: 0.8 },
  { height: 2*50, delay: 1.0 },
];

export default function AnalysisPreview() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full"
    >
      {/* Floating Graph Animation */}
      <div className="absolute inset-0 flex items-end justify-center gap-2">
        {bars.map((bar, index) => (
          <motion.div
            key={index}
            initial={{ height: 0 }}
            animate={{ height: bar.height }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: bar.delay,
              ease: "easeInOut",
            }}
            className="w-8 bg-blue-400 rounded-t-lg shadow-lg"
          />
        ))}
      </div>

      {/* Floating Data Points */}
      <motion.div 
        className="absolute top-4 left-4 flex gap-2"
        animate={{ y: [-5, 5, -5] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div className="w-2 h-2 bg-green-400 rounded-full" />
        <div className="w-2 h-2 bg-yellow-400 rounded-full" />
        <div className="w-2 h-2 bg-red-400 rounded-full" />
      </motion.div>

    
    </motion.div>
  );
}