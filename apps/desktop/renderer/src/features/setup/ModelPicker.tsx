import { bundledModelCatalog } from "@molten-voice/model-catalog";

export const ModelPicker = () => {
  return (
    <div className="model-grid">
      {bundledModelCatalog.map((model) => (
        <article className="model-card" key={model.id}>
          <div>
            <h2>{model.displayName}</h2>
            <p>{model.runtime}</p>
          </div>
          <dl>
            <div>
              <dt>Languages</dt>
              <dd>{model.languages.join(", ")}</dd>
            </div>
            <div>
              <dt>Memory</dt>
              <dd>{Math.round(model.estimatedMemoryBytes / 1024 / 1024 / 1024)} GB</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
};
