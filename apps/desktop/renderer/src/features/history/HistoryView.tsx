const demoTranscripts = [
  { id: "1", text: "Hello world", createdAt: "2026-05-07 09:00" },
  { id: "2", text: "Privet mir", createdAt: "2026-05-07 09:05" },
];

export const HistoryView = () => {
  return (
    <section className="history-panel">
      <div className="section-heading">
        <p className="eyebrow">Local history</p>
        <h2>Recent transcripts</h2>
      </div>
      <input className="search-input" placeholder="Search transcripts" />
      <div className="history-list">
        {demoTranscripts.map((item) => (
          <article className="history-item" key={item.id}>
            <p>{item.text}</p>
            <time>{item.createdAt}</time>
          </article>
        ))}
      </div>
    </section>
  );
};
