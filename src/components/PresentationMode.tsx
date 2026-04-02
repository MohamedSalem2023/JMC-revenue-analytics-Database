import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Play, Pause, Maximize2 } from "lucide-react";
import { DashboardStats } from "../types";
import { cn } from "../lib/utils";
import { DashboardChart } from "./Charts";
import { KPICard } from "./KPICard";

interface PresentationModeProps {
  stats: DashboardStats;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({ stats, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const slides = [
    {
      title: "Executive Summary",
      content: (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <KPICard title="Total Revenue" value={`SAR ${stats.totalRevenue.toLocaleString()}`} className="h-48" />
          <KPICard title="B2B Revenue" value={`SAR ${stats.b2bRevenue.toLocaleString()}`} className="h-48" />
          <KPICard title="B2C Revenue" value={`SAR ${stats.b2cRevenue.toLocaleString()}`} className="h-48" />
          <KPICard title="Total Patients" value={stats.totalVolume} className="h-48" />
        </div>
      )
    },
    {
      title: "Revenue Trends",
      content: (
        <div className="h-[500px]">
          <DashboardChart
            title="Monthly Revenue Trend"
            type="line"
            data={Object.entries(stats.monthlyTrends).map(([name, val]: [string, any]) => ({ name, ...val }))}
            dataKeys={["b2b", "b2c"]}
          />
        </div>
      )
    },
    {
      title: "Clinic Performance",
      content: (
        <div className="h-[500px]">
          <DashboardChart
            title="Revenue by Clinic"
            type="bar"
            data={Object.entries(stats.revenueByClinic).map(([name, val]: [string, any]) => ({ name, ...val }))}
            dataKeys={["b2b", "b2c"]}
          />
        </div>
      )
    },
    {
      title: "Doctor Performance",
      content: (
        <div className="h-[500px]">
          <DashboardChart
            title="Revenue by Doctor"
            type="bar"
            data={Object.entries(stats.revenueByDoctor).map(([name, val]: [string, any]) => ({ name, ...val }))}
            dataKeys={["b2b", "b2c"]}
          />
        </div>
      )
    }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, slides.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900 flex flex-col p-12 overflow-hidden"
    >
      <div className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl text-white">
            <Maximize2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Revenue Analytics</h1>
            <p className="text-slate-400 text-sm">Executive Presentation Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col justify-center max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <h2 className="text-4xl font-bold text-white mb-12">{slides[currentSlide].title}</h2>
            {slides[currentSlide].content}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center items-center gap-8 mt-12">
        <button
          onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
          className="p-4 bg-slate-800 text-white rounded-2xl hover:bg-slate-700 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex gap-3">
          {slides.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-3 h-3 rounded-full transition-all",
                currentSlide === i ? "bg-blue-500 w-8" : "bg-slate-700"
              )}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
          className="p-4 bg-slate-800 text-white rounded-2xl hover:bg-slate-700 transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </motion.div>
  );
};
