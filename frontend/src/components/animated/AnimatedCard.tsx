'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { cardVariants } from '@/lib/animations'
import { ReactNode } from 'react'

interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  hover?: boolean
  tap?: boolean
}

export default function AnimatedCard({
  children,
  hover = true,
  tap = true,
  className = '',
  ...props
}: AnimatedCardProps) {
  return (
    <motion.div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 transition-shadow ${className}`}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={hover ? 'hover' : undefined}
      whileTap={tap ? 'tap' : undefined}
      {...props}
    >
      {children}
    </motion.div>
  )
}
