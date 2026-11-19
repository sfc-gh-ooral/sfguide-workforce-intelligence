// True in the static GitHub Pages build (`npm run build:example`). That build has no server,
// so every screen uses the bundled sample data and AI panels use their scripted answers.
export const HOSTED_EXAMPLE = process.env.NEXT_PUBLIC_HOSTED_EXAMPLE === 'true';
