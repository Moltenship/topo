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

export type DownloadSource = GithubReleaseSource | DirectDownloadSource;

const encodePathSegment = (segment: string): string =>
  encodeURIComponent(segment).replaceAll("%2F", "/");

export const resolveDownloadSourceUrl = (source: DownloadSource): string => {
  if (source.type === "direct-url") {
    return source.url;
  }

  return `https://github.com/${encodePathSegment(source.owner)}/${encodePathSegment(
    source.repo,
  )}/releases/download/${encodeURIComponent(source.tag)}/${encodeURIComponent(source.assetName)}`;
};
