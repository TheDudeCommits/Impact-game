import NEUTRAL from './fixtures/voiceFileNames.json';

export const voiceFile = (file: string) => (NEUTRAL as Record<string, string>)[file] ?? file;
