import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { proposalParseTemplate, proposalGenerate, proposalRenderDocx } from './proposals.js';
export { meetingProcessTranscript } from './meetings.js';
export {
  googleAuthUrl,
  googleOAuthCallback,
  googleAccountsStatus,
  googleDisconnect,
  calendarCreateEvent,
  calendarListEvents,
} from './google.js';
export { socialGenerateWeek, socialCaptionImage, jobTailor, jobRenderDocs } from './personal.js';
