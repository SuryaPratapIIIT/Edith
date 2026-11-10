/**
 * Re-export GnaniVoiceService as BolnaVoiceService for 100% backward compatibility.
 * All voice interactions (STT & TTS) are powered by Gnani AI.
 */
export * from './gnaniVoiceService';
export { gnaniVoiceService as bolnaVoiceService } from './gnaniVoiceService';
