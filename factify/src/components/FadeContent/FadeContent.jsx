import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import './FadeContent.css';

const FadeContent = ({
  children,
  blur = false,
  duration = 2000,
  ease = 'power2.out',
  delay = 0,
  initialOpacity = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = 'power2.in',
  onComplete,
  onDisappearanceComplete,
  className = '',
  style,
  ...props
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const getSeconds = val => (typeof val === 'number' && val > 10 ? val / 1000 : val);

    const tl = gsap.timeline({
      delay: getSeconds(delay),
      onComplete: () => {
        if (onComplete) onComplete();
        if (disappearAfter > 0) {
          gsap.to(el, {
            autoAlpha: initialOpacity,
            filter: blur ? 'blur(10px)' : 'blur(0px)',
            delay: getSeconds(disappearAfter),
            duration: getSeconds(disappearDuration),
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.()
          });
        }
      }
    });

    tl.to(el, {
      autoAlpha: 1,
      filter: 'blur(0px)',
      duration: getSeconds(duration),
      ease: ease
    });

    return () => {
      tl.kill();
      gsap.killTweensOf(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div 
      ref={ref} 
      className={`fade-content-initial ${className}`} 
      style={style} 
      {...props}
    >
      {children}
    </div>
  );
};

export default FadeContent;
