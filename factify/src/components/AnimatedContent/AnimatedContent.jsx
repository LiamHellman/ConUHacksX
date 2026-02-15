import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';

const AnimatedContent = ({
  children,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  delay = 0,
  onComplete,
  className = '',
  ...props
}) => {
  const ref = useRef(null);
  const hasAnimated = useRef(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only animate once
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const el = ref.current;
    if (!el) return;

    const axis = direction === 'horizontal' ? 'x' : 'y';
    const offset = reverse ? -distance : distance;

    // Set initial state
    gsap.set(el, {
      [axis]: offset,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
    });

    // Make visible before animating
    setIsVisible(true);

    // Animate immediately
    gsap.to(el, {
      [axis]: 0,
      scale: 1,
      opacity: 1,
      duration,
      ease,
      delay,
      onComplete
    });
  }, []); // Empty deps - only run once on mount

  return (
    <div 
      ref={ref} 
      className={className} 
      style={{ visibility: isVisible ? 'visible' : 'hidden' }} 
      {...props}
    >
      {children}
    </div>
  );
};

export default AnimatedContent;
