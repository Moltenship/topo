const bars = [18, 28, 42, 34, 50, 32, 24, 38, 20];

export const OverlayView = () => {
  return (
    <aside className="overlay-preview" aria-label="Recording overlay preview">
      <span className="recording-dot" />
      <div className="waveform" aria-hidden="true">
        {bars.map((height, index) => (
          <span key={`${height}-${index}`} style={{ height }} />
        ))}
      </div>
      <strong>Recording</strong>
    </aside>
  );
};
