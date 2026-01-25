import React, { useRef, useEffect } from "react";
import "./ResizableSections.css";

/**
 * Simple horizontal resizer for three sections.
 * Usage: <ResizableSections left={<A />} center={<B />} right={<C />} />
 */
export default function ResizableSections({ left, center, right }) {
  const containerRef = useRef(null);
  const leftRef = useRef(null);
  const centerRef = useRef(null);
  const rightRef = useRef(null);
  const dragState = useRef({ dragging: null, startX: 0, startWidths: [] });

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragState.current.dragging) return;
      const dx = e.clientX - dragState.current.startX;
      if (dragState.current.dragging === "left") {
        const newLeft = Math.max(120, dragState.current.startWidths[0] + dx);
        const newCenter = Math.max(120, dragState.current.startWidths[1] - dx);
        leftRef.current.style.flexBasis = `${newLeft}px`;
        centerRef.current.style.flexBasis = `${newCenter}px`;
      } else if (dragState.current.dragging === "right") {
        const newCenter = Math.max(120, dragState.current.startWidths[1] + dx);
        const newRight = Math.max(120, dragState.current.startWidths[2] - dx);
        centerRef.current.style.flexBasis = `${newCenter}px`;
        rightRef.current.style.flexBasis = `${newRight}px`;
      }
    }
    function onMouseUp() {
      dragState.current.dragging = null;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    if (dragState.current.dragging) {
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function startDrag(which, e) {
    dragState.current = {
      dragging: which,
      startX: e.clientX,
      startWidths: [
        leftRef.current.offsetWidth,
        centerRef.current.offsetWidth,
        rightRef.current.offsetWidth,
      ],
    };
  }

  return (
    <div className="resizable-sections" ref={containerRef}>
      <div className="section left" ref={leftRef}>
        {left}
      </div>
      <div
        className="resizer"
        onMouseDown={(e) => startDrag("left", e)}
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
      />
      <div className="section center" ref={centerRef}>
        {center}
      </div>
      <div
        className="resizer"
        onMouseDown={(e) => startDrag("right", e)}
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
      />
      <div className="section right" ref={rightRef}>
        {right}
      </div>
    </div>
  );
}
