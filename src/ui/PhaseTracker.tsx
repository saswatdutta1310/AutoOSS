import React from "react";

export interface PhaseTrackerProps {
  currentPhase: string;
  status: "idle" | "in-progress" | "success" | "error";
}

export const PhaseTracker: React.FC<PhaseTrackerProps> = ({ currentPhase, status }) => {
  return (
    <div>
      <span>Phase: {currentPhase}</span> - <span>Status: {status}</span>
    </div>
  );
};

export default PhaseTracker;
