const MOBILE_APP_SCHEME = "bropen";

type BuildTrustedOriginsInput = {
  siteUrl: string;
};

export function buildTrustedOrigins(input: BuildTrustedOriginsInput) {
  return [input.siteUrl, `${MOBILE_APP_SCHEME}://`];
}
