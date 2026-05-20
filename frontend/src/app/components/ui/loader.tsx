import { motion } from 'motion/react';
import { Truck } from 'lucide-react';

interface LoaderProps {
  text?: string;
  fullscreen?: boolean;
}

export function Loader({ text = 'Загрузка...', fullscreen = false }) {
  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-4"
    >
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Truck className="w-6 h-6 text-primary" />
          </motion.div>
        </div>
      </div>
      
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-muted-foreground font-medium"
      >
        {text}
      </motion.p>
    </motion.div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

export function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-muted rounded-xl" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded" />
        <div className="h-3 bg-muted rounded w-5/6" />
      </div>
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3 animate-pulse">
          <div className="w-10 h-10 bg-muted rounded-lg" />
          <div className="h-8 bg-muted rounded w-16" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
      ))}
    </div>
  );
}
