import React from 'react';

const Loading = ({ message = 'Loading...', fullPage = false }) => {
  if (fullPage) {
    return (
      <div className="loading-fullpage">
        <div className="loading-spinner"></div>
        <p>{message}</p>
      </div>
    );
  }
  return (
    <div className="loading">
      <span className="loading-spinner-sm">⏳</span> {message}
    </div>
  );
};

export default Loading;
