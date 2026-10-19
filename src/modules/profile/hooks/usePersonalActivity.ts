import { limit, orderBy } from 'firebase/firestore';
import { useCollection } from '../../../common/hooks/useCollection';
import { Reminder } from '../../calendar/types';
import { JobApplication, TailoredDoc } from '../../jobSearch/types';
import { SocialDraft } from '../../social/types';

// Raw inputs for the activity log and momentum summary.
export function usePersonalActivity(uid: string) {
  const drafts = useCollection<SocialDraft>(`personal/${uid}/socialDrafts`, [orderBy('createdAt', 'desc'), limit(60)], 'recent60');
  const applications = useCollection<JobApplication>(`personal/${uid}/jobApplications`, [orderBy('appliedDate', 'desc'), limit(60)], 'recent60');
  const tailored = useCollection<TailoredDoc>(`personal/${uid}/tailoredDocs`, [orderBy('createdAt', 'desc'), limit(20)], 'recent20');
  const reminders = useCollection<Reminder>(`personal/${uid}/reminders`);
  const all = [drafts, applications, tailored, reminders];
  return {
    drafts: drafts.data,
    applications: applications.data,
    tailored: tailored.data,
    reminders: reminders.data,
    loading: all.some(r => r.loading),
    error: all.find(r => r.error)?.error || null,
  };
}
