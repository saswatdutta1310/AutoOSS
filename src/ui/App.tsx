import React from "react";

export interface AppProps {
  issueUrl?: string;
}

export const App: React.FC<AppProps> = ({ issueUrl }) => {
  return (
    <div>
      <h1>AutoOSS Dashboard</h1>
      <p>Target Issue: {issueUrl || "None"}</p>
    </div>
  );
};

export default App;
