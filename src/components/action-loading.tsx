"use client";

export default function ActionLoading() {
  return (
    <div className="action-loading-overlay" aria-live="assertive" aria-label="Saving changes">
      <div className="action-loading-card">
        <span className="action-spinner" aria-hidden="true" />
        <div>
          <strong>Working on it</strong>
          <span>Please wait a moment.</span>
        </div>
      </div>
    </div>
  );
}
