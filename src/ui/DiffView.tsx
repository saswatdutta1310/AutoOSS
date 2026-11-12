import React from "react";

export interface DiffViewProps {
  diff: string;
}

export const DiffView: React.FC<DiffViewProps> = ({ diff }) => {
  return (
    <pre>
      <code>{diff || "No diff available."}</code>
    </pre>
  );
};

export default DiffView;
