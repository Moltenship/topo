export interface GithubReleaseSource {
  readonly type: "github-release";
  readonly owner: string;
  readonly repo: string;
  readonly tag: string;
  readonly assetName: string;
}

export interface DirectDownloadSource {
  readonly type: "direct-url";
  readonly url: string;
}

export interface HuggingFaceFileSource {
  readonly type: "huggingface-file";
  readonly repo: string;
  readonly revision: string;
  readonly filePath: string;
}

export interface HuggingFaceSnapshotSource {
  readonly type: "huggingface-snapshot";
  readonly repo: string;
  readonly revision: string;
  readonly subfolder: string;
}

export interface LocalFileSource {
  readonly type: "local-file";
  readonly relativePath: string;
}

export type DownloadSource =
  | GithubReleaseSource
  | DirectDownloadSource
  | HuggingFaceFileSource
  | HuggingFaceSnapshotSource
  | LocalFileSource;

const encodePathSegment = (segment: string): string =>
  encodeURIComponent(segment).replaceAll("%2F", "/");

export const resolveDownloadSourceUrl = (source: DownloadSource): string => {
  if (source.type === "direct-url") {
    return source.url;
  }

  if (source.type === "huggingface-file") {
    return `https://huggingface.co/${encodePathSegment(source.repo)}/resolve/${encodeURIComponent(
      source.revision,
    )}/${encodePathSegment(source.filePath)}`;
  }

  if (source.type === "huggingface-snapshot") {
    return `https://huggingface.co/${encodePathSegment(source.repo)}/tree/${encodeURIComponent(
      source.revision,
    )}/${encodePathSegment(source.subfolder)}`;
  }

  if (source.type === "local-file") {
    return `local-file://${encodePathSegment(source.relativePath)}`;
  }

  return `https://github.com/${encodePathSegment(source.owner)}/${encodePathSegment(
    source.repo,
  )}/releases/download/${encodeURIComponent(source.tag)}/${encodeURIComponent(source.assetName)}`;
};
