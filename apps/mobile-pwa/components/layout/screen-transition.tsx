"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface ScreenTransitionProps {
  children: ReactNode;
}

export function ScreenTransition({ children }: ScreenTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-3"
    >
      {children}
    </motion.div>
  );
}
