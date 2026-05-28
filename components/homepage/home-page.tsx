'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Zap, BarChart3, Wifi } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8 },
  },
};

export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32"
        >
          {/* Badges */}
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 backdrop-blur-sm">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">
                IoT Aquaculture Monitoring
              </span>
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                MoltSense
              </span>
              <br />
              <span className="text-3xl sm:text-4xl lg:text-5xl text-slate-400">
                Smart Molt Detection System
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Eliminating 24/7 manual monitoring in soft-shell crab aquaculture through precision
              IoT sensing — increasing farm yield, reducing labor cost, and delivering soft-shell
              crabs to market at peak quality.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-bold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all flex items-center gap-2 justify-center"
              >
                Enter Dashboard
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
            <Link href="/undiscovered">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 border border-cyan-500/50 text-cyan-300 font-bold rounded-lg hover:bg-cyan-500/10 transition-all flex items-center gap-2 justify-center"
              >
                Add Device
                <Wifi className="w-5 h-5" />
              </motion.button>
            </Link>
          </motion.div>

          {/* Feature Grid */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20"
          >
            {[
              {
                icon: <Zap className="w-8 h-8" />,
                title: 'Real-Time Monitoring',
                description:
                  'Live cell status, pressure, moisture, and temperature readings from every sensor pod.',
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: 'Farm Analytics',
                description:
                  'Predictive insights on optimal feeding cycles, molt frequency trends, and farm-level performance.',
              },
              {
                icon: <Wifi className="w-8 h-8" />,
                title: 'Seamless Integration',
                description:
                  'Easy device discovery, registration, and management through the intuitive web interface.',
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                className="p-6 rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-700/50 border border-cyan-500/20 hover:border-cyan-500/50 transition-colors"
              >
                <div className="text-cyan-400 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* Product Overview */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-cyan-500/20"
        >
          <motion.h2
            variants={itemVariants}
            className="text-4xl sm:text-5xl font-bold text-center mb-16 bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent"
          >
            What&apos;s in the Box?
          </motion.h2>

          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {[
              {
                title: 'Cell Sensor Pod',
                description:
                  'Snap-in unit per crab cell. Reads pressure, moisture & bio-impedance simultaneously. Waterproof, food-safe housing.',
              },
              {
                title: 'Hub Controller',
                description:
                  'One hub per rack. Aggregates 48 cell sensors, preprocesses signals, transmits via LoRa or WiFi to the cloud.',
              },
              {
                title: 'MoltSense App',
                description:
                  'Web application dashboard showing live cell status, molt history, farm-level analytics, and push alerts.',
              },
              {
                title: 'Database Persistence',
                description:
                  'Stores molt timing per cell, enables predictive insights: optimal feeding cycles and molt frequency trends.',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="p-8 rounded-lg border-l-4 border-cyan-400 bg-gradient-to-r from-slate-800/50 to-transparent hover:from-slate-800/80 transition-colors"
              >
                <h3 className="text-2xl font-bold text-slate-100 mb-3">
                  {item.title}
                </h3>
                <p className="text-slate-300 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      </div>
    </div>
  );
}
